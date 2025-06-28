'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, FileText, Image, Loader } from 'lucide-react';
import { ProcessedDocument } from '@/lib/document-processor';

interface DocumentUploadProps {
  onDocumentProcessed?: (document: ProcessedDocument) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface UploadedFile {
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  result?: ProcessedDocument;
  error?: string;
  id: string;
}

export function DocumentUpload({ onDocumentProcessed, onError, className }: DocumentUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [supportedTypes, setSupportedTypes] = useState<string[]>([]);

  // Fetch supported file types on component mount
  React.useEffect(() => {
    fetch('/api/documents/process')
      .then(res => res.json())
      .then(data => setSupportedTypes(data.supportedMimeTypes))
      .catch(console.error);
  }, []);

  const processFile = useCallback(async (file: File) => {
    const fileId = crypto.randomUUID();
    
    // Add file to list
    setUploadedFiles(prev => [...prev, {
      file,
      status: 'uploading',
      progress: 0,
      id: fileId
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Update status to processing
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'processing' as const } : f
      ));

      const response = await fetch('/api/documents/process', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Processing failed');
      }

      // Update with success
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'completed' as const, 
          result: result.document 
        } : f
      ));

      // Notify parent component
      if (onDocumentProcessed) {
        onDocumentProcessed(result.document);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update with error
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'error' as const, 
          error: errorMessage 
        } : f
      ));

      if (onError) {
        onError(errorMessage);
      }
    }
  }, [onDocumentProcessed, onError]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(processFile);
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'text/markdown': ['.md'],
      'application/rtf': ['.rtf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.tiff', '.bmp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (mimeType.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-4 h-4 text-blue-500" />;
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className="w-4 h-4 text-green-500" />;
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return <FileText className="w-4 h-4 text-orange-500" />;
    return <File className="w-4 h-4" />;
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={className}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-600">Drop the files here...</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-2">
              Drag & drop documents here, or click to select files
            </p>
            <p className="text-sm text-gray-500">
              Supports PDF, Word, Excel, PowerPoint, images and text files (max 10MB)
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-medium text-gray-900">Uploaded Files</h3>
          {uploadedFiles.map((uploadedFile) => (
            <div
              key={uploadedFile.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getFileIcon(uploadedFile.file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadedFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(uploadedFile.file.size)}
                    {uploadedFile.result && (
                      <span className="ml-2">
                        • {uploadedFile.result.chunks.length} chunks
                        • {uploadedFile.result.content.length} characters
                      </span>
                    )}
                  </p>
                  {uploadedFile.error && (
                    <p className="text-xs text-red-600 mt-1">{uploadedFile.error}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(uploadedFile.status)}
                <button
                  onClick={() => removeFile(uploadedFile.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Processing Summary */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          {uploadedFiles.filter(f => f.status === 'completed').length} of {uploadedFiles.length} files processed successfully
        </div>
      )}
    </div>
  );
}

export default DocumentUpload;