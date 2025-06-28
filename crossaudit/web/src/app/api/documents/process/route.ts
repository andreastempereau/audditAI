import { NextRequest, NextResponse } from 'next/server';
import { documentProcessor } from '@/lib/document-processor';
import { validateAuth } from '@/lib/auth-middleware';
import { aiGovernanceMetrics } from '@/lib/metrics';

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const authResult = await validateAuth(request);
    if (!authResult.authorized) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB' 
      }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Start timer for metrics
    const startTime = Date.now();

    try {
      // Process document
      const result = await documentProcessor.processDocument(
        buffer,
        file.name,
        file.type
      );

      // Record metrics
      const processingTime = Date.now() - startTime;
      aiGovernanceMetrics.recordDocumentProcessed(
        authResult.user?.organizationId || 'unknown',
        result.metadata.mimeType,
        true
      );
      aiGovernanceMetrics.recordDocumentSize(
        authResult.user?.organizationId || 'unknown',
        file.size
      );

      return NextResponse.json({
        success: true,
        document: {
          ...result,
          processingTime
        }
      });

    } catch (processingError) {
      // Record processing failure
      aiGovernanceMetrics.recordDocumentProcessed(
        authResult.user?.organizationId || 'unknown',
        file.type || 'unknown',
        false
      );

      console.error('Document processing failed:', processingError);
      return NextResponse.json({
        error: 'Document processing failed',
        details: processingError instanceof Error ? processingError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const authResult = await validateAuth(request);
    if (!authResult.authorized) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Return supported file types
    const supportedTypes = documentProcessor.getSupportedMimeTypes();
    
    return NextResponse.json({
      supportedMimeTypes: supportedTypes,
      maxFileSize: '10MB',
      features: {
        ocr: true,
        textExtraction: true,
        metadataExtraction: true,
        chunking: true
      }
    });

  } catch (error) {
    console.error('Document info error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}