import { LLMProvider } from './manager';
import { ProviderConfig, LLMRequest, LLMResponse } from '../types';

export class GoogleProvider implements LLMProvider {
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
    const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const model = request.model.replace('gemini-', '');
    
    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Ausk-AI-Gateway/1.0'
        },
        body: JSON.stringify({
          contents: this.convertMessages(request.messages),
          generationConfig: {
            temperature: request.temperature || 0.7,
            maxOutputTokens: request.max_tokens || 1000,
          }
        })
      }
    );

    this.updateRateLimitState(response.headers);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: { message: `HTTP ${response.status}` } 
      }));
      throw new Error(`Google API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    return {
      id: crypto.randomUUID(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        },
        finish_reason: this.mapFinishReason(data.candidates?.[0]?.finishReason)
      }],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  private convertMessages(messages: Array<{ role: string; content: string }>) {
    const contents = [];
    let systemInstruction = '';

    for (const message of messages) {
      if (message.role === 'system') {
        systemInstruction += message.content + '\n';
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        });
      }
    }

    // Add system instruction as first user message if present
    if (systemInstruction) {
      contents.unshift({
        role: 'user',
        parts: [{ text: `System: ${systemInstruction.trim()}` }]
      });
    }

    return contents;
  }

  private mapFinishReason(reason?: string): string {
    switch (reason) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      case 'SAFETY': return 'content_filter';
      case 'RECITATION': return 'content_filter';
      default: return 'stop';
    }
  }

  private updateRateLimitState(headers: Headers) {
    // Google uses different rate limit headers - update as needed
    this.rateLimitState.resetAt = new Date(Date.now() + 60000);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const response = await fetch(
        `${baseUrl}/models?key=${this.config.apiKey}`,
        {
          headers: {
            'User-Agent': 'Ausk-AI-Gateway/1.0'
          }
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Google health check failed:', error);
      return false;
    }
  }

  async rateLimitStatus() {
    return { ...this.rateLimitState };
  }
}