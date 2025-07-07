-- =============================================================================
-- SUPABASE STORAGE SETUP FOR AUSK APPLICATION
-- Run these commands in Supabase Dashboard > SQL Editor
-- =============================================================================

-- 1. Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'documents', 
  'documents', 
  false, 
  104857600, -- 100MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
);

-- 2. Create storage policies for document access
CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND bucket_id = 'documents'
);

CREATE POLICY "Users can view documents in their organization" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' 
  AND bucket_id = 'documents'
);

CREATE POLICY "Users can update their own documents" 
ON storage.objects 
FOR UPDATE 
USING (
  auth.role() = 'authenticated' 
  AND bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[2]  -- User ID is in folder path
);

CREATE POLICY "Users can delete their own documents" 
ON storage.objects 
FOR DELETE 
USING (
  auth.role() = 'authenticated' 
  AND bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[2]  -- User ID is in folder path
);

-- 3. Verify the bucket was created successfully
SELECT * FROM storage.buckets WHERE id = 'documents';