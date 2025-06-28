import { createHash, createHmac } from 'crypto';

export interface WebhookEvent {
  id: string;
  type: 'content.blocked' | 'content.rewritten' | 'policy.violation' | 'threshold.exceeded' | 'evaluation.completed';
  timestamp: Date;
  organizationId: string;
  data: {
    requestId?: string;
    userId?: string;
    violations?: string[];
    evaluationScores?: any;
    originalContent?: string;
    rewrittenContent?: string;
    policyRules?: string[];
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}

export interface WebhookEndpoint {
  id: string;
  organizationId: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffSeconds: number;
  };
  headers?: Record<string, string>;
}

export class WebhookService {
  private endpoints: Map<string, WebhookEndpoint[]> = new Map();
  private retryQueue: Map<string, { event: WebhookEvent; endpoint: WebhookEndpoint; attempt: number }[]> = new Map();

  constructor() {
    // Start retry processor
    setInterval(() => this.processRetryQueue(), 30000); // Process every 30 seconds
  }

  async addEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    const orgEndpoints = this.endpoints.get(endpoint.organizationId) || [];
    orgEndpoints.push(endpoint);
    this.endpoints.set(endpoint.organizationId, orgEndpoints);
  }

  async removeEndpoint(organizationId: string, endpointId: string): Promise<void> {
    const orgEndpoints = this.endpoints.get(organizationId) || [];
    const filtered = orgEndpoints.filter(ep => ep.id !== endpointId);
    this.endpoints.set(organizationId, filtered);
  }

  async updateEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    const orgEndpoints = this.endpoints.get(endpoint.organizationId) || [];
    const index = orgEndpoints.findIndex(ep => ep.id === endpoint.id);
    if (index !== -1) {
      orgEndpoints[index] = endpoint;
    }
  }

  async sendWebhook(event: WebhookEvent): Promise<void> {
    const endpoints = this.endpoints.get(event.organizationId) || [];
    
    for (const endpoint of endpoints) {
      if (!endpoint.enabled) continue;
      
      // Check if endpoint subscribes to this event type
      if (!endpoint.events.includes(event.type)) continue;

      await this.deliverWebhook(event, endpoint);
    }
  }

  private async deliverWebhook(
    event: WebhookEvent, 
    endpoint: WebhookEndpoint, 
    attempt: number = 1
  ): Promise<void> {
    try {
      const payload = JSON.stringify(event);
      const signature = this.generateSignature(payload, endpoint.secret);

      const headers = {
        'Content-Type': 'application/json',
        'X-CrossAudit-Signature': signature,
        'X-CrossAudit-Event': event.type,
        'X-CrossAudit-Delivery': event.id,
        'X-CrossAudit-Timestamp': event.timestamp.toISOString(),
        'User-Agent': 'CrossAudit-Webhooks/1.0',
        ...endpoint.headers
      };

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`Webhook delivered successfully to ${endpoint.url} for event ${event.id}`);

    } catch (error) {
      console.error(`Webhook delivery failed (attempt ${attempt}) to ${endpoint.url}:`, error);

      if (attempt < endpoint.retryConfig.maxRetries) {
        await this.scheduleRetry(event, endpoint, attempt);
      } else {
        console.error(`Webhook delivery failed permanently after ${attempt} attempts for event ${event.id}`);
        await this.handlePermanentFailure(event, endpoint);
      }
    }
  }

  private async scheduleRetry(
    event: WebhookEvent,
    endpoint: WebhookEndpoint,
    attempt: number
  ): Promise<void> {
    const orgQueue = this.retryQueue.get(endpoint.organizationId) || [];
    
    // Calculate backoff delay
    const backoffSeconds = Math.min(
      Math.pow(endpoint.retryConfig.backoffMultiplier, attempt) * 60,
      endpoint.retryConfig.maxBackoffSeconds
    );

    // Schedule for retry
    setTimeout(() => {
      orgQueue.push({ event, endpoint, attempt: attempt + 1 });
      this.retryQueue.set(endpoint.organizationId, orgQueue);
    }, backoffSeconds * 1000);

    console.log(`Webhook retry scheduled for ${backoffSeconds} seconds (attempt ${attempt + 1})`);
  }

  private async processRetryQueue(): Promise<void> {
    for (const [orgId, queue] of Array.from(this.retryQueue.entries())) {
      if (queue.length === 0) continue;

      const toProcess = queue.splice(0, 10); // Process up to 10 at a time
      
      for (const { event, endpoint, attempt } of toProcess) {
        await this.deliverWebhook(event, endpoint, attempt);
      }
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private async handlePermanentFailure(event: WebhookEvent, endpoint: WebhookEndpoint): Promise<void> {
    // In production, this could:
    // 1. Disable the endpoint temporarily
    // 2. Send an alert to the organization
    // 3. Store the failed event for manual retry
    console.error(`Permanent webhook failure for endpoint ${endpoint.id}, event ${event.id}`);
    
    // Store failed event for potential manual retry
    await this.storeFailedEvent(event, endpoint);
  }

  private async storeFailedEvent(event: WebhookEvent, endpoint: WebhookEndpoint): Promise<void> {
    // In production, store in database for later inspection/retry
    console.log(`Storing failed webhook event ${event.id} for endpoint ${endpoint.id}`);
  }

  // Webhook verification for incoming webhook endpoints
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
    return signature === expectedSignature;
  }

  // Test webhook endpoint
  async testEndpoint(endpoint: WebhookEndpoint): Promise<boolean> {
    const testEvent: WebhookEvent = {
      id: crypto.randomUUID(),
      type: 'evaluation.completed',
      timestamp: new Date(),
      organizationId: endpoint.organizationId,
      data: {
        requestId: 'test-request',
        evaluationScores: { overall: 0.95 },
        violations: [],
        severity: 'LOW'
      }
    };

    try {
      await this.deliverWebhook(testEvent, endpoint);
      return true;
    } catch (error) {
      console.error('Webhook test failed:', error);
      return false;
    }
  }

  // Get webhook statistics
  async getStats(organizationId: string): Promise<{
    totalEndpoints: number;
    activeEndpoints: number;
    totalEvents: number;
    failedEvents: number;
    avgResponseTime: number;
  }> {
    const endpoints = this.endpoints.get(organizationId) || [];
    
    return {
      totalEndpoints: endpoints.length,
      activeEndpoints: endpoints.filter(ep => ep.enabled).length,
      totalEvents: 0, // Would be tracked in production
      failedEvents: 0, // Would be tracked in production
      avgResponseTime: 0 // Would be tracked in production
    };
  }
}

// Singleton instance
export const webhookService = new WebhookService();