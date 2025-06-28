import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { aiGovernanceMetrics } from '@/lib/metrics';
import { alertingService } from '@/lib/alerts';

// GET /api/dashboard/metrics - Get current dashboard metrics
export const GET = withPermission('system.monitor')(async (request) => {
  try {
    const organizationId = request.url.includes('organizationId=') 
      ? new URL(request.url).searchParams.get('organizationId')
      : (request as any).user?.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Simulate getting real-time metrics
    // In production, these would come from your metrics store (Redis, InfluxDB, etc.)
    const metrics = {
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
        connections: Math.floor(Math.random() * 500) + 100,
        queueSize: Math.floor(Math.random() * 50) + 10
      },
      alerts: await getAlertCounts(organizationId)
    };

    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
});

async function getAlertCounts(organizationId: string) {
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