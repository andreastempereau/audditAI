#!/usr/bin/env python3
"""Database initialization script for CrossAudit AI."""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_async_session, init_db
from app.models.auth import User, Organization
from app.models.governance import SubscriptionPlan, AlertRule
from app.models.rbac import Role, Permission, Department
from app.services.auth_enhanced import EnhancedAuthService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)
settings = get_settings()


async def run_migrations():
    """Run database migrations."""
    logger.info("Running database migrations...")
    
    try:
        # Initialize database (creates tables)
        await init_db()
        logger.info("Database tables created successfully")
        
        # Run any additional migration scripts
        migration_dir = Path(__file__).parent.parent.parent / "migrations"
        
        if migration_dir.exists():
            migration_files = sorted(migration_dir.glob("*.sql"))
            
            async for session in get_async_session():
                for migration_file in migration_files:
                    logger.info(f"Running migration: {migration_file.name}")
                    
                    with open(migration_file, 'r') as f:
                        migration_sql = f.read()
                    
                    # Split by statements and execute
                    statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
                    
                    for statement in statements:
                        try:
                            await session.execute(text(statement))
                        except Exception as e:
                            # Some statements might fail if already applied
                            logger.warning(f"Migration statement failed (may be expected): {e}")
                    
                    await session.commit()
                    logger.info(f"Migration {migration_file.name} completed")
                
                break  # Exit after first session
        
        logger.info("Database migrations completed successfully")
        
    except Exception as e:
        logger.error(f"Database migration failed: {e}")
        raise


async def seed_default_data():
    """Seed database with default data."""
    logger.info("Seeding database with default data...")
    
    try:
        async for session in get_async_session():
            # Create default subscription plans
            await create_default_subscription_plans(session)
            
            # Create default roles and permissions
            await create_default_rbac(session)
            
            # Create default alert rules
            await create_default_alert_rules(session)
            
            # Create admin organization if not exists
            await create_admin_organization(session)
            
            await session.commit()
            logger.info("Database seeding completed successfully")
            break
            
    except Exception as e:
        logger.error(f"Database seeding failed: {e}")
        raise


async def create_default_subscription_plans(session: AsyncSession):
    """Create default subscription plans."""
    logger.info("Creating default subscription plans...")
    
    plans = [
        {
            "name": "starter",
            "display_name": "Starter",
            "description": "Perfect for small teams getting started with AI governance",
            "price_monthly": 49.00,
            "price_yearly": 490.00,
            "features": [
                "Up to 5 users",
                "10,000 API calls/month",
                "1GB storage",
                "Basic policy templates",
                "Email support"
            ],
            "quotas": {
                "users": 5,
                "api_calls": 10000,
                "storage": 1073741824,  # 1GB
                "tokens": 50000,
                "evaluator_calls": 1000
            },
            "is_active": True
        },
        {
            "name": "business",
            "display_name": "Business",
            "description": "For growing companies with advanced governance needs",
            "price_monthly": 149.00,
            "price_yearly": 1490.00,
            "features": [
                "Up to 25 users",
                "100,000 API calls/month",
                "10GB storage",
                "Advanced policy templates",
                "Custom evaluators",
                "Priority support"
            ],
            "quotas": {
                "users": 25,
                "api_calls": 100000,
                "storage": 10737418240,  # 10GB
                "tokens": 500000,
                "evaluator_calls": 10000
            },
            "is_active": True
        },
        {
            "name": "enterprise",
            "display_name": "Enterprise",
            "description": "For large organizations with enterprise-grade requirements",
            "price_monthly": 499.00,
            "price_yearly": 4990.00,
            "features": [
                "Unlimited users",
                "Unlimited API calls",
                "100GB storage",
                "Custom policy development",
                "Dedicated evaluators",
                "24/7 support",
                "SLA guarantee"
            ],
            "quotas": {
                "users": -1,  # Unlimited
                "api_calls": -1,  # Unlimited
                "storage": 107374182400,  # 100GB
                "tokens": -1,  # Unlimited
                "evaluator_calls": -1  # Unlimited
            },
            "is_active": True
        }
    ]
    
    for plan_data in plans:
        # Check if plan already exists
        existing_plan = await session.execute(
            text("SELECT id FROM subscription_plans WHERE name = :name"),
            {"name": plan_data["name"]}
        )
        
        if not existing_plan.scalar_one_or_none():
            plan = SubscriptionPlan(**plan_data)
            session.add(plan)
            logger.info(f"Created subscription plan: {plan_data['name']}")


