import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-supabase';
import { createClientComponentClient } from '@/lib/supabase-client';

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  category: 'auth' | 'document' | 'compliance' | 'system';
  user: {
    name: string;
    email: string;
    id: string;
  };
  details: string;
  status: 'success' | 'warning' | 'error';
  ipAddress: string;
  metadata?: Record<string, any>;
}

export interface AuditLogStats {
  totalEvents: number;
  successRate: number;
  warnings: number;
  errors: number;
}

export function useAuditLogs(filters?: {
  category?: string;
  status?: string;
  dateRange?: string;
  searchQuery?: string;
}) {
  const { user } = useAuth();
  const supabase = createClientComponentClient();

  // Get audit logs
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['audit-logs', user?.id, filters],
    queryFn: async () => {
      if (!user) return [];

      // Get user's organization first
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        console.error('Error fetching user organization:', orgError);
        return [];
      }

      // Build query for audit logs
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles (
            id,
            name,
            email
          )
        `)
        .eq('organization_id', userOrg.organization_id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.dateRange) {
        const now = new Date();
        let startDate = new Date();
        
        switch (filters.dateRange) {
          case '1d':
            startDate.setDate(now.getDate() - 1);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(now.getDate() - 90);
            break;
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      // Limit results
      query = query.limit(100);

      const { data: auditData, error: auditError } = await query;

      if (auditError) {
        console.error('Error fetching audit logs:', auditError);
        return [];
      }

      // Transform data to match interface
      const transformedLogs: AuditLog[] = (auditData || []).map((log: any) => ({
        id: log.id,
        timestamp: log.created_at,
        action: log.action,
        category: log.category,
        user: {
          name: log.profiles?.name || 'Unknown',
          email: log.profiles?.email || 'Unknown',
          id: log.user_id,
        },
        details: log.details,
        status: log.status,
        ipAddress: log.ip_address || 'N/A',
        metadata: log.metadata,
      }));

      // Apply search filter if provided
      if (filters?.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        return transformedLogs.filter(log =>
          log.action.toLowerCase().includes(searchLower) ||
          log.details.toLowerCase().includes(searchLower) ||
          log.user.name.toLowerCase().includes(searchLower) ||
          log.user.email.toLowerCase().includes(searchLower)
        );
      }

      return transformedLogs;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Get audit log statistics
  const { data: stats } = useQuery({
    queryKey: ['audit-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get user's organization first
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        console.error('Error fetching user organization:', orgError);
        return null;
      }

      // Get total count
      const { count: totalEvents } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', userOrg.organization_id);

      // Get success count
      const { count: successCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', userOrg.organization_id)
        .eq('status', 'success');

      // Get warning count
      const { count: warningCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', userOrg.organization_id)
        .eq('status', 'warning');

      // Get error count
      const { count: errorCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', userOrg.organization_id)
        .eq('status', 'error');

      const stats: AuditLogStats = {
        totalEvents: totalEvents || 0,
        successRate: totalEvents ? ((successCount || 0) / totalEvents) * 100 : 0,
        warnings: warningCount || 0,
        errors: errorCount || 0,
      };

      return stats;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    logs: logs || [],
    stats: stats || { totalEvents: 0, successRate: 0, warnings: 0, errors: 0 },
    isLoading,
    error,
  };
}