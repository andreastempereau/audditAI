// Slack Integration for Ausk

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
}

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  channel?: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
  threadTs?: string;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  accessory?: any;
}

export interface SlackAttachment {
  color: string;
  title?: string;
  titleLink?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short: boolean;
  }>;
  footer?: string;
  ts?: number;
}

export interface AlertNotification {
  type: 'policy_violation' | 'system_alert' | 'security_incident';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  details: Record<string, any>;
  timestamp: Date;
  organizationId: string;
  userId?: string;
}

export class SlackIntegration {
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  async sendMessage(message: SlackMessage): Promise<void> {
    const payload = {
      text: message.text,
      channel: message.channel || this.config.channel,
      username: message.username || this.config.username || 'Ausk',
      icon_emoji: message.iconEmoji || this.config.iconEmoji || ':shield:',
      icon_url: message.iconUrl || this.config.iconUrl,
      blocks: message.blocks,
      attachments: message.attachments,
      thread_ts: message.threadTs
    };

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send Slack message:', error);
      throw error;
    }
  }

  async sendAlertNotification(alert: AlertNotification): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);
    
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${alert.title}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alert.description
        }
      }
    ];

    // Add details as fields
    if (Object.keys(alert.details).length > 0) {
      const fields = Object.entries(alert.details)
        .slice(0, 10) // Limit to 10 fields
        .map(([key, value]) => ({
          type: 'mrkdwn',
          text: `*${this.formatFieldName(key)}:*\n${this.formatFieldValue(value)}`
        }));

      blocks.push({
        type: 'section',
        fields
      });
    }

    // Add context
    blocks.push({
      type: 'context',
      text: {
        type: 'mrkdwn',
        text: `Severity: ${alert.severity} | Time: ${alert.timestamp.toISOString()} | Org: ${alert.organizationId}`
      }
    });

    const message: SlackMessage = {
      text: `${emoji} Ausk Alert: ${alert.title}`,
      blocks,
      attachments: [{
        color,
        footer: 'Ausk AI Governance',
        ts: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    };

    await this.sendMessage(message);
  }

  async sendPolicyViolationAlert(violation: {
    type: string;
    severity: string;
    message: string;
    userId?: string;
    organizationId: string;
    model: string;
    provider: string;
    evidence?: string;
    timestamp: Date;
  }): Promise<void> {
    const alert: AlertNotification = {
      type: 'policy_violation',
      severity: violation.severity as any,
      title: `Policy Violation: ${violation.type}`,
      description: violation.message,
      details: {
        'Violation Type': violation.type,
        'Model': violation.model,
        'Provider': violation.provider,
        'User ID': violation.userId || 'Unknown',
        'Evidence': violation.evidence || 'N/A'
      },
      timestamp: violation.timestamp,
      organizationId: violation.organizationId,
      userId: violation.userId
    };

    await this.sendAlertNotification(alert);
  }

  async sendSystemAlert(alert: {
    title: string;
    description: string;
    severity: string;
    component: string;
    details: Record<string, any>;
    organizationId: string;
  }): Promise<void> {
    const notification: AlertNotification = {
      type: 'system_alert',
      severity: alert.severity as any,
      title: alert.title,
      description: alert.description,
      details: {
        'Component': alert.component,
        ...alert.details
      },
      timestamp: new Date(),
      organizationId: alert.organizationId
    };

    await this.sendAlertNotification(notification);
  }

  async sendDailyReport(report: {
    organizationId: string;
    date: string;
    metrics: {
      totalRequests: number;
      blockedRequests: number;
      violationsCount: number;
      topViolationTypes: Array<{ type: string; count: number }>;
      topModels: Array<{ model: string; count: number }>;
    };
  }): Promise<void> {
    const violationRate = report.metrics.totalRequests > 0 
      ? ((report.metrics.blockedRequests / report.metrics.totalRequests) * 100).toFixed(2)
      : '0.00';

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Ausk Daily Report - ${report.date}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Requests:*\n${report.metrics.totalRequests.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Blocked Requests:*\n${report.metrics.blockedRequests.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Violation Rate:*\n${violationRate}%`
          },
          {
            type: 'mrkdwn',
            text: `*Total Violations:*\n${report.metrics.violationsCount.toLocaleString()}`
          }
        ]
      }
    ];

    // Top violation types
    if (report.metrics.topViolationTypes.length > 0) {
      const violationText = report.metrics.topViolationTypes
        .slice(0, 5)
        .map(v => `• ${v.type}: ${v.count}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Violation Types:*\n${violationText}`
        }
      });
    }

    // Top models
    if (report.metrics.topModels.length > 0) {
      const modelsText = report.metrics.topModels
        .slice(0, 5)
        .map(m => `• ${m.model}: ${m.count}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Most Used Models:*\n${modelsText}`
        }
      });
    }

    const message: SlackMessage = {
      text: `📊 Ausk Daily Report - ${report.date}`,
      blocks
    };

    await this.sendMessage(message);
  }

  async sendWelcomeMessage(userInfo: {
    userName: string;
    organizationName: string;
    setupUrl: string;
  }): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 Welcome to Ausk!'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi ${userInfo.userName}! Welcome to Ausk AI Governance for ${userInfo.organizationName}.\n\nYou'll receive important alerts and daily reports in this channel.`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*What you'll receive here:*\n• Policy violation alerts\n• System health notifications\n• Daily usage reports\n• Security incident alerts`
        }
      },
      {
        type: 'actions',
        text: {
          type: 'mrkdwn',
          text: 'Get started with Ausk:'
        }
      }
    ];

    const message: SlackMessage = {
      text: `🎉 Welcome to Ausk, ${userInfo.userName}!`,
      blocks
    };

    await this.sendMessage(message);
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return '#dc2626'; // Red
      case 'HIGH':
        return '#ea580c'; // Orange
      case 'MEDIUM':
        return '#ca8a04'; // Yellow
      case 'LOW':
        return '#2563eb'; // Blue
      default:
        return '#6b7280'; // Gray
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return '🚨';
      case 'HIGH':
        return '⚠️';
      case 'MEDIUM':
        return '⚡';
      case 'LOW':
        return 'ℹ️';
      default:
        return '📝';
    }
  }

  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  }
}

