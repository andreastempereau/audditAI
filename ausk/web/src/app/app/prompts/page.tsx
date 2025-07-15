"use client";

import React, { useState } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Pin,
  PinOff,
  Copy,
  Edit,
  Trash2,
  Tag,
  FileText,
  DollarSign,
  Users as UsersIcon,
  AlertTriangle,
  CheckCircle,
  Globe,
  Briefcase,
  Heart,
  Shield,
  Clock,
  TrendingUp,
  Download,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
  variables: string[];
  isPinned: boolean;
  usageCount: number;
  lastUsed?: string;
  createdBy: string;
  tags: string[];
  icon: React.ComponentType<any>;
}

const categoryIcons = {
  'Pricing': DollarSign,
  'HR Policy': UsersIcon,
  'Incident Response': AlertTriangle,
  'Deal Analysis': Briefcase,
  'Compliance': Shield,
  'Customer Success': Heart,
  'Market Research': Globe,
  'Risk Assessment': TrendingUp
};

const mockPrompts: PromptTemplate[] = [
  {
    id: '1',
    title: 'Pricing Objection Handler',
    description: 'Respond to common pricing objections with data-backed arguments',
    category: 'Pricing',
    content: 'A customer is concerned that our ${product} at ${price} is too expensive compared to ${competitor}. Using our pricing strategy documentation and win-loss analysis, craft a response that addresses their concern while highlighting our unique value propositions, ROI metrics, and flexible payment options.',
    variables: ['product', 'price', 'competitor'],
    isPinned: true,
    usageCount: 234,
    lastUsed: '2024-01-20T10:00:00Z',
    createdBy: 'Admin',
    tags: ['sales', 'objections', 'pricing'],
    icon: DollarSign
  },
  {
    id: '2',
    title: 'Employee Onboarding Checklist',
    description: 'Generate comprehensive onboarding plan for new hires',
    category: 'HR Policy',
    content: 'Create a detailed onboarding checklist for a new ${role} joining the ${department} team on ${startDate}. Include all necessary paperwork, system access requirements, training modules, and first-week meeting schedule based on our HR policies.',
    variables: ['role', 'department', 'startDate'],
    isPinned: true,
    usageCount: 156,
    lastUsed: '2024-01-19T14:30:00Z',
    createdBy: 'HR Team',
    tags: ['hr', 'onboarding', 'checklist'],
    icon: UsersIcon
  },
  {
    id: '3',
    title: 'Security Incident Response',
    description: 'Step-by-step guide for handling security incidents',
    category: 'Incident Response',
    content: 'We have detected a ${incidentType} affecting ${systemName} with severity level ${severity}. Generate an incident response plan following our security protocols, including immediate containment steps, stakeholder notifications, and remediation timeline.',
    variables: ['incidentType', 'systemName', 'severity'],
    isPinned: false,
    usageCount: 45,
    lastUsed: '2024-01-18T09:15:00Z',
    createdBy: 'Security Team',
    tags: ['security', 'incident', 'emergency'],
    icon: AlertTriangle
  },
  {
    id: '4',
    title: 'M&A Due Diligence Questions',
    description: 'Comprehensive due diligence questionnaire for acquisitions',
    category: 'Deal Analysis',
    content: 'Generate a due diligence questionnaire for acquiring ${targetCompany} in the ${industry} sector with estimated value of ${dealSize}. Focus on ${focusAreas} and include red flag indicators based on similar deals in our database.',
    variables: ['targetCompany', 'industry', 'dealSize', 'focusAreas'],
    isPinned: false,
    usageCount: 89,
    lastUsed: '2024-01-17T16:45:00Z',
    createdBy: 'M&A Team',
    tags: ['m&a', 'due-diligence', 'acquisition'],
    icon: Briefcase
  }
];

