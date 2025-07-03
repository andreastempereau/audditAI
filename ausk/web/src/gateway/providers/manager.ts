import { ProviderType, ProviderConfig, LLMRequest, LLMResponse } from '../types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { CohereProvider } from './cohere';

export interface LLMProvider {
  call(request: LLMRequest): Promise<LLMResponse>;
  stream?(request: LLMRequest, callbacks: StreamCallbacks): Promise<void>;
  healthCheck(): Promise<boolean>;
  rateLimitStatus(): Promise<{
    requestsRemaining: number;
    tokensRemaining: number;
    resetAt: Date;
  }>;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (evaluation?: any) => void;
  onError: (error: Error) => void;
}

export class ProviderManager {
  private providers: Map<ProviderType, LLMProvider> = new Map();
  private configs: Map<ProviderType, ProviderConfig> = new Map();

  constructor(configs: ProviderConfig[]) {
    this.initializeProviders(configs);
  }

  private initializeProviders(configs: ProviderConfig[]) {
    for (const config of configs) {
      this.configs.set(config.type, config);
      
      switch (config.type) {
        case 'openai':
          this.providers.set('openai', new OpenAIProvider(config));
          break;
        case 'anthropic':
          this.providers.set('anthropic', new AnthropicProvider(config));
          break;
        case 'google':
          this.providers.set('google', new GoogleProvider(config));
          break;
        case 'cohere':
          this.providers.set('cohere', new CohereProvider(config));
          break;
        default:
          console.warn(`Unknown provider type: ${config.type}`);
      }
    }
  }

  async callProvider(
    providerType: ProviderType, 
    request: LLMRequest
  ): Promise<LLMResponse> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not configured`);
    }

    // Check rate limits before making request
    const rateLimitStatus = await provider.rateLimitStatus();
    if (rateLimitStatus.requestsRemaining <= 0) {
      throw new Error(`Rate limit exceeded for provider ${providerType}`);
    }

    try {
      return await provider.call(request);
    } catch (error) {
      console.error(`Error calling provider ${providerType}:`, error);
      
      // Try fallback provider if available
      const fallbackProvider = this.getFallbackProvider(providerType);
      if (fallbackProvider && fallbackProvider !== providerType) {
        console.log(`Falling back to ${fallbackProvider} for request`);
        return await this.callProvider(fallbackProvider, request);
      }
      
      throw error;
    }
  }

  private getFallbackProvider(primary: ProviderType): ProviderType | null {
    // Simple fallback logic - in production this would be more sophisticated
    const fallbacks: Record<ProviderType, ProviderType | null> = {
      'openai': 'anthropic',
      'anthropic': 'openai',
      'google': 'openai',
      'cohere': 'openai',
      'azure': 'openai'
    };
    
    const fallback = fallbacks[primary];
    return fallback && this.providers.has(fallback) ? fallback : null;
  }

  async healthCheck(): Promise<boolean> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.providers.values()).map(provider => provider.healthCheck())
    );
    
    // Return true if at least one provider is healthy
    return healthChecks.some(result => 
      result.status === 'fulfilled' && result.value === true
    );
  }

  getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  async getProviderStatus(): Promise<Record<ProviderType, {
    healthy: boolean;
    rateLimits: any;
  }>> {
    const status: Record<string, any> = {};
    
    for (const [type, provider] of Array.from(this.providers.entries())) {
      try {
        const [healthy, rateLimits] = await Promise.all([
          provider.healthCheck(),
          provider.rateLimitStatus()
        ]);
        
        status[type] = { healthy, rateLimits };
      } catch (error) {
        status[type] = { 
          healthy: false, 
          rateLimits: null, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }
    
    return status;
  }

  updateProviderConfig(type: ProviderType, config: ProviderConfig) {
    this.configs.set(type, config);
    
    // Reinitialize the specific provider
    switch (type) {
      case 'openai':
        this.providers.set('openai', new OpenAIProvider(config));
        break;
      case 'anthropic':
        this.providers.set('anthropic', new AnthropicProvider(config));
        break;
      case 'google':
        this.providers.set('google', new GoogleProvider(config));
        break;
      case 'cohere':
        this.providers.set('cohere', new CohereProvider(config));
        break;
    }
  }

  async streamProvider(
    providerType: ProviderType,
    request: LLMRequest,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not configured`);
    }

    // Check if provider supports streaming
    if (!provider.stream) {
      throw new Error(`Provider ${providerType} does not support streaming`);
    }

    // Check rate limits before streaming
    const rateLimitStatus = await provider.rateLimitStatus();
    if (rateLimitStatus.requestsRemaining <= 0) {
      throw new Error(`Rate limit exceeded for provider ${providerType}`);
    }

    try {
      return await provider.stream(request, callbacks);
    } catch (error) {
      console.error(`Error streaming from provider ${providerType}:`, error);
      
      // Try fallback provider if available
      const fallbackProvider = this.getFallbackProvider(providerType);
      if (fallbackProvider && fallbackProvider !== providerType) {
        console.log(`Falling back to ${fallbackProvider} for streaming`);
        return await this.streamProvider(fallbackProvider, request, callbacks);
      }
      
      throw error;
    }
  }
}