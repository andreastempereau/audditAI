import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  side?: 'left' | 'right';
  className?: string;
}

const Drawer = ({ 
  open, 
  onOpenChange, 
  children, 
  title, 
  side = 'right',
  className 
}: DrawerProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed z-50 h-full w-full max-w-md bg-white shadow-lg duration-300',
            'focus:outline-none',
            'dark:bg-muted-900',
            side === 'right' 
              ? 'right-0 top-0 data-[state=open]:animate-slide-in-right' 
              : 'left-0 top-0 data-[state=open]:animate-slide-in-left',
            className
          )}
        >
          <div className="flex h-full flex-col">
            {title && (
              <div className="flex items-center justify-between border-b border-muted-200 p-6 dark:border-muted-800">
                <Dialog.Title className="text-display-md text-muted-900 dark:text-white">
                  {title}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    className="rounded-lg p-2 hover:bg-muted-100 dark:hover:bg-muted-800"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export { Drawer };