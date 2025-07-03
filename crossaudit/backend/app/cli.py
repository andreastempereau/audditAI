"""CLI commands for CrossAudit AI platform management."""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, TaskID
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.core.config import get_settings
from app.services.rbac import RBACService
from app.services.audit import AuditService
from app.services.metrics_enhanced import EnhancedMetricsService
from app.services.admin_enhanced import EnhancedAdminService

# Initialize CLI
app = typer.Typer(name="crossaudit", help="CrossAudit AI Platform CLI")
console = Console()
settings = get_settings()

# Create async engine for CLI operations
engine = create_async_engine(settings.database_url)


async def get_session() -> AsyncSession:
    """Get database session."""
    return AsyncSession(engine)


# Permission management commands
@app.command("sync-permissions")
def sync_permissions(
    definition_file: str = typer.Option(
        "permissions.json",
        "--file", "-f",
        help="Path to permission definitions JSON file"
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Show what would be changed without making changes"
    )
):
    """Sync permissions from canonical definitions file."""
    asyncio.run(_sync_permissions(definition_file, dry_run))


async def _sync_permissions(definition_file: str, dry_run: bool):
    """Async implementation of permission sync."""
    console.print(f"[blue]Loading permission definitions from {definition_file}...[/blue]")
    
    try:
        with open(definition_file, 'r') as f:
            permission_definitions = json.load(f)
    except FileNotFoundError:
        console.print(f"[red]Error: File {definition_file} not found[/red]")
        raise typer.Exit(1)
    except json.JSONDecodeError as e:
        console.print(f"[red]Error: Invalid JSON in {definition_file}: {e}[/red]")
        raise typer.Exit(1)
    
    console.print(f"[green]Loaded {len(permission_definitions)} permission definitions[/green]")
    
    if dry_run:
        console.print("[yellow]DRY RUN MODE - No changes will be made[/yellow]")
    
    async with get_session() as session:
        rbac_service = RBACService(session)
        await rbac_service.initialize_redis()
        
        # Sync permissions
        results = await rbac_service.sync_permissions_from_definitions(permission_definitions)
        
        # Display results
        table = Table(title="Permission Sync Results")
        table.add_column("Operation", style="cyan")
        table.add_column("Count", style="magenta")
        
        table.add_row("Created", str(results["created"]))
        table.add_row("Updated", str(results["updated"]))
        table.add_row("Deactivated", str(results["deactivated"]))
        
        console.print(table)
        
        if results["errors"]:
            console.print("[red]Errors encountered:[/red]")
            for error in results["errors"]:
                console.print(f"  • {error}")
        else:
            console.print("[green]✓ Permission sync completed successfully[/green]")


@app.command("create-permission-template")
def create_permission_template(
    output_file: str = typer.Option(
        "permissions_template.json",
        "--output", "-o",
        help="Output file for permission template"
    )
):
    """Create a template permissions.json file."""
    template = [
        {
            "name": "chat.message:create",
            "display_name": "Create Chat Message",
            "description": "Ability to send messages in chat",
            "resource": "chat.message",
            "action": "create",
            "conditions": {}
        },
        {
            "name": "chat.message:read",
            "display_name": "Read Chat Messages",
            "description": "Ability to view chat messages",
            "resource": "chat.message",
            "action": "read",
            "conditions": {}
        },
        {
            "name": "chat.message:update",
            "display_name": "Update Chat Message",
            "description": "Ability to edit own messages",
            "resource": "chat.message",
            "action": "update",
            "conditions": {"own_only": True}
        },
        {
            "name": "document:create",
            "display_name": "Create Document",
            "description": "Ability to upload new documents",
            "resource": "document",
            "action": "create",
            "conditions": {}
        },
        {
            "name": "document:read",
            "display_name": "Read Document",
            "description": "Ability to view documents",
            "resource": "document",
            "action": "read",
            "conditions": {
                "max_classification": "restricted"
            }
        },
        {
            "name": "admin.audit:view",
            "display_name": "View Audit Logs",
            "description": "Ability to view audit trail",
            "resource": "admin.audit",
            "action": "view",
            "conditions": {
                "ip_restrictions": ["192.168.1.0/24", "10.0.0.0/8"],
                "time_restrictions": {
                    "start_time": "09:00:00",
                    "end_time": "17:00:00"
                }
            }
        }
    ]
    
    with open(output_file, 'w') as f:
        json.dump(template, f, indent=2)
    
    console.print(f"[green]✓ Permission template created: {output_file}[/green]")


@app.command("list-permissions")
def list_permissions(
    organization_id: Optional[str] = typer.Option(None, "--org", help="Organization ID"),
    resource: Optional[str] = typer.Option(None, "--resource", help="Filter by resource"),
    active_only: bool = typer.Option(True, "--active-only", help="Show only active permissions")
):
    """List all permissions in the system."""
    asyncio.run(_list_permissions(organization_id, resource, active_only))


