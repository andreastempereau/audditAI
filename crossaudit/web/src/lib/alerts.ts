export interface Alert {
  id: string;
  organizationId: string;
  type: 'threshold_exceeded' | 'policy_violation' | 'system_error' | 'security_incident' | 'evaluation_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata: Record<string, any>;
  channels: AlertChannel[];
}

export interface AlertRule {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownPeriod: number; // minutes
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  value: number | string;
  timeWindow: number; // minutes
  aggregation?: 'avg' | 'sum' | 'count' | 'max' | 'min';
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'dashboard';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
}

export class AlertingService {
  private alerts: Map<string, Alert[]> = new Map(); // organizationId -> alerts
  private rules: Map<string, AlertRule[]> = new Map(); // organizationId -> rules
  private metrics: Map<string, { value: number; timestamp: Date }[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
    // Start background processors
    setInterval(() => this.evaluateRules(), 60000); // Every minute
    setInterval(() => this.cleanupOldMetrics(), 300000); // Every 5 minutes
  }

  private initializeDefaultRules(): void {
    // Global default alerting rules
    const defaultRules: AlertRule[] = [
      {
        id: 'high-violation-rate',
        organizationId: 'global',
        name: 'High Policy Violation Rate',
        description: 'Alert when policy violations exceed 10% of requests in 5 minutes',
        enabled: true,
        conditions: [
          {
            metric: 'violation_rate',
            operator: 'gt',
            value: 0.1,
            timeWindow: 5,
            aggregation: 'avg'
          }
        ],
        actions: [
          {
            type: 'email',
            config: { recipients: ['security@company.com'] },
            enabled: true
          },
          {
            type: 'slack',
            config: { channel: '#security-alerts' },
            enabled: true
          }
        ],
        cooldownPeriod: 30
      },
      {
        id: 'critical-content-blocked',
        organizationId: 'global',
        name: 'Critical Content Blocked',
        description: 'Alert when content is blocked due to critical violations',
        enabled: true,
        conditions: [
          {
            metric: 'blocked_content_count',
            operator: 'gte',
            value: 1,
            timeWindow: 1
          }
        ],
        actions: [
          {
            type: 'email',
            config: { recipients: ['compliance@company.com'] },
            enabled: true
          }
        ],
        cooldownPeriod: 5
      },
      {
        id: 'evaluation-failure-rate',
        organizationId: 'global',
        name: 'High Evaluation Failure Rate',
        description: 'Alert when evaluation failures exceed 5% in 10 minutes',
        enabled: true,
        conditions: [
          {
            metric: 'evaluation_failure_rate',
            operator: 'gt',
            value: 0.05,
            timeWindow: 10,
            aggregation: 'avg'
          }
        ],
        actions: [
          {
            type: 'email',
            config: { recipients: ['engineering@company.com'] },
            enabled: true
          }
        ],
        cooldownPeriod: 15
      }
    ];

    this.rules.set('global', defaultRules);
  }

