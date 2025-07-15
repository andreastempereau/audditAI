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
  Loader2,
  Building2,
  User,
  Plus,
  Edit2,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Globe,
  Briefcase,
  Hash,
  DollarSign,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useDataRoom } from '@/lib/hooks/useDataRoom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CompanyObject {
  id: string;
  type: 'company';
  name: string;
  industry: string;
  website?: string;
  headquarters?: string;
  founded?: string;
  revenue?: string;
  employees?: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface PersonObject {
  id: string;
  type: 'person';
  name: string;
  role: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

type DataObject = CompanyObject | PersonObject;

// Mock data for objects
const mockObjects: DataObject[] = [
  {
    id: '1',
    type: 'company',
    name: 'Acme Corporation',
    industry: 'Technology',
    website: 'https://acme.com',
    headquarters: 'San Francisco, CA',
    founded: '2010',
    revenue: '$500M',
    employees: '2,500',
    notes: 'Key competitor in the enterprise software space. Strong presence in financial services sector. Recently acquired CloudSync for $120M.',
    tags: ['competitor', 'enterprise', 'saas'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    id: '2',
    type: 'person',
    name: 'Sarah Johnson',
    role: 'CEO',
    company: 'Acme Corporation',
    email: 'sarah.johnson@acme.com',
    linkedin: 'linkedin.com/in/sarahjohnson',
    notes: 'Former CTO at TechGiant. MIT graduate. Expert in AI/ML. Key decision maker for enterprise deals.',
    tags: ['executive', 'decision-maker', 'technical'],
    createdAt: '2024-01-16T11:00:00Z',
    updatedAt: '2024-01-18T09:15:00Z'
  },
  {
    id: '3',
    type: 'company',
    name: 'Global Logistics Co',
    industry: 'Logistics',
    headquarters: 'Chicago, IL',
    employees: '10,000+',
    notes: 'Potential partner for supply chain integration. Looking to modernize their tech stack.',
    tags: ['partner', 'opportunity'],
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-10T08:00:00Z'
  }
];

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
  const [activeTab, setActiveTab] = useState<'documents' | 'objects'>('documents');
  const [objects, setObjects] = useState<DataObject[]>(mockObjects);
  const [selectedObject, setSelectedObject] = useState<DataObject | null>(null);
  const [showCreateObjectModal, setShowCreateObjectModal] = useState(false);
  const [objectType, setObjectType] = useState<'company' | 'person'>('company');
  
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

  const filteredObjects = objects.filter(obj =>
    obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
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
            Securely manage documents and track companies & people
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'documents' ? (
            <>
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label htmlFor="file-upload">
                <Button 
                  asChild
                  className="cursor-pointer"
                  disabled={isUploading}
                >
                  <span>
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
                  </span>
                </Button>
              </label>
            </>
          ) : (
            <Button onClick={() => setShowCreateObjectModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add {objectType === 'company' ? 'Company' : 'Person'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('documents')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'documents' 
              ? 'bg-background text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="w-4 h-4 inline-block mr-2" />
          Documents
        </button>
        <button
          onClick={() => setActiveTab('objects')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'objects' 
              ? 'bg-background text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Building2 className="w-4 h-4 inline-block mr-2" />
          Companies & People
        </button>
      </div>

      {/* Filters and View Toggle */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder={activeTab === 'documents' ? "Search documents..." : "Search companies or people..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            {activeTab === 'objects' && (
              <div className="flex bg-muted rounded-lg p-1">
                <button
                  onClick={() => setObjectType('company')}
                  className={cn(
                    "px-3 py-1 rounded text-sm font-medium transition-colors",
                    objectType === 'company' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Companies
                </button>
                <button
                  onClick={() => setObjectType('person')}
                  className={cn(
                    "px-3 py-1 rounded text-sm font-medium transition-colors",
                    objectType === 'person' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  People
                </button>
              </div>
            )}
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
      </Card>

      {/* Documents Tab Content */}
      {activeTab === 'documents' && (
        <>
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

          {/* Documents Grid/List */}
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
                        <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                          <Eye className="w-3 h-3" />
                        </button>
                        <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
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
            // List view for documents
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm">Name</th>
                    <th className="text-left p-4 font-medium text-sm">Size</th>
                    <th className="text-left p-4 font-medium text-sm">Uploaded</th>
                    <th className="text-left p-4 font-medium text-sm">Security</th>
                    <th className="text-right p-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredFiles.map((file) => {
                    const Icon = getFileIcon(file.type);
                    
                    return (
                      <tr key={file.id} className="hover:bg-muted/50 transition-colors">
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
        </>
      )}

      {/* Objects Tab Content */}
      {activeTab === 'objects' && (
        <>
          {filteredObjects.filter(obj => obj.type === objectType).length === 0 ? (
            <Card className="p-12 text-center">
              {objectType === 'company' ? (
                <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              ) : (
                <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              )}
              <h3 className="text-lg font-medium mb-2">
                No {objectType === 'company' ? 'companies' : 'people'} tracked yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start tracking {objectType === 'company' ? 'companies' : 'people'} to help the AI understand your references
              </p>
              <Button onClick={() => setShowCreateObjectModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add {objectType === 'company' ? 'Company' : 'Person'}
              </Button>
            </Card>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredObjects
                .filter(obj => obj.type === objectType)
                .map((obj) => (
                  <Card
                    key={obj.id}
                    className={cn(
                      "p-4 hover:shadow-lg transition-all cursor-pointer",
                      selectedObject?.id === obj.id && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedObject(obj)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {obj.type === 'company' ? (
                            <Building2 className="w-5 h-5 text-primary" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{obj.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {obj.type === 'company' ? obj.industry : obj.role}
                            {obj.type === 'person' && obj.company && ` at ${obj.company}`}
                          </p>
                        </div>
                      </div>
                      <button className="p-1 hover:bg-muted rounded">
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {obj.notes}
                    </p>

                    <div className="space-y-2">
                      {obj.type === 'company' && (
                        <>
                          {obj.headquarters && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{obj.headquarters}</span>
                            </div>
                          )}
                          {obj.employees && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              <span>{obj.employees} employees</span>
                            </div>
                          )}
                        </>
                      )}
                      {obj.type === 'person' && (
                        <>
                          {obj.email && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{obj.email}</span>
                            </div>
                          )}
                          {obj.phone && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span>{obj.phone}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-3">
                      {obj.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {selectedObject?.id === obj.id && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        {obj.type === 'company' && obj.website && (
                          <a
                            href={obj.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Globe className="w-4 h-4" />
                            Visit Website
                          </a>
                        )}
                        {obj.type === 'person' && obj.linkedin && (
                          <a
                            href={`https://${obj.linkedin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Briefcase className="w-4 h-4" />
                            LinkedIn Profile
                          </a>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(obj.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
            </div>
          ) : (
            // List view for objects
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm">Name</th>
                    <th className="text-left p-4 font-medium text-sm">
                      {objectType === 'company' ? 'Industry' : 'Role & Company'}
                    </th>
                    <th className="text-left p-4 font-medium text-sm">Contact</th>
                    <th className="text-left p-4 font-medium text-sm">Tags</th>
                    <th className="text-left p-4 font-medium text-sm">Updated</th>
                    <th className="text-right p-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredObjects
                    .filter(obj => obj.type === objectType)
                    .map((obj) => (
                      <tr key={obj.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {obj.type === 'company' ? (
                              <Building2 className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground" />
                            )}
                            <span className="font-medium">{obj.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {obj.type === 'company' ? obj.industry : `${obj.role}${obj.company ? ` at ${obj.company}` : ''}`}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {obj.type === 'company' ? obj.website : obj.email}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {obj.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {obj.tags.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{obj.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(obj.updatedAt), { addSuffix: true })}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1 justify-end">
                            <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {/* Create Object Modal */}
      {showCreateObjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl p-6">
            <h2 className="text-xl font-semibold mb-4">
              Add {objectType === 'company' ? 'Company' : 'Person'}
            </h2>
            <p className="text-muted-foreground mb-6">
              Track {objectType === 'company' ? 'a company' : 'a person'} to help the AI understand your references
            </p>
            {/* Form would go here */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateObjectModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowCreateObjectModal(false)}>
                Create {objectType === 'company' ? 'Company' : 'Person'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}