import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
}

export class OpenAIEmbeddingService implements EmbeddingService {
  private model = 'text-embedding-3-small'; // Or text-embedding-3-large for better quality
  private dimension = 1536; // Default dimension for small model

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI supports batch embeddings
      const response = await openai.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: 'float',
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw new Error('Failed to generate batch embeddings');
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getDimension(): number {
    return this.dimension;
  }
}

// Alternative embedding services for flexibility
export class CohereEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private model = 'embed-english-v3.0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: [text],
        model: this.model,
        input_type: 'search_document',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate Cohere embedding');
    }

    const data = await response.json();
    return data.embeddings[0];
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts,
        model: this.model,
        input_type: 'search_document',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate Cohere embeddings');
    }

    const data = await response.json();
    return data.embeddings;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    // Same implementation as OpenAI
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Factory function to get appropriate embedding service
export function getEmbeddingService(): EmbeddingService {
  const provider = process.env.EMBEDDING_PROVIDER || 'openai';
  
  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddingService();
    case 'cohere':
      return new CohereEmbeddingService(process.env.COHERE_API_KEY!);
    default:
      return new OpenAIEmbeddingService();
  }
}

// Caching wrapper for embeddings
export class CachedEmbeddingService implements EmbeddingService {
  private cache = new Map<string, number[]>();
  private service: EmbeddingService;

  constructor(service: EmbeddingService) {
    this.service = service;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.getCacheKey(text);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const embedding = await this.service.generateEmbedding(text);
    this.cache.set(cacheKey, embedding);
    
    // Limit cache size
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    return embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.getCacheKey(texts[i]);
      if (this.cache.has(cacheKey)) {
        results[i] = this.cache.get(cacheKey)!;
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      const newEmbeddings = await this.service.generateBatchEmbeddings(uncachedTexts);
      
      for (let i = 0; i < uncachedTexts.length; i++) {
        const text = uncachedTexts[i];
        const embedding = newEmbeddings[i];
        const originalIndex = uncachedIndices[i];
        
        results[originalIndex] = embedding;
        this.cache.set(this.getCacheKey(text), embedding);
      }
    }

    return results;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    return this.service.cosineSimilarity(a, b);
  }

  private getCacheKey(text: string): string {
    // Simple hash for cache key
    return Buffer.from(text).toString('base64').substring(0, 32);
  }
}