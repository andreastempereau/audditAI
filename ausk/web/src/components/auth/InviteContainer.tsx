"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle, AlertCircle, Mail, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/lib/auth-supabase';
import { createClientComponentClient } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

interface InviteContainerProps {
  orgId: string | undefined;
  email: string | undefined;
}

interface Invitation {
  id: string;
  email: string;
  organization_id: string;
  invited_by: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  tier: string;
  created_at: string;
}

export function InviteContainer({ orgId, email }: InviteContainerProps) {
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const supabase = createClientComponentClient();

  // Effect to fetch invitation data
  useEffect(() => {
    const fetchInvitationData = async () => {
      if (!orgId || !email) {
        setError('Invalid invitation link. Missing organization or email parameter.');
        setLoading(false);
        return;
      }

      try {
        // Fetch invitation
        const { data: invitationData, error: inviteError } = await supabase
          .from('organization_invitations')
          .select('*')
          .eq('organization_id', orgId)
          .eq('email', decodeURIComponent(email))
          .eq('used', false)
          .single();

        if (inviteError) {
          console.error('Error fetching invitation:', inviteError);
          if (inviteError.code === 'PGRST116') {
            setError('Invitation not found or has already been used.');
          } else {
            setError('Failed to load invitation details.');
          }
          setLoading(false);
          return;
        }

        // Check if invitation has expired
        const expirationDate = new Date(invitationData.expires_at);
        if (expirationDate < new Date()) {
          setError('This invitation has expired.');
          setLoading(false);
          return;
        }

        setInvitation(invitationData);

        // Fetch organization details
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();

        if (orgError) {
          console.error('Error fetching organization:', orgError);
          setError('Failed to load organization details.');
          setLoading(false);
          return;
        }

        setOrganization(orgData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching invitation data:', error);
        setError('An unexpected error occurred while loading the invitation.');
        setLoading(false);
      }
    };

    fetchInvitationData();
  }, [orgId, email, supabase]);

  // Handle invitation acceptance
  const handleAcceptInvitation = async () => {
    if (!user || !invitation || !organization) {
      setError('Unable to accept invitation. Please try again.');
      return;
    }

    // Check if user email matches invitation email
    if (user.email !== invitation.email) {
      setError(`This invitation is for ${invitation.email}. Please sign in with the correct email address.`);
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      // Check if user is already a member of this organization
      const { data: existingMembership, error: membershipError } = await supabase
        .from('user_organizations')
        .select('*')
        .eq('user_id', user.id)
        .eq('org_id', organization.id)
        .single();

      if (existingMembership) {
        setError('You are already a member of this organization.');
        setIsAccepting(false);
        return;
      }

      // Add user to organization
      const { error: addMemberError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          org_id: organization.id,
          role: 'member',
        });

      if (addMemberError) {
        console.error('Error adding user to organization:', addMemberError);
        throw new Error('Failed to join organization.');
      }

      // Mark invitation as used
      const { error: updateInviteError } = await supabase
        .from('organization_invitations')
        .update({ used: true })
        .eq('id', invitation.id);

      if (updateInviteError) {
        console.error('Error updating invitation:', updateInviteError);
        // Don't throw error here as the main action succeeded
      }

      // Redirect to app
      router.push('/app');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to accept invitation.');
      setIsAccepting(false);
    }
  };

  // Handle cases where parameters are missing
  if (!orgId || !email) {
    return (
      <AuthLayout
        title="Invalid Invitation"
        subtitle="The invitation link appears to be incomplete"
      >
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-error-500 mb-4" />
          <p className="text-sm text-muted-600 dark:text-muted-400 mb-6">
            This invitation link is missing required information. Please check the link and try again.
          </p>
          <Button
            onClick={() => router.push('/login')}
            variant="primary"
            className="w-full"
          >
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <AuthLayout
        title="Loading Invitation"
        subtitle="Please wait while we verify your invitation"
      >
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-600 dark:text-muted-400">
            Verifying invitation details...
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AuthLayout
        title="Invitation Error"
        subtitle="There was a problem with your invitation"
      >
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-error-500 mb-4" />
          <p className="text-sm text-error-600 dark:text-error-400 mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/login')}
              variant="primary"
              className="w-full"
            >
              Go to Login
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="ghost"
              className="w-full"
            >
              Retry
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated || !user) {
    return (
      <AuthLayout
        title="Complete Your Invitation"
        subtitle="Sign in to join the organization"
      >
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            {organization && (
              <div>
                <h3 className="text-lg font-semibold text-muted-900 dark:text-white mb-2">
                  You're invited to join
                </h3>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-muted-600" />
                  <span className="font-medium text-muted-900 dark:text-white">
                    {organization.name}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-sm text-muted-600 dark:text-muted-400 mb-6">
            Please sign in with <strong>{email}</strong> to accept this invitation.
          </p>
          
          <Button
            onClick={() => router.push(`/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(window.location.href)}`)}
            variant="primary"
            className="w-full"
          >
            Sign In to Continue
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // User is authenticated - show invitation acceptance
  return (
    <AuthLayout
      title="Accept Invitation"
      subtitle="Join your team's organization"
    >
      <div className="text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>

        {/* Organization Info */}
        {organization && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-muted-900 dark:text-white mb-2">
              You're invited to join
            </h3>
            <div className="bg-muted-50 dark:bg-muted-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Building2 className="w-6 h-6 text-primary" />
                <span className="text-xl font-semibold text-muted-900 dark:text-white">
                  {organization.name}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-600 dark:text-muted-400">
                <Shield className="w-4 h-4" />
                <span className="capitalize">{organization.tier} Plan</span>
              </div>
            </div>
          </div>
        )}

        {/* User Info */}
        <div className="text-sm text-muted-600 dark:text-muted-400 mb-6">
          <p className="mb-1">Signed in as:</p>
          <p className="font-medium text-muted-900 dark:text-white">{user.email}</p>
        </div>

        {/* Accept Button */}
        <div className="space-y-3">
          <Button
            onClick={handleAcceptInvitation}
            disabled={isAccepting}
            variant="primary"
            className="w-full"
          >
            {isAccepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining Organization...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept Invitation
              </>
            )}
          </Button>
          
          <Button
            onClick={() => router.push('/app')}
            variant="ghost"
            className="w-full"
            disabled={isAccepting}
          >
            Cancel
          </Button>
        </div>

        {/* Invitation Details */}
        {invitation && (
          <div className="mt-6 pt-6 border-t border-muted-200 dark:border-muted-800">
            <p className="text-xs text-muted-500">
              Invitation expires on {new Date(invitation.expires_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}