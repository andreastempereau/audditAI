import { ContextDocument } from '../gateway/types';
import { getEmbeddingService, CachedEmbeddingService } from '@/lib/embeddings';

interface SearchOptions {
  limit?: number;
  threshold?: number;
  filters?: {
    department?: string;
    sensitivity?: string;
    dateRange?: { start: Date; end: Date };
  };
}

interface SearchResult {
  documents: ContextDocument[];
  totalResults: number;
  searchTime: number;
}

interface EmbeddingVector {
  id: string;
  vector: number[];
  metadata: {
    documentId: string;
    filename: string;
    department: string;
    sensitivity: string;
    chunkIndex: number;
    lastUpdated: Date;
  };
  content: string;
}

export class ContextRetriever {
  private embeddings: Map<string, EmbeddingVector[]> = new Map(); // clientId -> embeddings
  private embeddingDimension = 1536; // OpenAI embedding dimension
  private embeddingService: CachedEmbeddingService;
  
  constructor() {
    // Initialize embedding service with caching
    this.embeddingService = new CachedEmbeddingService(getEmbeddingService());
    // Initialize with some sample data for testing
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Add sample embeddings for testing
    const sampleEmbeddings: EmbeddingVector[] = [
      {
        id: 'sample-1',
        vector: this.generateRandomVector(),
        metadata: {
          documentId: 'doc-1',
          filename: 'company-policies.pdf',
          department: 'hr',
          sensitivity: 'internal',
          chunkIndex: 0,
          lastUpdated: new Date('2024-01-15')
        },
        content: 'Our company maintains strict confidentiality policies regarding client data and proprietary information.'
      },
      {
        id: 'sample-2',
        vector: this.generateRandomVector(),
        metadata: {
          documentId: 'doc-2',
          filename: 'technical-specifications.pdf',
          department: 'engineering',
          sensitivity: 'confidential',
          chunkIndex: 0,
          lastUpdated: new Date('2024-02-01')
        },
        content: 'The system architecture utilizes microservices with containerized deployment using Kubernetes orchestration.'
      }
    ];

    this.embeddings.set('sample-client', sampleEmbeddings);
  }

  private generateRandomVector(): number[] {
    return Array.from({ length: this.embeddingDimension }, () => Math.random() - 0.5);
  }

  async search(
    query: string,
    clientId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      // Get query embedding
      const queryVector = await this.getEmbedding(query);
      
      // Get client embeddings
      const clientEmbeddings = this.embeddings.get(clientId) || [];
      
      if (clientEmbeddings.length === 0) {
        return {
          documents: [],
          totalResults: 0,
          searchTime: Date.now() - startTime
        };
      }

      // Calculate similarities
      const similarities = clientEmbeddings.map(embedding => ({
        embedding,
        similarity: this.cosineSimilarity(queryVector, embedding.vector)
      }));

      // Filter by threshold
      const threshold = options.threshold || 0.7;
      let filtered = similarities.filter(item => item.similarity >= threshold);

      // Apply additional filters
      if (options.filters) {
        filtered = this.applyFilters(filtered, options.filters);
      }

      // Sort by similarity (descending)
      filtered.sort((a, b) => b.similarity - a.similarity);

      // Apply limit
      const limit = options.limit || 10;
      const limited = filtered.slice(0, limit);

      // Convert to ContextDocuments
      const documents: ContextDocument[] = limited.map(item => ({
        id: item.embedding.metadata.documentId,
        content: item.embedding.content,
        metadata: {
          filename: item.embedding.metadata.filename,
          department: item.embedding.metadata.department,
          sensitivity: item.embedding.metadata.sensitivity as any,
          lastUpdated: item.embedding.metadata.lastUpdated
        }
      }));

      return {
        documents,
        totalResults: filtered.length,
        searchTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Context retrieval error:', error);
      return {
        documents: [],
        totalResults: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      // Use real OpenAI embeddings
      return await this.embeddingService.generateEmbedding(text);
    } catch (error) {
      console.error('Failed to generate embedding, falling back to pseudo-embedding:', error);
      // Fallback to pseudo-embedding if API fails
      return this.generatePseudoEmbedding(text);
    }
  }

  private generatePseudoEmbedding(text: string): number[] {
    // Generate a deterministic pseudo-embedding based on text content
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = normalized.split(/\s+/).filter(w => w.length > 2);
    
    const embedding = new Array(this.embeddingDimension).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const char = word.charCodeAt(j);
        const index = (char + i + j) % this.embeddingDimension;
        embedding[index] += Math.sin(char * 0.1) * 0.1;
      }
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    return this.embeddingService.cosineSimilarity(vectorA, vectorB);
  }