export class SlackIntegrationManager {
  private integrations: Map<string, SlackIntegration> = new Map();

  addIntegration(organizationId: string, config: SlackConfig): void {
    this.integrations.set(organizationId, new SlackIntegration(config));
  }

  removeIntegration(organizationId: string): void {
    this.integrations.delete(organizationId);
  }

  getIntegration(organizationId: string): SlackIntegration | undefined {
    return this.integrations.get(organizationId);
  }

  async broadcastAlert(organizationId: string, alert: AlertNotification): Promise<void> {
    const integration = this.getIntegration(organizationId);
    if (!integration) {
      console.warn(`No Slack integration found for organization: ${organizationId}`);
      return;
    }

    try {
      await integration.sendAlertNotification(alert);
    } catch (error) {
      console.error(`Failed to send Slack alert for org ${organizationId}:`, error);
    }
  }

  async sendDailyReports(): Promise<void> {
    for (const [organizationId, integration] of Array.from(this.integrations.entries())) {
      try {
        // Get metrics for the organization
        const metrics = await this.getOrganizationMetrics(organizationId);
        
        await integration.sendDailyReport({
          organizationId,
          date: new Date().toISOString().split('T')[0],
          metrics
        });
      } catch (error) {
        console.error(`Failed to send daily report for org ${organizationId}:`, error);
      }
    }
  }

  private async getOrganizationMetrics(organizationId: string): Promise<any> {
    // In production, fetch real metrics from your analytics system
    return {
      totalRequests: Math.floor(Math.random() * 1000) + 500,
      blockedRequests: Math.floor(Math.random() * 50) + 10,
      violationsCount: Math.floor(Math.random() * 100) + 20,
      topViolationTypes: [
        { type: 'inappropriate_content', count: 15 },
        { type: 'pii_detection', count: 8 },
        { type: 'brand_guidelines', count: 5 }
      ],
      topModels: [
        { model: 'gpt-4', count: 300 },
        { model: 'gpt-3.5-turbo', count: 200 },
        { model: 'claude-3', count: 100 }
      ]
    };
  }
}

// Singleton instance
export const slackIntegrationManager = new SlackIntegrationManager();