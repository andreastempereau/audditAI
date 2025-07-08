"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { Shield, Bell, Menu, Sun, Moon, Monitor } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-supabase';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

const navigation = [
  { name: 'Chat', href: '/app' },
  { name: 'Data Room', href: '/app/data-room' },
  { name: 'Audit Logs', href: '/app/logs' },
  { name: 'Members', href: '/app/admin/members' },
  { name: 'Settings', href: '/app/admin/settings' },
];

const Header = ({ onMenuClick, sidebarCollapsed }: HeaderProps) => {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { organization } = useOrganization();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Generate breadcrumb from current path
  const getBreadcrumb = () => {
    const currentNav = navigation.find(
      nav => pathname === nav.href || 
        (pathname && nav.href !== '/app' && pathname.startsWith(nav.href + '/'))
    );
    return currentNav?.name || 'Dashboard';
  };

  const themeIcons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };

  const ThemeIcon = themeIcons[theme];

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Logo and breadcrumb */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="hidden font-bold text-foreground sm:block">
                {organization?.name || 'Ausk'}
              </span>
            </div>
            
            <div className="hidden h-6 w-px bg-border sm:block" />
            
            <nav className="hidden sm:block" aria-label="Breadcrumb">
              <span className="text-sm font-medium text-foreground">
                {getBreadcrumb()}
              </span>
            </nav>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <Tooltip.Provider delayDuration={300}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button variant="ghost" size="sm" aria-label="Toggle theme">
                      <ThemeIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="z-50 min-w-[8rem] rounded-lg border border-border bg-popover p-1 shadow-md"
                      sideOffset={4}
                    >
                      <DropdownMenu.Item
                        className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setTheme('light')}
                      >
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setTheme('dark')}
                      >
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setTheme('system')}
                      >
                        <Monitor className="mr-2 h-4 w-4" />
                        System
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-50 rounded-lg bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
                  sideOffset={4}
                >
                  Toggle theme
                  <Tooltip.Arrow className="fill-popover" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>

          {/* Notifications */}
          <Button variant="ghost" size="sm" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>

          {/* User menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="h-6 w-6 rounded-full bg-primary text-xs font-medium text-white flex items-center justify-center">
                  {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden text-sm font-medium md:block">{user?.name || user?.email}</span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[12rem] rounded-lg border border-border bg-popover p-1 shadow-md"
                sideOffset={4}
                align="end"
              >
                <DropdownMenu.Label className="px-2 py-1.5 text-sm font-semibold">
                  {user?.name || user?.email}
                </DropdownMenu.Label>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                  Profile
                </DropdownMenu.Item>
                <DropdownMenu.Item className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                  Settings
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item 
                  className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10"
                  onClick={handleSignOut}
                >
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
};

export { Header };