async def _list_permissions(organization_id: Optional[str], resource: Optional[str], active_only: bool):
    """Async implementation of list permissions."""
    async with get_session() as session:
        rbac_service = RBACService(session)
        
        permissions = await rbac_service.get_all_permissions()
        
        # Filter permissions
        if resource:
            permissions = [p for p in permissions if p.resource == resource]
        if active_only:
            permissions = [p for p in permissions if p.is_active]
        
        # Display permissions table
        table = Table(title="System Permissions")
        table.add_column("Name", style="cyan")
        table.add_column("Resource", style="magenta")
        table.add_column("Action", style="yellow")
        table.add_column("Conditions", style="green")
        table.add_column("Active", style="red")
        
        for perm in permissions:
            conditions_str = json.dumps(perm.conditions) if perm.conditions else "{}"
            table.add_row(
                perm.name,
                perm.resource,
                perm.action,
                conditions_str[:50] + "..." if len(conditions_str) > 50 else conditions_str,
                "✓" if perm.is_active else "✗"
            )
        
        console.print(table)
        console.print(f"[blue]Total permissions: {len(permissions)}[/blue]")


# RBAC analytics commands
@app.command("rbac-analytics")
def rbac_analytics(
    organization_id: str = typer.Argument(..., help="Organization ID"),
    days: int = typer.Option(30, "--days", help="Number of days to analyze")
):
    """Get RBAC analytics for organization."""
    asyncio.run(_rbac_analytics(organization_id, days))


async def _rbac_analytics(organization_id: str, days: int):
    """Async implementation of RBAC analytics."""
    async with get_session() as session:
        rbac_service = RBACService(session)
        await rbac_service.initialize_redis()
        
        analytics = await rbac_service.get_rbac_analytics(UUID(organization_id), days)
        
        console.print(f"[blue]RBAC Analytics for Organization {organization_id}[/blue]")
        console.print(f"[green]Analysis Period: {days} days[/green]\n")
        
        # Role distribution
        console.print("[bold]Role Distribution:[/bold]")
        role_table = Table()
        role_table.add_column("Role", style="cyan")
        role_table.add_column("Display Name", style="magenta")
        role_table.add_column("Users", style="yellow")
        
        for role in analytics["role_distribution"]:
            role_table.add_row(role["role"], role["display_name"], str(role["user_count"]))
        
        console.print(role_table)
        
        # Permission usage
        console.print("\n[bold]Top Permission Usage:[/bold]")
        perm_table = Table()
        perm_table.add_column("Permission", style="cyan")
        perm_table.add_column("Resource", style="magenta")
        perm_table.add_column("Action", style="yellow")
        perm_table.add_column("Users", style="green")
        
        for perm in analytics["permission_usage"][:10]:
            perm_table.add_row(
                perm["permission"],
                perm["resource"],
                perm["action"],
                str(perm["user_count"])
            )
        
        console.print(perm_table)


# Audit commands
@app.command("audit-export")
def audit_export(
    organization_id: str = typer.Argument(..., help="Organization ID"),
    output_file: str = typer.Option("audit_export.json", "--output", help="Output file"),
    days: int = typer.Option(30, "--days", help="Number of days to export"),
    format: str = typer.Option("json", "--format", help="Export format (json/csv)")
):
    """Export audit logs for compliance."""
    asyncio.run(_audit_export(organization_id, output_file, days, format))


async def _audit_export(organization_id: str, output_file: str, days: int, format: str):
    """Async implementation of audit export."""
    start_time = datetime.utcnow() - timedelta(days=days)
    end_time = datetime.utcnow()
    
    async with get_session() as session:
        audit_service = AuditService(session)
        
        console.print(f"[blue]Exporting audit logs for organization {organization_id}...[/blue]")
        console.print(f"[yellow]Period: {start_time.date()} to {end_time.date()}[/yellow]")
        
        with Progress() as progress:
            task = progress.add_task("Exporting...", total=100)
            
            # Export audit logs
            export_data = await audit_service.export_audit_logs(
                organization_id=UUID(organization_id),
                start_time=start_time,
                end_time=end_time,
                format=format
            )
            
            progress.update(task, completed=100)
        
        # Write to file
        with open(output_file, 'w') as f:
            f.write(export_data)
        
        console.print(f"[green]✓ Audit logs exported to {output_file}[/green]")


@app.command("audit-verify")
def audit_verify(
    audit_log_id: str = typer.Argument(..., help="Audit log ID to verify"),
    organization_id: Optional[str] = typer.Option(None, "--org", help="Organization ID")
):
    """Verify HMAC integrity of audit log."""
    asyncio.run(_audit_verify(audit_log_id, organization_id))


async def _audit_verify(audit_log_id: str, organization_id: Optional[str]):
    """Async implementation of audit verification."""
    async with get_session() as session:
        audit_service = AuditService(session)
        
        org_uuid = UUID(organization_id) if organization_id else None
        is_valid = await audit_service.verify_integrity(UUID(audit_log_id), org_uuid)
        
        if is_valid:
            console.print(f"[green]✓ Audit log {audit_log_id} integrity verified[/green]")
        else:
            console.print(f"[red]✗ Audit log {audit_log_id} integrity check failed[/red]")


