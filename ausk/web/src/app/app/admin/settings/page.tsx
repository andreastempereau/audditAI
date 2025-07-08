"use client";

import React, { useState, useEffect } from 'react';
import { 
  Building,
  Bell,
  Shield,
  CreditCard,
  Users,
  Globe,
  Key,
  FileText,
  Save,
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Separator } from '@/components/ui/Separator';
import { Badge } from '@/components/ui/Badge';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useAuth } from '@/lib/auth-supabase';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const { user } = useAuth();
  const { organization, isLoading, updateOrganization, isUpdating } = useOrganization();
  const [showSuccess, setShowSuccess] = useState(false);

  // Form states
  const [organizationName, setOrganizationName] = useState('');
  const [organizationUrl, setOrganizationUrl] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');

  // Load organization data
  useEffect(() => {
    if (organization) {
      setOrganizationName(organization.name || '');
      setOrganizationUrl(organization.website || '');
      setDescription(organization.description || '');
      setTimezone(organization.settings?.timezone || 'America/New_York');
      setEmailNotifications(organization.settings?.emailNotifications ?? true);
      setTwoFactorRequired(organization.settings?.twoFactorRequired ?? false);
      setSessionTimeout(String(organization.settings?.sessionTimeout || 30));
    }
  }, [organization]);

  const handleSave = async () => {
    try {
      await updateOrganization({
        name: organizationName,
        website: organizationUrl,
        description,
        settings: {
          timezone,
          emailNotifications,
          twoFactorRequired,
          sessionTimeout: parseInt(sessionTimeout),
        },
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization's settings and preferences
        </p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <Card className="p-4 bg-success/10 border-success/20">
          <div className="flex items-center gap-2 text-success">
            <Check className="w-5 h-5" />
            <span className="font-medium">Settings saved successfully!</span>
          </div>
        </Card>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-5 h-5" />
              <h2 className="text-lg font-medium">Organization Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Enter organization name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="org-url">Website</Label>
                <Input
                  id="org-url"
                  type="url"
                  value={organizationUrl}
                  onChange={(e) => setOrganizationUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your organization"
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              <h2 className="text-lg font-medium">Team Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-join on invite</p>
                  <p className="text-sm text-muted-foreground">
                    New members automatically join when invited
                  </p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Require admin approval</p>
                  <p className="text-sm text-muted-foreground">
                    Admin must approve new member requests
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5" />
              <h2 className="text-lg font-medium">Security Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-factor authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for all organization members
                  </p>
                </div>
                <Switch 
                  checked={twoFactorRequired}
                  onCheckedChange={setTwoFactorRequired}
                />
              </div>
              <Separator />
              <div>
                <Label htmlFor="session-timeout">Session timeout (minutes)</Label>
                <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">IP allowlist</p>
                  <p className="text-sm text-muted-foreground">
                    Restrict access to specific IP addresses
                  </p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5" />
              <h2 className="text-lg font-medium">API Keys</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Manage API keys for programmatic access
            </p>
            <Button variant="outline">
              <Key className="w-4 h-4 mr-2" />
              Generate New Key
            </Button>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5" />
              <h2 className="text-lg font-medium">Email Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts for important events
                  </p>
                </div>
                <Switch 
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="font-medium text-sm">Notification types</p>
                {['New documents', 'Team updates', 'Security alerts', 'Weekly reports'].map((type) => (
                  <div key={type} className="flex items-center justify-between pl-4">
                    <span className="text-sm">{type}</span>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5" />
              <h2 className="text-lg font-medium">Billing Information</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Current Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {organization?.tier === 'enterprise' ? 'Enterprise' : 
                     organization?.tier === 'pro' ? 'Professional' : 'Free'} Plan
                  </p>
                </div>
                <Badge variant={organization?.tier === 'enterprise' ? 'default' : 'secondary'}>
                  {organization?.tier?.toUpperCase()}
                </Badge>
              </div>
              {organization?.tier !== 'enterprise' && (
                <Button className="w-full">
                  Upgrade to {organization?.tier === 'free' ? 'Pro' : 'Enterprise'}
                </Button>
              )}
              <Separator />
              <div>
                <p className="font-medium mb-2">Payment Method</p>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">
                      {organization?.tier === 'free' ? 'No payment method' : '•••• •••• •••• 4242'}
                    </p>
                  </div>
                  {organization?.tier !== 'free' && (
                    <Button variant="outline" size="sm">Update</Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5" />
              <h2 className="text-lg font-medium">Billing History</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {organization?.tier === 'free' 
                ? 'No billing history for free plan' 
                : 'View and download past invoices'}
            </p>
          </Card>
        </TabsContent>

        {/* Integration Settings */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5" />
              <h2 className="text-lg font-medium">Connected Services</h2>
            </div>
            <div className="space-y-4">
              {[
                { name: 'Google Workspace', status: 'connected', icon: '🔗' },
                { name: 'Slack', status: 'not_connected', icon: '💬' },
                { name: 'Microsoft 365', status: 'not_connected', icon: '📊' },
              ].map((service) => (
                <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{service.icon}</span>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {service.status === 'connected' ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant={service.status === 'connected' ? 'outline' : 'default'}
                    size="sm"
                  >
                    {service.status === 'connected' ? 'Manage' : 'Connect'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isUpdating}>
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}