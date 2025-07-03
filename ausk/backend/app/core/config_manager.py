"""Configuration management system for CrossAudit AI."""

import json
import logging
from typing import Any, Dict, Optional, List
from pathlib import Path
from uuid import UUID

import yaml
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.exceptions import ConfigurationError
from app.models.governance import ConfigurationSetting

logger = logging.getLogger(__name__)
settings = get_settings()


class ConfigurationManager:
    """Centralized configuration management."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache = {}
        self._schema_cache = {}
    
    # Database Configuration Methods
    
    async def get_setting(
        self,
        key: str,
        organization_id: Optional[UUID] = None,
        default: Any = None
    ) -> Any:
        """Get a configuration setting."""
        cache_key = f"{organization_id or 'global'}:{key}"
        
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        try:
            # Try organization-specific setting first
            if organization_id:
                stmt = select(ConfigurationSetting).where(
                    ConfigurationSetting.organization_id == organization_id,
                    ConfigurationSetting.key == key,
                    ConfigurationSetting.is_active == True
                )
                result = await self.session.execute(stmt)
                setting = result.scalar_one_or_none()
                
                if setting:
                    value = self._deserialize_value(setting.value, setting.data_type)
                    self._cache[cache_key] = value
                    return value
            
            # Fall back to global setting
            global_cache_key = f"global:{key}"
            if global_cache_key in self._cache:
                return self._cache[global_cache_key]
            
            stmt = select(ConfigurationSetting).where(
                ConfigurationSetting.organization_id.is_(None),
                ConfigurationSetting.key == key,
                ConfigurationSetting.is_active == True
            )
            result = await self.session.execute(stmt)
            setting = result.scalar_one_or_none()
            
            if setting:
                value = self._deserialize_value(setting.value, setting.data_type)
                self._cache[global_cache_key] = value
                self._cache[cache_key] = value  # Cache for org-specific key too
                return value
            
            # Return default if no setting found
            self._cache[cache_key] = default
            return default
            
        except Exception as e:
            logger.error(f"Failed to get setting {key}: {e}")
            return default
    
    async def set_setting(
        self,
        key: str,
        value: Any,
        organization_id: Optional[UUID] = None,
        description: Optional[str] = None,
        is_secret: bool = False,
        validation_schema: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Set a configuration setting."""
        try:
            # Validate value against schema if provided
            if validation_schema:
                self._validate_value(value, validation_schema)
            
            data_type = self._infer_data_type(value)
            serialized_value = self._serialize_value(value, data_type)
            
            # Check if setting exists
            stmt = select(ConfigurationSetting).where(
                ConfigurationSetting.key == key,
                ConfigurationSetting.organization_id == organization_id
            )
            result = await self.session.execute(stmt)
            existing_setting = result.scalar_one_or_none()
            
            if existing_setting:
                # Update existing setting
                existing_setting.value = serialized_value
                existing_setting.data_type = data_type
                existing_setting.description = description or existing_setting.description
                existing_setting.is_secret = is_secret
                existing_setting.validation_schema = validation_schema
            else:
                # Create new setting
                new_setting = ConfigurationSetting(
                    key=key,
                    value=serialized_value,
                    data_type=data_type,
                    organization_id=organization_id,
                    description=description,
                    is_secret=is_secret,
                    validation_schema=validation_schema
                )
                self.session.add(new_setting)
            
            await self.session.commit()
            
            # Update cache
            cache_key = f"{organization_id or 'global'}:{key}"
            self._cache[cache_key] = value
            
            logger.info(f"Configuration setting updated: {key}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to set setting {key}: {e}")
            await self.session.rollback()
            return False
    
    async def delete_setting(
        self,
        key: str,
        organization_id: Optional[UUID] = None
    ) -> bool:
        """Delete a configuration setting."""
        try:
            stmt = select(ConfigurationSetting).where(
                ConfigurationSetting.key == key,
                ConfigurationSetting.organization_id == organization_id
            )
            result = await self.session.execute(stmt)
            setting = result.scalar_one_or_none()
            
            if setting:
                await self.session.delete(setting)
                await self.session.commit()
                
                # Remove from cache
                cache_key = f"{organization_id or 'global'}:{key}"
                self._cache.pop(cache_key, None)
                
                logger.info(f"Configuration setting deleted: {key}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to delete setting {key}: {e}")
            await self.session.rollback()
            return False
    
    async def get_all_settings(
        self,
        organization_id: Optional[UUID] = None,
        include_secrets: bool = False
    ) -> Dict[str, Any]:
        """Get all configuration settings."""
        try:
            conditions = [ConfigurationSetting.is_active == True]
            
            if organization_id:
                conditions.append(ConfigurationSetting.organization_id == organization_id)
            else:
                conditions.append(ConfigurationSetting.organization_id.is_(None))
            
            if not include_secrets:
                conditions.append(ConfigurationSetting.is_secret == False)
            
            stmt = select(ConfigurationSetting).where(*conditions)
            result = await self.session.execute(stmt)
            settings_list = result.scalars().all()
            
            settings_dict = {}
            for setting in settings_list:
                value = self._deserialize_value(setting.value, setting.data_type)
                settings_dict[setting.key] = {
                    "value": value,
                    "data_type": setting.data_type,
                    "description": setting.description,
                    "is_secret": setting.is_secret,
                    "updated_at": setting.updated_at.isoformat()
                }
            
            return settings_dict
            
        except Exception as e:
            logger.error(f"Failed to get all settings: {e}")
            return {}
    
    # File-based Configuration Methods
    
    def load_config_file(self, file_path: str) -> Dict[str, Any]:
        """Load configuration from a file."""
        try:
            path = Path(file_path)
            
            if not path.exists():
                raise ConfigurationError(f"Configuration file not found: {file_path}")
            
            with open(path, 'r') as f:
                if path.suffix.lower() in ['.yml', '.yaml']:
                    config = yaml.safe_load(f)
                elif path.suffix.lower() == '.json':
                    config = json.load(f)
                else:
                    raise ConfigurationError(f"Unsupported configuration file format: {path.suffix}")
            
            logger.info(f"Loaded configuration from {file_path}")
            return config
            
        except Exception as e:
            logger.error(f"Failed to load configuration file {file_path}: {e}")
            raise ConfigurationError(f"Failed to load configuration: {e}")
    
    def save_config_file(self, config: Dict[str, Any], file_path: str) -> bool:
        """Save configuration to a file."""
        try:
            path = Path(file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(path, 'w') as f:
                if path.suffix.lower() in ['.yml', '.yaml']:
                    yaml.dump(config, f, default_flow_style=False, sort_keys=True)
                elif path.suffix.lower() == '.json':
                    json.dump(config, f, indent=2, sort_keys=True)
                else:
                    raise ConfigurationError(f"Unsupported configuration file format: {path.suffix}")
            
            logger.info(f"Saved configuration to {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save configuration file {file_path}: {e}")
            return False
    
    # Schema Validation Methods
    
    def register_config_schema(self, schema_name: str, schema: Dict[str, Any]):
        """Register a configuration schema for validation."""
        self._schema_cache[schema_name] = schema
        logger.info(f"Registered configuration schema: {schema_name}")
    
    def validate_config(self, config: Dict[str, Any], schema_name: str) -> tuple[bool, List[str]]:
        """Validate configuration against a schema."""
        if schema_name not in self._schema_cache:
            return False, [f"Schema not found: {schema_name}"]
        
        schema = self._schema_cache[schema_name]
        errors = []
        
        try:
            self._validate_config_recursive(config, schema, "", errors)
            return len(errors) == 0, errors
            
        except Exception as e:
            errors.append(f"Validation error: {e}")
            return False, errors
    
    # Environment Configuration Methods
    
    def get_environment_config(self) -> Dict[str, Any]:
        """Get configuration from environment variables."""
        env_config = {
            "database_url": settings.database_url,
            "redis_url": settings.redis_url,
            "environment": getattr(settings, 'environment', 'development'),
            "debug": settings.debug,
            "jwt_secret_key": "***" if settings.jwt_secret_key else None,
            "encryption_key": "***" if settings.encryption_key else None,
            "openai_api_key": "***" if settings.openai_api_key else None,
            "anthropic_api_key": "***" if settings.anthropic_api_key else None,
            "stripe_secret_key": "***" if settings.stripe_secret_key else None,
            "smtp_server": settings.smtp_server,
            "smtp_port": settings.smtp_port,
            "from_email": settings.from_email,
            "frontend_url": settings.frontend_url,
            "allowed_origins": settings.allowed_origins,
            "allowed_hosts": settings.allowed_hosts,
        }
        
        return {k: v for k, v in env_config.items() if v is not None}
    
    # Cache Management
    
    def clear_cache(self, pattern: Optional[str] = None):
        """Clear configuration cache."""
        if pattern:
            keys_to_remove = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            self._cache.clear()
        
        logger.info(f"Configuration cache cleared (pattern: {pattern})")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "cache_size": len(self._cache),
            "schema_cache_size": len(self._schema_cache),
            "cached_keys": list(self._cache.keys())
        }
    
    # Helper Methods
    
    def _serialize_value(self, value: Any, data_type: str) -> str:
        """Serialize value for storage."""
        if data_type == "json":
            return json.dumps(value)
        elif data_type == "yaml":
            return yaml.dump(value)
        else:
            return str(value)
    
    def _deserialize_value(self, value: str, data_type: str) -> Any:
        """Deserialize value from storage."""
        try:
            if data_type == "string":
                return value
            elif data_type == "integer":
                return int(value)
            elif data_type == "float":
                return float(value)
            elif data_type == "boolean":
                return value.lower() in ("true", "1", "yes", "on")
            elif data_type == "json":
                return json.loads(value)
            elif data_type == "yaml":
                return yaml.safe_load(value)
            else:
                return value
        except (ValueError, json.JSONDecodeError, yaml.YAMLError) as e:
            logger.warning(f"Failed to deserialize value '{value}' as {data_type}: {e}")
            return value
    
    def _infer_data_type(self, value: Any) -> str:
        """Infer data type from value."""
        if isinstance(value, bool):
            return "boolean"
        elif isinstance(value, int):
            return "integer"
        elif isinstance(value, float):
            return "float"
        elif isinstance(value, str):
            return "string"
        elif isinstance(value, (dict, list)):
            return "json"
        else:
            return "string"
    
    def _validate_value(self, value: Any, schema: Dict[str, Any]):
        """Validate value against schema."""
        # Simple validation implementation
        value_type = type(value).__name__
        expected_type = schema.get("type")
        
        if expected_type and value_type != expected_type:
            raise ConfigurationError(f"Expected {expected_type}, got {value_type}")
        
        if "min" in schema and value < schema["min"]:
            raise ConfigurationError(f"Value {value} is below minimum {schema['min']}")
        
        if "max" in schema and value > schema["max"]:
            raise ConfigurationError(f"Value {value} is above maximum {schema['max']}")
        
        if "enum" in schema and value not in schema["enum"]:
            raise ConfigurationError(f"Value {value} not in allowed values: {schema['enum']}")
    
    def _validate_config_recursive(
        self,
        config: Dict[str, Any],
        schema: Dict[str, Any],
        path: str,
        errors: List[str]
    ):
        """Recursively validate configuration."""
        # This would implement full JSON Schema validation
        # For now, just basic validation
        
        for key, expected in schema.get("properties", {}).items():
            current_path = f"{path}.{key}" if path else key
            
            if key in config:
                try:
                    self._validate_value(config[key], expected)
                except ConfigurationError as e:
                    errors.append(f"{current_path}: {e}")
            elif expected.get("required", False):
                errors.append(f"{current_path}: Required field missing")