# Metrics commands
@app.command("metrics-cleanup")
def metrics_cleanup(
    days: int = typer.Option(7, "--days", help="Keep raw metrics for N days"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted")
):
    """Clean up old raw metrics data."""
    asyncio.run(_metrics_cleanup(days, dry_run))


async def _metrics_cleanup(days: int, dry_run: bool):
    """Async implementation of metrics cleanup."""
    async with get_session() as session:
        metrics_service = EnhancedMetricsService(session)
        
        if dry_run:
            console.print("[yellow]DRY RUN MODE - No data will be deleted[/yellow]")
        
        console.print(f"[blue]Cleaning up raw metrics older than {days} days...[/blue]")
        
        count = await metrics_service.cleanup_old_raw_metrics(days)
        
        if dry_run:
            console.print(f"[yellow]Would delete {count} raw metric records[/yellow]")
        else:
            console.print(f"[green]✓ Deleted {count} old raw metric records[/green]")


@app.command("metrics-aggregate")
def metrics_aggregate():
    """Run hourly metrics aggregation."""
    asyncio.run(_metrics_aggregate())


async def _metrics_aggregate():
    """Async implementation of metrics aggregation."""
    async with get_session() as session:
        metrics_service = EnhancedMetricsService(session)
        
        console.print("[blue]Running hourly metrics aggregation...[/blue]")
        
        await metrics_service.run_hourly_aggregation()
        
        console.print("[green]✓ Hourly aggregation completed[/green]")


# Admin commands
@app.command("webhook-stats")
def webhook_stats(
    organization_id: str = typer.Argument(..., help="Organization ID"),
    days: int = typer.Option(30, "--days", help="Number of days to analyze")
):
    """Get webhook delivery statistics."""
    asyncio.run(_webhook_stats(organization_id, days))


async def _webhook_stats(organization_id: str, days: int):
    """Async implementation of webhook stats."""
    async with get_session() as session:
        admin_service = EnhancedAdminService(session)
        
        stats = await admin_service.get_webhook_stats(UUID(organization_id), days)
        
        console.print(f"[blue]Webhook Statistics for Organization {organization_id}[/blue]")
        console.print(f"[green]Analysis Period: {days} days[/green]\n")
        
        # Create stats table
        table = Table(title="Webhook Delivery Stats")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="magenta")
        
        table.add_row("Total Deliveries", str(stats["total_deliveries"]))
        table.add_row("Successful", str(stats["successful_deliveries"]))
        table.add_row("Failed", str(stats["failed_deliveries"]))
        table.add_row("Pending", str(stats["pending_deliveries"]))
        table.add_row("Success Rate", f"{stats['success_rate']}%")
        
        console.print(table)


@app.command("api-key-usage")
def api_key_usage(
    organization_id: str = typer.Argument(..., help="Organization ID"),
    days: int = typer.Option(30, "--days", help="Number of days to analyze")
):
    """Get API key usage statistics."""
    asyncio.run(_api_key_usage(organization_id, days))


async def _api_key_usage(organization_id: str, days: int):
    """Async implementation of API key usage stats."""
    async with get_session() as session:
        admin_service = EnhancedAdminService(session)
        
        stats = await admin_service.get_api_key_usage_stats(UUID(organization_id), days)
        
        console.print(f"[blue]API Key Usage for Organization {organization_id}[/blue]")
        console.print(f"[green]Analysis Period: {days} days[/green]\n")
        
        # Summary stats
        console.print(f"Total API Calls: [bold]{stats['total_api_calls']}[/bold]")
        console.print(f"Active Keys: [bold]{stats['active_keys']}[/bold]\n")
        
        # Top keys table
        if stats["top_keys"]:
            table = Table(title="Top API Keys by Usage")
            table.add_column("Key Name", style="cyan")
            table.add_column("Usage Count", style="magenta")
            table.add_column("Last Used", style="yellow")
            
            for key in stats["top_keys"]:
                last_used = key["last_used_at"] or "Never"
                table.add_row(key["name"], str(key["usage_count"]), last_used)
            
            console.print(table)


# Health check commands
@app.command("health-check")
def health_check():
    """Check system health and service connectivity."""
    asyncio.run(_health_check())


async def _health_check():
    """Async implementation of health check."""
    console.print("[blue]Checking system health...[/blue]\n")
    
    # Database connectivity
    try:
        async with get_session() as session:
            await session.execute("SELECT 1")
        console.print("[green]✓ Database connection: OK[/green]")
    except Exception as e:
        console.print(f"[red]✗ Database connection: FAILED - {e}[/red]")
    
    # Redis connectivity
    try:
        import redis.asyncio as redis
        redis_client = redis.from_url(settings.redis_url)
        await redis_client.ping()
        await redis_client.close()
        console.print("[green]✓ Redis connection: OK[/green]")
    except Exception as e:
        console.print(f"[red]✗ Redis connection: FAILED - {e}[/red]")
    
    # Test services initialization
    try:
        async with get_session() as session:
            rbac_service = RBACService(session)
            await rbac_service.initialize_redis()
            await rbac_service.close_redis()
        console.print("[green]✓ RBAC service: OK[/green]")
    except Exception as e:
        console.print(f"[red]✗ RBAC service: FAILED - {e}[/red]")


if __name__ == "__main__":
    app()