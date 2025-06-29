import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { documentVersioningService } from '@/lib/document-versioning';

export const dynamic = 'force-dynamic';

// POST /api/documents/versions/compare - Compare two document versions
export const POST = withPermission('documents.read')(async (request) => {
  try {
    const body = await request.json();
    const { documentId, version1, version2 } = body;

    if (!documentId || !version1 || !version2) {
      return NextResponse.json({ 
        error: 'Document ID and both version numbers are required' 
      }, { status: 400 });
    }

    if (version1 === version2) {
      return NextResponse.json({ 
        error: 'Cannot compare a version with itself' 
      }, { status: 400 });
    }

    const diffs = await documentVersioningService.compareVersions(
      documentId,
      parseInt(version1),
      parseInt(version2)
    );

    // Get version metadata for context
    const [v1Doc, v2Doc] = await Promise.all([
      documentVersioningService.getVersion(documentId, parseInt(version1)),
      documentVersioningService.getVersion(documentId, parseInt(version2))
    ]);

    return NextResponse.json({
      success: true,
      comparison: {
        documentId,
        version1: {
          number: version1,
          metadata: v1Doc ? {
            title: v1Doc.title,
            createdBy: v1Doc.createdBy,
            createdAt: v1Doc.createdAt,
            changeDescription: v1Doc.changeDescription
          } : null
        },
        version2: {
          number: version2,
          metadata: v2Doc ? {
            title: v2Doc.title,
            createdBy: v2Doc.createdBy,
            createdAt: v2Doc.createdAt,
            changeDescription: v2Doc.changeDescription
          } : null
        },
        differences: diffs,
        summary: {
          totalChanges: diffs.length,
          additions: diffs.filter(d => d.type === 'addition').length,
          deletions: diffs.filter(d => d.type === 'deletion').length,
          modifications: diffs.filter(d => d.type === 'modification').length
        }
      }
    });

  } catch (error) {
    console.error('Compare document versions error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to compare document versions' 
    }, { status: 500 });
  }
});