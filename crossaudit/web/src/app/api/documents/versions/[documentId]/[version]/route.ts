import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { documentVersioningService } from '@/lib/document-versioning';

export const dynamic = 'force-dynamic';

// GET /api/documents/versions/[documentId]/[version] - Get specific version
export const GET = withPermission('documents.read')(async (request) => {
  try {
    const pathSegments = request.url.split('/');
    const documentId = pathSegments[pathSegments.length - 2];
    const versionStr = pathSegments[pathSegments.length - 1];
    const version = parseInt(versionStr);

    if (!documentId || isNaN(version)) {
      return NextResponse.json({ 
        error: 'Valid document ID and version number required' 
      }, { status: 400 });
    }

    const versionDoc = await documentVersioningService.getVersion(documentId, version);
    if (!versionDoc) {
      return NextResponse.json({ 
        error: `Version ${version} not found for document ${documentId}` 
      }, { status: 404 });
    }

    // Get content
    const content = await documentVersioningService.getVersionContent(documentId, version);

    return NextResponse.json({
      success: true,
      version: {
        ...versionDoc,
        content // Include decrypted content
      }
    });

  } catch (error) {
    console.error('Get document version error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch document version' 
    }, { status: 500 });
  }
});

// POST /api/documents/versions/[documentId]/[version]/restore - Restore version
export const POST = withPermission('documents.upload')(async (request) => {
  try {
    const pathSegments = request.url.split('/');
    const documentId = pathSegments[pathSegments.length - 3];
    const versionStr = pathSegments[pathSegments.length - 2];
    const version = parseInt(versionStr);
    
    const userId = (request as any).user?.id;
    const organizationId = (request as any).user?.organizationId;

    if (!documentId || isNaN(version) || !userId || !organizationId) {
      return NextResponse.json({ 
        error: 'Valid document ID, version number, user ID, and organization ID required' 
      }, { status: 400 });
    }

    const restoredVersion = await documentVersioningService.restoreVersion(
      documentId,
      version,
      userId,
      organizationId
    );

    return NextResponse.json({
      success: true,
      version: restoredVersion,
      message: `Document restored to version ${version}`
    });

  } catch (error) {
    console.error('Restore document version error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to restore document version' 
    }, { status: 500 });
  }
});