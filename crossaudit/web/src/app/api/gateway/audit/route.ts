import { NextRequest, NextResponse } from 'next/server';
import { AuditLogger } from '@/audit/logger';

const auditLogger = new AuditLogger();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const requestId = searchParams.get('requestId');
    const type = searchParams.get('type');
    const limit = searchParams.get('limit');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId parameter is required' },
        { status: 400 }
      );
    }

    const options: any = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (requestId) options.requestId = requestId;
    if (type) options.type = type;
    if (limit) options.limit = parseInt(limit);

    const auditTrail = await auditLogger.getAuditTrail(clientId, options);
    
    return NextResponse.json({
      auditTrail,
      count: auditTrail.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Audit trail API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve audit trail',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, clientId, ...params } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'getStatistics':
        const stats = await auditLogger.getAuditStatistics(clientId);
        return NextResponse.json(stats);

      case 'search':
        const { query } = params;
        if (!query) {
          return NextResponse.json(
            { error: 'query parameter is required for search' },
            { status: 400 }
          );
        }
        
        const searchResults = await auditLogger.searchAuditLogs(clientId, query);
        return NextResponse.json({
          results: searchResults,
          count: searchResults.length
        });

      case 'export':
        const { format = 'json' } = params;
        const exportData = await auditLogger.exportAuditTrail(clientId, format);
        
        const contentType = format === 'csv' 
          ? 'text/csv' 
          : 'application/json';
        
        return new NextResponse(exportData, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="audit-trail-${clientId}.${format}"`
          }
        });

      case 'verify':
        const verification = auditLogger.getChainVerificationStatus();
        return NextResponse.json({
          chainVerified: verification,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Audit action API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute audit action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}