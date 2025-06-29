"""Chat service layer."""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import ChatThread, ChatMessage
from app.schemas.chat import (
    ChatThreadCreate, ChatThreadRead, ChatThreadUpdate,
    ChatMessageCreate, ChatMessageRead, ChatMessageUpdate
)


class ChatService:
    """Chat management service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_thread(
        self,
        thread_data: ChatThreadCreate,
        creator_user_id: UUID,
        organization_id: UUID
    ) -> ChatThreadRead:
        """Create new chat thread."""
        thread = ChatThread(
            id=uuid4(),
            organization_id=organization_id,
            name=thread_data.name,
            description=thread_data.description,
            created_by=creator_user_id,
            is_private=thread_data.is_private,
            participants=thread_data.participants or [creator_user_id],
            metadata={},
            message_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(thread)
        await self.session.commit()
        await self.session.refresh(thread)
        
        return ChatThreadRead(
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
        )
    
    async def get_thread_by_id(self, thread_id: UUID) -> Optional[ChatThread]:
        """Get chat thread by ID."""
        stmt = select(ChatThread).where(ChatThread.id == thread_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_user_threads(
        self,
        user_id: UUID,
        organization_id: UUID,
        limit: int = 50
    ) -> List[ChatThreadRead]:
        """Get chat threads for a user."""
        stmt = (
            select(ChatThread)
            .where(ChatThread.organization_id == organization_id)
            .where(
                # User is participant or thread is not private
                (ChatThread.participants.contains([str(user_id)])) |
                (ChatThread.is_private == False)
            )
            .order_by(desc(ChatThread.updated_at))
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        threads = result.scalars().all()
        
        return [
            ChatThreadRead(
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
            )
            for thread in threads
        ]
    
    async def update_thread(
        self,
        thread_id: UUID,
        thread_data: ChatThreadUpdate,
        user_id: UUID
    ) -> ChatThreadRead:
        """Update chat thread."""
        thread = await self.get_thread_by_id(thread_id)
        if not thread:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found"
            )
        
        # Check if user has permission to update thread
        if (thread.created_by != user_id and 
            str(user_id) not in thread.participants):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this thread"
            )
        
        # Update fields
        if thread_data.name is not None:
            thread.name = thread_data.name
        if thread_data.description is not None:
            thread.description = thread_data.description
        if thread_data.is_private is not None:
            thread.is_private = thread_data.is_private
        if thread_data.participants is not None:
            thread.participants = thread_data.participants
        
        thread.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(thread)
        
        return ChatThreadRead(
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
        )
    
    async def add_message(
        self,
        thread_id: UUID,
        message_data: ChatMessageCreate,
        user_id: UUID
    ) -> ChatMessageRead:
        """Add message to chat thread."""
        thread = await self.get_thread_by_id(thread_id)
        if not thread:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found"
            )
        
        # Check if user has permission to send message
        if (thread.is_private and 
            str(user_id) not in thread.participants):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to send messages to this thread"
            )
        
        # Get next sequence number
        stmt = select(func.max(ChatMessage.sequence_number)).where(
            ChatMessage.thread_id == thread_id
        )
        result = await self.session.execute(stmt)
        max_sequence = result.scalar()
        next_sequence = (max_sequence or 0) + 1
        
        # Create message
        message = ChatMessage(
            id=uuid4(),
            thread_id=thread_id,
            user_id=user_id,
            parent_message_id=message_data.parent_message_id,
            content=message_data.content,
            content_type=message_data.content_type,
            message_type=message_data.message_type,
            sequence_number=next_sequence,
            metadata={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(message)
        
        # Update thread
        thread.message_count += 1
        thread.last_message_at = datetime.utcnow()
        thread.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(message)
        
        return ChatMessageRead(
            id=message.id,
            thread_id=message.thread_id,
            user_id=message.user_id,
            parent_message_id=message.parent_message_id,
            content=message.content,
            content_type=message.content_type,
            message_type=message.message_type,
            sequence_number=message.sequence_number,
            metadata=message.metadata,
            edited_at=message.edited_at,
            created_at=message.created_at,
            updated_at=message.updated_at
        )
    
    async def get_thread_messages(
        self,
        thread_id: UUID,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[ChatMessageRead]:
        """Get messages from a chat thread."""
        thread = await self.get_thread_by_id(thread_id)
        if not thread:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found"
            )
        
        # Check if user has permission to read messages
        if (thread.is_private and 
            str(user_id) not in thread.participants):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to read messages from this thread"
            )
        
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread_id)
            .order_by(desc(ChatMessage.sequence_number))
            .offset(offset)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        messages = result.scalars().all()
        
        return [
            ChatMessageRead(
                id=message.id,
                thread_id=message.thread_id,
                user_id=message.user_id,
                parent_message_id=message.parent_message_id,
                content=message.content,
                content_type=message.content_type,
                message_type=message.message_type,
                sequence_number=message.sequence_number,
                metadata=message.metadata,
                edited_at=message.edited_at,
                created_at=message.created_at,
                updated_at=message.updated_at
            )
            for message in reversed(messages)  # Return in chronological order
        ]
    
    async def update_message(
        self,
        message_id: UUID,
        message_data: ChatMessageUpdate,
        user_id: UUID
    ) -> ChatMessageRead:
        """Update chat message."""
        stmt = select(ChatMessage).where(ChatMessage.id == message_id)
        result = await self.session.execute(stmt)
        message = result.scalar_one_or_none()
        
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        # Check if user owns the message
        if message.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this message"
            )
        
        # Update fields
        if message_data.content is not None:
            message.content = message_data.content
        if message_data.content_type is not None:
            message.content_type = message_data.content_type
        
        message.edited_at = datetime.utcnow()
        message.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(message)
        
        return ChatMessageRead(
            id=message.id,
            thread_id=message.thread_id,
            user_id=message.user_id,
            parent_message_id=message.parent_message_id,
            content=message.content,
            content_type=message.content_type,
            message_type=message.message_type,
            sequence_number=message.sequence_number,
            metadata=message.metadata,
            edited_at=message.edited_at,
            created_at=message.created_at,
            updated_at=message.updated_at
        )
    
    async def delete_message(self, message_id: UUID, user_id: UUID) -> None:
        """Delete chat message (soft delete)."""
        stmt = select(ChatMessage).where(ChatMessage.id == message_id)
        result = await self.session.execute(stmt)
        message = result.scalar_one_or_none()
        
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        # Check if user owns the message
        if message.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this message"
            )
        
        # Soft delete - replace content with deletion marker
        message.content = "[Message deleted]"
        message.metadata["deleted"] = True
        message.metadata["deleted_at"] = datetime.utcnow().isoformat()
        message.updated_at = datetime.utcnow()
        
        await self.session.commit()