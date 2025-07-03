"use client";
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import { Button } from '@/components/ui/Button';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { 
    messages, 
    sendMessage, 
    isSending, 
    sendError,
    handleTyping 
  } = useChat();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    
    try {
      await sendMessage(message);
      setMessage('');
      handleTyping(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Handle typing indicator
    const nowTyping = value.length > 0;
    if (nowTyping !== isTyping) {
      setIsTyping(nowTyping);
      handleTyping(nowTyping);
    }
  };

  return (
    <div className="flex h-full max-h-[calc(100vh-200px)]">
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-6">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-500">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                <p className="text-sm">Send a message to begin chatting with the AI assistant.</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className="animate-fade-in">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {msg.userName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-muted-900 dark:text-white">
                          {msg.userName}
                        </span>
                        <span className="text-xs text-muted-500">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-muted-800 rounded-lg p-3 shadow-sm border border-muted-200 dark:border-muted-700">
                        <p className="text-sm text-muted-900 dark:text-white whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-muted-200 dark:border-muted-700 p-4">
          {sendError && (
            <div className="mb-3 p-3 bg-error-50 border border-error-200 rounded-lg">
              <p className="text-sm text-error-600">
                Failed to send message. Please try again.
              </p>
            </div>
          )}
          
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={message}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                className="w-full min-h-[44px] max-h-32 p-3 border border-muted-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-muted-800 dark:border-muted-600 dark:text-white"
                disabled={isSending}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || isSending}
              size="md"
              className="h-11"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}