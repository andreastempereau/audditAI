"""Authentication service layer."""

import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.auth import User, UserOrganization
from app.models.organization import Organization
from app.schemas.auth import UserCreate, LoginResponse, UserRead

settings = get_settings()


class AuthService:
    """Authentication service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def register_user(self, user_data: UserCreate) -> LoginResponse:
        """Register new user."""
        # Check if user already exists
        stmt = select(User).where(User.email == user_data.email)
        result = await self.session.execute(stmt)
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Hash password
        password_hash = bcrypt.hashpw(
            user_data.password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        # Create user
        user = User(
            id=uuid4(),
            email=user_data.email,
            password_hash=password_hash,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            profile_picture_url=user_data.profile_picture_url,
            timezone=user_data.timezone or "UTC",
            language=user_data.language or "en",
            notification_preferences=user_data.notification_preferences or {},
            is_active=True,
            email_verified=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        
        # Generate tokens
        access_token = self._create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        refresh_token = self._create_refresh_token(
            data={"sub": str(user.id)}
        )
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            user=UserRead(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                profile_picture_url=user.profile_picture_url,
                timezone=user.timezone,
                language=user.language,
                notification_preferences=user.notification_preferences,
                is_active=user.is_active,
                email_verified=user.email_verified,
                last_login_at=user.last_login_at,
                created_at=user.created_at,
                updated_at=user.updated_at
            )
        )
    
    async def authenticate_user(self, email: str, password: str) -> LoginResponse:
        """Authenticate user with email and password."""
        # Get user with organizations
        stmt = (
            select(User)
            .options(selectinload(User.organizations))
            .where(User.email == email)
        )
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Check password
        if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
            )
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        await self.session.commit()
        
        # Get user's primary organization
        primary_org_id = None
        if user.organizations:
            # For now, use the first organization as primary
            primary_org_id = user.organizations[0].org_id
        
        # Generate tokens
        token_data = {"sub": str(user.id), "email": user.email}
        if primary_org_id:
            token_data["org_id"] = str(primary_org_id)
            
        access_token = self._create_access_token(data=token_data)
        refresh_token = self._create_refresh_token(data={"sub": str(user.id)})
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            user=UserRead(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                profile_picture_url=user.profile_picture_url,
                timezone=user.timezone,
                language=user.language,
                notification_preferences=user.notification_preferences,
                is_active=user.is_active,
                email_verified=user.email_verified,
                last_login_at=user.last_login_at,
                created_at=user.created_at,
                updated_at=user.updated_at
            )
        )
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def request_password_reset(self, email: str) -> None:
        """Request password reset."""
        user = await self.get_user_by_email(email)
        if not user:
            # Don't reveal if user exists
            return
        
        # Generate reset token
        reset_token = self._create_password_reset_token(str(user.id))
        
        # TODO: Send email with reset token
        # For now, we'll just store it (in production, send email)
        print(f"Password reset token for {email}: {reset_token}")
    
    async def confirm_password_reset(self, token: str, new_password: str) -> None:
        """Confirm password reset with token."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )
            user_id = payload.get("sub")
            token_type = payload.get("type")
            
            if token_type != "password_reset" or not user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid reset token"
                )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        # Get user
        user = await self.get_user_by_id(UUID(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        # Update password
        password_hash = bcrypt.hashpw(
            new_password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        user.password_hash = password_hash
        user.updated_at = datetime.utcnow()
        
        await self.session.commit()
    
    def _create_access_token(self, data: Dict[str, Any]) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
        to_encode.update({"exp": expire, "type": "access"})
        
        return jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )
    
    def _create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create JWT refresh token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days)
        to_encode.update({"exp": expire, "type": "refresh"})
        
        return jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )
    
    def _create_password_reset_token(self, user_id: str) -> str:
        """Create password reset token."""
        expire = datetime.utcnow() + timedelta(hours=1)  # 1 hour expiry
        to_encode = {
            "sub": user_id,
            "exp": expire,
            "type": "password_reset"
        }
        
        return jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )