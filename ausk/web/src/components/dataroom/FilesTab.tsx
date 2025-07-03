import React, { useState } from 'react';
import { Plus, Filter, Download, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDataRoomFiles } from '@/lib/hooks/useDataRoom';
import { FileTable } from './FileTable';
import { UploadZone } from './UploadZone';
import { FileDrawer } from './FileDrawer';
import { DataRoomFile } from '@/lib/api';

export function FilesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<DataRoomFile | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sortBy, setSortBy] = useState('lastModified');
  const [filterSensitivity, setFilterSensitivity] = useState<string>('');

  const { 
    files, 
    total, 
    isLoading, 
    deleteFile,
    isDeleting 
  } = useDataRoomFiles({
    search: searchQuery,
    sortBy,
    sensitivity: filterSensitivity || undefined,
    perPage: 50,
  });

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      await Promise.all(selectedFiles.map(id => deleteFile(id)));
      setSelectedFiles([]);
    } catch (error) {
      console.error('Failed to delete files:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          
          <select
            value={filterSensitivity}
            onChange={(e) => setFilterSensitivity(e.target.value)}
            className="input w-32"
          >
            <option value="">All Levels</option>
            <option value="public">Public</option>
            <option value="restricted">Restricted</option>
            <option value="confidential">Confidential</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input w-32"
          >
            <option value="lastModified">Last Modified</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="uploadedAt">Upload Date</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          {selectedFiles.length > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-primary-50 rounded-lg">
              <span className="text-sm text-primary-700">
                {selectedFiles.length} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="text-error-600 hover:text-error-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="gap-2"
            data-upload-zone
          >
            <Plus className="w-4 h-4" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* File Table */}
      <div className="flex-1 min-h-0">
        <FileTable
          files={files}
          isLoading={isLoading}
          selectedFiles={selectedFiles}
          onSelectionChange={setSelectedFiles}
          onFileClick={setSelectedFile}
        />
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <UploadZone
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />
      )}

      {/* File Drawer */}
      {selectedFile && (
        <FileDrawer
          file={selectedFile}
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}