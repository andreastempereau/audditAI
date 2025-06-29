"""Document management routes."""

from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.base import BaseResponse
from app.schemas.documents import (
    DocumentCreate, DocumentRead, DocumentUpdate,
    DocumentVersionRead, FragmentSearch, FragmentSearchResult,
    FileUploadResponse
)
from app.services.documents import DocumentService

router = APIRouter()
security = HTTPBearer()


@router.post("/", response_model=BaseResponse[DocumentRead])
async def create_document(
    doc_data: DocumentCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[DocumentRead]:
    """Create new document."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    doc_service = DocumentService(session)
    document = await doc_service.create_document(doc_data, current_user.id, org_id)
    return BaseResponse(data=document)


@router.get("/", response_model=BaseResponse[List[DocumentRead]])
async def get_documents(
    limit: int = 50,
    offset: int = 0,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[DocumentRead]]:
    """Get organization documents."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    doc_service = DocumentService(session)
    documents = await doc_service.get_organization_documents(org_id, limit, offset)
    return BaseResponse(data=documents)


@router.get("/{document_id}", response_model=BaseResponse[DocumentRead])
async def get_document(
    document_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[DocumentRead]:
    """Get specific document."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    doc_service = DocumentService(session)
    document = await doc_service.get_document_by_id(document_id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # TODO: Check user has permission to access this document
    
    return BaseResponse(data=DocumentRead(
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
    ))


@router.put("/{document_id}", response_model=BaseResponse[DocumentRead])
async def update_document(
    document_id: UUID,
    doc_data: DocumentUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[DocumentRead]:
    """Update document metadata."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    doc_service = DocumentService(session)
    document = await doc_service.update_document(document_id, doc_data, current_user.id)
    return BaseResponse(data=document)


@router.post("/{document_id}/upload", response_model=BaseResponse[FileUploadResponse])
async def upload_file(
    document_id: UUID,
    file: UploadFile = File(...),
    session: Annotated[AsyncSession, Depends(get_async_session)] = Depends(get_async_session),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)] = Depends(security)
) -> BaseResponse[FileUploadResponse]:
    """Upload file for document."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Validate file size (max 100MB)
    max_size = 100 * 1024 * 1024  # 100MB
    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 100MB"
        )
    
    doc_service = DocumentService(session)
    result = await doc_service.upload_file(document_id, file, current_user.id)
    return BaseResponse(data=result)


@router.get("/{document_id}/versions", response_model=BaseResponse[List[DocumentVersionRead]])
async def get_document_versions(
    document_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[DocumentVersionRead]]:
    """Get all versions of a document."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check user has permission to access this document
    
    doc_service = DocumentService(session)
    versions = await doc_service.get_document_versions(document_id)
    return BaseResponse(data=versions)


@router.post("/search", response_model=BaseResponse[List[FragmentSearchResult]])
async def search_fragments(
    search_request: FragmentSearch,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[FragmentSearchResult]]:
    """Search document fragments."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    doc_service = DocumentService(session)
    results = await doc_service.search_fragments(search_request, org_id)
    return BaseResponse(data=results)