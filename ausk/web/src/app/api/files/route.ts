import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

// File upload validation schema
const uploadSchema = z.object({
  sensitivity: z.enum(['public', 'restricted', 'confidential']).optional().default('restricted'),
  expiry: z.string().optional(),
  encrypted: z.string().optional().transform(val => val === 'true'),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // No-op for server-side
          },
          remove(name: string, options: any) {
            // No-op for server-side
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(searchParams.get('perPage') || '20'), 100);
    const sortBy = searchParams.get('sortBy') || 'uploadedAt';
    const sensitivity = searchParams.get('sensitivity');
    const owner = searchParams.get('owner');
    const search = searchParams.get('search');

    // Get user's organization
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Build the query
    let query = supabase
      .from('documents')
      .select(`
        id,
        title,
        file_size,
        mime_type,
        sensitivity_level,
        total_versions,
        created_at,
        updated_at,
        created_by,
        profiles:created_by (name, email)
      `)
      .eq('organization_id', userOrg.organization_id)
      .is('deleted_at', null);

    // Apply filters
    if (sensitivity) {
      query = query.eq('sensitivity_level', sensitivity);
    }
    if (owner) {
      query = query.eq('created_by', owner);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    // Apply sorting and pagination
    const sortColumn = sortBy === 'uploadedAt' ? 'created_at' : 
                      sortBy === 'name' ? 'title' : 'created_at';
    query = query.order(sortColumn, { ascending: false });
    
    const from = (page - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data: documents, error, count } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
    }

    // Transform to match frontend interface
    const transformedFiles = documents?.map(doc => ({
      id: doc.id,
      name: doc.title,
      size: doc.file_size || 0,
      type: doc.mime_type || 'application/octet-stream',
      sensitivity: doc.sensitivity_level,
      owner: (doc.profiles as any)?.name || (doc.profiles as any)?.email || 'Unknown',
      ownerId: doc.created_by,
      encrypted: doc.sensitivity_level !== 'public', // Assume non-public files are encrypted
      versions: doc.total_versions,
      lastModified: doc.updated_at,
      uploadedAt: doc.created_at,
    })) || [];

    return NextResponse.json({
      files: transformedFiles,
      total: count || 0,
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // No-op for server-side
          },
          remove(name: string, options: any) {
            // No-op for server-side
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });
    }

    // Parse additional form data
    const options = uploadSchema.parse({
      sensitivity: formData.get('sensitivity'),
      expiry: formData.get('expiry'),
      encrypted: formData.get('encrypted'),
    });

    // Get user's organization
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    console.log('File upload request:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      options,
      userId: user.id,
      organizationId: userOrg.organization_id,
    });

    // Generate file path for storage
    const fileExtension = file.name.split('.').pop() || '';
    const storagePath = `${userOrg.organization_id}/${user.id}/${Date.now()}-${file.name}`;
    
    try {
      // Step 1: Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }

      // Step 2: Calculate file checksum (simplified)
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Step 3: Create document record
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          organization_id: userOrg.organization_id,
          title: file.name,
          description: `Uploaded file: ${file.name}`,
          document_type: file.type.startsWith('image/') ? 'image' : 'document',
          file_size: file.size,
          mime_type: file.type,
          checksum,
          storage_path: storagePath,
          sensitivity_level: options.sensitivity,
          created_by: user.id,
          last_modified_by: user.id,
        })
        .select('*')
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        // Clean up uploaded file
        await supabase.storage.from('documents').remove([storagePath]);
        return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
      }

      // Step 4: Create initial version record
      const { error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: document.id,
          version_number: 1,
          title: file.name,
          content_hash: checksum,
          file_size: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          change_type: 'create',
          change_description: 'Initial upload',
          created_by: user.id,
        });

      if (versionError) {
        console.error('Version creation error:', versionError);
        // Note: We'll keep the document record but log the error
      }

      console.log('File upload completed successfully:', {
        documentId: document.id,
        fileName: file.name,
        userId: user.id,
        storagePath,
      });

      return NextResponse.json({
        fileId: document.id,
        message: 'File uploaded successfully',
        file: {
          id: document.id,
          name: document.title,
          size: document.file_size,
          type: document.mime_type,
          sensitivity: document.sensitivity_level,
          owner: user.user_metadata?.full_name || user.email || 'Unknown',
          ownerId: user.id,
          encrypted: options.encrypted,
          versions: 1,
          lastModified: document.updated_at,
          uploadedAt: document.created_at,
        }
      });
    } catch (error) {
      console.error('File processing error:', error);
      return NextResponse.json(
        { error: 'File processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // No-op for server-side
          },
          remove(name: string, options: any) {
            // No-op for server-side
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse file ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const fileId = pathParts[pathParts.length - 1];

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    console.log('File deletion request:', { fileId, userId: user.id });

    // Get user's organization for permission check
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Check if document exists and user has permission
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, storage_path, created_by, organization_id')
      .eq('id', fileId)
      .eq('organization_id', userOrg.organization_id)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if user owns the document (or is admin - could add role check here)
    if (document.created_by !== user.id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    try {
      // Step 1: Soft delete the document record
      const { error: updateError } = await supabase
        .from('documents')
        .update({ 
          deleted_at: new Date().toISOString(),
          last_modified_by: user.id 
        })
        .eq('id', fileId);

      if (updateError) {
        console.error('Document soft delete error:', updateError);
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
      }

      // Step 2: Delete from storage (optional - could keep for recovery)
      if (document.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.storage_path]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Continue even if storage deletion fails
        }
      }

      console.log('File deleted successfully:', {
        documentId: fileId,
        userId: user.id,
        storagePath: document.storage_path,
      });

      return NextResponse.json({ 
        success: true,
        message: 'File deleted successfully' 
      });
    } catch (error) {
      console.error('File deletion error:', error);
      return NextResponse.json(
        { error: 'File deletion failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}