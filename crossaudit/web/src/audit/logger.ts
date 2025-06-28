import { createHash, createHmac } from 'crypto';
import { AuditEvent, LLMRequest, ProvenanceInfo } from '../gateway/types';
import { webhookService, WebhookEvent } from '@/lib/webhooks';

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  clientId: string;
  userId?: string;
  requestId: string;
  type: 'REQUEST' | 'EVALUATION' | 'REWRITE' | 'BLOCK' | 'PASS' | 'ERROR';
  data: any;
  hash: string;
  previousHash?: string;
  signature?: string;
}

interface CompletionData {
  originalPrompt: LLMRequest;
  originalResponse: string;
  evaluation: any;
  finalResponse: string;
  latency: number;
  documentsUsed: string[];
  clientId: string;
  userId?: string;
}

export class AuditLogger {
  private logEntries: Map<string, AuditLogEntry[]> = new Map(); // clientId -> entries
  private integrationKey: string;
  private chainVerified: boolean = true;

  constructor(integrationKey?: string) {
    this.integrationKey = integrationKey || this.generateIntegrationKey();
  }

  private generateIntegrationKey(): string {
    // In production, this would be loaded from secure storage
    return createHash('sha256').update(`crossaudit-${Date.now()}`).digest('hex').substring(0, 32);
  }

