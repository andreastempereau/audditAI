"use client";

import React, { useState } from 'react';
import { 
  Share2, 
  Plus, 
  Shield, 
  Clock, 
  Building2, 
  Calendar,
  Lock,
  Unlock,
  Users,
  FileCheck,
  AlertCircle,
  ExternalLink,
  Trash2,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TrustBubble {
  id: string;
  name: string;
  partnerCompany: string;
  sharedRooms: string[];
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'pending' | 'expired';
  accessCount: number;
  lastAccessed?: string;
}

// Mock data for demonstration
const mockBubbles: TrustBubble[] = [
  {
    id: '1',
    name: 'Q4 Merger Due Diligence',
    partnerCompany: 'Acme Corp',
    sharedRooms: ['Financial Reports', 'Legal Documents'],
    createdAt: '2024-01-15T10:00:00Z',
    expiresAt: '2024-02-15T10:00:00Z',
    status: 'active',
    accessCount: 47,
    lastAccessed: '2024-01-20T14:30:00Z'
  },
  {
    id: '2',
    name: 'Joint Venture Analysis',
    partnerCompany: 'TechStart Inc',
    sharedRooms: ['Technical Specs', 'Market Research'],
    createdAt: '2024-01-10T09:00:00Z',
    expiresAt: '2024-01-25T09:00:00Z',
    status: 'pending',
    accessCount: 0
  },
  {
    id: '3',
    name: 'Supply Chain Integration',
    partnerCompany: 'Global Logistics Co',
    sharedRooms: ['Vendor Contracts'],
    createdAt: '2023-12-01T08:00:00Z',
    expiresAt: '2024-01-01T08:00:00Z',
    status: 'expired',
    accessCount: 123,
    lastAccessed: '2023-12-28T16:45:00Z'
  }
];

export default function TrustBubblesPage() {
  const [bubbles] = useState<TrustBubble[]>(mockBubbles);
  const [selectedBubble, setSelectedBubble] = useState<TrustBubble | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getStatusIcon = (status: TrustBubble['status']) => {
    switch (status) {
      case 'active':
        return <Unlock className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'expired':
        return <Lock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: TrustBubble['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trust Bubbles</h1>
          <p className="text-muted-foreground mt-2">
            Create secure, time-limited data sharing spaces with partner companies
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Trust Bubble
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Bubbles</p>
              <p className="text-2xl font-bold">
                {bubbles.filter(b => b.status === 'active').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Partner Companies</p>
              <p className="text-2xl font-bold">
                {new Set(bubbles.map(b => b.partnerCompany)).size}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Accesses</p>
              <p className="text-2xl font-bold">
                {bubbles.reduce((sum, b) => sum + b.accessCount, 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Trust Bubbles List */}
      <div className="space-y-4">
        {bubbles.map((bubble) => (
          <Card 
            key={bubble.id} 
            className={cn(
              "p-6 cursor-pointer transition-all hover:shadow-lg",
              selectedBubble?.id === bubble.id && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedBubble(bubble)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">{bubble.name}</h3>
                  {getStatusBadge(bubble.status)}
                </div>
                
                <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    <span>{bubble.partnerCompany}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Created {formatDistanceToNow(new Date(bubble.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>
                      {bubble.status === 'expired' 
                        ? 'Expired ' + formatDistanceToNow(new Date(bubble.expiresAt), { addSuffix: true })
                        : 'Expires ' + formatDistanceToNow(new Date(bubble.expiresAt), { addSuffix: true })
                      }
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {bubble.sharedRooms.length} shared room{bubble.sharedRooms.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {bubble.accessCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {bubble.accessCount} access{bubble.accessCount !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  )}
                  {bubble.lastAccessed && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        Last accessed {formatDistanceToNow(new Date(bubble.lastAccessed), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {getStatusIcon(bubble.status)}
                {bubble.status === 'active' && (
                  <Button size="sm" variant="outline">
                    Manage Access
                  </Button>
                )}
              </div>
            </div>

            {selectedBubble?.id === bubble.id && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">Shared Data Rooms:</h4>
                  <div className="flex flex-wrap gap-2">
                    {bubble.sharedRooms.map((room) => (
                      <Badge key={room} variant="outline">
                        <FolderOpen className="w-3 h-3 mr-1" />
                        {room}
                      </Badge>
                    ))}
                  </div>
                </div>

                {bubble.status === 'pending' && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        Pending Partner Approval
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        Waiting for {bubble.partnerCompany} to approve access to their data rooms.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {bubble.status === 'active' && (
                    <>
                      <Button size="sm">
                        <Share2 className="w-4 h-4 mr-2" />
                        View Shared Space
                      </Button>
                      <Button size="sm" variant="outline">
                        <Clock className="w-4 h-4 mr-2" />
                        Extend Duration
                      </Button>
                    </>
                  )}
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle deletion
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {bubble.status === 'active' ? 'Revoke Access' : 'Delete'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {bubbles.length === 0 && (
        <Card className="p-12 text-center">
          <Share2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Trust Bubbles Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first trust bubble to start secure data sharing with partners
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Trust Bubble
          </Button>
        </Card>
      )}

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl p-6">
            <h2 className="text-xl font-semibold mb-4">Create Trust Bubble</h2>
            <p className="text-muted-foreground mb-6">
              Set up a secure data sharing space with a partner company
            </p>
            {/* Form would go here */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowCreateModal(false)}>
                Create Bubble
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}