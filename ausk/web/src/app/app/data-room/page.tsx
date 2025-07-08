"use client";

import React, { useState } from 'react';
import { 
  Upload, 
  Grid3X3, 
  List, 
  Search, 
  FileText, 
  Image, 
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Eye,
  MoreVertical,
  Filter,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useDataRoom } from '@/lib/hooks/useDataRoom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DataRoomPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  
  const { 
    files, 
    isLoading, 
    uploadFile, 
    deleteFile,
    isUploading,
    uploadProgress 
  } = useDataRoom();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(file);
    try {
      await uploadFile(file, {
        sensitivity: 'restricted',
        encrypted: true
      });
      setUploadingFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadingFile(null);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        await deleteFile(fileId);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.includes('pdf')) return FileText;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
    if (mimeType.includes('document') || mimeType.includes('word')) return FileText;
    return File;
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Room</h1>
          <p className="text-muted-foreground mt-2">
            Securely manage and share your sensitive documents
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          <label htmlFor="file-upload">
            <Button 
              as="span" 
              className="cursor-pointer"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </label>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  view === 'grid' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  view === 'list' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 p-2 bg-primary/10 rounded-lg flex items-center justify-between">
            <span className="text-sm">
              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
              <Button size="sm" variant="destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Upload Progress */}
      {uploadingFile && isUploading && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Uploading {uploadingFile.name}</span>
            <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </Card>
      )}

      {/* Documents */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? 'No documents found' : 'No documents yet'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms' 
              : 'Upload your first document to get started'}
          </p>
          {!searchQuery && (
            <label htmlFor="file-upload-empty">
              <Button as="span" variant="outline" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </label>
          )}
          <input
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload-empty"
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => {
            const Icon = getFileIcon(file.type);
            const isSelected = selectedFiles.includes(file.id);
            
            return (
              <Card
                key={file.id}
                className={cn(
                  "p-4 hover:shadow-lg transition-all cursor-pointer",
                  isSelected && "ring-2 ring-primary"
                )}
                onClick={() => toggleFileSelection(file.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={cn(
                    "p-3 rounded-lg",
                    isSelected ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <button 
                    className="p-1 hover:bg-muted rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open dropdown menu
                    }}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-medium text-sm mb-1 truncate" title={file.name}>
                  {file.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {formatFileSize(file.size)} • {formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true })}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant={
                    file.sensitivity === 'confidential' ? 'destructive' : 
                    file.sensitivity === 'restricted' ? 'warning' : 
                    'default'
                  } className="text-xs">
                    {file.sensitivity}
                  </Badge>
                  <div className="flex gap-1">
                    <button 
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle view
                      }}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button 
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle download
                      }}
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button 
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-sm">
                  <input 
                    type="checkbox"
                    className="rounded"
                    checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(filteredFiles.map(f => f.id));
                      } else {
                        setSelectedFiles([]);
                      }
                    }}
                  />
                </th>
                <th className="text-left p-4 font-medium text-sm">Name</th>
                <th className="text-left p-4 font-medium text-sm">Size</th>
                <th className="text-left p-4 font-medium text-sm">Uploaded</th>
                <th className="text-left p-4 font-medium text-sm">Security</th>
                <th className="text-left p-4 font-medium text-sm">Owner</th>
                <th className="text-right p-4 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredFiles.map((file) => {
                const Icon = getFileIcon(file.type);
                const isSelected = selectedFiles.includes(file.id);
                
                return (
                  <tr 
                    key={file.id} 
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    <td className="p-4">
                      <input 
                        type="checkbox"
                        className="rounded"
                        checked={isSelected}
                        onChange={() => toggleFileSelection(file.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">{file.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true })}
                    </td>
                    <td className="p-4">
                      <Badge variant={
                        file.sensitivity === 'confidential' ? 'destructive' : 
                        file.sensitivity === 'restricted' ? 'warning' : 
                        'default'
                      } className="text-xs">
                        {file.sensitivity}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {file.owner}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 justify-end">
                        <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(file.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}