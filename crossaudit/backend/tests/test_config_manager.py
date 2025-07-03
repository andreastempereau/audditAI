"""Tests for configuration management functionality."""

import pytest
import pytest_asyncio
import json
import yaml
from uuid import uuid4
from pathlib import Path
from tempfile import NamedTemporaryFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config_manager import ConfigurationManager, get_config_manager
from app.core.exceptions import ConfigurationError


class TestConfigurationManager:
    """Test cases for ConfigurationManager."""
    
    @pytest_asyncio.fixture
    async def config_manager(self, session: AsyncSession):
        """Create configuration manager instance."""
        return get_config_manager(session)
    
    @pytest_asyncio.fixture
    async def test_organization_id(self):
        """Create test organization ID."""
        return uuid4()
    
    async def test_set_and_get_setting(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test setting and getting a configuration value."""
        key = "test_setting"
        value = "test_value"
        
        # Set setting
        success = await config_manager.set_setting(
            key=key,
            value=value,
            organization_id=test_organization_id,
            description="Test setting for unit tests"
        )
        
        assert success is True
        
        # Get setting
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id
        )
        
        assert retrieved_value == value
    
    async def test_get_setting_with_default(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test getting a non-existent setting with default value."""
        key = "non_existent_setting"
        default_value = "default_value"
        
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id,
            default=default_value
        )
        
        assert retrieved_value == default_value
    
    async def test_global_setting_fallback(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test fallback to global setting when org-specific setting doesn't exist."""
        key = "global_setting"
        global_value = "global_value"
        
        # Set global setting
        await config_manager.set_setting(
            key=key,
            value=global_value,
            organization_id=None,  # Global setting
            description="Global test setting"
        )
        
        # Get setting for organization (should fallback to global)
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id
        )
        
        assert retrieved_value == global_value
    
    async def test_organization_specific_override(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test organization-specific setting overriding global setting."""
        key = "override_setting"
        global_value = "global_value"
        org_value = "org_value"
        
        # Set global setting
        await config_manager.set_setting(
            key=key,
            value=global_value,
            organization_id=None
        )
        
        # Set organization-specific setting
        await config_manager.set_setting(
            key=key,
            value=org_value,
            organization_id=test_organization_id
        )
        
        # Get setting for organization (should return org-specific value)
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id
        )
        
        assert retrieved_value == org_value
    
    async def test_different_data_types(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test storing and retrieving different data types."""
        test_cases = [
            ("string_setting", "test_string", str),
            ("int_setting", 42, int),
            ("float_setting", 3.14, float),
            ("bool_setting", True, bool),
            ("dict_setting", {"key": "value", "number": 123}, dict),
            ("list_setting", [1, 2, 3, "four"], list)
        ]
        
        for key, value, expected_type in test_cases:
            # Set setting
            success = await config_manager.set_setting(
                key=key,
                value=value,
                organization_id=test_organization_id
            )
            assert success is True
            
            # Get setting
            retrieved_value = await config_manager.get_setting(
                key=key,
                organization_id=test_organization_id
            )
            
            assert retrieved_value == value
            assert isinstance(retrieved_value, expected_type)
    
    async def test_secret_setting(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test storing and retrieving secret settings."""
        key = "api_key"
        secret_value = "sk-secret-api-key-12345"
        
        # Set secret setting
        success = await config_manager.set_setting(
            key=key,
            value=secret_value,
            organization_id=test_organization_id,
            is_secret=True,
            description="Secret API key"
        )
        
        assert success is True
        
        # Get secret setting
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id
        )
        
        assert retrieved_value == secret_value
    
    async def test_update_existing_setting(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test updating an existing setting."""
        key = "update_setting"
        original_value = "original_value"
        updated_value = "updated_value"
        
        # Set original setting
        await config_manager.set_setting(
            key=key,
            value=original_value,
            organization_id=test_organization_id
        )
        
        # Update setting
        success = await config_manager.set_setting(
            key=key,
            value=updated_value,
            organization_id=test_organization_id,
            description="Updated description"
        )
        
        assert success is True
        
        # Verify updated value
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id
        )
        
        assert retrieved_value == updated_value
    
    async def test_delete_setting(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test deleting a setting."""
        key = "delete_setting"
        value = "to_be_deleted"
        
        # Set setting
        await config_manager.set_setting(
            key=key,
            value=value,
            organization_id=test_organization_id
        )
        
        # Verify setting exists
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id
        )
        assert retrieved_value == value
        
        # Delete setting
        success = await config_manager.delete_setting(
            key=key,
            organization_id=test_organization_id
        )
        
        assert success is True
        
        # Verify setting is deleted
        retrieved_value = await config_manager.get_setting(
            key=key,
            organization_id=test_organization_id,
            default="default"
        )
        assert retrieved_value == "default"
    
    async def test_get_all_settings(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test getting all settings for an organization."""
        # Set multiple settings
        settings = {
            "setting1": "value1",
            "setting2": 42,
            "setting3": {"nested": "object"}
        }
        
        for key, value in settings.items():
            await config_manager.set_setting(
                key=key,
                value=value,
                organization_id=test_organization_id
            )
        
        # Get all settings
        all_settings = await config_manager.get_all_settings(
            organization_id=test_organization_id
        )
        
        assert isinstance(all_settings, dict)
        assert len(all_settings) >= len(settings)
        
        for key, value in settings.items():
            assert key in all_settings
            assert all_settings[key]["value"] == value
    
    async def test_get_all_settings_exclude_secrets(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test getting all settings excluding secrets."""
        # Set regular and secret settings
        await config_manager.set_setting(
            key="regular_setting",
            value="regular_value",
            organization_id=test_organization_id
        )
        
        await config_manager.set_setting(
            key="secret_setting",
            value="secret_value",
            organization_id=test_organization_id,
            is_secret=True
        )
        
        # Get all settings excluding secrets
        all_settings = await config_manager.get_all_settings(
            organization_id=test_organization_id,
            include_secrets=False
        )
        
        assert "regular_setting" in all_settings
        assert "secret_setting" not in all_settings
        
        # Get all settings including secrets
        all_settings_with_secrets = await config_manager.get_all_settings(
            organization_id=test_organization_id,
            include_secrets=True
        )
        
        assert "regular_setting" in all_settings_with_secrets
        assert "secret_setting" in all_settings_with_secrets
    
    def test_load_config_file_yaml(self, config_manager: ConfigurationManager):
        """Test loading configuration from YAML file."""
        config_data = {
            "database": {
                "host": "localhost",
                "port": 5432,
                "name": "testdb"
            },
            "api": {
                "timeout": 30,
                "retries": 3
            }
        }
        
        with NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(config_data, f)
            yaml_path = f.name
        
        try:
            loaded_config = config_manager.load_config_file(yaml_path)
            assert loaded_config == config_data
        finally:
            Path(yaml_path).unlink()
    
    def test_load_config_file_json(self, config_manager: ConfigurationManager):
        """Test loading configuration from JSON file."""
        config_data = {
            "server": {
                "host": "0.0.0.0",
                "port": 8000
            },
            "features": {
                "enable_logging": True,
                "max_requests": 1000
            }
        }
        
        with NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            json_path = f.name
        
        try:
            loaded_config = config_manager.load_config_file(json_path)
            assert loaded_config == config_data
        finally:
            Path(json_path).unlink()
    
    def test_load_config_file_not_found(self, config_manager: ConfigurationManager):
        """Test loading configuration from non-existent file."""
        with pytest.raises(ConfigurationError):
            config_manager.load_config_file("/non/existent/file.yaml")
    
    def test_save_config_file_yaml(self, config_manager: ConfigurationManager):
        """Test saving configuration to YAML file."""
        config_data = {
            "test": {
                "setting1": "value1",
                "setting2": 42
            }
        }
        
        with NamedTemporaryFile(suffix='.yaml', delete=False) as f:
            yaml_path = f.name
        
        try:
            success = config_manager.save_config_file(config_data, yaml_path)
            assert success is True
            
            # Verify file content
            with open(yaml_path, 'r') as f:
                saved_data = yaml.safe_load(f)
            
            assert saved_data == config_data
        finally:
            Path(yaml_path).unlink()
    
    def test_save_config_file_json(self, config_manager: ConfigurationManager):
        """Test saving configuration to JSON file."""
        config_data = {
            "test": {
                "setting1": "value1",
                "setting2": 42
            }
        }
        
        with NamedTemporaryFile(suffix='.json', delete=False) as f:
            json_path = f.name
        
        try:
            success = config_manager.save_config_file(config_data, json_path)
            assert success is True
            
            # Verify file content
            with open(json_path, 'r') as f:
                saved_data = json.load(f)
            
            assert saved_data == config_data
        finally:
            Path(json_path).unlink()
    
    def test_register_and_validate_schema(self, config_manager: ConfigurationManager):
        """Test registering and validating configuration schema."""
        schema_name = "test_schema"
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string", "required": True},
                "age": {"type": "integer", "min": 0, "max": 150},
                "email": {"type": "string"}
            }
        }
        
        # Register schema
        config_manager.register_config_schema(schema_name, schema)
        
        # Valid configuration
        valid_config = {
            "name": "John Doe",
            "age": 30,
            "email": "john@example.com"
        }
        
        is_valid, errors = config_manager.validate_config(valid_config, schema_name)
        assert is_valid is True
        assert len(errors) == 0
        
        # Invalid configuration (missing required field)
        invalid_config = {
            "age": 30,
            "email": "john@example.com"
        }
        
        is_valid, errors = config_manager.validate_config(invalid_config, schema_name)
        assert is_valid is False
        assert len(errors) > 0
    
    def test_get_environment_config(self, config_manager: ConfigurationManager):
        """Test getting environment configuration."""
        env_config = config_manager.get_environment_config()
        
        assert isinstance(env_config, dict)
        # Should contain basic environment settings
        expected_keys = ["database_url", "redis_url", "debug"]
        for key in expected_keys:
            assert key in env_config
    
    def test_cache_functionality(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test configuration caching functionality."""
        key = "cache_test"
        value = "cached_value"
        
        # Set setting
        await config_manager.set_setting(
            key=key,
            value=value,
            organization_id=test_organization_id
        )
        
        # Get cache stats
        cache_stats = config_manager.get_cache_stats()
        assert "cache_size" in cache_stats
        assert "schema_cache_size" in cache_stats
        assert "cached_keys" in cache_stats
        
        # Clear cache
        config_manager.clear_cache()
        
        # Verify cache is cleared
        cache_stats_after = config_manager.get_cache_stats()
        assert cache_stats_after["cache_size"] == 0
    
    def test_cache_pattern_clearing(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test clearing cache with pattern matching."""
        # Set multiple settings
        await config_manager.set_setting(
            key="api_setting",
            value="api_value",
            organization_id=test_organization_id
        )
        
        await config_manager.set_setting(
            key="db_setting",
            value="db_value",
            organization_id=test_organization_id
        )
        
        # Clear only API-related cache
        config_manager.clear_cache(pattern="api")
        
        # Verify selective clearing
        cache_stats = config_manager.get_cache_stats()
        cached_keys = cache_stats["cached_keys"]
        
        # Should not contain API keys but may contain DB keys
        api_keys = [key for key in cached_keys if "api" in key]
        assert len(api_keys) == 0
    
    async def test_validation_schema_setting(
        self,
        config_manager: ConfigurationManager,
        test_organization_id
    ):
        """Test setting with validation schema."""
        key = "validated_setting"
        value = 50
        validation_schema = {
            "type": "integer",
            "min": 0,
            "max": 100
        }
        
        # Set setting with validation
        success = await config_manager.set_setting(
            key=key,
            value=value,
            organization_id=test_organization_id,
            validation_schema=validation_schema
        )
        
        assert success is True
        
        # Try to set invalid value
        with pytest.raises(ConfigurationError):
            await config_manager.set_setting(
                key=key,
                value=150,  # Above max
                organization_id=test_organization_id,
                validation_schema=validation_schema
            )