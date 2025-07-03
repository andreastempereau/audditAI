"""Fragment search routes for semantic document search."""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.base import BaseResponse
from app.schemas.documents import FragmentSearchResult
from app.services.data_room import DataRoomService

router = APIRouter()
security = HTTPBearer()


@router.post("/search", response_model=BaseResponse[List[FragmentSearchResult]])
async def search_fragments(
    query: str,
    document_id: Optional[UUID] = None,
    classification_level: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    session: Annotated[AsyncSession, Depends(get_async_session)] = Depends(get_async_session),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)] = Depends(security)
) -> BaseResponse[List[FragmentSearchResult]]:
    """Search document fragments using semantic similarity."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    data_room_service = DataRoomService(session)
    results = await data_room_service.search_fragments(
        query_text=query,
        organization_id=org_id,
        user_id=current_user.id,
        document_id=document_id,
        classification_level=classification_level,
        limit=limit
    )
    return BaseResponse(data=results)


@router.get("/search", response_model=BaseResponse[List[FragmentSearchResult]])
async def search_fragments_get(
    q: str = Query(..., description="Search query"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    classification: Optional[str] = Query(None, description="Filter by classification level"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum results to return"),
    session: Annotated[AsyncSession, Depends(get_async_session)] = Depends(get_async_session),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)] = Depends(security)
) -> BaseResponse[List[FragmentSearchResult]]:
    """Search document fragments using semantic similarity (GET method)."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    data_room_service = DataRoomService(session)
    results = await data_room_service.search_fragments(
        query_text=q,
        organization_id=org_id,
        user_id=current_user.id,
        document_id=document_id,
        classification_level=classification,
        limit=limit
    )
    return BaseResponse(data=results)