# Default configuration schemas
DEFAULT_SCHEMAS = {
    "policy_config": {
        "type": "object",
        "properties": {
            "enabled": {"type": "boolean", "required": True},
            "evaluation_timeout": {"type": "integer", "min": 1, "max": 300},
            "retry_attempts": {"type": "integer", "min": 0, "max": 5},
            "cache_results": {"type": "boolean"},
            "alert_on_violation": {"type": "boolean"}
        }
    },
    "evaluator_config": {
        "type": "object",
        "properties": {
            "provider": {"type": "string", "enum": ["openai", "anthropic", "google", "local"]},
            "model": {"type": "string"},
            "temperature": {"type": "float", "min": 0.0, "max": 2.0},
            "max_tokens": {"type": "integer", "min": 1, "max": 8192},
            "timeout": {"type": "integer", "min": 1, "max": 300}
        }
    },
    "notification_config": {
        "type": "object",
        "properties": {
            "enabled": {"type": "boolean", "required": True},
            "channels": {"type": "array"},
            "rate_limit": {"type": "integer", "min": 1},
            "digest_frequency": {"type": "string", "enum": ["never", "daily", "weekly"]}
        }
    }
}


def get_config_manager(session: AsyncSession) -> ConfigurationManager:
    """Get a configuration manager instance."""
    manager = ConfigurationManager(session)
    
    # Register default schemas
    for schema_name, schema in DEFAULT_SCHEMAS.items():
        manager.register_config_schema(schema_name, schema)
    
    return manager