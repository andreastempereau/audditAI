import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import jwt from 'jsonwebtoken';
import { rbacService, AccessContext } from './rbac';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
  };
  accessContext?: AccessContext;
}

export async function validateAuth(request: NextRequest): Promise<{
  authorized: boolean;
  user?: any;
  accessContext?: AccessContext;
  error?: string;
}> {
  try {
    // Check for API key authentication first
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      return await validateApiKey(apiKey);
    }

    // Check for Bearer token authentication
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return await validateBearerToken(request, token);
    }

    // Check for session-based authentication (web app)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { authorized: false, error: 'No valid authentication found' };
    }

    // Get user's organization details
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) {
      return { authorized: false, error: 'User not associated with an organization' };
    }

    const userData = {
      id: user.id,
      email: user.email!,
      organizationId: profile.org_id,
      role: profile.role || 'member'
    };

    // Build access context with RBAC
    const accessContext = await rbacService.buildAccessContext(
      userData.id,
      userData.organizationId
    );

    return {
      authorized: true,
      user: userData,
      accessContext
    };

  } catch (error) {
    console.error('Auth validation error:', error);
    return { authorized: false, error: 'Authentication validation failed' };
  }
}

async function validateApiKey(apiKey: string): Promise<{
  authorized: boolean;
  user?: any;
  error?: string;
}> {
  try {
    // In production, this would validate against encrypted API keys in database
    const response = await fetch(`${process.env.VAULT_SERVICE_URL}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });

    if (!response.ok) {
      return { authorized: false, error: 'Invalid API key' };
    }

    const data = await response.json();
    
    return {
      authorized: true,
      user: {
        id: data.userId,
        email: data.email,
        organizationId: data.organizationId,
        role: 'api'
      }
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return { authorized: false, error: 'API key validation failed' };
  }
}

async function validateBearerToken(request: NextRequest, token: string): Promise<{
  authorized: boolean;
  user?: any;
  error?: string;
}> {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.sub || !decoded.org_id) {
      return { authorized: false, error: 'Invalid token structure' };
    }

    // Check if token is not expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return { authorized: false, error: 'Token expired' };
    }

    return {
      authorized: true,
      user: {
        id: decoded.sub,
        email: decoded.email,
        organizationId: decoded.org_id,
        role: decoded.role || 'member'
      }
    };

  } catch (error) {
    console.error('Bearer token validation error:', error);
    return { authorized: false, error: 'Invalid bearer token' };
  }
}

// Middleware wrapper for API routes
export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await validateAuth(req);
    
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Add user to request
    (req as any).user = auth.user;
    
    return handler(req as AuthenticatedRequest);
  };
}

// Rate limiting helper
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number = 100,
  window: number = 60000 // 1 minute
): Promise<boolean> {
  const key = `rate_limit:${userId}:${endpoint}`;
  
  // In production, use Redis for rate limiting
  // For now, use in-memory store
  const now = Date.now();
  const windowStart = now - window;
  
  // This is a placeholder - implement with Redis
  return true;
}

// RBAC middleware helpers
export function withPermission(permission: string) {
  return function(
    handler: (req: AuthenticatedRequest) => Promise<NextResponse>
  ) {
    return async (req: NextRequest): Promise<NextResponse> => {
      const auth = await validateAuth(req);
      
      if (!auth.authorized || !auth.accessContext) {
        return NextResponse.json(
          { error: auth.error || 'Unauthorized' },
          { status: 401 }
        );
      }

      const hasPermission = await rbacService.hasPermission(auth.accessContext, permission);
      if (!hasPermission) {
        return NextResponse.json(
          { error: `Insufficient permissions. Required: ${permission}` },
          { status: 403 }
        );
      }

      // Add user and context to request
      (req as any).user = auth.user;
      (req as any).accessContext = auth.accessContext;
      
      return handler(req as AuthenticatedRequest);
    };
  };
}

export function withAnyPermission(permissions: string[]) {
  return function(
    handler: (req: AuthenticatedRequest) => Promise<NextResponse>
  ) {
    return async (req: NextRequest): Promise<NextResponse> => {
      const auth = await validateAuth(req);
      
      if (!auth.authorized || !auth.accessContext) {
        return NextResponse.json(
          { error: auth.error || 'Unauthorized' },
          { status: 401 }
        );
      }

      const hasAnyPermission = await rbacService.hasAnyPermission(auth.accessContext, permissions);
      if (!hasAnyPermission) {
        return NextResponse.json(
          { error: `Insufficient permissions. Required one of: ${permissions.join(', ')}` },
          { status: 403 }
        );
      }

      // Add user and context to request
      (req as any).user = auth.user;
      (req as any).accessContext = auth.accessContext;
      
      return handler(req as AuthenticatedRequest);
    };
  };
}

export function withRole(role: string) {
  return function(
    handler: (req: AuthenticatedRequest) => Promise<NextResponse>
  ) {
    return async (req: NextRequest): Promise<NextResponse> => {
      const auth = await validateAuth(req);
      
      if (!auth.authorized || !auth.accessContext) {
        return NextResponse.json(
          { error: auth.error || 'Unauthorized' },
          { status: 401 }
        );
      }

      const hasRole = await rbacService.hasRole(auth.accessContext, role);
      if (!hasRole) {
        return NextResponse.json(
          { error: `Insufficient role. Required: ${role}` },
          { status: 403 }
        );
      }

      // Add user and context to request
      (req as any).user = auth.user;
      (req as any).accessContext = auth.accessContext;
      
      return handler(req as AuthenticatedRequest);
    };
  };
}

export async function requireResourceAccess(
  context: AccessContext,
  resource: string,
  action: string,
  resourceOwnerId?: string,
  resourceDepartmentId?: string
): Promise<boolean> {
  return await rbacService.canAccessResource(
    context,
    resource,
    action,
    resourceOwnerId,
    resourceDepartmentId
  );
}