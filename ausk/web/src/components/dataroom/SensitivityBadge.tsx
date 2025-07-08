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
    variant: 'secondary' as const,
    icon: Globe,
    description: 'Publicly accessible information with no access restrictions.',
  },
  restricted: {
    label: 'Restricted',
    variant: 'warning' as const,
    icon: AlertTriangle,
    description: 'Access limited to authorized personnel. Requires proper clearance.',
  },
  confidential: {
    label: 'Confidential',
    variant: 'destructive' as const,
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
          className="z-50 max-w-xs rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md border border-border"
          sideOffset={4}
        >
          <div className="font-medium mb-1">{config.label}</div>
          <div className="text-xs opacity-90">{config.description}</div>
          <Tooltip.Arrow className="fill-popover" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}