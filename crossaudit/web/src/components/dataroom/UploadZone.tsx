"use client";
import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, File, Shield, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { useDataRoomFiles } from '@/lib/hooks/useDataRoom';
import { useSocket } from '@/lib/hooks/useSocket';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FileUpload {
  id: string;
  file: File;
  sensitivity: 'public' | 'restricted' | 'confidential';
  encrypt: boolean;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export function UploadZone({ isOpen, onClose }: UploadZoneProps) {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMutation } = useDataRoomFiles();
  const socket = useSocket();

  // Socket event handlers for upload progress
  React.useEffect(() => {
    const handleProgress = (data: { fileId: string; percent: number }) => {
      setFiles(prev => prev.map(f => 
        f.id === data.fileId ? { ...f, progress: data.percent, status: 'uploading' as const } : f
      ));
    };

    const handleComplete = (data: { fileId: string; version: number }) => {
      setFiles(prev => prev.map(f => 
        f.id === data.fileId ? { ...f, progress: 100, status: 'completed' as const } : f
      ));
    };

    socket.on('uploadProgress', handleProgress);
    socket.on('uploadComplete', handleComplete);

    return () => {
      socket.off('uploadProgress', handleProgress);
      socket.off('uploadComplete', handleComplete);
    };
  }, [socket]);

  const generateFileId = () => Math.random().toString(36).substring(2, 15);

  const addFiles = useCallback((newFiles: File[]) => {
    const uploads: FileUpload[] = newFiles.map(file => ({
      id: generateFileId(),
      file,
      sensitivity: 'restricted' as const,
      encrypt: true,
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...uploads]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFileSetting = useCallback((id: string, key: keyof FileUpload, value: any) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  }, [addFiles]);

  const startUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const fileUpload of pendingFiles) {
      try {
        setFiles(prev => prev.map(f => 
          f.id === fileUpload.id ? { ...f, status: 'uploading' } : f
        ));

        await uploadMutation.mutateAsync({
          file: fileUpload.file,
          options: {
            sensitivity: fileUpload.sensitivity,
            encrypt: fileUpload.encrypt,
            fileId: fileUpload.id,
          },
        });
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileUpload.id ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed' 
          } : f
        ));
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: FileUpload['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-500" />;
      case 'uploading':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-error-500" />;
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const canUpload = pendingCount > 0 && !uploadMutation.isPending;

  const handleClose = () => {
    if (uploadMutation.isPending) return; // Prevent closing during upload
    setFiles([]);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleClose}
      title="Upload Files"
      description="Upload files to the data room with encryption and access controls"
      className="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Drop Zone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            dragActive ? "border-primary bg-primary/5" : "border-muted-300 hover:border-muted-400"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className={cn("mx-auto h-12 w-12 mb-4", dragActive ? "text-primary" : "text-muted-400")} />
          <p className="text-lg font-medium text-muted-900 dark:text-white mb-2">
            {dragActive ? "Drop files here" : "Drag and drop files here"}
          </p>
          <p className="text-sm text-muted-600">
            or <span className="font-medium text-primary underline">browse files</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleFileInput}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-muted-900 dark:text-white">
              Files to Upload ({files.length})
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {files.map((fileUpload) => (
                <div key={fileUpload.id} className="flex items-start gap-3 p-3 border border-muted-200 dark:border-muted-700 rounded-lg">
                  <File className="h-5 w-5 text-muted-500 mt-0.5 shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-sm truncate">{fileUpload.file.name}</p>
                      {getStatusIcon(fileUpload.status)}
                    </div>
                    
                    <p className="text-xs text-muted-600 mb-2">
                      {formatFileSize(fileUpload.file.size)} • {fileUpload.file.type || 'Unknown type'}
                    </p>

                    {fileUpload.status === 'error' && fileUpload.error && (
                      <p className="text-xs text-error-600 mb-2">{fileUpload.error}</p>
                    )}

                    {fileUpload.status === 'uploading' && (
                      <div className="w-full bg-muted-200 dark:bg-muted-700 rounded-full h-1.5 mb-2">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${fileUpload.progress}%` }}
                        />
                      </div>
                    )}

                    {fileUpload.status === 'pending' && (
                      <div className="flex gap-2">
                        <Select
                          value={fileUpload.sensitivity}
                          onValueChange={(value) => updateFileSetting(fileUpload.id, 'sensitivity', value as any)}
                          disabled={fileUpload.status !== 'pending'}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="restricted">Restricted</SelectItem>
                            <SelectItem value="confidential">Confidential</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`encrypt-${fileUpload.id}`}
                            checked={fileUpload.encrypt}
                            onChange={(e) => updateFileSetting(fileUpload.id, 'encrypt', e.target.checked)}
                            className="rounded border-muted-300"
                            disabled={fileUpload.status !== 'pending'}
                          />
                          <label htmlFor={`encrypt-${fileUpload.id}`} className="text-xs text-muted-600 flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Encrypt
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {fileUpload.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(fileUpload.id)}
                      className="shrink-0 p-1 h-auto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Actions */}
        {files.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-muted-200 dark:border-muted-700">
            <div className="text-sm text-muted-600">
              {pendingCount > 0 && `${pendingCount} file${pendingCount === 1 ? '' : 's'} ready to upload`}
              {uploadMutation.isPending && 'Uploading files...'}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Cancel'}
              </Button>
              
              <Button
                onClick={startUpload}
                disabled={!canUpload}
                className="min-w-[100px]"
              >
                {uploadMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Uploading
                  </div>
                ) : (
                  `Upload ${pendingCount} file${pendingCount === 1 ? '' : 's'}`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}