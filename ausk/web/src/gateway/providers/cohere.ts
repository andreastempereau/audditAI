import { LLMProvider } from './manager';
import { ProviderConfig, LLMRequest, LLMResponse } from '../types';

export class CohereProvider implements LLMProvider {
  private config: ProviderConfig;
  private rateLimitState = {
    requestsRemaining: 1000,
    tokensRemaining: 100000,
    resetAt: new Date(Date.now() + 60000)
  };

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch(
      this.config.baseUrl || 'https://api.cohere.ai/v1/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'Ausk-AI-Gateway/1.0'
        },
        body: JSON.stringify({
          model: request.model,
          message: this.getLastUserMessage(request.messages),
          chat_history: this.buildChatHistory(request.messages),
          preamble: this.getSystemMessage(request.messages),
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000,
          stream: false
        })
      }
    );

    this.updateRateLimitState(response.headers);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: { message: `HTTP ${response.status}` } 
      }));
      throw new Error(`Cohere API error: ${error.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    return {
      id: data.generation_id || crypto.randomUUID(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.text || ''
        },
        finish_reason: this.mapFinishReason(data.finish_reason)
      }],
      usage: {
        prompt_tokens: data.meta?.tokens?.input_tokens || 0,
        completion_tokens: data.meta?.tokens?.output_tokens || 0,
        total_tokens: (data.meta?.tokens?.input_tokens || 0) + (data.meta?.tokens?.output_tokens || 0)
      }
    };
  }

  private getLastUserMessage(messages: Array<{ role: string; content: string }>): string {
    const userMessages = messages.filter(msg => msg.role === 'user');
    return userMessages[userMessages.length - 1]?.content || '';
  }

  private getSystemMessage(messages: Array<{ role: string; content: string }>): string | undefined {
    const systemMessage = messages.find(msg => msg.role === 'system');
    return systemMessage?.content;
  }

  private buildChatHistory(messages: Array<{ role: string; content: string }>) {
    const history = [];
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
    
    // Remove the last user message as it's sent separately
    const chatMessages = nonSystemMessages.slice(0, -1);
    
    for (const message of chatMessages) {
      if (message.role === 'user') {
        history.push({ role: 'USER', message: message.content });
      } else if (message.role === 'assistant') {
        history.push({ role: 'CHATBOT', message: message.content });
      }
    }
    
    return history;
  }

  private mapFinishReason(reason?: string): string {
    switch (reason) {
      case 'COMPLETE': return 'stop';
      case 'MAX_TOKENS': return 'length';
      case 'ERROR': return 'error';
      default: return 'stop';
    }
  }

  private updateRateLimitState(headers: Headers) {
    // Cohere uses different rate limit headers - update as needed
    this.rateLimitState.resetAt = new Date(Date.now() + 60000);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://api.cohere.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'Ausk-AI-Gateway/1.0'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Cohere health check failed:', error);
      return false;
    }
  }

  async rateLimitStatus() {
    return { ...this.rateLimitState };
  }
}