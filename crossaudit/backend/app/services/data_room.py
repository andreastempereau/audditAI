"""Data Room service for file storage, versioning, and semantic search."""

import asyncio
import hashlib
import mimetypes
import os
from datetime import datetime
from typing import List, Optional, Dict, Any, BinaryIO, Tuple
from uuid import UUID, uuid4
from pathlib import Path
import json

from fastapi import HTTPException, status, UploadFile
from sqlalchemy import select, desc, and_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import redis.asyncio as redis
from cryptography.fernet import Fernet

from app.core.config import get_settings
from app.models.documents import Document, DocumentVersion, Fragment
from app.schemas.documents import (
    DocumentRead, DocumentVersionRead, FragmentRead,
    FragmentSearchResult, FileUploadResponse
)
from app.services.audit import AuditService
from app.schemas.audit import AuditLogCreate

settings = get_settings()


class EncryptionService:
    """Handle file encryption/decryption."""
    
    def __init__(self):
        self.key = self._get_or_create_key()
        self.cipher = Fernet(self.key)
    
    def _get_or_create_key(self) -> bytes:
        """Get or create encryption key from environment."""
        key_str = getattr(settings, 'data_room_encryption_key', None)
        if key_str:
            return key_str.encode()
        
        # Generate new key for development
        key = Fernet.generate_key()
        # In production, this should be stored securely in KMS
        return key
    
    def encrypt_file(self, file_data: bytes) -> bytes:
        """Encrypt file data."""
        return self.cipher.encrypt(file_data)
    
    def decrypt_file(self, encrypted_data: bytes) -> bytes:
        """Decrypt file data."""
        return self.cipher.decrypt(encrypted_data)


class StorageService:
    """Handle file storage operations (MinIO/Supabase Storage)."""
    
    def __init__(self):
        self.encryption = EncryptionService()
        self.bucket_name = getattr(settings, 'storage_bucket', 'docs')
        
    async def store_file(
        self,
        file_data: bytes,
        storage_path: str,
        content_type: str = None
    ) -> str:
        """Store encrypted file and return storage path."""
        try:
            # Encrypt file data
            encrypted_data = self.encryption.encrypt_file(file_data)
            
            # TODO: Implement actual MinIO/Supabase storage
            # For now, simulate storage
            storage_url = f"storage://{self.bucket_name}/{storage_path}"
            
            # In production, use MinIO client:
            # from minio import Minio
            # client = Minio(settings.minio_endpoint, ...)
            # client.put_object(self.bucket_name, storage_path, 
            #                  io.BytesIO(encrypted_data), len(encrypted_data))
            
            return storage_url
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store file: {str(e)}"
            )
    
    async def retrieve_file(self, storage_path: str) -> bytes:
        """Retrieve and decrypt file."""
        try:
            # TODO: Implement actual MinIO/Supabase retrieval
            # For now, simulate retrieval
            # In production:
            # response = client.get_object(self.bucket_name, storage_path)
            # encrypted_data = response.read()
            
            # Simulate encrypted data for now
            encrypted_data = b"simulated_encrypted_data"
            
            # Decrypt and return
            return self.encryption.decrypt_file(encrypted_data)
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve file: {str(e)}"
            )
    
    async def delete_file(self, storage_path: str) -> None:
        """Delete file from storage."""
        try:
            # TODO: Implement actual deletion
            # client.remove_object(self.bucket_name, storage_path)
            pass
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete file: {str(e)}"
            )


