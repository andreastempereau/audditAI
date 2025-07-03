import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

const Modal = ({ open, onOpenChange, children, title, description, className }: ModalProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-scale-in',
            'rounded-xl border border-muted-200',
            'focus:outline-none',
            'dark:bg-muted-900 dark:border-muted-800',
            className
          )}
        >
          {title && (
            <Dialog.Title className="text-display-md mb-2 text-muted-900 dark:text-white">
              {title}
            </Dialog.Title>
          )}
          
          {description && (
            <Dialog.Description className="mb-4 text-sm text-muted-600 dark:text-muted-400">
              {description}
            </Dialog.Description>
          )}
          
          {children}
          
          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-lg p-1 hover:bg-muted-100 dark:hover:bg-muted-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export { Modal };