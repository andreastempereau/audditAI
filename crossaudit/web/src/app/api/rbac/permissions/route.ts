import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { rbacService } from '@/lib/rbac';

// GET /api/rbac/permissions - List all permissions
export const GET = withPermission('roles.read')(async (request) => {
  try {
    const permissions = await rbacService.getAllPermissions();
    
    // Group permissions by resource
    const groupedPermissions = permissions.reduce((acc, permission) => {
      const resource = permission.resource;
      if (!acc[resource]) {
        acc[resource] = [];
      }
      acc[resource].push(permission);
      return acc;
    }, {} as Record<string, typeof permissions>);
    
    return NextResponse.json({
      success: true,
      permissions,
      groupedPermissions
    });

  } catch (error) {
    console.error('Get permissions error:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
});