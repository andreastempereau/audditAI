import React from 'react';
import { Shield, AlertTriangle, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import * as Tooltip from '@radix-ui/react-tooltip';

interface SensitivityBadgeProps {
  level: 'public' | 'restricted' | 'confidential';
  showTooltip?: boolean;
}

const sensitivityConfig = {
  public: {
    label: 'Public',
    variant: 'public' as const,
    icon: Globe,
    description: 'Publicly accessible information with no access restrictions.',
  },
  restricted: {
    label: 'Restricted',
    variant: 'restricted' as const,
    icon: AlertTriangle,
    description: 'Access limited to authorized personnel. Requires proper clearance.',
  },
  confidential: {
    label: 'Confidential',
    variant: 'confidential' as const,
    icon: Shield,
    description: 'Highly sensitive information. Unauthorized access prohibited.',
  },
};

export function SensitivityBadge({ level, showTooltip = true }: SensitivityBadgeProps) {
  const config = sensitivityConfig[level];
  const Icon = config.icon;

  const badge = (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        {badge}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-50 max-w-xs rounded-lg bg-muted-900 px-3 py-2 text-sm text-white shadow-md dark:bg-white dark:text-muted-900"
          sideOffset={4}
        >
          <div className="font-medium mb-1">{config.label}</div>
          <div className="text-xs opacity-90">{config.description}</div>
          <Tooltip.Arrow className="fill-muted-900 dark:fill-white" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}