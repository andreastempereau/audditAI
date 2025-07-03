"""WebSocket handlers for real-time features in CrossAudit AI."""

import json
import logging
from typing import Dict, Any, Optional
from uuid import UUID

import redis.asyncio as redis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.websockets import WebSocketState

from app.core.config import get_settings
from app.core.database import get_async_session
from app.services.auth import get_current_user_websocket

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, list] = {}  # user_id -> [connection_ids]
        self.org_connections: Dict[str, list] = {}   # org_id -> [connection_ids]
    
    async def connect(self, websocket: WebSocket, connection_id: str, user_id: str, org_id: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        
        self.active_connections[connection_id] = websocket
        
        # Track by user
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(connection_id)
        
        # Track by organization
        if org_id not in self.org_connections:
            self.org_connections[org_id] = []
        self.org_connections[org_id].append(connection_id)
        
        logger.info(f"WebSocket connected: {connection_id} (user: {user_id}, org: {org_id})")
    
    def disconnect(self, connection_id: str, user_id: str, org_id: str):
        """Remove a WebSocket connection."""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Remove from user tracking
        if user_id in self.user_connections:
            self.user_connections[user_id] = [
                conn for conn in self.user_connections[user_id] if conn != connection_id
            ]
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        # Remove from org tracking
        if org_id in self.org_connections:
            self.org_connections[org_id] = [
                conn for conn in self.org_connections[org_id] if conn != connection_id
            ]
            if not self.org_connections[org_id]:
                del self.org_connections[org_id]
        
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket."""
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_text(message)
    
    async def send_to_user(self, user_id: str, message: Dict[str, Any]):
        """Send a message to all connections for a specific user."""
        if user_id in self.user_connections:
            message_str = json.dumps(message)
            for connection_id in self.user_connections[user_id].copy():
                websocket = self.active_connections.get(connection_id)
                if websocket and websocket.client_state == WebSocketState.CONNECTED:
                    try:
                        await websocket.send_text(message_str)
                    except Exception as e:
                        logger.error(f"Failed to send message to {connection_id}: {e}")
                        # Remove dead connection
                        self.user_connections[user_id].remove(connection_id)
                        if connection_id in self.active_connections:
                            del self.active_connections[connection_id]
    
    async def send_to_organization(self, org_id: str, message: Dict[str, Any]):
        """Send a message to all connections for a specific organization."""
        if org_id in self.org_connections:
            message_str = json.dumps(message)
            for connection_id in self.org_connections[org_id].copy():
                websocket = self.active_connections.get(connection_id)
                if websocket and websocket.client_state == WebSocketState.CONNECTED:
                    try:
                        await websocket.send_text(message_str)
                    except Exception as e:
                        logger.error(f"Failed to send message to {connection_id}: {e}")
                        # Remove dead connection
                        self.org_connections[org_id].remove(connection_id)
                        if connection_id in self.active_connections:
                            del self.active_connections[connection_id]
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients."""
        message_str = json.dumps(message)
        for connection_id, websocket in self.active_connections.copy().items():
            if websocket.client_state == WebSocketState.CONNECTED:
                try:
                    await websocket.send_text(message_str)
                except Exception as e:
                    logger.error(f"Failed to broadcast to {connection_id}: {e}")
                    # Remove dead connection
                    del self.active_connections[connection_id]


# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws/notifications/{user_id}")
async def websocket_notifications(
    websocket: WebSocket,
    user_id: str,
    token: Optional[str] = None
):
    """WebSocket endpoint for real-time notifications."""
    connection_id = f"notifications_{user_id}_{id(websocket)}"
    
    try:
        # Authenticate user (simplified - in production, verify JWT token)
        if not token:
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        # For demo purposes, assuming authentication is valid
        org_id = "demo_org"  # This would come from user authentication
        
        await manager.connect(websocket, connection_id, user_id, org_id)
        
        # Send welcome message
        await manager.send_personal_message(
            json.dumps({
                "type": "connection_established",
                "message": "Connected to notifications stream"
            }),
            websocket
        )
        
        # Listen for messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong"}),
                    websocket
                )
            elif message.get("type") == "subscribe":
                # Handle subscription to specific notification types
                await handle_notification_subscription(websocket, user_id, message)
            
    except WebSocketDisconnect:
        manager.disconnect(connection_id, user_id, org_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(connection_id, user_id, org_id)


@router.websocket("/ws/chat/{thread_id}")
async def websocket_chat(
    websocket: WebSocket,
    thread_id: str,
    token: Optional[str] = None
):
    """WebSocket endpoint for real-time chat streaming."""
    connection_id = f"chat_{thread_id}_{id(websocket)}"
    
    try:
        # Authenticate user
        if not token:
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        # For demo purposes
        user_id = "demo_user"
        org_id = "demo_org"
        
        await manager.connect(websocket, connection_id, user_id, org_id)
        
        # Subscribe to Redis channel for this chat thread
        redis_client = redis.from_url(settings.redis_url)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"chat_stream_{thread_id}")
        
        await manager.send_personal_message(
            json.dumps({
                "type": "chat_connected",
                "thread_id": thread_id,
                "message": "Connected to chat stream"
            }),
            websocket
        )
        
        # Listen for Redis messages and WebSocket messages
        import asyncio
        
        async def redis_listener():
            """Listen for Redis pub/sub messages."""
            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = json.loads(message["data"])
                        await manager.send_personal_message(
                            json.dumps(data),
                            websocket
                        )
            except Exception as e:
                logger.error(f"Redis listener error: {e}")
        
        async def websocket_listener():
            """Listen for WebSocket messages."""
            try:
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    if message.get("type") == "ping":
                        await manager.send_personal_message(
                            json.dumps({"type": "pong"}),
                            websocket
                        )
            except WebSocketDisconnect:
                pass
            except Exception as e:
                logger.error(f"WebSocket listener error: {e}")
        
        # Run both listeners concurrently
        await asyncio.gather(
            redis_listener(),
            websocket_listener(),
            return_exceptions=True
        )
        
        await pubsub.unsubscribe(f"chat_stream_{thread_id}")
        await redis_client.close()
        
    except WebSocketDisconnect:
        manager.disconnect(connection_id, user_id, org_id)
    except Exception as e:
        logger.error(f"WebSocket chat error for thread {thread_id}: {e}")
        manager.disconnect(connection_id, user_id, org_id)


