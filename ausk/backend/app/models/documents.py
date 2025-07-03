"""Document management models."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from decimal import Decimal

from sqlmodel import SQLModel, Field, JSON, Column


class Document(SQLModel, table=True):
    """Document model."""
    __tablename__ = "documents"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    title: str = Field(max_length=500)
    description: Optional[str] = None
    document_type: str = Field(default="general", max_length=50)
    current_version: int = Field(default=1)
    total_versions: int = Field(default=1)
    file_size: Optional[int] = None
    mime_type: Optional[str] = Field(max_length=200)
    checksum: Optional[str] = Field(max_length=64)
    storage_path: Optional[str] = None
    sensitivity_level: str = Field(default="restricted", max_length=20)
    encryption_key_id: Optional[UUID] = None
    retention_policy: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_by: UUID = Field(foreign_key="auth.users.id")
    last_modified_by: Optional[UUID] = Field(foreign_key="auth.users.id")
    indexed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class DocumentVersion(SQLModel, table=True):
    """Document version model."""
    __tablename__ = "document_versions"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    document_id: UUID = Field(foreign_key="documents.id")
    version_number: int
    title: str = Field(max_length=500)
    content_hash: str = Field(max_length=64)
    file_size: int
    mime_type: str = Field(max_length=200)
    storage_path: str
    change_type: str = Field(default="update", max_length=20)
    change_description: Optional[str] = None
    diff_data: Optional[Dict[str, Any]] = Field(sa_column=Column(JSON))
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_by: UUID = Field(foreign_key="auth.users.id")
    parent_version_id: Optional[UUID] = Field(foreign_key="document_versions.id")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Fragment(SQLModel, table=True):
    """Text fragment model for vector search."""
    __tablename__ = "fragments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    document_id: UUID = Field(foreign_key="documents.id")
    version_number: int
    content: str
    content_preview: str
    page_number: Optional[int] = None
    paragraph_number: Optional[int] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    fragment_type: str = Field(default="paragraph", max_length=50)
    language: Optional[str] = Field(max_length=10)
    confidence_score: Decimal = Field(default=Decimal("0.5"), decimal_places=2, max_digits=3)
    sensitivity_level: str = Field(default="restricted", max_length=20)
    embedding: Optional[List[float]] = Field(sa_column=Column(JSON))  # Vector embedding
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    is_deprecated: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)