  private applyFilters(
    similarities: Array<{ embedding: EmbeddingVector; similarity: number }>,
    filters: NonNullable<SearchOptions['filters']>
  ): Array<{ embedding: EmbeddingVector; similarity: number }> {
    return similarities.filter(item => {
      const metadata = item.embedding.metadata;

      if (filters.department && metadata.department !== filters.department) {
        return false;
      }

      if (filters.sensitivity && metadata.sensitivity !== filters.sensitivity) {
        return false;
      }

      if (filters.dateRange) {
        const date = metadata.lastUpdated;
        if (date < filters.dateRange.start || date > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }

  // Document management methods
  async addDocument(
    clientId: string,
    document: {
      id: string;
      content: string;
      filename: string;
      department: string;
      sensitivity: string;
    }
  ): Promise<void> {
    try {
      // Split document into chunks
      const chunks = this.chunkDocument(document.content);
      
      // Generate embeddings for each chunk in batch for efficiency
      const embeddings: EmbeddingVector[] = [];
      
      // Batch generate embeddings
      const vectors = await this.embeddingService.generateBatchEmbeddings(chunks);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const vector = vectors[i];
        
        embeddings.push({
          id: `${document.id}-chunk-${i}`,
          vector,
          metadata: {
            documentId: document.id,
            filename: document.filename,
            department: document.department,
            sensitivity: document.sensitivity,
            chunkIndex: i,
            lastUpdated: new Date()
          },
          content: chunk
        });
      }

      // Store embeddings
      if (!this.embeddings.has(clientId)) {
        this.embeddings.set(clientId, []);
      }

      const clientEmbeddings = this.embeddings.get(clientId)!;
      
      // Remove existing embeddings for this document
      const filteredEmbeddings = clientEmbeddings.filter(
        e => e.metadata.documentId !== document.id
      );
      
      // Add new embeddings
      filteredEmbeddings.push(...embeddings);
      this.embeddings.set(clientId, filteredEmbeddings);

    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }

  async removeDocument(clientId: string, documentId: string): Promise<void> {
    const clientEmbeddings = this.embeddings.get(clientId);
    if (!clientEmbeddings) return;

    const filtered = clientEmbeddings.filter(
      e => e.metadata.documentId !== documentId
    );
    
    this.embeddings.set(clientId, filtered);
  }

  async updateDocument(
    clientId: string,
    documentId: string,
    updates: {
      content?: string;
      filename?: string;
      department?: string;
      sensitivity?: string;
    }
  ): Promise<void> {
    const clientEmbeddings = this.embeddings.get(clientId);
    if (!clientEmbeddings) return;

    const documentEmbeddings = clientEmbeddings.filter(
      e => e.metadata.documentId === documentId
    );

    if (documentEmbeddings.length === 0) return;

    // If content changed, need to regenerate embeddings
    if (updates.content) {
      const firstEmbedding = documentEmbeddings[0];
      await this.addDocument(clientId, {
        id: documentId,
        content: updates.content,
        filename: updates.filename || firstEmbedding.metadata.filename,
        department: updates.department || firstEmbedding.metadata.department,
        sensitivity: updates.sensitivity || firstEmbedding.metadata.sensitivity
      });
    } else {
      // Just update metadata
      for (const embedding of documentEmbeddings) {
        if (updates.filename) embedding.metadata.filename = updates.filename;
        if (updates.department) embedding.metadata.department = updates.department;
        if (updates.sensitivity) embedding.metadata.sensitivity = updates.sensitivity;
        embedding.metadata.lastUpdated = new Date();
      }
    }
  }

  private chunkDocument(content: string, chunkSize: number = 1000): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence.trim();
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
  }

  // Statistics and management
  async getDocumentStats(clientId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    byDepartment: Record<string, number>;
    bySensitivity: Record<string, number>;
    storageSize: number;
  }> {
    const clientEmbeddings = this.embeddings.get(clientId) || [];
    
    const documents = new Set(clientEmbeddings.map(e => e.metadata.documentId));
    const byDepartment: Record<string, number> = {};
    const bySensitivity: Record<string, number> = {};

    for (const embedding of clientEmbeddings) {
      const dept = embedding.metadata.department;
      const sens = embedding.metadata.sensitivity;
      
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;
      bySensitivity[sens] = (bySensitivity[sens] || 0) + 1;
    }

    // Estimate storage size (vectors + metadata)
    const vectorSize = this.embeddingDimension * 4; // 4 bytes per float
    const metadataSize = 200; // estimated metadata size
    const storageSize = clientEmbeddings.length * (vectorSize + metadataSize);

    return {
      totalDocuments: documents.size,
      totalChunks: clientEmbeddings.length,
      byDepartment,
      bySensitivity,
      storageSize
    };
  }

  async searchSimilarDocuments(
    clientId: string,
    documentId: string,
    limit: number = 5
  ): Promise<ContextDocument[]> {
    const clientEmbeddings = this.embeddings.get(clientId) || [];
    const sourceDocument = clientEmbeddings.find(e => e.metadata.documentId === documentId);
    
    if (!sourceDocument) return [];

    const similarities = clientEmbeddings
      .filter(e => e.metadata.documentId !== documentId)
      .map(embedding => ({
        embedding,
        similarity: this.cosineSimilarity(sourceDocument.vector, embedding.vector)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarities.map(item => ({
      id: item.embedding.metadata.documentId,
      content: item.embedding.content,
      metadata: {
        filename: item.embedding.metadata.filename,
        department: item.embedding.metadata.department,
        sensitivity: item.embedding.metadata.sensitivity as any,
        lastUpdated: item.embedding.metadata.lastUpdated
      }
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test basic search functionality
      const result = await this.search('test query', 'sample-client', { limit: 1 });
      return result.documents !== undefined && result.searchTime > 0;
    } catch (error) {
      console.error('Context retriever health check failed:', error);
      return false;
    }
  }

  // Method to list all documents for a client
  async listDocuments(clientId: string): Promise<Array<{
    id: string;
    filename: string;
    department: string;
    sensitivity: string;
    chunkCount: number;
    lastUpdated: Date;
  }>> {
    const clientEmbeddings = this.embeddings.get(clientId) || [];
    const documentMap = new Map<string, any>();

    for (const embedding of clientEmbeddings) {
      const docId = embedding.metadata.documentId;
      if (!documentMap.has(docId)) {
        documentMap.set(docId, {
          id: docId,
          filename: embedding.metadata.filename,
          department: embedding.metadata.department,
          sensitivity: embedding.metadata.sensitivity,
          chunkCount: 0,
          lastUpdated: embedding.metadata.lastUpdated
        });
      }
      documentMap.get(docId).chunkCount++;
    }

    return Array.from(documentMap.values());
  }
}