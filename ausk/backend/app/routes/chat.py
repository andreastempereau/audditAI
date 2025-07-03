"""Chat system routes."""

from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.base import BaseResponse
from app.schemas.chat import (
    ChatThreadCreate, ChatThreadRead, ChatThreadUpdate,
    ChatMessageCreate, ChatMessageRead, ChatMessageUpdate,
    WebSocketMessage, TypingIndicator
)
from app.services.chat import ChatService

router = APIRouter()
security = HTTPBearer()


@router.post("/threads", response_model=BaseResponse[ChatThreadRead])
async def create_thread(
    thread_data: ChatThreadCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[ChatThreadRead]:
    """Create new chat thread."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    chat_service = ChatService(session)
    thread = await chat_service.create_thread(thread_data, current_user.id, org_id)
    return BaseResponse(data=thread)


@router.get("/threads", response_model=BaseResponse[List[ChatThreadRead]])
async def get_threads(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[ChatThreadRead]]:
    """Get user's chat threads."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    chat_service = ChatService(session)
    threads = await chat_service.get_user_threads(current_user.id, org_id)
    return BaseResponse(data=threads)


@router.get("/threads/{thread_id}", response_model=BaseResponse[ChatThreadRead])
async def get_thread(
    thread_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[ChatThreadRead]:
    """Get specific chat thread."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    chat_service = ChatService(session)
    thread = await chat_service.get_thread_by_id(thread_id)
    
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    # Check permissions
    if (thread.is_private and 
        str(current_user.id) not in thread.participants):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this thread"
        )
    
    return BaseResponse(data=ChatThreadRead(
        id=thread.id,
        organization_id=thread.organization_id,
        name=thread.name,
        description=thread.description,
        created_by=thread.created_by,
        is_private=thread.is_private,
        participants=[str(p) for p in thread.participants],
        metadata=thread.metadata,
        message_count=thread.message_count,
        last_message_at=thread.last_message_at,
        created_at=thread.created_at,
        updated_at=thread.updated_at
    ))


@router.put("/threads/{thread_id}", response_model=BaseResponse[ChatThreadRead])
async def update_thread(
    thread_id: UUID,
    thread_data: ChatThreadUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[ChatThreadRead]:
    """Update chat thread."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    chat_service = ChatService(session)
    thread = await chat_service.update_thread(thread_id, thread_data, current_user.id)
    return BaseResponse(data=thread)


@router.post("/threads/{thread_id}/messages", response_model=BaseResponse[ChatMessageRead])
async def send_message(
    thread_id: UUID,
    message_data: ChatMessageCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[ChatMessageRead]:
    """Send message to chat thread."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    chat_service = ChatService(session)
    message = await chat_service.add_message(thread_id, message_data, current_user.id)
    return BaseResponse(data=message)


@router.get("/threads/{thread_id}/messages", response_model=BaseResponse[List[ChatMessageRead]])
async def get_messages(
    thread_id: UUID,
    limit: int = 50,
    offset: int = 0,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[ChatMessageRead]]:
    """Get messages from chat thread."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    chat_service = ChatService(session)
    messages = await chat_service.get_thread_messages(
        thread_id, current_user.id, limit, offset
    )
    return BaseResponse(data=messages)


@router.put("/messages/{message_id}", response_model=BaseResponse[ChatMessageRead])
async def update_message(
    message_id: UUID,
    message_data: ChatMessageUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[ChatMessageRead]:
    """Update chat message."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    chat_service = ChatService(session)
    message = await chat_service.update_message(message_id, message_data, current_user.id)
    return BaseResponse(data=message)


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Delete chat message."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    chat_service = ChatService(session)
    await chat_service.delete_message(message_id, current_user.id)
    return BaseResponse(data={"message": "Message deleted successfully"})


# WebSocket connection manager
class ConnectionManager:
    """WebSocket connection manager for real-time chat."""
    
    def __init__(self):
        self.active_connections: Dict[UUID, List[WebSocket]] = {}
        self.user_connections: Dict[WebSocket, UUID] = {}
    
    async def connect(self, websocket: WebSocket, thread_id: UUID, user_id: UUID):
        """Connect user to thread."""
        await websocket.accept()
        
        if thread_id not in self.active_connections:
            self.active_connections[thread_id] = []
        
        self.active_connections[thread_id].append(websocket)
        self.user_connections[websocket] = user_id
    
    def disconnect(self, websocket: WebSocket, thread_id: UUID):
        """Disconnect user from thread."""
        if thread_id in self.active_connections:
            self.active_connections[thread_id].remove(websocket)
            if not self.active_connections[thread_id]:
                del self.active_connections[thread_id]
        
        if websocket in self.user_connections:
            del self.user_connections[websocket]
    
    async def send_to_thread(self, message: dict, thread_id: UUID):
        """Send message to all connections in a thread."""
        if thread_id in self.active_connections:
            for connection in self.active_connections[thread_id]:
                try:
                    await connection.send_json(message)
                except:
                    # Connection is closed, remove it
                    self.active_connections[thread_id].remove(connection)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws/{thread_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    thread_id: UUID,
    token: str = None
):
    """WebSocket endpoint for real-time chat."""
    # TODO: Authenticate WebSocket connection using token
    # For now, we'll use a dummy user ID
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    
    await manager.connect(websocket, thread_id, user_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            # Handle different message types
            message_type = data.get("type")
            
            if message_type == "message":
                # Broadcast new message to all thread participants
                await manager.send_to_thread({
                    "type": "message",
                    "data": data.get("data"),
                    "user_id": str(user_id),
                    "timestamp": datetime.utcnow().isoformat()
                }, thread_id)
            
            elif message_type == "typing":
                # Broadcast typing indicator
                await manager.send_to_thread({
                    "type": "typing",
                    "user_id": str(user_id),
                    "is_typing": data.get("is_typing", False),
                    "timestamp": datetime.utcnow().isoformat()
                }, thread_id)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, thread_id)