"""Document management schemas."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field


# Document schemas
class DocumentCreate(BaseModel):
    """Document creation schema."""
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    document_type: str = "general"
    sensitivity_level: str = "restricted"
    tags: List[str] = Field(default_factory=list)


class DocumentRead(BaseModel):
    """Document read schema."""
    id: UUID
    organization_id: UUID
    title: str
    description: Optional[str]
    document_type: str
    current_version: int
    total_versions: int
    file_size: Optional[int]
    mime_type: Optional[str]
    checksum: Optional[str]
    storage_path: Optional[str]
    sensitivity_level: str
    retention_policy: Dict[str, Any]
    tags: List[str]
    created_by: UUID
    last_modified_by: Optional[UUID]
    indexed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class DocumentUpdate(BaseModel):
    """Document update schema."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    document_type: Optional[str] = None
    sensitivity_level: Optional[str] = None
    tags: Optional[List[str]] = None


# Document version schemas
class DocumentVersionRead(BaseModel):
    """Document version read schema."""
    id: UUID
    document_id: UUID
    version_number: int
    title: str
    content_hash: str
    file_size: int
    mime_type: str
    storage_path: str
    change_type: str
    change_description: Optional[str]
    metadata: Dict[str, Any]
    created_by: UUID
    parent_version_id: Optional[UUID]
    is_active: bool
    created_at: datetime


# Fragment schemas
class FragmentRead(BaseModel):
    """Fragment read schema."""
    id: UUID
    document_id: UUID
    version_number: int
    content: str
    content_preview: str
    page_number: Optional[int]
    paragraph_number: Optional[int]
    fragment_type: str
    language: Optional[str]
    confidence_score: Decimal
    sensitivity_level: str
    metadata: Dict[str, Any]
    tags: List[str]
    created_at: datetime


class FragmentSearch(BaseModel):
    """Fragment search request schema."""
    query: str = Field(min_length=1)
    limit: int = Field(default=10, ge=1, le=100)
    min_confidence: Optional[Decimal] = Field(None, ge=0, le=1)
    document_types: Optional[List[str]] = None
    sensitivity_levels: Optional[List[str]] = None


class FragmentSearchResult(BaseModel):
    """Fragment search result schema."""
    fragment: FragmentRead
    score: float = Field(ge=0, le=1)
    distance: float


# File upload schemas
class FileUploadResponse(BaseModel):
    """File upload response schema."""
    document_id: UUID
    filename: str
    size: int
    mime_type: str
    checksum: str
    storage_path: str