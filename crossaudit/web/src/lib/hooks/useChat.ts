import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { endpoints, ChatMessage, ChatThread } from '../api';
import { useSocketEvent, useChatStream } from './useSocket';

export function useChat(threadId?: string) {
  const queryClient = useQueryClient();
  const [isTyping, setIsTyping] = useState(false);
  const { sendTyping } = useChatStream(threadId);

  // Get messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', 'messages', threadId],
    queryFn: () => endpoints.getMessages(threadId),
    staleTime: 0, // Always refetch to ensure we have latest messages
  });

  // Get threads
  const { data: threads = [] } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: endpoints.getThreads,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: endpoints.sendMessage,
    onMutate: async (newMessage) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages', threadId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<ChatMessage[]>(['chat', 'messages', threadId]);

      // Optimistically update
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content: newMessage.content,
        userId: 'current-user', // This should come from auth context
        userName: 'You',
        createdAt: new Date().toISOString(),
        threadId,
      };

      queryClient.setQueryData<ChatMessage[]>(
        ['chat', 'messages', threadId],
        (old = []) => [...old, optimisticMessage]
      );

      return { previousMessages };
    },
    onError: (err, newMessage, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['chat', 'messages', threadId], context.previousMessages);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', threadId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });

  // Listen for real-time messages
  useSocketEvent('chat:message', useCallback((message: ChatMessage) => {
    if (!threadId || message.threadId === threadId) {
      queryClient.setQueryData<ChatMessage[]>(
        ['chat', 'messages', threadId],
        (old = []) => {
          // Avoid duplicates
          if (old.some(m => m.id === message.id)) return old;
          return [...old, message];
        }
      );
    }
    // Update threads list
    queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
  }, [queryClient, threadId]));

  // Listen for typing indicators
  useSocketEvent('chat:typing', useCallback((data) => {
    // Handle typing indicators here if needed
    console.log('Typing:', data);
  }, []));

  const sendMessage = (content: string) => {
    return sendMessageMutation.mutateAsync({ content, threadId });
  };

  const handleTyping = useCallback((typing: boolean) => {
    if (typing !== isTyping) {
      setIsTyping(typing);
      sendTyping(typing);
    }
  }, [isTyping, sendTyping]);

  return {
    messages,
    threads,
    isLoading,
    sendMessage,
    isSending: sendMessageMutation.isPending,
    sendError: sendMessageMutation.error,
    handleTyping,
    isTyping,
  };
}