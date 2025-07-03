import { LLMProvider } from './manager';
import { ProviderConfig, LLMRequest, LLMResponse } from '../types';

export class AnthropicProvider implements LLMProvider {
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
      this.config.baseUrl || 'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'User-Agent': 'Ausk-AI-Gateway/1.0'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages.filter(msg => msg.role !== 'system'),
          system: request.messages.find(msg => msg.role === 'system')?.content || undefined,
          max_tokens: request.max_tokens || 1000,
          temperature: request.temperature || 0.7,
          stream: false
        })
      }
    );

    this.updateRateLimitState(response.headers);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: { message: `HTTP ${response.status}` } 
      }));
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      object: 'chat.completion',
      created: Date.now(),
      model: data.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.content[0].text
        },
        finish_reason: data.stop_reason
      }],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  private updateRateLimitState(headers: Headers) {
    const requestsRemaining = headers.get('anthropic-ratelimit-requests-remaining');
    const tokensRemaining = headers.get('anthropic-ratelimit-tokens-remaining');
    const resetRequests = headers.get('anthropic-ratelimit-requests-reset');

    if (requestsRemaining) {
      this.rateLimitState.requestsRemaining = parseInt(requestsRemaining);
    }
    if (tokensRemaining) {
      this.rateLimitState.tokensRemaining = parseInt(tokensRemaining);
    }
    if (resetRequests) {
      this.rateLimitState.resetAt = new Date(resetRequests);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'User-Agent': 'Ausk-AI-Gateway/1.0'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        })
      });
      return response.ok || response.status === 400; // 400 is expected for minimal request
    } catch (error) {
      console.error('Anthropic health check failed:', error);
      return false;
    }
  }

  async rateLimitStatus() {
    return { ...this.rateLimitState };
  }
}