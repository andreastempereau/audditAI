import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { documentVersioningService } from '@/lib/document-versioning';

// GET /api/documents/versions?documentId=xxx - Get document version history
export const GET = withPermission('documents.read')(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const history = await documentVersioningService.getDocumentHistory(documentId);

    return NextResponse.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('Get document versions error:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch document versions' }, { status: 500 });
  }
});

// POST /api/documents/versions - Create new document version
export const POST = withPermission('documents.upload')(async (request) => {
  try {
    const body = await request.json();
    const { documentId, content, metadata, changeDescription } = body;
    const userId = (request as any).user?.id;
    const organizationId = (request as any).user?.organizationId;

    if (!documentId || !content || !userId || !organizationId) {
      return NextResponse.json({ 
        error: 'Document ID, content, user ID, and organization ID are required' 
      }, { status: 400 });
    }

    let version;
    
    // Check if document exists
    try {
      const currentVersion = await documentVersioningService.getCurrentVersion(documentId);
      if (currentVersion) {
        // Update existing document
        version = await documentVersioningService.updateDocument(
          documentId,
          content,
          metadata || {},
          userId,
          organizationId,
          changeDescription
        );
      } else {
        // Create new document
        version = await documentVersioningService.createDocument(
          documentId,
          content,
          metadata || { filename: `document-${documentId}`, customFields: {} },
          userId,
          organizationId
        );
      }
    } catch (error) {
      // Document doesn't exist, create new one
      version = await documentVersioningService.createDocument(
        documentId,
        content,
        metadata || { filename: `document-${documentId}`, customFields: {} },
        userId,
        organizationId
      );
    }

    return NextResponse.json({
      success: true,
      version
    }, { status: 201 });

  } catch (error) {
    console.error('Create document version error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create document version' 
    }, { status: 500 });
  }
});