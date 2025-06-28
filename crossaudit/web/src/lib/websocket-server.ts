// WebSocket server for real-time dashboard updates
import { WebSocketServer, WebSocket } from 'ws';
import { aiGovernanceMetrics } from './metrics';
import { alertingService } from './alerts';

interface DashboardClient {
  ws: WebSocket;
  organizationId: string;
  userId: string;
  lastPing: number;
}

export class DashboardWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, DashboardClient> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3001) {
    this.initializeServer(port);
  }

  private initializeServer(port: number): void {
    this.wss = new WebSocketServer({ port });
    
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.startMetricsBroadcast();
    this.startPingCheck();

    console.log(`Dashboard WebSocket server listening on port ${port}`);
  }

  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(clientId, data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
      console.log(`Dashboard client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.clients.delete(clientId);
    });

    // Send initial connection response
    ws.send(JSON.stringify({
      type: 'connection',
      clientId,
      message: 'Connected to dashboard stream'
    }));
  }

  private handleMessage(clientId: string, data: any): void {
    switch (data.type) {
      case 'auth':
        this.authenticateClient(clientId, data);
        break;
      case 'subscribe':
        this.subscribeClient(clientId, data);
        break;
      case 'ping':
        this.handlePing(clientId);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private authenticateClient(clientId: string, data: any): void {
    // In production, validate the auth token here
    const client = this.clients.get(clientId);
    if (client) {
      client.userId = data.userId;
      client.organizationId = data.organizationId;
      client.lastPing = Date.now();

      client.ws.send(JSON.stringify({
        type: 'auth_success',
        message: 'Authentication successful'
      }));
    }
  }

  private subscribeClient(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Send initial metrics
    this.sendMetricsToClient(client);
  }

  private handlePing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
      client.ws.send(JSON.stringify({
        type: 'pong',
        timestamp: Date.now()
      }));
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startMetricsBroadcast(): void {
    this.metricsInterval = setInterval(() => {
      this.broadcastMetrics();
    }, 5000); // Every 5 seconds
  }

  private startPingCheck(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 1 minute timeout

      for (const [clientId, client] of Array.from(this.clients.entries())) {
        if (now - client.lastPing > timeout) {
          console.log(`Client ${clientId} timed out, removing...`);
          client.ws.close();
          this.clients.delete(clientId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private async broadcastMetrics(): Promise<void> {
    if (this.clients.size === 0) return;

    try {
      // Group clients by organization
      const orgClients = new Map<string, DashboardClient[]>();
      
      for (const client of Array.from(this.clients.values())) {
        if (!client.organizationId) continue;
        
        if (!orgClients.has(client.organizationId)) {
          orgClients.set(client.organizationId, []);
        }
        orgClients.get(client.organizationId)!.push(client);
      }

      // Send metrics to each organization's clients
      for (const [orgId, clients] of Array.from(orgClients.entries())) {
        const metrics = await this.generateMetrics(orgId);
        const timeSeriesData = this.generateTimeSeriesData();

        clients.forEach(client => {
          if (client.ws.readyState === WebSocket.OPEN) {
            // Send current metrics
            client.ws.send(JSON.stringify({
              type: 'metrics',
              metrics,
              timestamp: new Date().toISOString()
            }));

            // Send time series data
            client.ws.send(JSON.stringify({
              type: 'timeseries',
              data: timeSeriesData,
              timestamp: new Date().toISOString()
            }));
          }
        });
      }
    } catch (error) {
      console.error('Error broadcasting metrics:', error);
    }
  }

  private async sendMetricsToClient(client: DashboardClient): Promise<void> {
    try {
      const metrics = await this.generateMetrics(client.organizationId);
      
      client.ws.send(JSON.stringify({
        type: 'metrics',
        metrics,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending metrics to client:', error);
    }
  }

  private async generateMetrics(organizationId: string): Promise<any> {
    // In production, get real metrics from your data store
    const alerts = await this.getAlertCounts(organizationId);

    return {
      requests: {
        total: Math.floor(Math.random() * 10000) + 5000,
        rate: Math.floor(Math.random() * 100) + 50,
        success: Math.floor(Math.random() * 8000) + 4000,
        blocked: Math.floor(Math.random() * 500) + 100,
        errors: Math.floor(Math.random() * 200) + 50
      },
      latency: {
        avg: Math.floor(Math.random() * 300) + 100,
        p95: Math.floor(Math.random() * 800) + 400,
        p99: Math.floor(Math.random() * 1500) + 800
      },
      evaluations: {
        total: Math.floor(Math.random() * 5000) + 2000,
        violations: Math.floor(Math.random() * 200) + 50,
        rate: Math.floor(Math.random() * 20) + 5
      },
      system: {
        cpu: Math.floor(Math.random() * 60) + 20,
        memory: Math.floor(Math.random() * 50) + 30,
        connections: this.clients.size,
        queueSize: Math.floor(Math.random() * 50) + 10
      },
      alerts
    };
  }

  private generateTimeSeriesData(): any {
    const now = Date.now();
    return {
      requests: {
        timestamp: now,
        value: Math.floor(Math.random() * 200) + 50
      },
      latency: {
        timestamp: now,
        value: Math.floor(Math.random() * 500) + 100
      },
      violations: {
        timestamp: now,
        value: Math.floor(Math.random() * 10) + 1
      },
      cpu: {
        timestamp: now,
        value: Math.floor(Math.random() * 60) + 20
      }
    };
  }

  private async getAlertCounts(organizationId: string): Promise<any> {
    try {
      const alerts = await alertingService.getAlerts(organizationId, { resolved: false });
      
      const counts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };

      alerts.forEach(alert => {
        if (alert.severity in counts) {
          counts[alert.severity as keyof typeof counts]++;
        }
      });

      return counts;
    } catch (error) {
      console.error('Failed to get alert counts:', error);
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
  }

  public addClient(ws: WebSocket, organizationId: string, userId: string): string {
    const clientId = this.generateClientId();
    
    this.clients.set(clientId, {
      ws,
      organizationId,
      userId,
      lastPing: Date.now()
    });

    return clientId;
  }

  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public close(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    if (this.wss) {
      this.wss.close();
    }

    // Close all client connections
    for (const client of Array.from(this.clients.values())) {
      client.ws.close();
    }
    
    this.clients.clear();
  }
}

// Singleton instance
let dashboardWS: DashboardWebSocketServer | null = null;

export function getDashboardWebSocketServer(): DashboardWebSocketServer {
  if (!dashboardWS) {
    dashboardWS = new DashboardWebSocketServer();
  }
  return dashboardWS;
}

// Initialize WebSocket server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  getDashboardWebSocketServer();
}