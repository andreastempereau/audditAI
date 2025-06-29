"""Chat system models."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field, JSON, Column


class ChatThread(SQLModel, table=True):
    """Chat thread model."""
    __tablename__ = "chat_threads"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    name: str = Field(max_length=200)
    description: Optional[str] = None
    created_by: UUID = Field(foreign_key="auth.users.id")
    is_private: bool = Field(default=False)
    participants: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    message_count: int = Field(default=0)
    last_message_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class ChatMessage(SQLModel, table=True):
    """Chat message model."""
    __tablename__ = "chat_messages"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    thread_id: UUID = Field(foreign_key="chat_threads.id")
    user_id: UUID = Field(foreign_key="auth.users.id")
    parent_message_id: Optional[UUID] = Field(foreign_key="chat_messages.id")
    content: str
    content_type: str = Field(default="text", max_length=50)
    message_type: str = Field(default="user", max_length=20)
    sequence_number: int
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    edited_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None