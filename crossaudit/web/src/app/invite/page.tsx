"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-supabase';
import { createClientComponentClient } from '@/lib/supabase-client';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Building2, Users, Check, X } from 'lucide-react';

export default function InvitePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, signUp } = useAuth();
  const supabase = createClientComponentClient();
  
  const orgId = searchParams?.get('org');
  const email = searchParams?.get('email');

  useEffect(() => {
    if (orgId && email) {
      loadInvitation();
    } else {
      setError('Invalid invitation link');
      setIsLoading(false);
    }
  }, [orgId, email]);

  const loadInvitation = async () => {
    try {
      // Load invitation details
      const { data: inviteData, error: inviteError } = await supabase
        .from('organization_invitations')
        .select(`
          *,
          organization:organizations(name, tier),
          inviter:invited_by(name, email)
        `)
        .eq('organization_id', orgId)
        .eq('email', email)
        .eq('status', 'pending')
        .single();

      if (inviteError || !inviteData) {
        setError('Invitation not found or has expired');
        return;
      }

      // Check if invitation has expired
      if (new Date(inviteData.expires_at) < new Date()) {
        await supabase
          .from('organization_invitations')
          .update({ status: 'expired' })
          .eq('id', inviteData.id);
        
        setError('This invitation has expired');
        return;
      }

      setInvitation(inviteData);
      setOrganization(inviteData.organization);
    } catch (error) {
      console.error('Error loading invitation:', error);
      setError('Failed to load invitation details');
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!invitation) return;

    setIsAccepting(true);
    
    try {
      // If user is not logged in, they need to create an account
      if (!isAuthenticated) {
        setError('Please create an account or sign in to accept this invitation');
        setIsAccepting(false);
        return;
      }

      // Check if user exists and email matches the invitation
      if (!user || user.email !== email) {
        setError(`This invitation is for ${email}. Please sign in with that email address.`);
        setIsAccepting(false);
        return;
      }

      // Add user to organization
      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          org_id: invitation.organization_id,
          role: 'member',
        });

      if (memberError) {
        throw memberError;
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('organization_invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Error updating invitation status:', updateError);
      }

      // Redirect to app
      router.push('/app');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError('Failed to accept invitation. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const declineInvitation = async () => {
    if (!invitation) return;

    try {
      await supabase
        .from('organization_invitations')
        .update({ status: 'declined' })
        .eq('id', invitation.id);

      router.push('/');
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  if (isLoading) {
    return (
      <AuthLayout title="Loading invitation..." subtitle="">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout title="Invitation Error" subtitle="">
        <Card>
          <CardContent className="p-6 text-center">
            <X className="w-12 h-12 text-error-500 mx-auto mb-4" />
            <p className="text-error-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} variant="secondary">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  if (!invitation || !organization) {
    return (
      <AuthLayout title="Invitation Not Found" subtitle="">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-600 mb-4">This invitation link is invalid or has expired.</p>
            <Button onClick={() => router.push('/')} variant="secondary">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Organization Invitation" 
      subtitle={`You've been invited to join ${organization.name}`}
    >
      <Card>
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-muted-900 dark:text-white mb-2">
              {organization.name}
            </h3>
            <p className="text-muted-600 dark:text-muted-400">
              You've been invited to join this organization
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between p-3 bg-muted-50 dark:bg-muted-800 rounded-lg">
              <span className="text-sm text-muted-600 dark:text-muted-400">Plan</span>
              <span className="text-sm font-medium capitalize">{organization.tier}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted-50 dark:bg-muted-800 rounded-lg">
              <span className="text-sm text-muted-600 dark:text-muted-400">Your Role</span>
              <span className="text-sm font-medium">Member</span>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-600 dark:text-muted-400 text-center">
                You need to create an account to accept this invitation
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={() => router.push(`/register?email=${encodeURIComponent(email!)}`)}
                  className="w-full"
                >
                  Create Account
                </Button>
                <Button 
                  onClick={() => router.push(`/login?email=${encodeURIComponent(email!)}`)}
                  variant="secondary"
                  className="w-full"
                >
                  Sign In
                </Button>
              </div>
            </div>
          ) : user?.email === email ? (
            <div className="space-y-3">
              <Button
                onClick={acceptInvitation}
                disabled={isAccepting}
                className="w-full flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {isAccepting ? 'Accepting...' : 'Accept Invitation'}
              </Button>
              <Button
                onClick={declineInvitation}
                variant="secondary"
                className="w-full flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Decline
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-600 dark:text-muted-400 mb-4">
                This invitation is for {email}. Please sign in with that email address.
              </p>
              <Button 
                onClick={() => router.push('/login')}
                variant="secondary"
              >
                Sign In with Different Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}