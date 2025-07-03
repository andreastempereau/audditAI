"""Secrets manager for encrypted credential storage with customer keys."""

import os
import base64
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import UUID

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import EncryptionKey, SecretsManager
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SecretsManagerError(Exception):
    """Base exception for secrets manager errors."""
    pass


class EncryptionError(SecretsManagerError):
    """Encryption/decryption error."""
    pass


class KeyNotFoundError(SecretsManagerError):
    """Encryption key not found."""
    pass


class SecretsManagerService:
    """Service for managing encrypted secrets with customer-specific keys."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.master_key = self._get_master_key()
    
    def _get_master_key(self) -> bytes:
        """Get or generate master encryption key from environment."""
        master_key_b64 = settings.encryption_master_key
        if not master_key_b64:
            # Generate a new master key if not set (development only)
            logger.warning("No master key found in environment. Generating temporary key.")
            master_key = Fernet.generate_key()
            return master_key
        
        try:
            return base64.b64decode(master_key_b64)
        except Exception as e:
            raise SecretsManagerError(f"Invalid master key format: {e}")
    
    def _derive_key_from_password(self, password: str, salt: bytes) -> bytes:
        """Derive encryption key from password using PBKDF2."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))
    
    async def create_organization_key(
        self,
        organization_id: UUID,
        key_name: str = "default",
        expires_days: Optional[int] = None
    ) -> EncryptionKey:
        """Create a new encryption key for an organization."""
        # Generate customer-specific key
        customer_key = Fernet.generate_key()
        
        # Encrypt customer key with master key
        master_fernet = Fernet(self.master_key)
        encrypted_customer_key = master_fernet.encrypt(customer_key)
        
        # Calculate expiration
        expires_at = None
        if expires_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        # Get next version number
        version_stmt = select(EncryptionKey).where(
            EncryptionKey.organization_id == organization_id,
            EncryptionKey.key_name == key_name
        ).order_by(EncryptionKey.key_version.desc()).limit(1)
        
        result = await self.session.execute(version_stmt)
        latest_key = result.scalar_one_or_none()
        next_version = (latest_key.key_version + 1) if latest_key else 1
        
        # Deactivate previous version
        if latest_key and latest_key.is_active:
            latest_key.is_active = False
        
        # Create new key
        encryption_key = EncryptionKey(
            organization_id=organization_id,
            key_name=key_name,
            key_version=next_version,
            encrypted_key=encrypted_customer_key,
            is_active=True,
            expires_at=expires_at
        )
        
        self.session.add(encryption_key)
        await self.session.commit()
        await self.session.refresh(encryption_key)
        
        logger.info(f"Created encryption key {key_name} v{next_version} for org {organization_id}")
        return encryption_key
    
    async def get_organization_key(
        self,
        organization_id: UUID,
        key_name: str = "default"
    ) -> Optional[bytes]:
        """Get active encryption key for organization."""
        stmt = select(EncryptionKey).where(
            EncryptionKey.organization_id == organization_id,
            EncryptionKey.key_name == key_name,
            EncryptionKey.is_active == True
        ).order_by(EncryptionKey.key_version.desc())
        
        result = await self.session.execute(stmt)
        key_record = result.scalar_one_or_none()
        
        if not key_record:
            # Auto-create default key for organization
            logger.info(f"Auto-creating default encryption key for org {organization_id}")
            key_record = await self.create_organization_key(organization_id, key_name)
        
        # Check expiration
        if key_record.expires_at and key_record.expires_at < datetime.utcnow():
            raise KeyNotFoundError(f"Encryption key {key_name} has expired")
        
        # Decrypt customer key with master key
        try:
            master_fernet = Fernet(self.master_key)
            customer_key = master_fernet.decrypt(key_record.encrypted_key)
            return customer_key
        except Exception as e:
            raise EncryptionError(f"Failed to decrypt customer key: {e}")
    
    async def store_secret(
        self,
        organization_id: UUID,
        secret_name: str,
        secret_type: str,
        secret_value: str,
        metadata: Optional[Dict[str, Any]] = None,
        expires_days: Optional[int] = None
    ) -> UUID:
        """Store an encrypted secret."""
        # Get organization encryption key
        customer_key = await self.get_organization_key(organization_id)
        fernet = Fernet(customer_key)
        
        # Encrypt the secret value
        try:
            encrypted_value = fernet.encrypt(secret_value.encode())
        except Exception as e:
            raise EncryptionError(f"Failed to encrypt secret: {e}")
        
        # Calculate expiration
        expires_at = None
        if expires_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        # Get encryption key record for foreign key
        key_stmt = select(EncryptionKey).where(
            EncryptionKey.organization_id == organization_id,
            EncryptionKey.key_name == "default",
            EncryptionKey.is_active == True
        ).order_by(EncryptionKey.key_version.desc())
        
        key_result = await self.session.execute(key_stmt)
        key_record = key_result.scalar_one()
        
        # Check if secret already exists
        existing_stmt = select(SecretsManager).where(
            SecretsManager.organization_id == organization_id,
            SecretsManager.secret_name == secret_name
        )
        
        existing_result = await self.session.execute(existing_stmt)
        existing_secret = existing_result.scalar_one_or_none()
        
        if existing_secret:
            # Update existing secret
            existing_secret.encrypted_value = encrypted_value
            existing_secret.secret_type = secret_type
            existing_secret.metadata = metadata or {}
            existing_secret.expires_at = expires_at
            existing_secret.updated_at = datetime.utcnow()
            existing_secret.is_active = True
            
            await self.session.commit()
            await self.session.refresh(existing_secret)
            
            logger.info(f"Updated secret {secret_name} for org {organization_id}")
            return existing_secret.id
        else:
            # Create new secret
            secret = SecretsManager(
                organization_id=organization_id,
                secret_name=secret_name,
                secret_type=secret_type,
                encrypted_value=encrypted_value,
                encryption_key_id=key_record.id,
                metadata=metadata or {},
                expires_at=expires_at
            )
            
            self.session.add(secret)
            await self.session.commit()
            await self.session.refresh(secret)
            
            logger.info(f"Stored secret {secret_name} for org {organization_id}")
            return secret.id
    
    async def get_secret(self, secret_id: UUID) -> Optional[str]:
        """Retrieve and decrypt a secret by ID."""
        secret = await self.session.get(SecretsManager, secret_id)
        if not secret or not secret.is_active:
            return None
        
        # Check expiration
        if secret.expires_at and secret.expires_at < datetime.utcnow():
            logger.warning(f"Secret {secret_id} has expired")
            return None
        
        # Get organization encryption key
        customer_key = await self.get_organization_key(secret.organization_id)
        fernet = Fernet(customer_key)
        
        try:
            decrypted_value = fernet.decrypt(secret.encrypted_value)
            return decrypted_value.decode()
        except Exception as e:
            raise EncryptionError(f"Failed to decrypt secret: {e}")
    
    async def get_secret_by_name(
        self,
        organization_id: UUID,
        secret_name: str
    ) -> Optional[str]:
        """Retrieve and decrypt a secret by name."""
        stmt = select(SecretsManager).where(
            SecretsManager.organization_id == organization_id,
            SecretsManager.secret_name == secret_name,
            SecretsManager.is_active == True
        )
        
        result = await self.session.execute(stmt)
        secret = result.scalar_one_or_none()
        
        if not secret:
            return None
        
        return await self.get_secret(secret.id)
    
    async def list_secrets(
        self,
        organization_id: UUID,
        secret_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List secrets for an organization (metadata only, no values)."""
        stmt = select(SecretsManager).where(
            SecretsManager.organization_id == organization_id,
            SecretsManager.is_active == True
        )
        
        if secret_type:
            stmt = stmt.where(SecretsManager.secret_type == secret_type)
        
        stmt = stmt.order_by(SecretsManager.created_at.desc())
        
        result = await self.session.execute(stmt)
        secrets = result.scalars().all()
        
        secret_list = []
        for secret in secrets:
            # Check if expired
            is_expired = (
                secret.expires_at and 
                secret.expires_at < datetime.utcnow()
            )
            
            secret_list.append({
                "id": str(secret.id),
                "name": secret.secret_name,
                "type": secret.secret_type,
                "metadata": secret.metadata,
                "created_at": secret.created_at.isoformat(),
                "updated_at": secret.updated_at.isoformat(),
                "expires_at": secret.expires_at.isoformat() if secret.expires_at else None,
                "is_expired": is_expired
            })
        
        return secret_list
    
    async def delete_secret(self, secret_id: UUID) -> bool:
        """Delete (deactivate) a secret."""
        secret = await self.session.get(SecretsManager, secret_id)
        if not secret:
            return False
        
        secret.is_active = False
        secret.updated_at = datetime.utcnow()
        
        await self.session.commit()
        
        logger.info(f"Deleted secret {secret.secret_name} (ID: {secret_id})")
        return True
    
    async def rotate_organization_key(
        self,
        organization_id: UUID,
        key_name: str = "default"
    ) -> EncryptionKey:
        """Rotate encryption key for an organization."""
        # Get all secrets using the current key
        stmt = select(SecretsManager).join(EncryptionKey).where(
            SecretsManager.organization_id == organization_id,
            EncryptionKey.key_name == key_name,
            EncryptionKey.is_active == True,
            SecretsManager.is_active == True
        )
        
        result = await self.session.execute(stmt)
        secrets_to_migrate = result.scalars().all()
        
        # Get current key for decryption
        old_key = await self.get_organization_key(organization_id, key_name)
        old_fernet = Fernet(old_key)
        
        # Create new key
        new_key_record = await self.create_organization_key(organization_id, key_name)
        new_key = await self.get_organization_key(organization_id, key_name)
        new_fernet = Fernet(new_key)
        
        # Re-encrypt all secrets with new key
        for secret in secrets_to_migrate:
            try:
                # Decrypt with old key
                decrypted_value = old_fernet.decrypt(secret.encrypted_value)
                
                # Encrypt with new key
                new_encrypted_value = new_fernet.encrypt(decrypted_value)
                
                # Update secret
                secret.encrypted_value = new_encrypted_value
                secret.encryption_key_id = new_key_record.id
                secret.updated_at = datetime.utcnow()
                
            except Exception as e:
                logger.error(f"Failed to migrate secret {secret.secret_name}: {e}")
                # Continue with other secrets
        
        await self.session.commit()
        
        logger.info(f"Rotated key {key_name} for org {organization_id}, migrated {len(secrets_to_migrate)} secrets")
        return new_key_record
    
    async def cleanup_expired_secrets(self) -> int:
        """Clean up expired secrets."""
        current_time = datetime.utcnow()
        
        # Deactivate expired secrets
        stmt = text("""
            UPDATE secrets_manager 
            SET is_active = false, updated_at = :current_time
            WHERE expires_at < :current_time AND is_active = true
        """)
        
        result = await self.session.execute(stmt, {"current_time": current_time})
        count = result.rowcount
        
        await self.session.commit()
        
        if count > 0:
            logger.info(f"Cleaned up {count} expired secrets")
        
        return count
    
    async def cleanup_expired_keys(self) -> int:
        """Clean up expired encryption keys."""
        current_time = datetime.utcnow()
        
        # Deactivate expired keys
        stmt = text("""
            UPDATE encryption_keys 
            SET is_active = false
            WHERE expires_at < :current_time AND is_active = true
        """)
        
        result = await self.session.execute(stmt, {"current_time": current_time})
        count = result.rowcount
        
        await self.session.commit()
        
        if count > 0:
            logger.info(f"Cleaned up {count} expired encryption keys")
        
        return count
    
    async def get_secrets_health(self, organization_id: UUID) -> Dict[str, Any]:
        """Get health status of secrets for an organization."""
        current_time = datetime.utcnow()
        
        # Count secrets by type and status
        stats_stmt = text("""
            SELECT 
                secret_type,
                COUNT(*) as total,
                COUNT(CASE WHEN expires_at IS NULL OR expires_at > :current_time THEN 1 END) as active,
                COUNT(CASE WHEN expires_at < :current_time THEN 1 END) as expired,
                COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
            FROM secrets_manager 
            WHERE organization_id = :org_id
            GROUP BY secret_type
        """)
        
        result = await self.session.execute(stats_stmt, {
            "org_id": organization_id,
            "current_time": current_time
        })
        
        type_stats = []
        for row in result.fetchall():
            type_stats.append({
                "type": row[0],
                "total": row[1],
                "active": row[2],
                "expired": row[3],
                "inactive": row[4]
            })
        
        # Get key information
        key_stmt = select(EncryptionKey).where(
            EncryptionKey.organization_id == organization_id,
            EncryptionKey.is_active == True
        ).order_by(EncryptionKey.created_at.desc())
        
        key_result = await self.session.execute(key_stmt)
        keys = key_result.scalars().all()
        
        key_info = []
        for key in keys:
            key_info.append({
                "name": key.key_name,
                "version": key.key_version,
                "created_at": key.created_at.isoformat(),
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "is_expired": key.expires_at and key.expires_at < current_time
            })
        
        return {
            "organization_id": str(organization_id),
            "secrets_by_type": type_stats,
            "encryption_keys": key_info,
            "health_check_time": current_time.isoformat()
        }