@router.websocket("/ws/analytics/{org_id}")
async def websocket_analytics(
    websocket: WebSocket,
    org_id: str,
    token: Optional[str] = None
):
    """WebSocket endpoint for real-time analytics updates."""
    connection_id = f"analytics_{org_id}_{id(websocket)}"
    
    try:
        # Authenticate user
        if not token:
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        user_id = "demo_user"
        
        await manager.connect(websocket, connection_id, user_id, org_id)
        
        # Subscribe to analytics updates for this org
        redis_client = redis.from_url(settings.redis_url)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"analytics_updates_{org_id}")
        
        await manager.send_personal_message(
            json.dumps({
                "type": "analytics_connected",
                "organization_id": org_id,
                "message": "Connected to analytics stream"
            }),
            websocket
        )
        
        # Listen for updates
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                await manager.send_personal_message(
                    json.dumps(data),
                    websocket
                )
        
        await pubsub.unsubscribe(f"analytics_updates_{org_id}")
        await redis_client.close()
        
    except WebSocketDisconnect:
        manager.disconnect(connection_id, user_id, org_id)
    except Exception as e:
        logger.error(f"WebSocket analytics error for org {org_id}: {e}")
        manager.disconnect(connection_id, user_id, org_id)


async def handle_notification_subscription(
    websocket: WebSocket,
    user_id: str,
    message: Dict[str, Any]
):
    """Handle notification subscription requests."""
    subscription_types = message.get("subscription_types", [])
    
    # Store subscription preferences (in production, this would be in database)
    logger.info(f"User {user_id} subscribed to notifications: {subscription_types}")
    
    await manager.send_personal_message(
        json.dumps({
            "type": "subscription_confirmed",
            "subscription_types": subscription_types
        }),
        websocket
    )


# Utility functions for sending notifications
async def send_notification_to_user(user_id: str, notification: Dict[str, Any]):
    """Send a notification to a specific user via WebSocket."""
    await manager.send_to_user(user_id, {
        "type": "notification",
        "data": notification
    })


async def send_notification_to_organization(org_id: str, notification: Dict[str, Any]):
    """Send a notification to all users in an organization via WebSocket."""
    await manager.send_to_organization(org_id, {
        "type": "notification",
        "data": notification
    })


async def broadcast_system_notification(notification: Dict[str, Any]):
    """Broadcast a system notification to all connected users."""
    await manager.broadcast({
        "type": "system_notification",
        "data": notification
    })