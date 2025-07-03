"""Chat system schemas."""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# Chat thread schemas
class ChatThreadCreate(BaseModel):
    """Chat thread creation schema."""
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    is_private: bool = False
    participants: List[UUID] = Field(default_factory=list)


class ChatThreadRead(BaseModel):
    """Chat thread read schema."""
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str]
    created_by: UUID
    is_private: bool
    participants: List[str]
    metadata: Dict[str, Any]
    message_count: int
    last_message_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ChatThreadUpdate(BaseModel):
    """Chat thread update schema."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_private: Optional[bool] = None
    participants: Optional[List[UUID]] = None


# Chat message schemas
class ChatMessageCreate(BaseModel):
    """Chat message creation schema."""
    content: str = Field(min_length=1)
    content_type: Literal["text", "markdown", "html", "code"] = "text"
    message_type: Literal["user", "assistant", "system", "bot"] = "user"
    parent_message_id: Optional[UUID] = None


class ChatMessageRead(BaseModel):
    """Chat message read schema."""
    id: UUID
    thread_id: UUID
    user_id: UUID
    parent_message_id: Optional[UUID]
    content: str
    content_type: str
    message_type: str
    sequence_number: int
    metadata: Dict[str, Any]
    edited_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ChatMessageUpdate(BaseModel):
    """Chat message update schema."""
    content: Optional[str] = Field(None, min_length=1)
    content_type: Optional[Literal["text", "markdown", "html", "code"]] = None


# WebSocket schemas
class TypingIndicator(BaseModel):
    """Typing indicator schema."""
    user_id: UUID
    thread_id: UUID
    is_typing: bool


class WebSocketMessage(BaseModel):
    """WebSocket message schema."""
    type: Literal["message", "typing", "join", "leave", "error"]
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatJoinRequest(BaseModel):
    """Chat join request schema."""
    thread_id: UUID


class ChatLeaveRequest(BaseModel):
    """Chat leave request schema."""
    thread_id: UUID