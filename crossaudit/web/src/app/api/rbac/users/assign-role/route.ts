import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { rbacService } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// POST /api/rbac/users/assign-role - Assign role to user
export const POST = withPermission('roles.assign')(async (request) => {
  try {
    const body = await request.json();
    const { userId, roleId, departmentId, expiresAt } = body;

    if (!userId || !roleId) {
      return NextResponse.json({ 
        error: 'User ID and role ID are required' 
      }, { status: 400 });
    }

    // Get the current user to track who granted the role
    const grantedBy = (request as any).user?.id;
    if (!grantedBy) {
      return NextResponse.json({ error: 'Unable to identify granting user' }, { status: 400 });
    }

    // Validate role exists
    const role = await rbacService.getRole(roleId);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Validate department if provided
    if (departmentId) {
      const department = await rbacService.getDepartment(departmentId);
      if (!department) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
    }

    await rbacService.assignRole(
      userId,
      roleId,
      departmentId,
      grantedBy,
      expiresAt ? new Date(expiresAt) : undefined
    );

    return NextResponse.json({
      success: true,
      message: 'Role assigned successfully'
    });

  } catch (error) {
    console.error('Assign role error:', error);
    return NextResponse.json({ error: 'Failed to assign role' }, { status: 500 });
  }
});

// DELETE /api/rbac/users/assign-role - Revoke role from user
export const DELETE = withPermission('roles.assign')(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const roleId = searchParams.get('roleId');
    const departmentId = searchParams.get('departmentId') || undefined;

    if (!userId || !roleId) {
      return NextResponse.json({ 
        error: 'User ID and role ID are required' 
      }, { status: 400 });
    }

    await rbacService.revokeRole(userId, roleId, departmentId);

    return NextResponse.json({
      success: true,
      message: 'Role revoked successfully'
    });

  } catch (error) {
    console.error('Revoke role error:', error);
    return NextResponse.json({ error: 'Failed to revoke role' }, { status: 500 });
  }
});