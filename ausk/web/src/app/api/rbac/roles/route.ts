import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { rbacService, Role } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// GET /api/rbac/roles - List roles
export const GET = withPermission('roles.read')(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const roles = await rbacService.getRolesByOrganization(organizationId);
    
    return NextResponse.json({
      success: true,
      roles: roles.map(role => ({
        ...role,
        permissions: undefined // Don't expose raw permissions in list
      }))
    });

  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
});

// POST /api/rbac/roles - Create role
export const POST = withPermission('roles.write')(async (request) => {
  try {
    const body = await request.json();
    const { name, description, permissions, organizationId } = body;

    if (!name || !organizationId) {
      return NextResponse.json({ 
        error: 'Name and organization ID are required' 
      }, { status: 400 });
    }

    const role: Role = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      permissions: permissions || [],
      organizationId,
      isSystemRole: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await rbacService.createRole(role);

    return NextResponse.json({
      success: true,
      role
    }, { status: 201 });

  } catch (error) {
    console.error('Create role error:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
});

// PUT /api/rbac/roles - Update role
export const PUT = withPermission('roles.write')(async (request) => {
  try {
    const body = await request.json();
    const { id, name, description, permissions } = body;

    if (!id || !name) {
      return NextResponse.json({ 
        error: 'Role ID and name are required' 
      }, { status: 400 });
    }

    const existingRole = await rbacService.getRole(id);
    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (existingRole.isSystemRole) {
      return NextResponse.json({ 
        error: 'Cannot modify system roles' 
      }, { status: 403 });
    }

    const updatedRole: Role = {
      ...existingRole,
      name,
      description: description || existingRole.description,
      permissions: permissions || existingRole.permissions,
      updatedAt: new Date()
    };

    await rbacService.updateRole(updatedRole);

    return NextResponse.json({
      success: true,
      role: updatedRole
    });

  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
});

// DELETE /api/rbac/roles - Delete role
export const DELETE = withPermission('roles.write')(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('id');

    if (!roleId) {
      return NextResponse.json({ error: 'Role ID required' }, { status: 400 });
    }

    const role = await rbacService.getRole(roleId);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (role.isSystemRole) {
      return NextResponse.json({ 
        error: 'Cannot delete system roles' 
      }, { status: 403 });
    }

    await rbacService.deleteRole(roleId);

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('Delete role error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete role' 
    }, { status: 500 });
  }
});