class QuotaService:
    """Handle organization quota checking and enforcement."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def check_quota(
        self,
        organization_id: UUID,
        additional_storage: int = 0,
        additional_versions: int = 0,
        additional_fragments: int = 0
    ) -> Dict[str, Any]:
        """Check if organization is within quota limits."""
        # Get current quota
        stmt = text("""
            SELECT storage_used_bytes, version_count, fragment_count,
                   storage_limit_bytes, version_limit, fragment_limit
            FROM organization_quotas 
            WHERE organization_id = :org_id
        """)
        result = await self.session.execute(stmt, {"org_id": organization_id})
        quota = result.fetchone()
        
        if not quota:
            # Initialize quota for organization
            await self._initialize_quota(organization_id)
            return await self.check_quota(organization_id, additional_storage, additional_versions, additional_fragments)
        
        # Check limits
        storage_ok = (quota.storage_used_bytes + additional_storage) <= quota.storage_limit_bytes
        version_ok = (quota.version_count + additional_versions) <= quota.version_limit
        fragment_ok = (quota.fragment_count + additional_fragments) <= quota.fragment_limit
        
        return {
            "within_limits": storage_ok and version_ok and fragment_ok,
            "storage": {
                "used": quota.storage_used_bytes,
                "limit": quota.storage_limit_bytes,
                "available": quota.storage_limit_bytes - quota.storage_used_bytes,
                "within_limit": storage_ok
            },
            "versions": {
                "used": quota.version_count,
                "limit": quota.version_limit,
                "available": quota.version_limit - quota.version_count,
                "within_limit": version_ok
            },
            "fragments": {
                "used": quota.fragment_count,
                "limit": quota.fragment_limit,
                "available": quota.fragment_limit - quota.fragment_count,
                "within_limit": fragment_ok
            }
        }
    
    async def _initialize_quota(self, organization_id: UUID) -> None:
        """Initialize quota for organization."""
        stmt = text("""
            INSERT INTO organization_quotas (organization_id)
            VALUES (:org_id)
            ON CONFLICT (organization_id) DO NOTHING
        """)
        await self.session.execute(stmt, {"org_id": organization_id})
        await self.session.commit()


class DataRoomService:
    """Main data room service for file management and search."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.storage = StorageService()
        self.quota = QuotaService(session)
        self.audit = AuditService(session)
        self.redis = None  # Will be initialized when needed
        
        # Supported file types and size limits
        self.supported_types = {
            'application/pdf': '.pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
            'text/plain': '.txt',
            'text/csv': '.csv',
            'application/zip': '.zip'
        }
        self.max_file_size = 500 * 1024 * 1024  # 500 MB
    
    async def _get_redis(self):
        """Get Redis connection for task queue."""
        if not self.redis:
            self.redis = redis.from_url(settings.redis_url)
        return self.redis
    
    def _calculate_checksum(self, file_data: bytes) -> str:
        """Calculate SHA-256 checksum of file."""
        return hashlib.sha256(file_data).hexdigest()
    
    def _validate_file(self, file: UploadFile) -> Tuple[str, str]:
        """Validate file type and size."""
        # Check file size
        if file.size and file.size > self.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {self.max_file_size // (1024*1024)} MB"
            )
        
        # Determine MIME type
        content_type = file.content_type
        if not content_type:
            content_type, _ = mimetypes.guess_type(file.filename or "")
        
        if content_type not in self.supported_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {content_type}. "
                       f"Supported types: {list(self.supported_types.keys())}"
            )
        
        return content_type, self.supported_types[content_type]
    
    async def upload_file(
        self,
        file: UploadFile,
        document_id: Optional[UUID],
        title: str,
        description: Optional[str],
        classification_level: str,
        user_id: UUID,
        organization_id: UUID
    ) -> FileUploadResponse:
        """Upload and process a file."""
        # Validate file
        content_type, file_ext = self._validate_file(file)
        
        # Read file data
        file_data = await file.read()
        file_size = len(file_data)
        checksum = self._calculate_checksum(file_data)
        
        # Check quotas
        quota_check = await self.quota.check_quota(
            organization_id,
            additional_storage=file_size,
            additional_versions=1
        )
        
        if not quota_check["within_limits"]:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Organization quota exceeded"
            )
        
        # Check for duplicate file
        if document_id:
            existing_version = await self._check_duplicate_version(document_id, checksum)
            if existing_version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="File with identical content already exists"
                )
        
        # Create or update document
        if document_id:
            document = await self._get_document_by_id(document_id)
            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document not found"
                )
            
            # Get next version number
            version_number = await self._get_next_version_number(document_id)
            is_new_document = False
        else:
            # Create new document
            document = await self._create_document(
                title, description, classification_level, user_id, organization_id
            )
            document_id = document.id
            version_number = 1
            is_new_document = True
        
        # Generate storage path
        storage_path = f"documents/{organization_id}/{document_id}/v{version_number}/{file.filename}"
        
        # Store encrypted file
        storage_url = await self.storage.store_file(file_data, storage_path, content_type)
        
        # Create document version
        doc_version = await self._create_document_version(
            document_id=document_id,
            version_number=version_number,
            title=title,
            file_size=file_size,
            content_type=content_type,
            checksum=checksum,
            storage_path=storage_url,
            user_id=user_id,
            filename=file.filename or f"upload{file_ext}"
        )
        
        # Update document metadata
        await self._update_document_metadata(document_id, file_size, content_type, checksum, storage_url, user_id)
        
        # Queue for async processing
        await self._queue_for_processing(document_id, version_number, storage_url, content_type)
        
        # Log audit event
        await self.audit.create_audit_log(
            AuditLogCreate(
                actor_type="user",
                action="file.upload" if is_new_document else "file.reupload",
                resource_type="document",
                resource_id=document_id,
                changes={
                    "filename": file.filename,
                    "size": file_size,
                    "version": version_number,
                    "checksum": checksum
                },
                severity="info"
            ),
            organization_id=organization_id,
            actor_user_id=user_id
        )
        
        return FileUploadResponse(
            document_id=document_id,
            filename=file.filename or f"upload{file_ext}",
            size=file_size,
            mime_type=content_type,
            checksum=checksum,
            storage_path=storage_url
        )
    
    async def _create_document(
        self,
        title: str,
        description: Optional[str],
        classification_level: str,
        user_id: UUID,
        organization_id: UUID
    ) -> Document:
        """Create new document record."""
        document = Document(
            id=uuid4(),
            organization_id=organization_id,
            title=title,
            description=description,
            document_type="upload",
            current_version=1,
            total_versions=1,
            classification_level=classification_level,
            retention_policy={"retention_days": 2555},  # 7 years
            tags=[],
            created_by=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(document)
        await self.session.commit()
        await self.session.refresh(document)
        
        return document
    
    async def _create_document_version(
        self,
        document_id: UUID,
        version_number: int,
        title: str,
        file_size: int,
        content_type: str,
        checksum: str,
        storage_path: str,
        user_id: UUID,
        filename: str
    ) -> DocumentVersion:
        """Create document version record."""
        doc_version = DocumentVersion(
            id=uuid4(),
            document_id=document_id,
            version_number=version_number,
            title=title,
            content_hash=checksum,
            file_size=file_size,
            mime_type=content_type,
            storage_path=storage_path,
            change_type="upload",
            change_description=f"Uploaded {filename}",
            metadata={"original_filename": filename},
            created_by=user_id,
            is_active=True,
            created_at=datetime.utcnow()
        )
        
        self.session.add(doc_version)
        await self.session.commit()
        await self.session.refresh(doc_version)
        
        return doc_version
    
    async def _update_document_metadata(
        self,
        document_id: UUID,
        file_size: int,
        content_type: str,
        checksum: str,
        storage_path: str,
        user_id: UUID
    ) -> None:
        """Update document with latest file metadata."""
        stmt = select(Document).where(Document.id == document_id)
        result = await self.session.execute(stmt)
        document = result.scalar_one()
        
        document.file_size = file_size
        document.mime_type = content_type
        document.checksum = checksum
        document.storage_path = storage_path
        document.last_modified_by = user_id
        document.updated_at = datetime.utcnow()
        document.total_versions += 1
        document.current_version = await self._get_latest_version_number(document_id)
        
        await self.session.commit()
    
    async def _get_document_by_id(self, document_id: UUID) -> Optional[Document]:
        """Get document by ID."""
        stmt = select(Document).where(Document.id == document_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _check_duplicate_version(self, document_id: UUID, checksum: str) -> Optional[DocumentVersion]:
        """Check if a version with the same checksum already exists."""
        stmt = select(DocumentVersion).where(
            and_(
                DocumentVersion.document_id == document_id,
                DocumentVersion.content_hash == checksum
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _get_next_version_number(self, document_id: UUID) -> int:
        """Get the next version number for a document."""
        stmt = select(func.max(DocumentVersion.version_number)).where(
            DocumentVersion.document_id == document_id
        )
        result = await self.session.execute(stmt)
        max_version = result.scalar()
        return (max_version or 0) + 1
    
    async def _get_latest_version_number(self, document_id: UUID) -> int:
        """Get the latest version number for a document."""
        stmt = select(func.max(DocumentVersion.version_number)).where(
            DocumentVersion.document_id == document_id
        )
        result = await self.session.execute(stmt)
        max_version = result.scalar()
        return max_version or 1
    
    async def _queue_for_processing(
        self,
        document_id: UUID,
        version_number: int,
        storage_path: str,
        content_type: str
    ) -> None:
        """Queue document for async text extraction and embedding."""
        task_data = {
            "document_id": str(document_id),
            "version_number": version_number,
            "storage_path": storage_path,
            "content_type": content_type,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        redis_client = await self._get_redis()
        await redis_client.lpush("ingest_queue", json.dumps(task_data))
    
    async def get_document_versions(self, document_id: UUID) -> List[DocumentVersionRead]:
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
        query_text: str,
        organization_id: UUID,
        user_id: UUID,
        document_id: Optional[UUID] = None,
        classification_level: Optional[str] = None,
        limit: int = 20
    ) -> List[FragmentSearchResult]:
        """Search fragments using semantic similarity."""
        # Log search audit event
        await self.audit.create_audit_log(
            AuditLogCreate(
                actor_type="user",
                action="file.search",
                resource_type="fragment",
                changes={"query": query_text, "filters": {"document_id": str(document_id) if document_id else None}},
                severity="info"
            ),
            organization_id=organization_id,
            actor_user_id=user_id
        )
        
        # Get query embedding (this would call the embedder service)
        query_embedding = await self._get_text_embedding(query_text)
        
        if not query_embedding:
            # Fallback to text search if embedding fails
            return await self._fallback_text_search(query_text, organization_id, document_id, classification_level, limit)
        
        # Perform vector search using the database function
        stmt = text("""
            SELECT * FROM search_fragments_vector(
                :query_embedding::vector,
                :org_id,
                :doc_id,
                NULL,  -- department filter (not implemented yet)
                :classification_filter,
                :limit_count
            )
        """)
        
        result = await self.session.execute(stmt, {
            "query_embedding": f"[{','.join(map(str, query_embedding))}]",
            "org_id": organization_id,
            "doc_id": document_id,
            "classification_filter": classification_level,
            "limit_count": limit
        })
        
        fragments = result.fetchall()
        
        return [
            FragmentSearchResult(
                fragment=FragmentRead(
                    id=fragment.id,
                    document_id=fragment.document_id,
                    version_number=fragment.version_number,
                    content=fragment.content,
                    content_preview=self._create_highlight(fragment.content, query_text),
                    start_page=fragment.start_page,
                    end_page=fragment.end_page,
                    fragment_type="text",
                    language="en",
                    confidence_score=0.95,
                    classification_level="restricted",
                    metadata={
                        "document_title": fragment.document_title,
                        "provenance": {
                            "version_id": fragment.version_number,
                            "pages": f"{fragment.start_page}-{fragment.end_page}"
                        }
                    },
                    tags=[],
                    created_at=datetime.utcnow()
                ),
                score=float(fragment.similarity),
                distance=1.0 - float(fragment.similarity)
            )
            for fragment in fragments
        ]
    
    async def _get_text_embedding(self, text: str) -> Optional[List[float]]:
        """Get text embedding from embedder service."""
        try:
            # TODO: Implement gRPC call to embedder service
            # For now, return mock embedding
            import random
            random.seed(hash(text) % 2**32)
            return [random.uniform(-1, 1) for _ in range(384)]
        except Exception:
            return None
    
    async def _fallback_text_search(
        self,
        query_text: str,
        organization_id: UUID,
        document_id: Optional[UUID],
        classification_level: Optional[str],
        limit: int
    ) -> List[FragmentSearchResult]:
        """Fallback text search when vector search is unavailable."""
        query_conditions = [
            text("f.content ILIKE :query"),
            text("d.organization_id = :org_id")
        ]
        params = {
            "query": f"%{query_text}%",
            "org_id": organization_id
        }
        
        if document_id:
            query_conditions.append(text("f.document_id = :doc_id"))
            params["doc_id"] = document_id
        
        if classification_level:
            query_conditions.append(text("f.classification_level = :classification"))
            params["classification"] = classification_level
        
        stmt = text(f"""
            SELECT f.id, f.document_id, f.version_number, f.content, 
                   f.start_page, f.end_page, d.title as document_title,
                   0.8 as similarity
            FROM fragments f
            JOIN documents d ON f.document_id = d.id
            WHERE {' AND '.join([str(cond) for cond in query_conditions])}
            ORDER BY f.created_at DESC
            LIMIT :limit_val
        """)
        params["limit_val"] = limit
        
        result = await self.session.execute(stmt, params)
        fragments = result.fetchall()
        
        return [
            FragmentSearchResult(
                fragment=FragmentRead(
                    id=fragment.id,
                    document_id=fragment.document_id,
                    version_number=fragment.version_number,
                    content=fragment.content,
                    content_preview=self._create_highlight(fragment.content, query_text),
                    start_page=fragment.start_page,
                    end_page=fragment.end_page,
                    fragment_type="text",
                    language="en",
                    confidence_score=0.8,
                    classification_level="restricted",
                    metadata={
                        "document_title": fragment.document_title,
                        "provenance": {
                            "version_id": fragment.version_number,
                            "pages": f"{fragment.start_page}-{fragment.end_page}"
                        }
                    },
                    tags=[],
                    created_at=datetime.utcnow()
                ),
                score=float(fragment.similarity),
                distance=1.0 - float(fragment.similarity)
            )
            for fragment in fragments
        ]
    
    def _create_highlight(self, content: str, query: str) -> str:
        """Create highlighted preview of content."""
        # Simple highlighting - find query in content and show context
        query_lower = query.lower()
        content_lower = content.lower()
        
        # Find query position
        pos = content_lower.find(query_lower)
        if pos == -1:
            # Return first 200 chars if query not found
            return content[:200] + "..." if len(content) > 200 else content
        
        # Extract context around query
        start = max(0, pos - 100)
        end = min(len(content), pos + len(query) + 100)
        
        highlight = content[start:end]
        if start > 0:
            highlight = "..." + highlight
        if end < len(content):
            highlight = highlight + "..."
        
        return highlight
    
    async def delete_document(self, document_id: UUID, user_id: UUID) -> None:
        """Soft delete document and its versions."""
        # Get document
        document = await self._get_document_by_id(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Mark document as deleted (soft delete)
        document.deleted_at = datetime.utcnow()
        document.last_modified_by = user_id
        document.updated_at = datetime.utcnow()
        
        # Mark all versions as inactive
        stmt = text("""
            UPDATE document_versions 
            SET is_active = false 
            WHERE document_id = :doc_id
        """)
        await self.session.execute(stmt, {"doc_id": document_id})
        
        await self.session.commit()
        
        # TODO: Schedule file deletion from storage (keep for retention period)
    
    async def get_organization_usage(self, organization_id: UUID) -> Dict[str, Any]:
        """Get organization's data room usage statistics."""
        quota_check = await self.quota.check_quota(organization_id)
        
        # Get additional statistics
        stmt = text("""
            SELECT 
                COUNT(DISTINCT d.id) as document_count,
                COUNT(DISTINCT dv.id) as version_count,
                COUNT(DISTINCT f.id) as fragment_count,
                COALESCE(SUM(d.file_size), 0) as total_storage
            FROM documents d
            LEFT JOIN document_versions dv ON d.id = dv.document_id
            LEFT JOIN fragments f ON d.id = f.document_id
            WHERE d.organization_id = :org_id AND d.deleted_at IS NULL
        """)
        
        result = await self.session.execute(stmt, {"org_id": organization_id})
        stats = result.fetchone()
        
        return {
            "quota": quota_check,
            "statistics": {
                "documents": stats.document_count,
                "versions": stats.version_count,
                "fragments": stats.fragment_count,
                "storage_bytes": stats.total_storage
            }
        }