"use client";

import React, { useState } from 'react';
import { 
  Brain, 
  Search, 
  MessageSquare, 
  TrendingUp, 
  Users,
  Award,
  HelpCircle,
  Lightbulb,
  Clock,
  ChevronRight,
  BarChart3,
  Sparkles,
  Target,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface Expert {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  topicsAsked: string[];
  topicsAnswered: string[];
  helpScore: number;
  lastActive: string;
  currentDeals: string[];
}

interface Topic {
  name: string;
  experts: string[];
  questionCount: number;
  answerCount: number;
  trending: boolean;
}

// Mock data
const mockExperts: Expert[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Senior M&A Analyst',
    topicsAsked: ['Due diligence', 'Valuation models'],
    topicsAnswered: ['Financial modeling', 'Deal structuring', 'Risk assessment'],
    helpScore: 92,
    lastActive: '2 hours ago',
    currentDeals: ['Project Phoenix', 'Blue Ocean Acquisition']
  },
  {
    id: '2',
    name: 'Michael Torres',
    role: 'Legal Counsel',
    topicsAsked: ['Tax implications', 'Cross-border regulations'],
    topicsAnswered: ['Contract law', 'Regulatory compliance', 'IP rights'],
    helpScore: 87,
    lastActive: '30 minutes ago',
    currentDeals: ['Project Phoenix']
  },
  {
    id: '3',
    name: 'Emily Johnson',
    role: 'Data Room Manager',
    topicsAsked: ['API integrations', 'Security protocols'],
    topicsAnswered: ['Data organization', 'Access controls', 'Audit trails'],
    helpScore: 95,
    lastActive: '1 hour ago',
    currentDeals: ['Green Energy Deal', 'Tech Merger 2024']
  }
];

const trendingTopics: Topic[] = [
  {
    name: 'ESG Compliance',
    experts: ['Sarah Chen', 'Michael Torres'],
    questionCount: 47,
    answerCount: 38,
    trending: true
  },
  {
    name: 'AI Integration Strategy',
    experts: ['Emily Johnson'],
    questionCount: 32,
    answerCount: 28,
    trending: true
  },
  {
    name: 'Cross-border Tax Structure',
    experts: ['Michael Torres'],
    questionCount: 25,
    answerCount: 22,
    trending: false
  }
];

export default function ExpertisePage() {
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'experts' | 'topics'>('experts');

  const filteredExperts = mockExperts.filter(expert =>
    expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expert.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    [...expert.topicsAsked, ...expert.topicsAnswered].some(topic =>
      topic.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Expertise Mapping</h1>
          <p className="text-muted-foreground mt-2">
            Discover who knows what across your organization
          </p>
        </div>
        <Button>
          <Sparkles className="w-4 h-4 mr-2" />
          Ask AI for Expert
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Experts</p>
              <p className="text-2xl font-bold">{mockExperts.length}</p>
            </div>
            <Users className="w-8 h-8 text-primary opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Topics Tracked</p>
              <p className="text-2xl font-bold">156</p>
            </div>
            <Brain className="w-8 h-8 text-purple-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Questions Answered</p>
              <p className="text-2xl font-bold">1,247</p>
            </div>
            <MessageSquare className="w-8 h-8 text-green-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
              <p className="text-2xl font-bold">2.4h</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Search and Tabs */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search experts or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveTab('experts')}
              className={cn(
                "px-4 py-1.5 rounded text-sm font-medium transition-colors",
                activeTab === 'experts' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Experts
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={cn(
                "px-4 py-1.5 rounded text-sm font-medium transition-colors",
                activeTab === 'topics' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Topics
            </button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {activeTab === 'experts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredExperts.map((expert) => (
            <Card 
              key={expert.id}
              className={cn(
                "p-6 cursor-pointer transition-all hover:shadow-lg",
                selectedExpert?.id === expert.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedExpert(expert)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    {expert.avatar ? (
                      <img src={expert.avatar} alt={expert.name} className="w-full h-full rounded-full" />
                    ) : (
                      <User className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{expert.name}</h3>
                    <p className="text-sm text-muted-foreground">{expert.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium">{expert.helpScore}%</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {expert.lastActive}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Answers questions about:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {expert.topicsAnswered.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Asks about:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {expert.topicsAsked.map((topic) => (
                      <Badge key={topic} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>

                {expert.currentDeals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium">Working on:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {expert.currentDeals.map((deal) => (
                        <Badge key={deal} variant="default" className="text-xs">
                          {deal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedExpert?.id === expert.id && (
                <div className="mt-4 pt-4 border-t flex gap-2">
                  <Button size="sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Ask Question
                  </Button>
                  <Button size="sm" variant="outline">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Activity
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Trending Topics
            </h3>
            <div className="space-y-3">
              {trendingTopics.filter(t => t.trending).map((topic) => (
                <div key={topic.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{topic.name}</h4>
                      <Badge variant="warning" className="text-xs">Trending</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {topic.experts.length} expert{topic.experts.length !== 1 ? 's' : ''} • 
                      {topic.questionCount} questions • 
                      {topic.answerCount} answers
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">All Topics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trendingTopics.map((topic) => (
                <div key={topic.name} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <h4 className="font-medium mb-1">{topic.name}</h4>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{topic.experts.length} experts</span>
                    <span>•</span>
                    <span>{Math.round((topic.answerCount / topic.questionCount) * 100)}% answered</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}