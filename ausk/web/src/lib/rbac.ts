// Role-Based Access Control (RBAC) System for Ausk

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  organizationId: string;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  parentDepartmentId?: string;
  policies: string[]; // Policy IDs that apply to this department
  defaultRole?: string; // Default role for users in this department
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  departmentId?: string;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
  isActive: boolean;
}

export interface AccessContext {
  userId: string;
  organizationId: string;
  departmentId?: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
}

// Predefined system permissions
export const SYSTEM_PERMISSIONS: Permission[] = [
  // Gateway permissions
  {
    id: 'gateway.use',
    name: 'Use Gateway',
    description: 'Can send requests through the AI gateway',
    resource: 'gateway',
    action: 'use'
  },
  {
    id: 'gateway.configure',
    name: 'Configure Gateway',
    description: 'Can configure gateway settings and providers',
    resource: 'gateway',
    action: 'configure'
  },
  
  // Policy permissions
  {
    id: 'policies.read',
    name: 'Read Policies',
    description: 'Can view organization policies',
    resource: 'policies',
    action: 'read'
  },
  {
    id: 'policies.write',
    name: 'Write Policies',
    description: 'Can create and modify policies',
    resource: 'policies',
    action: 'write'
  },
  {
    id: 'policies.delete',
    name: 'Delete Policies',
    description: 'Can delete policies',
    resource: 'policies',
    action: 'delete'
  },
  {
    id: 'policies.test',
    name: 'Test Policies',
    description: 'Can test policy configurations',
    resource: 'policies',
    action: 'test'
  },
  
  // Audit permissions
  {
    id: 'audits.read',
    name: 'Read Audit Logs',
    description: 'Can view audit logs and interactions',
    resource: 'audits',
    action: 'read'
  },
  {
    id: 'audits.export',
    name: 'Export Audit Data',
    description: 'Can export audit logs and reports',
    resource: 'audits',
    action: 'export'
  },
  
  // User management permissions
  {
    id: 'users.read',
    name: 'Read Users',
    description: 'Can view user information',
    resource: 'users',
    action: 'read'
  },
  {
    id: 'users.write',
    name: 'Manage Users',
    description: 'Can create, modify, and deactivate users',
    resource: 'users',
    action: 'write'
  },
  {
    id: 'users.invite',
    name: 'Invite Users',
    description: 'Can send user invitations',
    resource: 'users',
    action: 'invite'
  },
  
  // Role management permissions
  {
    id: 'roles.read',
    name: 'Read Roles',
    description: 'Can view role definitions',
    resource: 'roles',
    action: 'read'
  },
  {
    id: 'roles.write',
    name: 'Manage Roles',
    description: 'Can create and modify roles',
    resource: 'roles',
    action: 'write'
  },
  {
    id: 'roles.assign',
    name: 'Assign Roles',
    description: 'Can assign roles to users',
    resource: 'roles',
    action: 'assign'
  },
  
  // Department permissions
  {
    id: 'departments.read',
    name: 'Read Departments',
    description: 'Can view department information',
    resource: 'departments',
    action: 'read'
  },
  {
    id: 'departments.write',
    name: 'Manage Departments',
    description: 'Can create and modify departments',
    resource: 'departments',
    action: 'write'
  },
  
  // Evaluator permissions
  {
    id: 'evaluators.read',
    name: 'Read Evaluators',
    description: 'Can view evaluator configurations',
    resource: 'evaluators',
    action: 'read'
  },
  {
    id: 'evaluators.write',
    name: 'Manage Evaluators',
    description: 'Can configure evaluators',
    resource: 'evaluators',
    action: 'write'
  },
  
  // Document permissions
  {
    id: 'documents.read',
    name: 'Read Documents',
    description: 'Can view organization documents',
    resource: 'documents',
    action: 'read'
  },
  {
    id: 'documents.upload',
    name: 'Upload Documents',
    description: 'Can upload new documents',
    resource: 'documents',
    action: 'upload'
  },
  {
    id: 'documents.delete',
    name: 'Delete Documents',
    description: 'Can delete documents',
    resource: 'documents',
    action: 'delete'
  },
  
  // System admin permissions
  {
    id: 'system.configure',
    name: 'System Configuration',
    description: 'Can configure system-wide settings',
    resource: 'system',
    action: 'configure'
  },
  {
    id: 'system.monitor',
    name: 'System Monitoring',
    description: 'Can access system monitoring and metrics',
    resource: 'system',
    action: 'monitor'
  }
];