  async createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'channels'>): Promise<Alert> {
    const fullAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      resolved: false,
      channels: []
    };

    // Store alert
    if (!this.alerts.has(alert.organizationId)) {
      this.alerts.set(alert.organizationId, []);
    }
    this.alerts.get(alert.organizationId)!.push(fullAlert);

    // Trigger alert actions
    await this.executeAlertActions(fullAlert);

    return fullAlert;
  }

  async resolveAlert(
    organizationId: string,
    alertId: string,
    resolvedBy: string
  ): Promise<boolean> {
    const orgAlerts = this.alerts.get(organizationId);
    if (!orgAlerts) return false;

    const alert = orgAlerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    return true;
  }

  async addRule(rule: AlertRule): Promise<void> {
    if (!this.rules.has(rule.organizationId)) {
      this.rules.set(rule.organizationId, []);
    }
    this.rules.get(rule.organizationId)!.push(rule);
  }

  async updateRule(rule: AlertRule): Promise<boolean> {
    const orgRules = this.rules.get(rule.organizationId);
    if (!orgRules) return false;

    const index = orgRules.findIndex(r => r.id === rule.id);
    if (index === -1) return false;

    orgRules[index] = rule;
    return true;
  }

  async removeRule(organizationId: string, ruleId: string): Promise<boolean> {
    const orgRules = this.rules.get(organizationId);
    if (!orgRules) return false;

    const index = orgRules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;

    orgRules.splice(index, 1);
    return true;
  }

  // Record metrics for alerting
  recordMetric(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    this.metrics.get(metric)!.push({
      value,
      timestamp: new Date()
    });

    // Keep only recent data
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
    const filtered = this.metrics.get(metric)!.filter(m => m.timestamp > cutoff);
    this.metrics.set(metric, filtered);
  }

  private async evaluateRules(): Promise<void> {
    const now = new Date();

    // Evaluate global rules for all organizations
    await this.evaluateRulesForOrg('global', now);

    // Evaluate organization-specific rules
    for (const [orgId, rules] of Array.from(this.rules.entries())) {
      if (orgId !== 'global') {
        await this.evaluateRulesForOrg(orgId, now);
      }
    }
  }

  private async evaluateRulesForOrg(organizationId: string, now: Date): Promise<void> {
    const rules = this.rules.get(organizationId) || [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered) {
        const cooldownMs = rule.cooldownPeriod * 60 * 1000;
        if (now.getTime() - rule.lastTriggered.getTime() < cooldownMs) {
          continue;
        }
      }

      // Evaluate all conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions, now);

      if (conditionsMet) {
        await this.triggerRule(rule, organizationId, now);
      }
    }
  }

  private async evaluateConditions(conditions: AlertCondition[], now: Date): Promise<boolean> {
    for (const condition of conditions) {
      const metricData = this.metrics.get(condition.metric) || [];
      
      // Filter data within time window
      const windowMs = condition.timeWindow * 60 * 1000;
      const cutoff = new Date(now.getTime() - windowMs);
      const windowData = metricData.filter(m => m.timestamp > cutoff);

      if (windowData.length === 0) continue;

      // Calculate aggregated value
      let value: number;
      const values = windowData.map(d => d.value);

      switch (condition.aggregation) {
        case 'avg':
          value = values.reduce((sum, v) => sum + v, 0) / values.length;
          break;
        case 'sum':
          value = values.reduce((sum, v) => sum + v, 0);
          break;
        case 'count':
          value = values.length;
          break;
        case 'max':
          value = Math.max(...values);
          break;
        case 'min':
          value = Math.min(...values);
          break;
        default:
          value = values[values.length - 1]; // Latest value
      }

      // Check condition
      const threshold = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value as string);
      let conditionMet = false;

      switch (condition.operator) {
        case 'gt':
          conditionMet = value > threshold;
          break;
        case 'gte':
          conditionMet = value >= threshold;
          break;
        case 'lt':
          conditionMet = value < threshold;
          break;
        case 'lte':
          conditionMet = value <= threshold;
          break;
        case 'eq':
          conditionMet = Math.abs(value - threshold) < 0.001;
          break;
        case 'contains':
          conditionMet = value.toString().includes(condition.value.toString());
          break;
      }

      if (!conditionMet) return false;
    }

    return true;
  }

  private async triggerRule(rule: AlertRule, organizationId: string, now: Date): Promise<void> {
    // Create alert
    const alert = await this.createAlert({
      organizationId,
      type: 'threshold_exceeded',
      severity: this.determineSeverity(rule),
      title: rule.name,
      description: rule.description,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        triggeredAt: now.toISOString()
      }
    });

    // Update rule's last triggered time
    rule.lastTriggered = now;

    console.log(`Alert triggered: ${rule.name} for organization ${organizationId}`);
  }

  private determineSeverity(rule: AlertRule): Alert['severity'] {
    // Simple severity determination based on rule name and conditions
    const name = rule.name.toLowerCase();
    
    if (name.includes('critical') || name.includes('security')) {
      return 'critical';
    } else if (name.includes('high') || name.includes('blocked')) {
      return 'high';
    } else if (name.includes('medium') || name.includes('warning')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private async executeAlertActions(alert: Alert): Promise<void> {
    // Get applicable rules for this organization
    const orgRules = this.rules.get(alert.organizationId) || [];
    const globalRules = this.rules.get('global') || [];
    const allRules = [...orgRules, ...globalRules];

    for (const rule of allRules) {
      if (!rule.enabled) continue;

      for (const action of rule.actions) {
        if (!action.enabled) continue;

        try {
          await this.executeAction(alert, action);
          alert.channels.push({
            type: action.type as any,
            status: 'sent',
            sentAt: new Date()
          });
        } catch (error) {
          console.error(`Failed to execute alert action ${action.type}:`, error);
          alert.channels.push({
            type: action.type as any,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  private async executeAction(alert: Alert, action: AlertAction): Promise<void> {
    switch (action.type) {
      case 'email':
        await this.sendEmailAlert(alert, action.config);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, action.config);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, action.config);
        break;
      case 'sms':
        await this.sendSMSAlert(alert, action.config);
        break;
      case 'dashboard':
        await this.sendDashboardAlert(alert, action.config);
        break;
    }
  }

  private async sendEmailAlert(alert: Alert, config: any): Promise<void> {
    // In production, integrate with email service (SendGrid, SES, etc.)
    console.log(`[EMAIL ALERT] ${alert.title} - ${alert.description}`);
    console.log(`Recipients: ${config.recipients?.join(', ')}`);
  }

  private async sendSlackAlert(alert: Alert, config: any): Promise<void> {
    // In production, integrate with Slack API
    console.log(`[SLACK ALERT] Channel: ${config.channel}`);
    console.log(`Message: ${alert.title} - ${alert.description}`);
  }

  private async sendWebhookAlert(alert: Alert, config: any): Promise<void> {
    if (!config.url) return;

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify({
        alert,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  private async sendSMSAlert(alert: Alert, config: any): Promise<void> {
    // In production, integrate with SMS service (Twilio, etc.)
    console.log(`[SMS ALERT] ${alert.title} - ${alert.description}`);
    console.log(`Phone: ${config.phoneNumber}`);
  }

  private async sendDashboardAlert(alert: Alert, config: any): Promise<void> {
    // Update dashboard real-time alerts
    console.log(`[DASHBOARD ALERT] ${alert.title}`);
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours

    for (const [metric, data] of Array.from(this.metrics.entries())) {
      const filtered = data.filter(d => d.timestamp > cutoff);
      this.metrics.set(metric, filtered);
    }
  }

  // Query methods
  async getAlerts(
    organizationId: string,
    options: {
      resolved?: boolean;
      severity?: Alert['severity'];
      type?: Alert['type'];
      limit?: number;
    } = {}
  ): Promise<Alert[]> {
    const orgAlerts = this.alerts.get(organizationId) || [];
    
    let filtered = orgAlerts;

    if (options.resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === options.resolved);
    }

    if (options.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }

    if (options.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async getRules(organizationId: string): Promise<AlertRule[]> {
    return this.rules.get(organizationId) || [];
  }

  async getAlertStats(organizationId: string): Promise<{
    total: number;
    unresolved: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const alerts = this.alerts.get(organizationId) || [];

    const stats = {
      total: alerts.length,
      unresolved: alerts.filter(a => !a.resolved).length,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    for (const alert of alerts) {
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
export const alertingService = new AlertingService();