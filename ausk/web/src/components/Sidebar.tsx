"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  FolderOpen, 
  FileText, 
  Users, 
  Settings,
  ChevronLeft,
  Shield
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

const navigation = [
  { name: 'Chat', href: '/app', icon: MessageSquare },
  { name: 'Data Room', href: '/app/data-room', icon: FolderOpen },
  { name: 'Audit Logs', href: '/app/logs', icon: FileText },
  { name: 'Members', href: '/app/admin/members', icon: Users },
  { name: 'Settings', href: '/app/admin/settings', icon: Settings },
];

const Sidebar = ({ collapsed, onToggleCollapse, className }: SidebarProps) => {
  const pathname = usePathname();

  const sidebarVariants = {
    expanded: { width: 240 },
    collapsed: { width: 64 },
  };

  const NavItem = ({ item }: { item: typeof navigation[0] }) => {
    const isActive = pathname === item.href || 
      (pathname && item.href !== '/app' && pathname.startsWith(item.href + '/'));
    
    const content = (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          isActive
            ? 'bg-primary/10 text-primary border-l-2 border-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="truncate"
          >
            {item.name}
          </motion.span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip.Root delayDuration={300}>
          <Tooltip.Trigger asChild>
            {content}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              className="z-50 rounded-lg bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
              sideOffset={8}
            >
              {item.name}
              <Tooltip.Arrow className="fill-popover" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    return content;
  };

  return (
    <Tooltip.Provider>
      <motion.aside
        variants={sidebarVariants}
        animate={collapsed ? 'collapsed' : 'expanded'}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          'flex h-full flex-col border-r border-border bg-card',
          className
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-3">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-foreground">Ausk</span>
            </motion.div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              'h-8 w-8 p-0',
              collapsed && 'mx-auto'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 transition-transform',
                collapsed && 'rotate-180'
              )}
            />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-muted-foreground"
            >
              <div className="mb-1 font-medium">Ausk v1.0</div>
              <div>Enterprise Edition</div>
            </motion.div>
          )}
        </div>
      </motion.aside>
    </Tooltip.Provider>
  );
};

export { Sidebar };