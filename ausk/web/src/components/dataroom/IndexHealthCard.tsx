import React from 'react';
import { AlertTriangle, CheckCircle, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { IndexHealth } from '@/lib/api';
import { useIndexHealth } from '@/lib/hooks/useDataRoom';

interface IndexHealthCardProps {
  health?: IndexHealth;
}

export function IndexHealthCard({ health }: IndexHealthCardProps) {
  const { triggerRebalance, isRebalancing } = useIndexHealth();

  if (!health) {
    return (
      <Card className="w-64">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-muted-foreground animate-pulse" />
            <span className="text-sm text-muted-foreground">Loading index status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isStale = health.pendingJobs > 0 || health.orphanCount > 100;
  const statusIcon = health.isHealthy && !isStale ? CheckCircle : AlertTriangle;
  const statusColor = health.isHealthy && !isStale ? 'text-success' : 'text-warning';

  return (
    <Card className="w-64">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {React.createElement(statusIcon, { className: `w-4 h-4 ${statusColor}` })}
            <span className="text-sm font-medium">Vector Index</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => triggerRebalance()}
            disabled={isRebalancing}
            className="h-6 px-2"
          >
            <RefreshCw className={`w-3 h-3 ${isRebalancing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-600">Fragments:</span>
            <span className="font-medium">{health.fragmentsTotal.toLocaleString()}</span>
          </div>
          
          {health.orphanCount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-600">Orphaned:</span>
              <span className="font-medium text-warning-600">{health.orphanCount}</span>
            </div>
          )}
          
          {health.pendingJobs > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-600">Pending:</span>
              <span className="font-medium text-primary-600">{health.pendingJobs}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-muted-600">Last rebalance:</span>
            <span className="font-medium">
              {new Date(health.lastRebalance).toLocaleDateString()}
            </span>
          </div>
        </div>

        {isStale && (
          <div className="mt-3 p-2 bg-warning-50 border border-warning-200 rounded text-xs text-warning-700">
            Index needs rebalancing for optimal performance
          </div>
        )}
      </CardContent>
    </Card>
  );
}