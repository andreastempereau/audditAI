import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { rbacService, Department } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// GET /api/rbac/departments - List departments
export const GET = withPermission('departments.read')(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const hierarchy = searchParams.get('hierarchy') === 'true';
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    let departments;
    if (hierarchy) {
      departments = await rbacService.getDepartmentHierarchy(organizationId);
    } else {
      departments = await rbacService.getDepartmentsByOrganization(organizationId);
    }
    
    return NextResponse.json({
      success: true,
      departments
    });

  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
});

// POST /api/rbac/departments - Create department
export const POST = withPermission('departments.write')(async (request) => {
  try {
    const body = await request.json();
    const { name, description, organizationId, parentDepartmentId, policies, defaultRole } = body;

    if (!name || !organizationId) {
      return NextResponse.json({ 
        error: 'Name and organization ID are required' 
      }, { status: 400 });
    }

    const department: Department = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      organizationId,
      parentDepartmentId,
      policies: policies || [],
      defaultRole,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await rbacService.createDepartment(department);

    return NextResponse.json({
      success: true,
      department
    }, { status: 201 });

  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
});

// PUT /api/rbac/departments - Update department
export const PUT = withPermission('departments.write')(async (request) => {
  try {
    const body = await request.json();
    const { id, name, description, parentDepartmentId, policies, defaultRole } = body;

    if (!id || !name) {
      return NextResponse.json({ 
        error: 'Department ID and name are required' 
      }, { status: 400 });
    }

    const existingDepartment = await rbacService.getDepartment(id);
    if (!existingDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const updatedDepartment: Department = {
      ...existingDepartment,
      name,
      description: description || existingDepartment.description,
      parentDepartmentId,
      policies: policies || existingDepartment.policies,
      defaultRole: defaultRole || existingDepartment.defaultRole,
      updatedAt: new Date()
    };

    await rbacService.updateDepartment(updatedDepartment);

    return NextResponse.json({
      success: true,
      department: updatedDepartment
    });

  } catch (error) {
    console.error('Update department error:', error);
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
});