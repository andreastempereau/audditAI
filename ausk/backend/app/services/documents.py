"""Document management service layer."""

import hashlib
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, BinaryIO
from uuid import UUID, uuid4
from decimal import Decimal

from fastapi import HTTPException, status, UploadFile
from sqlalchemy import select, desc, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import Document, DocumentVersion, Fragment
from app.schemas.documents import (
    DocumentCreate, DocumentRead, DocumentUpdate,
    DocumentVersionRead, FragmentRead, FragmentSearch,
    FragmentSearchResult, FileUploadResponse
)


class DocumentService:
    """Document management service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_document(
        self,
        doc_data: DocumentCreate,
        creator_user_id: UUID,
        organization_id: UUID
    ) -> DocumentRead:
        """Create new document."""
        document = Document(
            id=uuid4(),
            organization_id=organization_id,
            title=doc_data.title,
            description=doc_data.description,
            document_type=doc_data.document_type,
            current_version=1,
            total_versions=1,
            sensitivity_level=doc_data.sensitivity_level,
            retention_policy={
                "retention_period": 2555,  # 7 years in days
                "auto_delete": False
            },
            tags=doc_data.tags,
            created_by=creator_user_id,
            indexed_at=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(document)
        await self.session.commit()
        await self.session.refresh(document)
        
        return DocumentRead(
            id=document.id,
            organization_id=document.organization_id,
            title=document.title,
            description=document.description,
            document_type=document.document_type,
            current_version=document.current_version,
            total_versions=document.total_versions,
            file_size=document.file_size,
            mime_type=document.mime_type,
            checksum=document.checksum,
            storage_path=document.storage_path,
            sensitivity_level=document.sensitivity_level,
            retention_policy=document.retention_policy,
            tags=document.tags,
            created_by=document.created_by,
            last_modified_by=document.last_modified_by,
            indexed_at=document.indexed_at,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
    
    async def upload_file(
        self,
        document_id: UUID,
        file: UploadFile,
        user_id: UUID
    ) -> FileUploadResponse:
        """Upload file for document."""
        # Get document
        document = await self.get_document_by_id(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Calculate checksum
        checksum = hashlib.sha256(content).hexdigest()
        
        # Generate storage path
        storage_path = f"documents/{document_id}/v{document.current_version}/{file.filename}"
        
        # Update document with file info
        document.file_size = file_size
        document.mime_type = file.content_type
        document.checksum = checksum
        document.storage_path = storage_path
        document.last_modified_by = user_id
        document.updated_at = datetime.utcnow()
        
        # Create document version
        version = DocumentVersion(
            id=uuid4(),
            document_id=document_id,
            version_number=document.current_version,
            title=document.title,
            content_hash=checksum,
            file_size=file_size,
            mime_type=file.content_type or "application/octet-stream",
            storage_path=storage_path,
            change_type="upload",
            change_description="File uploaded",
            metadata={
                "filename": file.filename,
                "original_filename": file.filename
            },
            created_by=user_id,
            is_active=True,
            created_at=datetime.utcnow()
        )
        
        self.session.add(version)
        await self.session.commit()
        
        # TODO: Store file in MinIO/S3
        # TODO: Extract text and create fragments for indexing
        
        return FileUploadResponse(
            document_id=document_id,
            filename=file.filename or "unknown",
            size=file_size,
            mime_type=file.content_type or "application/octet-stream",
            checksum=checksum,
            storage_path=storage_path
        )
    
    async def get_document_by_id(self, document_id: UUID) -> Optional[Document]:
        """Get document by ID."""
        stmt = select(Document).where(Document.id == document_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_organization_documents(
        self,
        organization_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[DocumentRead]:
        """Get documents for organization."""
        stmt = (
            select(Document)
            .where(Document.organization_id == organization_id)
            .order_by(desc(Document.updated_at))
            .offset(offset)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        documents = result.scalars().all()
        
        return [
            DocumentRead(
                id=doc.id,
                organization_id=doc.organization_id,
                title=doc.title,
                description=doc.description,
                document_type=doc.document_type,
                current_version=doc.current_version,
                total_versions=doc.total_versions,
                file_size=doc.file_size,
                mime_type=doc.mime_type,
                checksum=doc.checksum,
                storage_path=doc.storage_path,
                sensitivity_level=doc.sensitivity_level,
                retention_policy=doc.retention_policy,
                tags=doc.tags,
                created_by=doc.created_by,
                last_modified_by=doc.last_modified_by,
                indexed_at=doc.indexed_at,
                created_at=doc.created_at,
                updated_at=doc.updated_at
            )
            for doc in documents
        ]
    
    async def update_document(
        self,
        document_id: UUID,
        doc_data: DocumentUpdate,
        user_id: UUID
    ) -> DocumentRead:
        """Update document metadata."""
        document = await self.get_document_by_id(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Update fields
        if doc_data.title is not None:
            document.title = doc_data.title
        if doc_data.description is not None:
            document.description = doc_data.description
        if doc_data.document_type is not None:
            document.document_type = doc_data.document_type
        if doc_data.sensitivity_level is not None:
            document.sensitivity_level = doc_data.sensitivity_level
        if doc_data.tags is not None:
            document.tags = doc_data.tags
        
        document.last_modified_by = user_id
        document.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(document)
        
        return DocumentRead(
            id=document.id,
            organization_id=document.organization_id,
            title=document.title,
            description=document.description,
            document_type=document.document_type,
            current_version=document.current_version,
            total_versions=document.total_versions,
            file_size=document.file_size,
            mime_type=document.mime_type,
            checksum=document.checksum,
            storage_path=document.storage_path,
            sensitivity_level=document.sensitivity_level,
            retention_policy=document.retention_policy,
            tags=document.tags,
            created_by=document.created_by,
            last_modified_by=document.last_modified_by,
            indexed_at=document.indexed_at,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
    
    async def get_document_versions(
        self,
        document_id: UUID
    ) -> List[DocumentVersionRead]:
        """Get all versions of a document."""
        stmt = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .order_by(desc(DocumentVersion.version_number))
        )
        
        result = await self.session.execute(stmt)
        versions = result.scalars().all()
        
        return [
            DocumentVersionRead(
                id=version.id,
                document_id=version.document_id,
                version_number=version.version_number,
                title=version.title,
                content_hash=version.content_hash,
                file_size=version.file_size,
                mime_type=version.mime_type,
                storage_path=version.storage_path,
                change_type=version.change_type,
                change_description=version.change_description,
                metadata=version.metadata,
                created_by=version.created_by,
                parent_version_id=version.parent_version_id,
                is_active=version.is_active,
                created_at=version.created_at
            )
            for version in versions
        ]
    
    async def search_fragments(
        self,
        search_request: FragmentSearch,
        organization_id: UUID
    ) -> List[FragmentSearchResult]:
        """Search document fragments using vector similarity."""
        # TODO: Implement vector embedding search
        # For now, use simple text search
        
        # Build base query
        base_query = (
            select(Fragment)
            .join(Document, Fragment.document_id == Document.id)
            .where(Document.organization_id == organization_id)
            .where(Fragment.content.ilike(f"%{search_request.query}%"))
        )
        
        # Apply filters
        if search_request.min_confidence:
            base_query = base_query.where(
                Fragment.confidence_score >= search_request.min_confidence
            )
        
        if search_request.document_types:
            base_query = base_query.where(
                Document.document_type.in_(search_request.document_types)
            )
        
        if search_request.sensitivity_levels:
            base_query = base_query.where(
                Fragment.sensitivity_level.in_(search_request.sensitivity_levels)
            )
        
        # Add limit
        query = base_query.limit(search_request.limit)
        
        result = await self.session.execute(query)
        fragments = result.scalars().all()
        
        # Convert to search results with dummy scores for now
        return [
            FragmentSearchResult(
                fragment=FragmentRead(
                    id=fragment.id,
                    document_id=fragment.document_id,
                    version_number=fragment.version_number,
                    content=fragment.content,
                    content_preview=fragment.content_preview,
                    page_number=fragment.page_number,
                    paragraph_number=fragment.paragraph_number,
                    fragment_type=fragment.fragment_type,
                    language=fragment.language,
                    confidence_score=fragment.confidence_score,
                    sensitivity_level=fragment.sensitivity_level,
                    metadata=fragment.metadata,
                    tags=fragment.tags,
                    created_at=fragment.created_at
                ),
                score=0.8,  # TODO: Calculate actual similarity score
                distance=0.2  # TODO: Calculate actual vector distance
            )
            for fragment in fragments
        ]
    
    async def create_fragment(
        self,
        document_id: UUID,
        version_number: int,
        content: str,
        fragment_type: str = "text",
        page_number: Optional[int] = None,
        paragraph_number: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> FragmentRead:
        """Create document fragment for indexing."""
        # Generate content preview (first 200 characters)
        content_preview = content[:200] + "..." if len(content) > 200 else content
        
        fragment = Fragment(
            id=uuid4(),
            document_id=document_id,
            version_number=version_number,
            content=content,
            content_preview=content_preview,
            page_number=page_number,
            paragraph_number=paragraph_number,
            fragment_type=fragment_type,
            language="en",  # TODO: Detect language
            confidence_score=Decimal("0.95"),  # TODO: Calculate confidence
            sensitivity_level="restricted",  # TODO: Inherit from document
            metadata=metadata or {},
            tags=[],
            created_at=datetime.utcnow()
        )
        
        self.session.add(fragment)
        await self.session.commit()
        await self.session.refresh(fragment)
        
        return FragmentRead(
            id=fragment.id,
            document_id=fragment.document_id,
            version_number=fragment.version_number,
            content=fragment.content,
            content_preview=fragment.content_preview,
            page_number=fragment.page_number,
            paragraph_number=fragment.paragraph_number,
            fragment_type=fragment.fragment_type,
            language=fragment.language,
            confidence_score=fragment.confidence_score,
            sensitivity_level=fragment.sensitivity_level,
            metadata=fragment.metadata,
            tags=fragment.tags,
            created_at=fragment.created_at
        )