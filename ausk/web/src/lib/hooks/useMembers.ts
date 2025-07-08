import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-supabase';
import { createClientComponentClient } from '@/lib/supabase-client';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  department?: string;
  joinedAt: string;
  lastActive: string;
  status: 'active' | 'invited' | 'inactive';
  avatar?: string;
  twoFactorEnabled: boolean;
}

export function useMembers() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();

  // Get organization members
  const { data: members, isLoading, error } = useQuery({
    queryKey: ['members', user?.id],
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

      // Get all members of the organization
      const { data: memberData, error: memberError } = await supabase
        .from('user_organizations')
        .select(`
          user_id,
          role,
          created_at,
          profiles (
            id,
            name,
            email,
            last_active,
            two_factor_enabled
          )
        `)
        .eq('organization_id', userOrg.organization_id);

      if (memberError) {
        console.error('Error fetching members:', memberError);
        return [];
      }

      // Get pending invitations
      const { data: invitationData, error: invitationError } = await supabase
        .from('invitations')
        .select('email, role, created_at')
        .eq('organization_id', userOrg.organization_id)
        .eq('status', 'pending');

      if (invitationError) {
        console.error('Error fetching invitations:', invitationError);
      }

      // Transform member data
      const members = memberData.map((member: any) => ({
        id: member.user_id,
        name: member.profiles?.name || 'Unknown',
        email: member.profiles?.email || 'Unknown',
        role: member.role,
        department: 'General', // Default department
        joinedAt: member.created_at,
        lastActive: member.profiles?.last_active || new Date().toISOString(),
        status: 'active' as const,
        twoFactorEnabled: member.profiles?.two_factor_enabled || false,
      }));

      // Add invited members
      const invitedMembers = (invitationData || []).map((invitation: any) => ({
        id: `invite-${invitation.email}`,
        name: invitation.email.split('@')[0],
        email: invitation.email,
        role: invitation.role,
        department: 'General',
        joinedAt: invitation.created_at,
        lastActive: invitation.created_at,
        status: 'invited' as const,
        twoFactorEnabled: false,
      }));

      return [...members, ...invitedMembers];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Invite member
  const inviteMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Member['role'] }) => {
      if (!user) throw new Error('User not authenticated');

      // Get user's organization
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        throw new Error('Organization not found');
      }

      // Create invitation record
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          email,
          role,
          organization_id: userOrg.organization_id,
          invited_by: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.id] });
    },
  });

  // Update member role
  const updateMemberRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Member['role'] }) => {
      if (!user) throw new Error('User not authenticated');

      // Get user's organization
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        throw new Error('Organization not found');
      }

      const { data, error } = await supabase
        .from('user_organizations')
        .update({ role })
        .eq('user_id', userId)
        .eq('organization_id', userOrg.organization_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.id] });
    },
  });

  // Remove member
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error('User not authenticated');

      // Get user's organization
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        throw new Error('Organization not found');
      }

      const { error } = await supabase
        .from('user_organizations')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', userOrg.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.id] });
    },
  });

  return {
    members: members || [],
    isLoading,
    error,
    inviteMember: inviteMember.mutate,
    isInviting: inviteMember.isPending,
    updateMemberRole: updateMemberRole.mutate,
    isUpdatingRole: updateMemberRole.isPending,
    removeMember: removeMember.mutate,
    isRemoving: removeMember.isPending,
  };
}