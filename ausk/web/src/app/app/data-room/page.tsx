"use client";

import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  Image, 
  File, 
  MoreVertical,
  Search,
  Filter,
  Grid,
  List,
  Download,
  Share2,
  Trash2,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/DropdownMenu';

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'document' | 'other';
  size: string;
  uploadedAt: Date;
  uploadedBy: string;
  lastModified: Date;
  tags: string[];
}

export default function DataRoomPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // Mock data
  const documents: Document[] = [
    {
      id: '1',
      name: 'Q4 2023 Financial Report.pdf',
      type: 'pdf',
      size: '2.4 MB',
      uploadedAt: new Date('2024-01-15'),
      uploadedBy: 'John Doe',
      lastModified: new Date('2024-01-15'),
      tags: ['financial', 'quarterly', '2023'],
    },
    {
      id: '2',
      name: 'Compliance Certificate 2024.pdf',
      type: 'pdf',
      size: '1.1 MB',
      uploadedAt: new Date('2024-01-10'),
      uploadedBy: 'Jane Smith',
      lastModified: new Date('2024-01-10'),
      tags: ['compliance', 'certificate', '2024'],
    },
    {
      id: '3',
      name: 'Board Meeting Minutes.docx',
      type: 'document',
      size: '456 KB',
      uploadedAt: new Date('2024-01-05'),
      uploadedBy: 'Mike Johnson',
      lastModified: new Date('2024-01-08'),
      tags: ['board', 'minutes', 'meeting'],
    },
  ];

  const getFileIcon = (type: Document['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-500" />;
      case 'image':
        return <Image className="w-8 h-8 text-blue-500" />;
      case 'document':
        return <FileText className="w-8 h-8 text-blue-600" />;
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Room</h1>
        <p className="text-muted-foreground mt-2">
          Securely store and manage your governance documents
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <Button className="gap-2">
            <Upload className="w-4 h-4" />
            Upload Files
          </Button>
          <Button variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <div className="flex border rounded-lg">
            <Button
              variant={view === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setView('grid')}
              className="rounded-r-none"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setView('list')}
              className="rounded-l-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Documents Grid/List */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocuments.map((doc) => (
            <Card
              key={doc.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                selectedFiles.includes(doc.id) ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                setSelectedFiles(prev =>
                  prev.includes(doc.id)
                    ? prev.filter(id => id !== doc.id)
                    : [...prev, doc.id]
                );
              }}
            >
              <div className="flex justify-between items-start mb-3">
                {getFileIcon(doc.type)}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <h3 className="font-medium text-sm mb-1 truncate">{doc.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{doc.size}</p>
              
              <div className="flex gap-1 flex-wrap mb-2">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-muted text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground">
                Uploaded {doc.uploadedAt.toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`p-4 flex items-center gap-4 hover:bg-muted/50 cursor-pointer ${
                  selectedFiles.includes(doc.id) ? 'bg-muted/50' : ''
                }`}
                onClick={() => {
                  setSelectedFiles(prev =>
                    prev.includes(doc.id)
                      ? prev.filter(id => id !== doc.id)
                      : [...prev, doc.id]
                  );
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(doc.id)}
                  onChange={() => {}}
                  className="rounded"
                  onClick={(e) => e.stopPropagation()}
                />
                
                {getFileIcon(doc.type)}
                
                <div className="flex-1">
                  <h3 className="font-medium">{doc.name}</h3>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>{doc.size}</span>
                    <span>•</span>
                    <span>Uploaded by {doc.uploadedBy}</span>
                    <span>•</span>
                    <span>{doc.uploadedAt.toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-muted text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Selected Files Actions */}
      {selectedFiles.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-background border rounded-lg shadow-lg p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
            </span>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFiles([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}