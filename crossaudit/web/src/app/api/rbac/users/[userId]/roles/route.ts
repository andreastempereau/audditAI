import { NextRequest, NextResponse } from 'next/server';
import { withAnyPermission } from '@/lib/auth-middleware';
import { rbacService } from '@/lib/rbac';

// GET /api/rbac/users/[userId]/roles - Get user's roles
export const GET = withAnyPermission(['users.read', 'roles.read'])(async (request) => {
  try {
    const userId = request.url.split('/').slice(-2)[0]; // Extract userId from path
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const userRoles = await rbacService.getUserRoles(userId);
    
    // Get full role details
    const rolesWithDetails = await Promise.all(
      userRoles.map(async (userRole) => {
        const role = await rbacService.getRole(userRole.roleId);
        const department = userRole.departmentId ? 
          await rbacService.getDepartment(userRole.departmentId) : null;
        
        return {
          ...userRole,
          role,
          department
        };
      })
    );

    // Build access context
    const context = await rbacService.buildAccessContext(userId, rolesWithDetails[0]?.role?.organizationId || '');

    return NextResponse.json({
      success: true,
      userRoles: rolesWithDetails,
      accessContext: {
        permissions: context.permissions,
        roles: context.roles,
        departmentId: context.departmentId
      }
    });

  } catch (error) {
    console.error('Get user roles error:', error);
    return NextResponse.json({ error: 'Failed to fetch user roles' }, { status: 500 });
  }
});