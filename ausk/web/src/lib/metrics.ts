// Prometheus metrics for Ausk AI Governance Gateway

export interface MetricsCollector {
  incrementCounter(name: string, labels?: Record<string, string>): void;
  setGauge(name: string, value: number, labels?: Record<string, string>): void;
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
  startTimer(name: string, labels?: Record<string, string>): () => void;
}

class PrometheusMetrics implements MetricsCollector {
  private counters = new Map<string, { value: number; labels: Record<string, string> }[]>();
  private gauges = new Map<string, { value: number; labels: Record<string, string> }[]>();
  private histograms = new Map<string, { values: number[]; labels: Record<string, string> }[]>();

  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, []);
    }
    
    const existing = this.counters.get(name)!.find(c => 
      JSON.stringify(c.labels) === JSON.stringify(labels)
    );

    if (existing) {
      existing.value++;
    } else {
      this.counters.get(name)!.push({ value: 1, labels });
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, []);
    }

    const existing = this.gauges.get(name)!.find(g => 
      JSON.stringify(g.labels) === JSON.stringify(labels)
    );

    if (existing) {
      existing.value = value;
    } else {
      this.gauges.get(name)!.push({ value, labels });
    }
  }

  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }

    const existing = this.histograms.get(name)!.find(h => 
      JSON.stringify(h.labels) === JSON.stringify(labels)
    );

    if (existing) {
      existing.values.push(value);
      // Keep only last 1000 values
      if (existing.values.length > 1000) {
        existing.values.shift();
      }
    } else {
      this.histograms.get(name)!.push({ values: [value], labels });
    }
  }

  startTimer(name: string, labels: Record<string, string> = {}): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordHistogram(name, duration, labels);
    };
  }

  exportMetrics(): string {
    let output = '';
    
    // Export counters
    for (const [name, entries] of Array.from(this.counters.entries())) {
      output += `# TYPE ${name} counter\n`;
      for (const entry of entries) {
        const labelStr = Object.entries(entry.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        output += `${name}${labelStr ? `{${labelStr}}` : ''} ${entry.value}\n`;
      }
    }

    // Export gauges
    for (const [name, entries] of Array.from(this.gauges.entries())) {
      output += `# TYPE ${name} gauge\n`;
      for (const entry of entries) {
        const labelStr = Object.entries(entry.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        output += `${name}${labelStr ? `{${labelStr}}` : ''} ${entry.value}\n`;
      }
    }

    // Export histograms (simplified)
    for (const [name, entries] of Array.from(this.histograms.entries())) {
      output += `# TYPE ${name} histogram\n`;
      for (const entry of entries) {
        const labelStr = Object.entries(entry.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        
        const values = entry.values.sort((a, b) => a - b);
        const count = values.length;
        const sum = values.reduce((a, b) => a + b, 0);
        
        // Percentiles
        const p50 = values[Math.floor(count * 0.5)] || 0;
        const p95 = values[Math.floor(count * 0.95)] || 0;
        const p99 = values[Math.floor(count * 0.99)] || 0;

        output += `${name}_count${labelStr ? `{${labelStr}}` : ''} ${count}\n`;
        output += `${name}_sum${labelStr ? `{${labelStr}}` : ''} ${sum}\n`;
        output += `${name}_bucket{le="50"${labelStr ? `,${labelStr}` : ''}} ${count}\n`;
        output += `${name}_bucket{le="95"${labelStr ? `,${labelStr}` : ''}} ${count}\n`;
        output += `${name}_bucket{le="99"${labelStr ? `,${labelStr}` : ''}} ${count}\n`;
      }
    }

    return output;
  }
}

// AI Governance specific metrics
export class AIGovernanceMetrics {
  private metrics: MetricsCollector;

  constructor(metrics?: MetricsCollector) {
    this.metrics = metrics || new PrometheusMetrics();
  }

  // Gateway metrics
  recordRequest(organizationId: string, model: string, provider: string): void {
    this.metrics.incrementCounter('crossaudit_requests_total', {
      organization_id: organizationId,
      model,
      provider
    });
  }

  recordResponse(
    organizationId: string,
    model: string,
    action: string,
    latency: number
  ): void {
    this.metrics.incrementCounter('crossaudit_responses_total', {
      organization_id: organizationId,
      model,
      action
    });
    
    this.metrics.recordHistogram('crossaudit_request_duration_ms', latency, {
      organization_id: organizationId,
      model,
      action
    });
  }

  // Evaluation metrics
  recordEvaluation(
    organizationId: string,
    evaluator: string,
    score: number,
    violations: number
  ): void {
    this.metrics.recordHistogram('crossaudit_evaluation_score', score, {
      organization_id: organizationId,
      evaluator
    });
    
    this.metrics.incrementCounter('crossaudit_violations_total', {
      organization_id: organizationId,
      evaluator
    });

    if (violations > 0) {
      this.metrics.setGauge('crossaudit_violation_count', violations, {
        organization_id: organizationId,
        evaluator
      });
    }
  }

  recordEvaluationLatency(evaluator: string, latency: number): void {
    this.metrics.recordHistogram('crossaudit_evaluation_duration_ms', latency, {
      evaluator
    });
  }

  // Policy metrics
  recordPolicyAction(
    organizationId: string,
    ruleId: string,
    action: string
  ): void {
    this.metrics.incrementCounter('crossaudit_policy_actions_total', {
      organization_id: organizationId,
      rule_id: ruleId,
      action
    });
  }

  recordPolicyViolation(
    organizationId: string,
    ruleId: string,
    severity: string
  ): void {
    this.metrics.incrementCounter('crossaudit_policy_violations_total', {
      organization_id: organizationId,
      rule_id: ruleId,
      severity: severity.toLowerCase()
    });
  }

  // Cache metrics
  recordCacheHit(organizationId: string): void {
    this.metrics.incrementCounter('crossaudit_cache_hits_total', {
      organization_id: organizationId
    });
  }

  recordCacheMiss(organizationId: string): void {
    this.metrics.incrementCounter('crossaudit_cache_misses_total', {
      organization_id: organizationId
    });
  }

  // Provider metrics
  recordProviderError(provider: string, errorType: string): void {
    this.metrics.incrementCounter('crossaudit_provider_errors_total', {
      provider,
      error_type: errorType
    });
  }

  recordProviderLatency(provider: string, latency: number): void {
    this.metrics.recordHistogram('crossaudit_provider_duration_ms', latency, {
      provider
    });
  }

  // Document processing metrics
  recordDocumentProcessed(
    organizationId: string,
    documentType: string,
    success: boolean
  ): void {
    this.metrics.incrementCounter('crossaudit_documents_processed_total', {
      organization_id: organizationId,
      document_type: documentType,
      status: success ? 'success' : 'error'
    });
  }

  recordDocumentSize(organizationId: string, size: number): void {
    this.metrics.recordHistogram('crossaudit_document_size_bytes', size, {
      organization_id: organizationId
    });
  }

  // System metrics
  setActiveConnections(count: number): void {
    this.metrics.setGauge('crossaudit_active_connections', count);
  }

  setQueueSize(queue: string, size: number): void {
    this.metrics.setGauge('crossaudit_queue_size', size, { queue });
  }

  recordMemoryUsage(usage: number): void {
    this.metrics.setGauge('crossaudit_memory_usage_bytes', usage);
  }

  recordCPUUsage(usage: number): void {
    this.metrics.setGauge('crossaudit_cpu_usage_percent', usage);
  }

  // Error tracking
  recordError(
    organizationId: string,
    component: string,
    errorType: string
  ): void {
    this.metrics.incrementCounter('crossaudit_errors_total', {
      organization_id: organizationId,
      component,
      error_type: errorType
    });
  }

  // Webhook metrics
  recordWebhookDelivery(
    organizationId: string,
    eventType: string,
    success: boolean,
    attempt: number
  ): void {
    this.metrics.incrementCounter('crossaudit_webhook_deliveries_total', {
      organization_id: organizationId,
      event_type: eventType,
      status: success ? 'success' : 'failed',
      attempt: attempt.toString()
    });
  }

  // Export metrics for Prometheus scraping
  exportPrometheusMetrics(): string {
    if (this.metrics instanceof PrometheusMetrics) {
      return this.metrics.exportMetrics();
    }
    return '';
  }
}

// Singleton instance
export const aiGovernanceMetrics = new AIGovernanceMetrics();

// Middleware for automatic request tracking
export function metricsMiddleware(
  req: any,
  res: any,
  next: () => void,
  organizationId?: string
): void {
  const startTime = Date.now();
  
  // Track request
  aiGovernanceMetrics.recordRequest(
    organizationId || 'unknown',
    req.body?.model || 'unknown',
    'gateway'
  );

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const latency = Date.now() - startTime;
    
    aiGovernanceMetrics.recordResponse(
      organizationId || 'unknown',
      req.body?.model || 'unknown',
      res.statusCode < 400 ? 'success' : 'error',
      latency
    );
    
    originalEnd.apply(this, args);
  };

  next();
}