export default function PromptsPage() {
  const [prompts] = useState<PromptTemplate[]>(mockPrompts);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [promptVariables, setPromptVariables] = useState<Record<string, string>>({});

  const categories = Array.from(new Set(prompts.map(p => p.category)));
  
  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || prompt.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const pinnedPrompts = filteredPrompts.filter(p => p.isPinned);
  const unpinnedPrompts = filteredPrompts.filter(p => !p.isPinned);

  const handleUsePrompt = (prompt: PromptTemplate) => {
    setSelectedPrompt(prompt);
    // Initialize variables
    const vars: Record<string, string> = {};
    prompt.variables.forEach(v => {
      vars[v] = '';
    });
    setPromptVariables(vars);
  };

  const renderPromptWithVariables = (content: string, variables: Record<string, string>) => {
    let rendered = content;
    Object.entries(variables).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value || `[${key}]`);
    });
    return rendered;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Prompt Vault</h1>
          <p className="text-muted-foreground mt-2">
            Pre-loaded prompts for common business scenarios
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Prompt
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
            >
              All Categories
            </Button>
            {categories.map((category) => {
              const Icon = categoryIcons[category as keyof typeof categoryIcons] || FileText;
              return (
                <Button
                  key={category}
                  size="sm"
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {category}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prompts List */}
        <div className="lg:col-span-2 space-y-4">
          {pinnedPrompts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Pin className="w-4 h-4" />
                Pinned Prompts
              </h3>
              <div className="space-y-3">
                {pinnedPrompts.map((prompt) => {
                  const Icon = categoryIcons[prompt.category as keyof typeof categoryIcons] || FileText;
                  return (
                    <Card
                      key={prompt.id}
                      className={cn(
                        "p-4 cursor-pointer transition-all hover:shadow-lg",
                        selectedPrompt?.id === prompt.id && "ring-2 ring-primary"
                      )}
                      onClick={() => handleUsePrompt(prompt)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{prompt.title}</h3>
                              <p className="text-sm text-muted-foreground">{prompt.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-3">
                            <Badge variant="outline">{prompt.category}</Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <TrendingUp className="w-3 h-3" />
                              <span>{prompt.usageCount} uses</span>
                            </div>
                            {prompt.lastUsed && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{formatDistanceToNow(new Date(prompt.lastUsed), { addSuffix: true })}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-1 mt-2">
                            {prompt.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-4">
                          <button className="p-1 hover:bg-muted rounded">
                            <PinOff className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button className="p-1 hover:bg-muted rounded">
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button className="p-1 hover:bg-muted rounded">
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {unpinnedPrompts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                All Prompts
              </h3>
              <div className="space-y-3">
                {unpinnedPrompts.map((prompt) => {
                  const Icon = categoryIcons[prompt.category as keyof typeof categoryIcons] || FileText;
                  return (
                    <Card
                      key={prompt.id}
                      className={cn(
                        "p-4 cursor-pointer transition-all hover:shadow-lg",
                        selectedPrompt?.id === prompt.id && "ring-2 ring-primary"
                      )}
                      onClick={() => handleUsePrompt(prompt)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-muted rounded-lg">
                              <Icon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{prompt.title}</h3>
                              <p className="text-sm text-muted-foreground">{prompt.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-3">
                            <Badge variant="outline">{prompt.category}</Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <TrendingUp className="w-3 h-3" />
                              <span>{prompt.usageCount} uses</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-4">
                          <button className="p-1 hover:bg-muted rounded">
                            <Pin className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button className="p-1 hover:bg-muted rounded">
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Prompt Editor */}
        <div className="lg:col-span-1">
          {selectedPrompt ? (
            <Card className="p-6 sticky top-6">
              <h3 className="text-lg font-semibold mb-4">Customize Prompt</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Variables</h4>
                  {selectedPrompt.variables.map((variable) => (
                    <div key={variable} className="mb-3">
                      <label className="text-sm text-muted-foreground capitalize">
                        {variable.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="text"
                        value={promptVariables[variable] || ''}
                        onChange={(e) => setPromptVariables({
                          ...promptVariables,
                          [variable]: e.target.value
                        })}
                        placeholder={`Enter ${variable}...`}
                        className="w-full mt-1 px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Preview</h4>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {renderPromptWithVariables(selectedPrompt.content, promptVariables)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Use Prompt
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center sticky top-6">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Select a Prompt</h3>
              <p className="text-sm text-muted-foreground">
                Choose a prompt from the list to customize and use
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredPrompts.length === 0 && (
        <Card className="p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No prompts found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try adjusting your search or filters
          </p>
        </Card>
      )}

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl p-6">
            <h2 className="text-xl font-semibold mb-4">Create New Prompt</h2>
            <p className="text-muted-foreground mb-6">
              Create a reusable prompt template for your team
            </p>
            {/* Form would go here */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowCreateModal(false)}>
                Create Prompt
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}