// Predefined system roles
export const SYSTEM_ROLES: Omit<Role, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Organization Admin',
    description: 'Full administrative access to the organization',
    permissions: SYSTEM_PERMISSIONS.map(p => p.id),
    isSystemRole: true
  },
  {
    name: 'Policy Manager',
    description: 'Can manage policies and view audit logs',
    permissions: [
      'gateway.use',
      'policies.read',
      'policies.write',
      'policies.delete',
      'policies.test',
      'audits.read',
      'audits.export',
      'evaluators.read',
      'evaluators.write',
      'documents.read',
      'users.read'
    ],
    isSystemRole: true
  },
  {
    name: 'Compliance Officer',
    description: 'Can view policies and audit logs, limited write access',
    permissions: [
      'gateway.use',
      'policies.read',
      'policies.test',
      'audits.read',
      'audits.export',
      'evaluators.read',
      'documents.read',
      'users.read',
      'departments.read'
    ],
    isSystemRole: true
  },
  {
    name: 'Department Manager',
    description: 'Can manage users and policies within their department',
    permissions: [
      'gateway.use',
      'policies.read',
      'policies.write',
      'audits.read',
      'users.read',
      'users.invite',
      'roles.read',
      'roles.assign',
      'departments.read',
      'documents.read',
      'documents.upload'
    ],
    isSystemRole: true
  },
  {
    name: 'End User',
    description: 'Basic user with gateway access',
    permissions: [
      'gateway.use',
      'policies.read',
      'documents.read',
      'documents.upload'
    ],
    isSystemRole: true
  },
  {
    name: 'Auditor',
    description: 'Read-only access to audit logs and policies',
    permissions: [
      'policies.read',
      'audits.read',
      'audits.export',
      'users.read',
      'departments.read',
      'evaluators.read'
    ],
    isSystemRole: true
  }
];

export class RBACService {
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private departments: Map<string, Department> = new Map();
  private userRoles: Map<string, UserRole[]> = new Map(); // userId -> roles
  private rolePermissions: Map<string, Set<string>> = new Map(); // roleId -> permission IDs

  constructor() {
    this.initializeSystemPermissions();
  }

  private initializeSystemPermissions(): void {
    // Load system permissions
    for (const permission of SYSTEM_PERMISSIONS) {
      this.permissions.set(permission.id, permission);
    }
  }

  // Permission management
  async createPermission(permission: Permission): Promise<void> {
    this.permissions.set(permission.id, permission);
  }

  async getPermission(permissionId: string): Promise<Permission | undefined> {
    return this.permissions.get(permissionId);
  }

