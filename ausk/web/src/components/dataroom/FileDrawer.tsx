import React from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { DataRoomFile } from '@/lib/api';

interface FileDrawerProps {
  file: DataRoomFile;
  isOpen: boolean;
  onClose: () => void;
}

export function FileDrawer({ file, isOpen, onClose }: FileDrawerProps) {
  return (
    <Drawer
      open={isOpen}
      onOpenChange={onClose}
      title={file.name}
    >
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">File Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-600">Size:</dt>
              <dd>{file.size} bytes</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-600">Type:</dt>
              <dd>{file.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-600">Owner:</dt>
              <dd>{file.owner}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-600">Modified:</dt>
              <dd>{new Date(file.lastModified).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Drawer>
  );
}