  async logRequest(
    requestId: string,
    clientId: string,
    request: LLMRequest,
    userId?: string
  ): Promise<void> {
    try {
      const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        clientId,
        userId,
        requestId,
        type: 'REQUEST',
        data: {
          model: request.model,
          messageCount: request.messages.length,
          temperature: request.temperature,
          maxTokens: request.max_tokens,
          // Don't log full message content for privacy
          promptHash: this.hashContent(JSON.stringify(request.messages))
        },
        hash: '',
        previousHash: this.getLastHash(clientId)
      };

      entry.hash = this.calculateHash(entry);
      entry.signature = this.signEntry(entry);

      await this.storeEntry(clientId, entry);
      
    } catch (error) {
      console.error('Failed to log request:', error);
      throw error;
    }
  }

  async logComplete(
    requestId: string,
    data: CompletionData
  ): Promise<void> {
    try {
      const provenance = this.calculateProvenance(data.documentsUsed);
      
      const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        clientId: data.clientId,
        userId: data.userId,
        requestId,
        type: this.determineCompletionType(data.evaluation),
        data: {
          evaluation: {
            score: data.evaluation.score,
            action: data.evaluation.action,
            violations: data.evaluation.violations,
            confidence: data.evaluation.confidence,
            evaluationScores: data.evaluation.evaluationScores
          },
          latency: data.latency,
          originalResponseHash: this.hashContent(data.originalResponse),
          finalResponseHash: this.hashContent(data.finalResponse),
          documentsUsed: data.documentsUsed,
          provenance,
          modified: data.originalResponse !== data.finalResponse,
          tokenCount: this.estimateTokens(data.originalResponse) + this.estimateTokens(data.finalResponse)
        },
        hash: '',
        previousHash: this.getLastHash(data.clientId)
      };

      entry.hash = this.calculateHash(entry);
      entry.signature = this.signEntry(entry);

      await this.storeEntry(data.clientId, entry);
      
      // Send webhook notifications based on evaluation results
      await this.sendWebhookNotifications(data);

    } catch (error) {
      console.error('Failed to log completion:', error);
      throw error;
    }
  }

  private async sendWebhookNotifications(data: CompletionData): Promise<void> {
    try {
      const event: WebhookEvent = {
        id: crypto.randomUUID(),
        type: this.getWebhookEventType(data.evaluation),
        timestamp: new Date(),
        organizationId: data.clientId,
        data: {
          requestId: crypto.randomUUID(),
          userId: data.userId,
          violations: data.evaluation.violations,
          evaluationScores: data.evaluation.evaluationScores,
          originalContent: data.originalResponse.substring(0, 500), // Truncate for privacy
          rewrittenContent: data.evaluation.action === 'REWRITE' ? data.finalResponse.substring(0, 500) : undefined,
          severity: this.getSeverityLevel(data.evaluation)
        }
      };

      await webhookService.sendWebhook(event);
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
      // Don't throw - webhook failures shouldn't stop audit logging
    }
  }

  private getWebhookEventType(evaluation: any): WebhookEvent['type'] {
    switch (evaluation.action) {
      case 'BLOCK':
        return 'content.blocked';
      case 'REWRITE':
        return 'content.rewritten';
      case 'FLAG':
        return 'policy.violation';
      default:
        return 'evaluation.completed';
    }
  }

  private getSeverityLevel(evaluation: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const score = evaluation.evaluationScores.overall;
    const violationCount = evaluation.violations.length;
    
    if (evaluation.action === 'BLOCK' || score < 0.3) {
      return 'CRITICAL';
    } else if (evaluation.action === 'REWRITE' || score < 0.6 || violationCount > 3) {
      return 'HIGH';
    } else if (evaluation.action === 'FLAG' || score < 0.8 || violationCount > 0) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  async logError(
    requestId: string,
    clientId: string,
    error: any,
    userId?: string
  ): Promise<void> {
    try {
      const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        clientId,
        userId,
        requestId,
        type: 'ERROR',
        data: {
          errorType: error.constructor.name,
          errorMessage: error.message,
          errorStack: error.stack?.split('\n').slice(0, 5).join('\n'), // Truncate stack trace
          timestamp: new Date().toISOString()
        },
        hash: '',
        previousHash: this.getLastHash(clientId)
      };

      entry.hash = this.calculateHash(entry);
      entry.signature = this.signEntry(entry);

      await this.storeEntry(clientId, entry);

    } catch (logError) {
      console.error('Failed to log error:', logError);
      // Don't throw here to avoid infinite loops
    }
  }

  private determineCompletionType(evaluation: any): 'EVALUATION' | 'REWRITE' | 'BLOCK' | 'PASS' {
    switch (evaluation.action) {
      case 'REWRITE': return 'REWRITE';
      case 'BLOCK': return 'BLOCK';
      case 'FLAGS': return 'EVALUATION';
      default: return 'PASS';
    }
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private calculateHash(entry: Omit<AuditLogEntry, 'hash' | 'signature'>): string {
    const hashInput = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      clientId: entry.clientId,
      userId: entry.userId,
      requestId: entry.requestId,
      type: entry.type,
      data: entry.data,
      previousHash: entry.previousHash
    });
    
    return createHash('sha256').update(hashInput).digest('hex');
  }

  private signEntry(entry: AuditLogEntry): string {
    return createHmac('sha256', this.integrationKey)
      .update(entry.hash)
      .digest('hex');
  }

  private getLastHash(clientId: string): string | undefined {
    const entries = this.logEntries.get(clientId);
    if (!entries || entries.length === 0) return undefined;
    return entries[entries.length - 1].hash;
  }

  private calculateProvenance(documentsUsed: string[]): ProvenanceInfo[] {
    // In production, this would query the vector database for document metadata
    return documentsUsed.map(docId => ({
      chunkId: `chunk-${docId}`,
      documentId: docId,
      filename: `document-${docId}.pdf`,
      department: 'unknown',
      extractedAt: new Date(),
      relevanceScore: 0.8 // Placeholder
    }));
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private async storeEntry(clientId: string, entry: AuditLogEntry): Promise<void> {
    // Store in memory map (in production this would go to database)
    if (!this.logEntries.has(clientId)) {
      this.logEntries.set(clientId, []);
    }
    
    this.logEntries.get(clientId)!.push(entry);

    // Verify chain integrity
    await this.verifyChainIntegrity(clientId);

    // In production, also store to immutable ledger/blockchain
    // await this.storeToImmutableLedger(entry);
  }

  private async verifyChainIntegrity(clientId: string): Promise<boolean> {
    const entries = this.logEntries.get(clientId);
    if (!entries || entries.length <= 1) return true;

    for (let i = 1; i < entries.length; i++) {
      const current = entries[i];
      const previous = entries[i - 1];

      // Verify previous hash link
      if (current.previousHash !== previous.hash) {
        console.error(`Chain integrity violation at entry ${current.id}`);
        this.chainVerified = false;
        return false;
      }

      // Verify entry hash
      const expectedHash = this.calculateHash({
        id: current.id,
        timestamp: current.timestamp,
        clientId: current.clientId,
        userId: current.userId,
        requestId: current.requestId,
        type: current.type,
        data: current.data,
        previousHash: current.previousHash
      });

      if (current.hash !== expectedHash) {
        console.error(`Hash verification failed for entry ${current.id}`);
        this.chainVerified = false;
        return false;
      }

      // Verify signature
      const expectedSignature = this.signEntry(current);
      if (current.signature !== expectedSignature) {
        console.error(`Signature verification failed for entry ${current.id}`);
        this.chainVerified = false;
        return false;
      }
    }

    return true;
  }

  // Query methods
  async getAuditTrail(
    clientId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      requestId?: string;
      type?: string;
      limit?: number;
    } = {}
  ): Promise<AuditLogEntry[]> {
    const entries = this.logEntries.get(clientId) || [];
    let filtered = entries;

    if (options.startDate) {
      filtered = filtered.filter(entry => entry.timestamp >= options.startDate!);
    }
    
    if (options.endDate) {
      filtered = filtered.filter(entry => entry.timestamp <= options.endDate!);
    }
    
    if (options.requestId) {
      filtered = filtered.filter(entry => entry.requestId === options.requestId);
    }
    
    if (options.type) {
      filtered = filtered.filter(entry => entry.type === options.type);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async getAuditStatistics(clientId: string): Promise<{
    totalEntries: number;
    entriesByType: Record<string, number>;
    latestEntry?: Date;
    chainIntegrity: boolean;
    avgLatency: number;
    totalViolations: number;
  }> {
    const entries = this.logEntries.get(clientId) || [];
    
    const stats = {
      totalEntries: entries.length,
      entriesByType: {} as Record<string, number>,
      latestEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : undefined,
      chainIntegrity: await this.verifyChainIntegrity(clientId),
      avgLatency: 0,
      totalViolations: 0
    };

    // Count by type
    for (const entry of entries) {
      stats.entriesByType[entry.type] = (stats.entriesByType[entry.type] || 0) + 1;
    }

    // Calculate average latency
    const latencyEntries = entries.filter(entry => entry.data.latency);
    if (latencyEntries.length > 0) {
      const totalLatency = latencyEntries.reduce((sum, entry) => sum + entry.data.latency, 0);
      stats.avgLatency = totalLatency / latencyEntries.length;
    }

    // Count violations
    const violationEntries = entries.filter(entry => entry.data.evaluation?.violations);
    stats.totalViolations = violationEntries.reduce(
      (sum, entry) => sum + (entry.data.evaluation.violations.length || 0), 
      0
    );

    return stats;
  }

  async searchAuditLogs(
    clientId: string,
    query: {
      content?: string;
      violations?: string[];
      scoreRange?: { min: number; max: number };
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<AuditLogEntry[]> {
    const entries = this.logEntries.get(clientId) || [];
    
    return entries.filter(entry => {
      // Content search
      if (query.content) {
        const entryText = JSON.stringify(entry.data).toLowerCase();
        if (!entryText.includes(query.content.toLowerCase())) {
          return false;
        }
      }

      // Violation search
      if (query.violations && query.violations.length > 0) {
        const entryViolations = entry.data.evaluation?.violations || [];
        const hasMatchingViolation = query.violations.some(violation =>
          entryViolations.some((v: string) => v.toLowerCase().includes(violation.toLowerCase()))
        );
        if (!hasMatchingViolation) {
          return false;
        }
      }

      // Score range
      if (query.scoreRange) {
        const score = entry.data.evaluation?.score;
        if (score === undefined || score < query.scoreRange.min || score > query.scoreRange.max) {
          return false;
        }
      }

      // Date range
      if (query.dateRange) {
        if (entry.timestamp < query.dateRange.start || entry.timestamp > query.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }

  async exportAuditTrail(clientId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const entries = await this.getAuditTrail(clientId);
    
    if (format === 'csv') {
      const headers = ['ID', 'Timestamp', 'Request ID', 'Type', 'Score', 'Violations', 'Latency'];
      const rows = entries.map(entry => [
        entry.id,
        entry.timestamp.toISOString(),
        entry.requestId,
        entry.type,
        entry.data.evaluation?.score || '',
        (entry.data.evaluation?.violations || []).join('; '),
        entry.data.latency || ''
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(entries, null, 2);
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test basic logging functionality
      const testRequestId = 'health-check-' + Date.now();
      const testClientId = 'health-check';
      
      await this.logRequest(testRequestId, testClientId, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }]
      });

      // Verify chain integrity
      const integrity = await this.verifyChainIntegrity(testClientId);
      
      // Clean up test data
      this.logEntries.delete(testClientId);
      
      return integrity;
    } catch (error) {
      console.error('Audit logger health check failed:', error);
      return false;
    }
  }

  // Method to rotate/archive old entries
  async archiveOldEntries(clientId: string, olderThanDays: number): Promise<number> {
    const entries = this.logEntries.get(clientId) || [];
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    const toArchive = entries.filter(entry => entry.timestamp < cutoffDate);
    const toKeep = entries.filter(entry => entry.timestamp >= cutoffDate);
    
    // In production, archive entries would be moved to cold storage
    // await this.moveToArchiveStorage(toArchive);
    
    this.logEntries.set(clientId, toKeep);
    
    return toArchive.length;
  }

  // Get chain verification status
  getChainVerificationStatus(): boolean {
    return this.chainVerified;
  }
}