  async getAllPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values());
  }

  // Role management
  async createRole(role: Role): Promise<void> {
    this.roles.set(role.id, role);
    this.rolePermissions.set(role.id, new Set(role.permissions));
  }

  async updateRole(role: Role): Promise<void> {
    this.roles.set(role.id, { ...role, updatedAt: new Date() });
    this.rolePermissions.set(role.id, new Set(role.permissions));
  }

  async getRole(roleId: string): Promise<Role | undefined> {
    return this.roles.get(roleId);
  }

  async getRolesByOrganization(organizationId: string): Promise<Role[]> {
    return Array.from(this.roles.values())
      .filter(role => role.organizationId === organizationId);
  }

  async deleteRole(roleId: string): Promise<boolean> {
    // Check if role is in use
    const usersWithRole = Array.from(this.userRoles.values())
      .flat()
      .filter(ur => ur.roleId === roleId && ur.isActive);
    
    if (usersWithRole.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    this.roles.delete(roleId);
    this.rolePermissions.delete(roleId);
    return true;
  }

  // Department management
  async createDepartment(department: Department): Promise<void> {
    this.departments.set(department.id, department);
  }

  async updateDepartment(department: Department): Promise<void> {
    this.departments.set(department.id, { ...department, updatedAt: new Date() });
  }

  async getDepartment(departmentId: string): Promise<Department | undefined> {
    return this.departments.get(departmentId);
  }

  async getDepartmentsByOrganization(organizationId: string): Promise<Department[]> {
    return Array.from(this.departments.values())
      .filter(dept => dept.organizationId === organizationId);
  }

  async getDepartmentHierarchy(organizationId: string): Promise<Department[]> {
    const departments = await this.getDepartmentsByOrganization(organizationId);
    
    // Build hierarchy tree
    const buildHierarchy = (parentId?: string): Department[] => {
      return departments
        .filter(dept => dept.parentDepartmentId === parentId)
        .map(dept => ({
          ...dept,
          children: buildHierarchy(dept.id)
        } as any));
    };

    return buildHierarchy();
  }

  // User role assignment
  async assignRole(
    userId: string,
    roleId: string,
    departmentId: string | undefined,
    grantedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    const role = await this.getRole(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, []);
    }

    // Deactivate existing role assignments for the same role
    const userRoleList = this.userRoles.get(userId)!;
    userRoleList.forEach(ur => {
      if (ur.roleId === roleId && ur.departmentId === departmentId) {
        ur.isActive = false;
      }
    });

    // Add new role assignment
    userRoleList.push({
      userId,
      roleId,
      departmentId,
      grantedAt: new Date(),
      grantedBy,
      expiresAt,
      isActive: true
    });
  }

  async revokeRole(userId: string, roleId: string, departmentId?: string): Promise<void> {
    const userRoleList = this.userRoles.get(userId);
    if (!userRoleList) return;

    userRoleList.forEach(ur => {
      if (ur.roleId === roleId && ur.departmentId === departmentId) {
        ur.isActive = false;
      }
    });
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const userRoleList = this.userRoles.get(userId) || [];
    const now = new Date();
    
    return userRoleList.filter(ur => 
      ur.isActive && 
      (!ur.expiresAt || ur.expiresAt > now)
    );
  }

  // Access control checks
  async buildAccessContext(userId: string, organizationId: string): Promise<AccessContext> {
    const userRoleList = await this.getUserRoles(userId);
    const roles = userRoleList.map(ur => ur.roleId);
    
    // Collect all permissions from user's roles
    const permissions = new Set<string>();
    for (const roleId of roles) {
      const rolePermissions = this.rolePermissions.get(roleId);
      if (rolePermissions) {
        rolePermissions.forEach(p => permissions.add(p));
      }
    }

    // Get primary department (first active role with department)
    const primaryDepartment = userRoleList.find(ur => ur.departmentId)?.departmentId;

    return {
      userId,
      organizationId,
      departmentId: primaryDepartment,
      roles,
      permissions: Array.from(permissions)
    };
  }

  async hasPermission(context: AccessContext, permission: string): Promise<boolean> {
    return context.permissions.includes(permission);
  }

  async hasAnyPermission(context: AccessContext, permissions: string[]): Promise<boolean> {
    return permissions.some(permission => context.permissions.includes(permission));
  }

  async hasRole(context: AccessContext, role: string): Promise<boolean> {
    return context.roles.includes(role);
  }

  async canAccessResource(
    context: AccessContext,
    resource: string,
    action: string,
    resourceOwnerId?: string,
    resourceDepartmentId?: string
  ): Promise<boolean> {
    const permission = `${resource}.${action}`;
    
    if (!await this.hasPermission(context, permission)) {
      return false;
    }

    // Department-based access control
    if (resourceDepartmentId && context.departmentId) {
      // Check if user's department matches or is parent/child
      const canAccess = await this.canAccessDepartment(
        context.departmentId,
        resourceDepartmentId
      );
      if (!canAccess) return false;
    }

    // Owner-based access control
    if (resourceOwnerId && resourceOwnerId !== context.userId) {
      // Check if user has admin permissions or specific cross-user permissions
      const hasAdminAccess = await this.hasPermission(context, 'system.configure') ||
                           await this.hasPermission(context, `${resource}.admin`);
      if (!hasAdminAccess) return false;
    }

    return true;
  }

  private async canAccessDepartment(
    userDepartmentId: string,
    resourceDepartmentId: string
  ): Promise<boolean> {
    if (userDepartmentId === resourceDepartmentId) {
      return true;
    }

    // Check if departments are in same hierarchy
    const userDept = await this.getDepartment(userDepartmentId);
    const resourceDept = await this.getDepartment(resourceDepartmentId);

    if (!userDept || !resourceDept) return false;

    // Check if user's department is parent of resource department
    let current = resourceDept;
    while (current.parentDepartmentId) {
      if (current.parentDepartmentId === userDepartmentId) {
        return true;
      }
      const parent = await this.getDepartment(current.parentDepartmentId);
      if (!parent) break;
      current = parent;
    }

    return false;
  }

  // Middleware helper
  async requirePermission(permission: string) {
    return async (context: AccessContext): Promise<boolean> => {
      return await this.hasPermission(context, permission);
    };
  }

  async requireAnyPermission(permissions: string[]) {
    return async (context: AccessContext): Promise<boolean> => {
      return await this.hasAnyPermission(context, permissions);
    };
  }

  async requireRole(role: string) {
    return async (context: AccessContext): Promise<boolean> => {
      return await this.hasRole(context, role);
    };
  }

  // Initialize organization with default roles
  async initializeOrganization(organizationId: string): Promise<void> {
    for (const roleTemplate of SYSTEM_ROLES) {
      const role: Role = {
        id: crypto.randomUUID(),
        ...roleTemplate,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await this.createRole(role);
    }

    // Create default department
    const defaultDepartment: Department = {
      id: crypto.randomUUID(),
      name: 'General',
      description: 'Default department for new users',
      organizationId,
      policies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.createDepartment(defaultDepartment);
  }
}

// Singleton instance
export const rbacService = new RBACService();