async def create_default_rbac(session: AsyncSession):
    """Create default roles and permissions."""
    logger.info("Creating default RBAC structure...")
    
    # Default permissions
    permissions = [
        # Authentication
        {"name": "auth:login", "description": "Can log in to the system"},
        {"name": "auth:logout", "description": "Can log out of the system"},
        {"name": "auth:change_password", "description": "Can change own password"},
        
        # Users
        {"name": "users:read", "description": "Can view user information"},
        {"name": "users:create", "description": "Can create new users"},
        {"name": "users:update", "description": "Can update user information"},
        {"name": "users:delete", "description": "Can delete users"},
        
        # Organizations
        {"name": "organizations:read", "description": "Can view organization information"},
        {"name": "organizations:update", "description": "Can update organization settings"},
        {"name": "organizations:manage_billing", "description": "Can manage billing and subscriptions"},
        
        # Documents
        {"name": "documents:read", "description": "Can view documents"},
        {"name": "documents:upload", "description": "Can upload documents"},
        {"name": "documents:delete", "description": "Can delete documents"},
        {"name": "documents:process", "description": "Can process documents"},
        
        # Policies
        {"name": "policies:read", "description": "Can view policies"},
        {"name": "policies:create", "description": "Can create policies"},
        {"name": "policies:update", "description": "Can update policies"},
        {"name": "policies:delete", "description": "Can delete policies"},
        {"name": "policies:test", "description": "Can test policies"},
        
        # Evaluators
        {"name": "evaluators:read", "description": "Can view evaluators"},
        {"name": "evaluators:create", "description": "Can create evaluators"},
        {"name": "evaluators:update", "description": "Can update evaluators"},
        {"name": "evaluators:delete", "description": "Can delete evaluators"},
        
        # Analytics
        {"name": "analytics:read", "description": "Can view analytics and reports"},
        {"name": "analytics:export", "description": "Can export analytics data"},
        
        # Admin
        {"name": "admin:full_access", "description": "Full administrative access"},
        {"name": "admin:user_management", "description": "Can manage all users"},
        {"name": "admin:system_settings", "description": "Can modify system settings"},
    ]
    
    permission_objects = []
    for perm_data in permissions:
        # Check if permission already exists
        existing_perm = await session.execute(
            text("SELECT id FROM permissions WHERE name = :name"),
            {"name": perm_data["name"]}
        )
        
        if not existing_perm.scalar_one_or_none():
            permission = Permission(**perm_data)
            session.add(permission)
            permission_objects.append(permission)
            logger.info(f"Created permission: {perm_data['name']}")
    
    await session.flush()  # Ensure permissions are saved before creating roles
    
    # Default roles
    roles = [
        {
            "name": "admin",
            "description": "Full system administrator",
            "permissions": ["admin:full_access"]  # Admin gets all permissions
        },
        {
            "name": "org_admin",
            "description": "Organization administrator",
            "permissions": [
                "auth:login", "auth:logout", "auth:change_password",
                "users:read", "users:create", "users:update", "users:delete",
                "organizations:read", "organizations:update", "organizations:manage_billing",
                "documents:read", "documents:upload", "documents:delete", "documents:process",
                "policies:read", "policies:create", "policies:update", "policies:delete", "policies:test",
                "evaluators:read", "evaluators:create", "evaluators:update", "evaluators:delete",
                "analytics:read", "analytics:export"
            ]
        },
        {
            "name": "policy_manager",
            "description": "Can manage policies and evaluators",
            "permissions": [
                "auth:login", "auth:logout", "auth:change_password",
                "users:read",
                "organizations:read",
                "documents:read", "documents:upload", "documents:process",
                "policies:read", "policies:create", "policies:update", "policies:delete", "policies:test",
                "evaluators:read", "evaluators:create", "evaluators:update", "evaluators:delete",
                "analytics:read"
            ]
        },
        {
            "name": "analyst",
            "description": "Can view and analyze data",
            "permissions": [
                "auth:login", "auth:logout", "auth:change_password",
                "users:read",
                "organizations:read",
                "documents:read",
                "policies:read", "policies:test",
                "evaluators:read",
                "analytics:read", "analytics:export"
            ]
        },
        {
            "name": "user",
            "description": "Basic user with limited access",
            "permissions": [
                "auth:login", "auth:logout", "auth:change_password",
                "organizations:read",
                "documents:read", "documents:upload",
                "policies:read",
                "evaluators:read",
                "analytics:read"
            ]
        }
    ]
    
    for role_data in roles:
        # Check if role already exists
        existing_role = await session.execute(
            text("SELECT id FROM roles WHERE name = :name"),
            {"name": role_data["name"]}
        )
        
        if not existing_role.scalar_one_or_none():
            role = Role(
                name=role_data["name"],
                description=role_data["description"]
            )
            session.add(role)
            logger.info(f"Created role: {role_data['name']}")


async def create_default_alert_rules(session: AsyncSession):
    """Create default alert rules."""
    logger.info("Creating default alert rules...")
    
    # This would create system-wide default alert rules
    # For now, we'll skip this as it requires organization context
    pass


async def create_admin_organization(session: AsyncSession):
    """Create admin organization if it doesn't exist."""
    logger.info("Creating admin organization...")
    
    # Check if admin org exists
    existing_org = await session.execute(
        text("SELECT id FROM organizations WHERE name = :name"),
        {"name": "CrossAudit Admin"}
    )
    
    if not existing_org.scalar_one_or_none():
        admin_org = Organization(
            name="CrossAudit Admin",
            email="admin@crossaudit.ai",
            website="https://crossaudit.ai",
            description="System administration organization"
        )
        session.add(admin_org)
        await session.flush()
        
        # Create admin user if environment variables are set
        admin_email = settings.get("ADMIN_EMAIL", "admin@crossaudit.ai")
        admin_password = settings.get("ADMIN_PASSWORD", "")
        
        if admin_password:
            auth_service = EnhancedAuthService(session)
            
            try:
                admin_user, _ = await auth_service.register_user(
                    email=admin_email,
                    password=admin_password,
                    full_name="System Administrator",
                    organization_id=admin_org.id
                )
                
                # Make user admin and verify email
                admin_user.is_admin = True
                admin_user.is_verified = True
                admin_user.is_active = True
                
                logger.info(f"Created admin user: {admin_email}")
                
            except Exception as e:
                logger.warning(f"Could not create admin user: {e}")
        
        logger.info("Created admin organization")


async def main():
    """Main initialization function."""
    logger.info("Starting CrossAudit AI database initialization...")
    
    try:
        # Run migrations
        await run_migrations()
        
        # Seed default data
        await seed_default_data()
        
        logger.info("Database initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())