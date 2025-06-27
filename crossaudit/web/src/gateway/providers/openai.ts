import { LLMProvider } from './manager';
import { ProviderConfig, LLMRequest, LLMResponse } from '../types';

export class OpenAIProvider implements LLMProvider {
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
      this.config.baseUrl || 'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'CrossAudit-AI-Gateway/1.0'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000,
          stream: false, // Handle streaming separately if needed
          user: request.user
        })
      }
    );

    // Update rate limit state from headers
    this.updateRateLimitState(response.headers);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: { message: `HTTP ${response.status}` } 
      }));
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // Normalize response format
    return {
      id: data.id,
      object: data.object,
      created: data.created,
      model: data.model,
      choices: data.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content
        },
        finish_reason: choice.finish_reason
      })),
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0
      }
    };
  }

  private updateRateLimitState(headers: Headers) {
    const requestsRemaining = headers.get('x-ratelimit-remaining-requests');
    const tokensRemaining = headers.get('x-ratelimit-remaining-tokens');
    const resetRequests = headers.get('x-ratelimit-reset-requests');
    const resetTokens = headers.get('x-ratelimit-reset-tokens');

    if (requestsRemaining) {
      this.rateLimitState.requestsRemaining = parseInt(requestsRemaining);
    }
    if (tokensRemaining) {
      this.rateLimitState.tokensRemaining = parseInt(tokensRemaining);
    }
    
    // Parse reset time (format: "2m3s" or timestamp)
    if (resetRequests) {
      this.rateLimitState.resetAt = this.parseResetTime(resetRequests);
    }
  }

  private parseResetTime(resetString: string): Date {
    try {
      // Try parsing as timestamp first
      const timestamp = parseInt(resetString);
      if (!isNaN(timestamp)) {
        return new Date(timestamp * 1000);
      }
      
      // Parse duration format like "2m3s"
      const match = resetString.match(/(?:(\d+)m)?(?:(\d+)s)?/);
      if (match) {
        const minutes = parseInt(match[1] || '0');
        const seconds = parseInt(match[2] || '0');
        return new Date(Date.now() + (minutes * 60 + seconds) * 1000);
      }
    } catch (error) {
      console.warn('Failed to parse reset time:', resetString);
    }
    
    // Default to 1 minute from now
    return new Date(Date.now() + 60000);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'CrossAudit-AI-Gateway/1.0'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
      return false;
    }
  }

  async rateLimitStatus() {
    return { ...this.rateLimitState };
  }
}