"""Authentication routes."""

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.models.auth import User
from app.schemas.auth import (
    LoginRequest, LoginResponse, UserCreate, UserRead,
    ProfileRead, ProfileUpdate, OrganizationCreate, OrganizationRead,
    PasswordResetRequest, PasswordResetConfirm, TokenResponse
)
from app.schemas.base import BaseResponse
from app.services.auth import AuthService
from app.services.organization import OrganizationService

router = APIRouter()
security = HTTPBearer()


@router.post("/register", response_model=BaseResponse[LoginResponse])
async def register(
    user_data: UserCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)]
) -> BaseResponse[LoginResponse]:
    """Register new user."""
    auth_service = AuthService(session)
    user_response = await auth_service.register_user(user_data)
    return BaseResponse(data=user_response)


@router.post("/login", response_model=BaseResponse[LoginResponse])
async def login(
    login_data: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)]
) -> BaseResponse[LoginResponse]:
    """Login user."""
    auth_service = AuthService(session)
    user_response = await auth_service.authenticate_user(
        email=login_data.email,
        password=login_data.password
    )
    return BaseResponse(data=user_response)


@router.post("/logout", response_model=BaseResponse[dict])
async def logout() -> BaseResponse[dict]:
    """Logout user (client-side token removal)."""
    return BaseResponse(data={"message": "Logged out successfully"})


@router.get("/me", response_model=BaseResponse[UserRead])
async def get_current_user_info(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[UserRead]:
    """Get current user info."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    return BaseResponse(data=UserRead(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        profile_picture_url=current_user.profile_picture_url,
        timezone=current_user.timezone,
        language=current_user.language,
        notification_preferences=current_user.notification_preferences,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    ))


@router.get("/profile", response_model=BaseResponse[ProfileRead])
async def get_profile(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[ProfileRead]:
    """Get user profile."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get user's organizations
    org_service = OrganizationService(session)
    organizations = await org_service.get_user_organizations(current_user.id)
    
    return BaseResponse(data=ProfileRead(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        profile_picture_url=current_user.profile_picture_url,
        timezone=current_user.timezone,
        language=current_user.language,
        notification_preferences=current_user.notification_preferences,
        organizations=organizations,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    ))


@router.put("/profile", response_model=BaseResponse[ProfileRead])
async def update_profile(
    profile_data: ProfileUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[ProfileRead]:
    """Update user profile."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Update user fields
    if profile_data.first_name is not None:
        current_user.first_name = profile_data.first_name
    if profile_data.last_name is not None:
        current_user.last_name = profile_data.last_name
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone
    if profile_data.profile_picture_url is not None:
        current_user.profile_picture_url = profile_data.profile_picture_url
    if profile_data.timezone is not None:
        current_user.timezone = profile_data.timezone
    if profile_data.language is not None:
        current_user.language = profile_data.language
    if profile_data.notification_preferences is not None:
        current_user.notification_preferences = profile_data.notification_preferences
    
    current_user.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(current_user)
    
    # Get user's organizations for the response
    org_service = OrganizationService(session)
    organizations = await org_service.get_user_organizations(current_user.id)
    
    return BaseResponse(data=ProfileRead(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        profile_picture_url=current_user.profile_picture_url,
        timezone=current_user.timezone,
        language=current_user.language,
        notification_preferences=current_user.notification_preferences,
        organizations=organizations,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    ))


@router.post("/organizations", response_model=BaseResponse[OrganizationRead])
async def create_organization(
    org_data: OrganizationCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[OrganizationRead]:
    """Create new organization."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    org_service = OrganizationService(session)
    organization = await org_service.create_organization(org_data, current_user.id)
    return BaseResponse(data=organization)


@router.post("/reset-password", response_model=BaseResponse[dict])
async def reset_password_request(
    reset_data: PasswordResetRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)]
) -> BaseResponse[dict]:
    """Request password reset."""
    auth_service = AuthService(session)
    await auth_service.request_password_reset(reset_data.email)
    return BaseResponse(data={"message": "Password reset email sent"})


@router.post("/reset-password/confirm", response_model=BaseResponse[dict])
async def reset_password_confirm(
    reset_data: PasswordResetConfirm,
    session: Annotated[AsyncSession, Depends(get_async_session)]
) -> BaseResponse[dict]:
    """Confirm password reset."""
    auth_service = AuthService(session)
    await auth_service.confirm_password_reset(
        token=reset_data.token,
        new_password=reset_data.new_password
    )
    return BaseResponse(data={"message": "Password reset successfully"})


@router.post("/refresh", response_model=BaseResponse[TokenResponse])
async def refresh_token(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[TokenResponse]:
    """Refresh access token."""
    try:
        from jose import jwt, JWTError
        from app.core.config import get_settings
        
        settings = get_settings()
        token = credentials.credentials
        
        # Decode and validate refresh token
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        
        user_id = payload.get("sub")
        token_type = payload.get("type")
        
        if token_type != "refresh" or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Get user and generate new tokens
        auth_service = AuthService(session)
        user = await auth_service.get_user_by_id(UUID(user_id))
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Generate new access token
        from app.services.auth import AuthService
        new_access_token = auth_service._create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        
        return BaseResponse(data=TokenResponse(
            access_token=new_access_token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60
        ))
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )