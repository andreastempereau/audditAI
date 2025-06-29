"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  Tags, 
  Upload, 
  Users, 
  Check, 
  X 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/lib/auth-supabase';
import { createClientComponentClient } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

const onboardingSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  useCaseTags: z.array(z.string()).min(1, 'Please select at least one use case'),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

const USE_CASE_OPTIONS = [
  { id: 'compliance', label: 'Compliance & Audit', icon: '📋' },
  { id: 'security', label: 'Security Review', icon: '🔒' },
  { id: 'legal', label: 'Legal Discovery', icon: '⚖️' },
  { id: 'finance', label: 'Financial Analysis', icon: '💰' },
  { id: 'hr', label: 'HR & Personnel', icon: '👥' },
  { id: 'operations', label: 'Operations', icon: '⚙️' },
  { id: 'research', label: 'Research & Dev', icon: '🔬' },
  { id: 'other', label: 'Other', icon: '📁' },
];

interface OnboardingWizardProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function OnboardingWizard({ isOpen, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [emailInputs, setEmailInputs] = useState<string[]>(['']);
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const supabase = createClientComponentClient();

  // Debug user state
  useEffect(() => {
    console.log('OnboardingWizard auth state:', {
      user,
      authLoading,
      isAuthenticated,
    });
  }, [user, authLoading, isAuthenticated]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      useCaseTags: [],
    },
  });

  const watchedUseCases = watch('useCaseTags');

  const steps = [
    {
      title: 'Create your organization',
      subtitle: 'What should we call your organization?',
      icon: Building2,
    },
    {
      title: 'Tell us about your use case',
      subtitle: 'This helps us customize your experience',
      icon: Tags,
    },
    {
      title: 'Upload starter documents',
      subtitle: 'Get started with some initial files (optional)',
      icon: Upload,
    },
    {
      title: 'Invite your team',
      subtitle: 'Collaborate with teammates (optional)',
      icon: Users,
    },
  ];

  const toggleUseCase = (useCaseId: string) => {
    const current = watchedUseCases || [];
    const updated = current.includes(useCaseId)
      ? current.filter(id => id !== useCaseId)
      : [...current, useCaseId];
    setValue('useCaseTags', updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addEmailInput = () => {
    setEmailInputs(prev => [...prev, '']);
  };

  const removeEmailInput = (index: number) => {
    setEmailInputs(prev => prev.filter((_, i) => i !== index));
  };

  const updateEmailInput = (index: number, value: string) => {
    setEmailInputs(prev => prev.map((email, i) => i === index ? value : email));
  };

  const goToNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
    console.log('Form submitted with data:', data);
    console.log('Current user:', user);
    console.log('Auth loading:', authLoading);
    console.log('Is authenticated:', isAuthenticated);
    console.log('Email inputs:', emailInputs);
    
    if (!isAuthenticated) {
      console.error('User not authenticated');
      alert('❌ User not authenticated. Please refresh and try again.');
      return;
    }

    // Get current user from Supabase session
    const { data: { user: sessionUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !sessionUser) {
      console.error('Cannot get current user:', userError);
      alert('❌ Cannot identify user. Please refresh and try again.');
      return;
    }

    const userId = sessionUser.id;

    // Validate form data
    const validEmails = emailInputs.filter(email => email.trim() && email.includes('@'));
    
    // Check if organization name is provided
    if (!data.organizationName || data.organizationName.trim().length < 2) {
      alert('❌ Please enter an organization name (at least 2 characters).');
      return;
    }
    
    // Check if at least one use case is selected
    if (!data.useCaseTags || data.useCaseTags.length === 0) {
      alert('❌ Please select at least one use case to continue.');
      return;
    }

    console.log('Validation passed, starting organization creation...');
    setIsLoading(true);

    try {
      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.organizationName,
          tier: 'free',
          owner_id: userId,
        })
        .select()
        .single();

      if (orgError) {
        console.error('Organization creation error:', orgError);
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }

      console.log('Organization created successfully:', orgData);

      // Add user as owner to the organization
      const { error: userOrgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          org_id: orgData.id,
          role: 'owner',
        });

      if (userOrgError) {
        console.error('User organization relationship error:', userOrgError);
        throw new Error(`Failed to add user to organization: ${userOrgError.message}`);
      }

      console.log('User added to organization successfully');

      // Send team invitations
      if (validEmails.length > 0) {
        await sendTeamInvitations(validEmails, orgData.id, data.organizationName, userId);
      }

      // Update user profile
      console.log('Updating user profile to mark onboarding complete...');
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_time: false,
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Failed to update profile:', profileError);
        throw new Error(`Failed to update profile: ${profileError.message}`);
      }

      console.log('Profile updated successfully - onboarding complete!');
      onComplete();
    } catch (error) {
      console.error('Onboarding failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`❌ Setup failed: ${errorMessage}\n\nPlease check the console for details and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTeamInvitations = async (emails: string[], orgId: string, orgName: string, invitedBy: string) => {
    try {
      // Get current user for inviter name
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const inviterName = user?.name || currentUser?.user_metadata?.full_name || currentUser?.email || 'Someone';

      // Create invitation records in database
      const invitations = emails.map(email => ({
        email,
        organization_id: orgId,
        invited_by: invitedBy,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }));

      const { error: inviteError } = await supabase
        .from('organization_invitations')
        .insert(invitations);

      if (inviteError) {
        console.error('Error creating invitations:', inviteError);
        throw new Error('Failed to create invitations');
      }

      // Send invitation emails
      let successCount = 0;
      const failedEmails: string[] = [];

      for (const email of emails) {
        try {
          const inviteLink = `${window.location.origin}/invite?org=${orgId}&email=${encodeURIComponent(email)}`;
          
          const response = await fetch('/api/send-invitation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              organizationName: orgName,
              inviterName,
              inviteLink,
            }),
          });

          if (response.ok) {
            successCount++;
            console.log(`Invitation sent successfully to ${email}`);
          } else {
            const errorData = await response.json();
            if (errorData.error?.includes('Email service not configured')) {
              // Email service not set up, show invite links instead
              const inviteLinks = emails.map(email => 
                `${email}: ${window.location.origin}/invite?org=${orgId}&email=${encodeURIComponent(email)}`
              );
              
              alert(`⚠️ Email service not configured. Share these invitation links with your team:\n\n${inviteLinks.join('\n\n')}\n\nTo set up automatic emails, see docs/EMAIL_SETUP.md`);
              return;
            }
            failedEmails.push(email);
            console.error(`Failed to send invitation to ${email}`);
          }
        } catch (emailError) {
          failedEmails.push(email);
          console.error(`Error sending invitation to ${email}:`, emailError);
        }
      }

      // Show results to user
      if (successCount === emails.length) {
        alert(`✅ Successfully sent ${successCount} invitation email${successCount > 1 ? 's' : ''}!`);
      } else if (successCount > 0) {
        alert(`✅ Sent ${successCount} invitation${successCount > 1 ? 's' : ''} successfully.\n⚠️ Failed to send to: ${failedEmails.join(', ')}`);
      } else {
        alert(`❌ Failed to send any invitation emails. Please check your email configuration.`);
      }
      
    } catch (error) {
      console.error('Error sending team invitations:', error);
      alert('❌ Failed to send team invitations. Please try again.');
    }
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-muted-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-muted-200 dark:border-muted-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-muted-900 dark:text-white">
                  {currentStepData.title}
                </h2>
                <p className="text-sm text-muted-600 dark:text-muted-400">
                  {currentStepData.subtitle}
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-500">
              {currentStep + 1} of {steps.length}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 w-full bg-muted-200 dark:bg-muted-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit, (errors) => {
          console.log('Form validation errors:', errors);
          alert('❌ Form validation failed. Check console for details.');
        })} className="p-6">
          <div className="min-h-[300px]">
            {/* Step 0: Organization Name */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <Input
                  {...register('organizationName')}
                  placeholder="Enter your organization name"
                  className="text-lg"
                  autoFocus
                />
                {errors.organizationName && (
                  <p className="text-sm text-error-600">{errors.organizationName.message}</p>
                )}
                <p className="text-sm text-muted-600 dark:text-muted-400">
                  This will be displayed to your team members and in audit trails.
                </p>
              </div>
            )}

            {/* Step 1: Use Cases */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {USE_CASE_OPTIONS.map((useCase) => (
                    <button
                      key={useCase.id}
                      type="button"
                      onClick={() => toggleUseCase(useCase.id)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                        'hover:shadow-md',
                        watchedUseCases?.includes(useCase.id)
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-muted-200 dark:border-muted-700 text-muted-700 dark:text-muted-300'
                      )}
                    >
                      <span className="text-xl">{useCase.icon}</span>
                      <span className="font-medium text-sm">{useCase.label}</span>
                    </button>
                  ))}
                </div>
                {errors.useCaseTags && (
                  <p className="text-sm text-error-600">{errors.useCaseTags.message}</p>
                )}
              </div>
            )}

            {/* Step 2: File Upload */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-muted-300 dark:border-muted-700 rounded-lg p-8 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-400 mb-4" />
                  <p className="text-muted-600 dark:text-muted-400 mb-4">
                    Drop files here or click to browse
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  />
                  <label htmlFor="file-upload">
                    <Button type="button" variant="secondary" asChild>
                      <span>Choose Files</span>
                    </Button>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Selected Files:</h4>
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted-50 dark:bg-muted-800 rounded"
                      >
                        <span className="text-sm truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-error-600 hover:text-error-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-sm text-muted-600 dark:text-muted-400">
                  You can always upload more files later in the Data Room.
                </p>
              </div>
            )}

            {/* Step 3: Team Invites */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {emailInputs.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="teammate@company.com"
                        value={email}
                        onChange={(e) => updateEmailInput(index, e.target.value)}
                        className="flex-1"
                      />
                      {emailInputs.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeEmailInput(index)}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={addEmailInput}
                  className="w-full"
                >
                  Add another email
                </Button>

                <p className="text-sm text-muted-600 dark:text-muted-400">
                  Team members will receive an invitation email to join your organization.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-muted-200 dark:border-muted-800">
            <Button
              type="button"
              variant="ghost"
              onClick={goToPrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={goToNext}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2"
                onClick={() => console.log('Complete Setup button clicked!')}
              >
                {isLoading ? 'Setting up...' : 'Complete Setup'}
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}