"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  AlertTriangle,
  ChevronRight,
  FileText,
  X,
  Shield,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/lib/auth-supabase';
import { cn } from '@/lib/utils';

// Mock prompts for quick access
const quickPrompts = [
  { id: '1', title: 'Pricing Objection', icon: FileText, category: 'Sales' },
  { id: '2', title: 'Security Incident', icon: AlertTriangle, category: 'Security' },
  { id: '3', title: 'Contract Review', icon: FileText, category: 'Legal' },
];

interface AIMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  threadId?: string;
  isAI?: boolean;
  confidence?: number;
  sources?: string[];
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [showPromptSidebar, setShowPromptSidebar] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<typeof quickPrompts[0] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { 
    messages, 
    sendMessage, 
    isSending,
    sendError,
    isLoading: isLoadingMessages
  } = useChat();

  // Mock AI response with confidence score
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, aiMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const message = input;
    setInput('');
    
    try {
      await sendMessage(message);
      
      // Simulate AI response with confidence score
      setTimeout(() => {
        const mockResponse: AIMessage = {
          id: Date.now().toString(),
          content: "Based on the financial reports in the Data Room, our Q4 revenue increased by 23% year-over-year, primarily driven by enterprise sales. The EBITDA margin improved to 18.5%, exceeding our target by 2.5 percentage points.",
          userId: 'ai',
          userName: 'Ausk AI',
          createdAt: new Date().toISOString(),
          isAI: true,
          confidence: 92,
          sources: ['Q4 Financial Report.pdf', 'Enterprise Sales Dashboard.xlsx']
        };
        setAiMessages(prev => [...prev, mockResponse]);
      }, 1500);
    } catch (error) {
      console.error('Failed to send message:', error);
      setInput(message);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return CheckCircle;
    if (confidence >= 70) return AlertTriangle;
    return AlertTriangle;
  };

  const allMessages: AIMessage[] = [
    ...messages.map(msg => ({ ...msg, isAI: false } as AIMessage)),
    ...aiMessages
  ].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="mb-6 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Assistant</h1>
              <p className="text-muted-foreground mt-2">
                Ask questions about governance, compliance, and your documents
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowPromptSidebar(!showPromptSidebar)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Prompts
            </Button>
          </div>
        </div>

        <Card className="flex-1 flex flex-col p-0 overflow-hidden mx-6">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Start a Conversation</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ask questions about governance, compliance, or your documents
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickPrompts.map((prompt) => (
                      <Button
                        key={prompt.id}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPrompt(prompt)}
                      >
                        <prompt.icon className="w-4 h-4 mr-2" />
                        {prompt.title}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              allMessages.map((message) => {
                const isCurrentUser = !message.isAI && message.userId === user?.id;
                const isAI = message.isAI;
                
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      isCurrentUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`flex gap-3 max-w-[80%] ${
                        isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isAI
                              ? 'bg-primary text-primary-foreground'
                              : isCurrentUser
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {isAI ? (
                            <Bot className="w-4 h-4" />
                          ) : isCurrentUser ? (
                            <span className="text-xs font-medium">
                              {message.userName?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                      <div>
                        <div
                          className={`px-4 py-2 rounded-lg ${
                            isAI
                              ? 'bg-muted'
                              : isCurrentUser
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {/* AI Confidence Meter - Prompt Polygraph */}
                          {isAI && message.confidence !== undefined && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium">Confidence Level</span>
                                <div className={cn("flex items-center gap-1", getConfidenceColor(message.confidence))}>
                                  {React.createElement(getConfidenceIcon(message.confidence), { className: "w-3 h-3" })}
                                  <span className="text-xs font-medium">{message.confidence}%</span>
                                </div>
                              </div>
                              <div className="w-full bg-background rounded-full h-2">
                                <div 
                                  className={cn(
                                    "h-2 rounded-full transition-all duration-500",
                                    message.confidence >= 90 ? "bg-green-600" :
                                    message.confidence >= 70 ? "bg-yellow-600" :
                                    "bg-red-600"
                                  )}
                                  style={{ width: `${message.confidence}%` }}
                                />
                              </div>
                              {message.confidence < 70 && (
                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Low confidence - verify information independently
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* Sources */}
                          {isAI && message.sources && message.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <p className="text-xs font-medium mb-1">Sources:</p>
                              <div className="flex flex-wrap gap-1">
                                {message.sources.map((source, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    <FileText className="w-3 h-3 mr-1" />
                                    {source}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {isSending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-muted px-4 py-2 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t">
            {sendError && (
              <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                Failed to send message. Please try again.
              </div>
            )}
            {selectedPrompt && (
              <div className="mb-2 p-2 bg-primary/10 rounded-lg flex items-center justify-between">
                <span className="text-sm">
                  Using prompt: <strong>{selectedPrompt.title}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPrompt(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSending}
              />
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mic className="w-5 h-5" />
              </button>
              <Button type="submit" disabled={!input.trim() || isSending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Prompts Sidebar */}
      {showPromptSidebar && (
        <div className="w-80 border-l bg-card p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Quick Prompts</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPromptSidebar(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {quickPrompts.map((prompt) => (
              <Card
                key={prompt.id}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelectedPrompt(prompt);
                  setInput(`Use the ${prompt.title} prompt template`);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <prompt.icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{prompt.title}</p>
                      <p className="text-xs text-muted-foreground">{prompt.category}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-6 pt-6 border-t">
            <Button variant="outline" className="w-full" size="sm">
              <Sparkles className="w-4 h-4 mr-2" />
              View All Prompts
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}