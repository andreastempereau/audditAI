"""Enhanced authentication service with MFA and password reset."""

import base64
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID

import pyotp
import qrcode
from io import BytesIO
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.governance import (
    EmailVerificationToken, PasswordResetToken, 
    UserMFASettings, MFAVerificationAttempt
)
from app.core.config import get_settings
from app.services.email import EmailService

logger = logging.getLogger(__name__)
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthenticationError(Exception):
    """Base authentication exception."""
    pass


class MFARequiredError(AuthenticationError):
    """MFA verification required."""
    pass


class InvalidTokenError(AuthenticationError):
    """Invalid or expired token."""
    pass


class EnhancedAuthService:
    """Enhanced authentication service with MFA and security features."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.email_service = EmailService()
        self.token_expiry_hours = 24
        self.mfa_issuer = "CrossAudit AI"
        self.backup_codes_count = 10
    
    # Password Management
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt."""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        return pwd_context.verify(plain_password, hashed_password)
    
    async def register_user(
        self,
        email: str,
        password: str,
        full_name: str,
        organization_id: UUID
    ) -> Tuple[User, str]:
        """Register new user with email verification."""
        # Check if user exists
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise AuthenticationError("User with this email already exists")
        
        # Create user
        user = User(
            email=email,
            hashed_password=self.hash_password(password),
            full_name=full_name,
            organization_id=organization_id,
            is_active=False,  # Require email verification
            is_verified=False
        )
        
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        
        # Create email verification token
        verification_token = await self.create_email_verification_token(user.id, email)
        
        # Send verification email
        await self.email_service.send_verification_email(
            email=email,
            full_name=full_name,
            verification_token=verification_token
        )
        
        logger.info(f"User registered: {email}")
        return user, verification_token
    
    async def create_email_verification_token(self, user_id: UUID, email: str) -> str:
        """Create email verification token."""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=self.token_expiry_hours)
        
        verification = EmailVerificationToken(
            user_id=user_id,
            email=email,
            token=token,
            expires_at=expires_at
        )
        
        self.session.add(verification)
        await self.session.commit()
        
        return token
    
    async def verify_email(self, token: str) -> User:
        """Verify email with token."""
        stmt = select(EmailVerificationToken).where(
            EmailVerificationToken.token == token,
            EmailVerificationToken.verified_at.is_(None),
            EmailVerificationToken.expires_at > datetime.utcnow()
        )
        
        result = await self.session.execute(stmt)
        verification = result.scalar_one_or_none()
        
        if not verification:
            raise InvalidTokenError("Invalid or expired verification token")
        
        # Mark as verified
        verification.verified_at = datetime.utcnow()
        
        # Activate user
        user = await self.session.get(User, verification.user_id)
        if not user:
            raise AuthenticationError("User not found")
        
        user.is_active = True
        user.is_verified = True
        user.email_verified_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(user)
        
        logger.info(f"Email verified for user: {user.email}")
        return user
    
    async def resend_verification_email(self, email: str) -> bool:
        """Resend verification email."""
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        if user.is_verified:
            return False  # Already verified
        
        # Deactivate old tokens
        await self.session.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.verified_at.is_(None)
            ).execution_options(synchronize_session="fetch")
        )
        
        # Create new token
        verification_token = await self.create_email_verification_token(user.id, email)
        
        # Send email
        await self.email_service.send_verification_email(
            email=email,
            full_name=user.full_name,
            verification_token=verification_token
        )
        
        return True
    
    # Password Reset
    
    async def request_password_reset(self, email: str) -> bool:
        """Request password reset."""
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            # Don't reveal if user exists
            return True
        
        # Create reset token
        reset_token = await self.create_password_reset_token(user.id)
        
        # Send reset email
        await self.email_service.send_password_reset_email(
            email=email,
            full_name=user.full_name,
            reset_token=reset_token
        )
        
        logger.info(f"Password reset requested for: {email}")
        return True
    
    async def create_password_reset_token(self, user_id: UUID) -> str:
        """Create password reset token."""
        # Create signed JWT token
        payload = {
            "sub": str(user_id),
            "type": "password_reset",
            "exp": datetime.utcnow() + timedelta(hours=self.token_expiry_hours)
        }
        
        token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        
        # Store in database for tracking
        reset_record = PasswordResetToken(
            user_id=user_id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=self.token_expiry_hours)
        )
        
        self.session.add(reset_record)
        await self.session.commit()
        
        return token
    
    async def reset_password(self, token: str, new_password: str) -> User:
        """Reset password with token."""
        try:
            # Verify JWT token
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )
            
            if payload.get("type") != "password_reset":
                raise InvalidTokenError("Invalid token type")
            
            user_id = UUID(payload.get("sub"))
            
        except (JWTError, ValueError) as e:
            raise InvalidTokenError(f"Invalid token: {e}")
        
        # Check if token was already used
        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token == token,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.utcnow()
        )
        
        result = await self.session.execute(stmt)
        reset_record = result.scalar_one_or_none()
        
        if not reset_record:
            raise InvalidTokenError("Invalid or expired reset token")
        
        # Get user
        user = await self.session.get(User, user_id)
        if not user:
            raise AuthenticationError("User not found")
        
        # Update password
        user.hashed_password = self.hash_password(new_password)
        user.password_changed_at = datetime.utcnow()
        
        # Mark token as used
        reset_record.used_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(user)
        
        logger.info(f"Password reset for user: {user.email}")
        return user
    
    # MFA Management
    
    async def setup_mfa(self, user_id: UUID) -> Tuple[str, str, List[str]]:
        """
        Setup MFA for user.
        Returns: (secret_key, qr_code_base64, backup_codes)
        """
        # Check if MFA already exists
        stmt = select(UserMFASettings).where(UserMFASettings.user_id == user_id)
        result = await self.session.execute(stmt)
        existing_mfa = result.scalar_one_or_none()
        
        if existing_mfa and existing_mfa.is_enabled:
            raise AuthenticationError("MFA is already enabled")
        
        # Get user for email
        user = await self.session.get(User, user_id)
        if not user:
            raise AuthenticationError("User not found")
        
        # Generate secret key
        secret_key = pyotp.random_base32()
        
        # Generate backup codes
        backup_codes = [secrets.token_hex(4).upper() for _ in range(self.backup_codes_count)]
        
        # Create/update MFA settings
        if existing_mfa:
            existing_mfa.secret_key = secret_key
            existing_mfa.backup_codes = backup_codes
            existing_mfa.updated_at = datetime.utcnow()
        else:
            mfa_settings = UserMFASettings(
                user_id=user_id,
                secret_key=secret_key,
                backup_codes=backup_codes,
                is_enabled=False  # Not enabled until first successful verification
            )
            self.session.add(mfa_settings)
        
        await self.session.commit()
        
        # Generate QR code
        totp_uri = pyotp.totp.TOTP(secret_key).provisioning_uri(
            name=user.email,
            issuer_name=self.mfa_issuer
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buf = BytesIO()
        img.save(buf, format='PNG')
        qr_code_base64 = base64.b64encode(buf.getvalue()).decode()
        
        logger.info(f"MFA setup initiated for user: {user.email}")
        return secret_key, qr_code_base64, backup_codes
    
    async def verify_mfa_setup(self, user_id: UUID, totp_code: str) -> bool:
        """Verify MFA setup with TOTP code."""
        stmt = select(UserMFASettings).where(
            UserMFASettings.user_id == user_id,
            UserMFASettings.is_enabled == False
        )
        
        result = await self.session.execute(stmt)
        mfa_settings = result.scalar_one_or_none()
        
        if not mfa_settings or not mfa_settings.secret_key:
            raise AuthenticationError("MFA setup not found")
        
        # Verify TOTP code
        totp = pyotp.TOTP(mfa_settings.secret_key)
        
        if totp.verify(totp_code, valid_window=1):
            # Enable MFA
            mfa_settings.is_enabled = True
            mfa_settings.updated_at = datetime.utcnow()
            
            await self.session.commit()
            
            logger.info(f"MFA enabled for user ID: {user_id}")
            return True
        
        return False
    
    async def verify_mfa(
        self,
        user_id: UUID,
        code: str,
        code_type: str = "totp",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Verify MFA code (TOTP or backup code)."""
        stmt = select(UserMFASettings).where(
            UserMFASettings.user_id == user_id,
            UserMFASettings.is_enabled == True
        )
        
        result = await self.session.execute(stmt)
        mfa_settings = result.scalar_one_or_none()
        
        if not mfa_settings:
            raise AuthenticationError("MFA not enabled")
        
        success = False
        
        if code_type == "totp":
            # Verify TOTP code
            totp = pyotp.TOTP(mfa_settings.secret_key)
            success = totp.verify(code, valid_window=1)
        
        elif code_type == "backup":
            # Verify backup code
            if code in (mfa_settings.backup_codes or []):
                # Remove used backup code
                mfa_settings.backup_codes.remove(code)
                success = True
        
        # Log verification attempt
        attempt = MFAVerificationAttempt(
            user_id=user_id,
            attempt_type=code_type,
            success=success,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.session.add(attempt)
        
        if success:
            await self.session.commit()
            logger.info(f"MFA verification successful for user ID: {user_id}")
        else:
            # Check for too many failed attempts
            await self._check_mfa_lockout(user_id)
            await self.session.commit()
            logger.warning(f"MFA verification failed for user ID: {user_id}")
        
        return success
    
    async def _check_mfa_lockout(self, user_id: UUID):
        """Check if user should be locked out due to failed MFA attempts."""
        # Count recent failed attempts (last 15 minutes)
        cutoff_time = datetime.utcnow() - timedelta(minutes=15)
        
        stmt = select(MFAVerificationAttempt).where(
            MFAVerificationAttempt.user_id == user_id,
            MFAVerificationAttempt.success == False,
            MFAVerificationAttempt.created_at > cutoff_time
        )
        
        result = await self.session.execute(stmt)
        failed_attempts = result.scalars().all()
        
        if len(failed_attempts) >= 5:
            # Lock the account
            user = await self.session.get(User, user_id)
            if user:
                user.is_locked = True
                user.locked_at = datetime.utcnow()
                user.lock_reason = "Too many failed MFA attempts"
                
                logger.warning(f"User locked due to failed MFA attempts: {user.email}")
    
    async def regenerate_backup_codes(self, user_id: UUID) -> List[str]:
        """Regenerate MFA backup codes."""
        stmt = select(UserMFASettings).where(
            UserMFASettings.user_id == user_id,
            UserMFASettings.is_enabled == True
        )
        
        result = await self.session.execute(stmt)
        mfa_settings = result.scalar_one_or_none()
        
        if not mfa_settings:
            raise AuthenticationError("MFA not enabled")
        
        # Generate new backup codes
        backup_codes = [secrets.token_hex(4).upper() for _ in range(self.backup_codes_count)]
        
        mfa_settings.backup_codes = backup_codes
        mfa_settings.updated_at = datetime.utcnow()
        
        await self.session.commit()
        
        logger.info(f"Backup codes regenerated for user ID: {user_id}")
        return backup_codes
    
    async def disable_mfa(self, user_id: UUID, password: str) -> bool:
        """Disable MFA (requires password confirmation)."""
        # Verify user password
        user = await self.session.get(User, user_id)
        if not user or not self.verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid password")
        
        stmt = select(UserMFASettings).where(UserMFASettings.user_id == user_id)
        result = await self.session.execute(stmt)
        mfa_settings = result.scalar_one_or_none()
        
        if not mfa_settings or not mfa_settings.is_enabled:
            return False
        
        # Disable MFA
        mfa_settings.is_enabled = False
        mfa_settings.secret_key = None
        mfa_settings.backup_codes = []
        mfa_settings.updated_at = datetime.utcnow()
        
        await self.session.commit()
        
        logger.info(f"MFA disabled for user: {user.email}")
        return True
    
    # Login with MFA
    
    async def login(
        self,
        email: str,
        password: str,
        mfa_code: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """Login with email/password and optional MFA."""
        # Get user
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user or not self.verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid email or password")
        
        if not user.is_active:
            raise AuthenticationError("Account is not active")
        
        if user.is_locked:
            raise AuthenticationError("Account is locked")
        
        # Check if MFA is enabled
        stmt = select(UserMFASettings).where(
            UserMFASettings.user_id == user.id,
            UserMFASettings.is_enabled == True
        )
        result = await self.session.execute(stmt)
        mfa_settings = result.scalar_one_or_none()
        
        if mfa_settings:
            if not mfa_code:
                raise MFARequiredError("MFA verification required")
            
            # Verify MFA code
            mfa_valid = await self.verify_mfa(
                user.id, mfa_code, "totp", ip_address, user_agent
            )
            
            if not mfa_valid:
                # Try backup code
                mfa_valid = await self.verify_mfa(
                    user.id, mfa_code, "backup", ip_address, user_agent
                )
            
            if not mfa_valid:
                raise AuthenticationError("Invalid MFA code")
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        user.last_login_ip = ip_address
        await self.session.commit()
        
        # Generate access token
        access_token = await self.create_access_token(user)
        
        logger.info(f"User logged in: {email}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "organization_id": str(user.organization_id),
                "is_admin": user.is_admin,
                "mfa_enabled": mfa_settings is not None
            }
        }
    
    async def create_access_token(self, user: User) -> str:
        """Create JWT access token."""
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "org_id": str(user.organization_id),
            "is_admin": user.is_admin,
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        
        return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    
    # OAuth Integration
    
    async def get_or_create_oauth_user(
        self,
        email: str,
        full_name: str,
        provider: str,
        provider_user_id: str,
        organization_id: UUID
    ) -> User:
        """Get or create user from OAuth provider."""
        # Check if user exists
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user:
            # Update OAuth info
            user.oauth_provider = provider
            user.oauth_provider_id = provider_user_id
            user.last_login_at = datetime.utcnow()
        else:
            # Create new user
            user = User(
                email=email,
                full_name=full_name,
                organization_id=organization_id,
                oauth_provider=provider,
                oauth_provider_id=provider_user_id,
                is_active=True,
                is_verified=True,
                email_verified_at=datetime.utcnow()
            )
            self.session.add(user)
        
        await self.session.commit()
        await self.session.refresh(user)
        
        logger.info(f"OAuth user logged in: {email} via {provider}")
        return user