import { NextRequest, NextResponse } from 'next/server';
import { aiGovernanceMetrics } from '@/lib/metrics';

export async function GET(request: NextRequest) {
  try {
    // Basic auth check for metrics endpoint
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== process.env.METRICS_TOKEN) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Export Prometheus metrics
    const metrics = aiGovernanceMetrics.exportPrometheusMetrics();

    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Metrics export error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}