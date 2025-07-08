"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/lib/auth-supabase';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { 
    messages, 
    sendMessage, 
    isSending,
    sendError,
    isLoading: isLoadingMessages
  } = useChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const message = input;
    setInput('');
    
    try {
      await sendMessage(message);
      // Note: Real AI integration would go here
      // For now, the message is just stored in the database
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore input on error
      setInput(message);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted-foreground mt-2">
          Ask questions about governance, compliance, and your documents
        </p>
      </div>

      <Card className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Start a Conversation</h3>
                <p className="text-sm text-muted-foreground">
                  Ask questions about governance, compliance, or your documents
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isCurrentUser = message.userId === user?.id;
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
                          isCurrentUser
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {isCurrentUser ? (
                          <span className="text-xs font-medium">
                            {message.userName?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        isCurrentUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
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
  );
}