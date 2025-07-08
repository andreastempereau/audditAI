import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-supabase';
import { createClientComponentClient } from '@/lib/supabase-client';

export interface Organization {
  id: string;
  name: string;
  website?: string;
  description?: string;
  settings?: {
    timezone?: string;
    emailNotifications?: boolean;
    twoFactorRequired?: boolean;
    sessionTimeout?: number;
  };
  tier: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export function useOrganization() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();

  // Get user's organization
  const { data: organization, isLoading, error } = useQuery({
    queryKey: ['organization', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get user's organization membership
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        console.error('Error fetching user organization:', orgError);
        return null;
      }

      // Get organization details
      const { data: org, error: detailError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userOrg.organization_id)
        .single();

      if (detailError || !org) {
        console.error('Error fetching organization details:', detailError);
        return null;
      }

      return {
        ...org,
        userRole: userOrg.role,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update organization
  const updateOrganization = useMutation({
    mutationFn: async (updates: Partial<Organization>) => {
      if (!organization?.id) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: updates.name,
          website: updates.website,
          description: updates.description,
          settings: updates.settings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['organization', user?.id], data);
    },
  });

  return {
    organization,
    isLoading,
    error,
    updateOrganization: updateOrganization.mutate,
    isUpdating: updateOrganization.isPending,
    updateError: updateOrganization.error,
  };
}