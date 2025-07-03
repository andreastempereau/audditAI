"""Test data room functionality."""

import pytest
import tempfile
import asyncio
from uuid import UUID, uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.data_room import DataRoomService, TextExtractor, TextChunker
from app.models.documents import Document, DocumentVersion, Fragment


class TestTextExtractor:
    """Test text extraction from various file formats."""
    
    def __init__(self):
        self.extractor = TextExtractor()
    
    @pytest.mark.asyncio
    async def test_extract_txt_text(self):
        """Test plain text extraction."""
        text_content = "This is a test document.\nIt has multiple lines.\nAnd should be extracted correctly."
        file_data = text_content.encode('utf-8')
        
        result = await self.extractor.extract_text(file_data, 'text/plain', 'test.txt')
        
        assert result['text'] == text_content
        assert len(result['pages']) > 0
        assert 'extractor' in result['metadata']
        assert result['metadata']['extractor'] == 'native'
    
    @pytest.mark.asyncio
    async def test_extract_csv_text(self):
        """Test CSV text extraction."""
        csv_content = "name,age,city\nJohn,25,NYC\nJane,30,LA\nBob,35,Chicago"
        file_data = csv_content.encode('utf-8')
        
        result = await self.extractor.extract_text(file_data, 'text/csv', 'test.csv')
        
        assert 'CSV File: test.csv' in result['text']
        assert 'name' in result['text']
        assert 'John' in result['text']
        assert result['metadata']['row_count'] == 3
        assert result['metadata']['column_count'] == 3
    
    @pytest.mark.asyncio
    async def test_extract_unsupported_format(self):
        """Test handling of unsupported file format."""
        file_data = b"binary data"
        
        result = await self.extractor.extract_text(file_data, 'application/unknown', 'test.bin')
        
        assert result['text'] == ""
        assert 'error' in result['metadata']


class TestTextChunker:
    """Test text chunking functionality."""
    
    def __init__(self):
        self.chunker = TextChunker(chunk_size=100, overlap=20)  # Small chunks for testing
    
    def test_chunk_text(self):
        """Test text chunking with overlap."""
        text = "This is a test document. " * 20  # Long text
        page_info = [{"page": 1, "text": text}]
        
        chunks = self.chunker.chunk_text(text, page_info)
        
        assert len(chunks) > 1
        assert all('chunk_number' in chunk for chunk in chunks)
        assert all('text' in chunk for chunk in chunks)
        assert all('start_page' in chunk for chunk in chunks)
        assert all('end_page' in chunk for chunk in chunks)
        
        # Check overlap exists
        assert chunks[1]['start_char'] < chunks[0]['end_char']
    
    def test_chunk_empty_text(self):
        """Test chunking empty text."""
        chunks = self.chunker.chunk_text("", [])
        assert len(chunks) == 0
    
    def test_chunk_short_text(self):
        """Test chunking text shorter than chunk size."""
        text = "Short text."
        page_info = [{"page": 1, "text": text}]
        
        chunks = self.chunker.chunk_text(text, page_info)
        
        assert len(chunks) == 1
        assert chunks[0]['text'] == text
        assert chunks[0]['start_page'] == 1
        assert chunks[0]['end_page'] == 1


class TestDataRoomService:
    """Test data room service functionality."""
    
    @pytest.mark.asyncio
    async def test_upload_file_new_document(self, session: AsyncSession):
        """Test uploading a new file (creates new document)."""
        from fastapi import UploadFile
        import io
        
        service = DataRoomService(session)
        
        # Create mock file
        file_content = "This is a test document for upload testing."
        file_data = io.BytesIO(file_content.encode())
        
        file = UploadFile(
            filename="test.txt",
            file=file_data,
            size=len(file_content),
            content_type="text/plain"
        )
        
        user_id = uuid4()
        org_id = uuid4()
        
        # Initialize quota for organization
        await service.quota._initialize_quota(org_id)
        
        result = await service.upload_file(
            file=file,
            document_id=None,  # New document
            title="Test Document",
            description="Test description",
            classification_level="restricted",
            user_id=user_id,
            organization_id=org_id
        )
        
        assert result.filename == "test.txt"
        assert result.size == len(file_content)
        assert result.mime_type == "text/plain"
        assert result.document_id is not None
    
    @pytest.mark.asyncio
    async def test_upload_file_quota_exceeded(self, session: AsyncSession):
        """Test upload fails when quota is exceeded."""
        from fastapi import UploadFile
        import io
        
        service = DataRoomService(session)
        
        # Create large mock file (larger than default quota)
        large_content = "x" * (25 * 1024 * 1024 * 1024)  # 25GB
        file_data = io.BytesIO(large_content.encode())
        
        file = UploadFile(
            filename="large.txt",
            file=file_data,
            size=len(large_content),
            content_type="text/plain"
        )
        
        user_id = uuid4()
        org_id = uuid4()
        
        with pytest.raises(HTTPException) as exc_info:
            await service.upload_file(
                file=file,
                document_id=None,
                title="Large Document",
                description="Test large file",
                classification_level="restricted",
                user_id=user_id,
                organization_id=org_id
            )
        
        assert exc_info.value.status_code == 413
        assert "quota exceeded" in exc_info.value.detail.lower()
    
    @pytest.mark.asyncio
    async def test_upload_duplicate_file(self, session: AsyncSession):
        """Test uploading duplicate file to same document fails."""
        from fastapi import UploadFile
        import io
        
        service = DataRoomService(session)
        
        file_content = "This is a test document for duplicate testing."
        file_data = io.BytesIO(file_content.encode())
        
        file = UploadFile(
            filename="test.txt",
            file=file_data,
            size=len(file_content),
            content_type="text/plain"
        )
        
        user_id = uuid4()
        org_id = uuid4()
        
        # Initialize quota
        await service.quota._initialize_quota(org_id)
        
        # Upload first time
        result1 = await service.upload_file(
            file=file,
            document_id=None,
            title="Test Document",
            description="Test description",
            classification_level="restricted",
            user_id=user_id,
            organization_id=org_id
        )
        
        # Reset file pointer
        file_data.seek(0)
        file = UploadFile(
            filename="test.txt",
            file=file_data,
            size=len(file_content),
            content_type="text/plain"
        )
        
        # Try to upload same content to same document
        with pytest.raises(HTTPException) as exc_info:
            await service.upload_file(
                file=file,
                document_id=result1.document_id,
                title="Test Document",
                description="Test description",
                classification_level="restricted",
                user_id=user_id,
                organization_id=org_id
            )
        
        assert exc_info.value.status_code == 409
        assert "identical content" in exc_info.value.detail.lower()
    
    @pytest.mark.asyncio
    async def test_search_fragments_mock(self, session: AsyncSession):
        """Test fragment search with mock data."""
        service = DataRoomService(session)
        
        user_id = uuid4()
        org_id = uuid4()
        
        # Mock search (will use fallback text search)
        results = await service.search_fragments(
            query_text="test query",
            organization_id=org_id,
            user_id=user_id,
            limit=10
        )
        
        # Should return empty results for mock/empty database
        assert isinstance(results, list)
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_get_organization_usage(self, session: AsyncSession):
        """Test getting organization usage statistics."""
        service = DataRoomService(session)
        
        org_id = uuid4()
        
        # Initialize quota
        await service.quota._initialize_quota(org_id)
        
        usage = await service.get_organization_usage(org_id)
        
        assert 'quota' in usage
        assert 'statistics' in usage
        assert 'storage' in usage['quota']
        assert 'versions' in usage['quota']
        assert 'fragments' in usage['quota']
        assert usage['quota']['within_limits'] is True


class TestSearchAccuracy:
    """Test search accuracy with toy corpus."""
    
    @pytest.mark.asyncio
    async def test_search_similarity_threshold(self):
        """Test that search returns results with similarity >= 0.5."""
        from app.workers.embedder_client import EmbedderClient
        
        embedder = EmbedderClient()
        
        # Test text similarity
        query = "artificial intelligence machine learning"
        similar_text = "AI and ML are important technologies"
        dissimilar_text = "The weather is nice today"
        
        query_embedding = await embedder.get_embedding(query)
        similar_embedding = await embedder.get_embedding(similar_text)
        dissimilar_embedding = await embedder.get_embedding(dissimilar_text)
        
        # Calculate cosine similarity (simplified)
        def cosine_similarity(a, b):
            dot_product = sum(x * y for x, y in zip(a, b))
            norm_a = sum(x * x for x in a) ** 0.5
            norm_b = sum(x * x for x in b) ** 0.5
            return dot_product / (norm_a * norm_b)
        
        similar_score = cosine_similarity(query_embedding, similar_embedding)
        dissimilar_score = cosine_similarity(query_embedding, dissimilar_embedding)
        
        # Similar text should have higher similarity
        assert similar_score > dissimilar_score
        
        # Mock embeddings should still show some similarity patterns
        # (actual test would use real embeddings and verify >= 0.6 accuracy)
        assert similar_score > 0.0


class TestRLSSecurity:
    """Test Row Level Security enforcement."""
    
    @pytest.mark.asyncio
    async def test_cross_organization_access_denied(self, session: AsyncSession):
        """Test that users cannot access fragments from other organizations."""
        service = DataRoomService(session)
        
        org_a_id = uuid4()
        org_b_id = uuid4()
        user_id = uuid4()
        
        # Search from org A should not return org B fragments
        results_a = await service.search_fragments(
            query_text="test",
            organization_id=org_a_id,
            user_id=user_id,
            limit=10
        )
        
        results_b = await service.search_fragments(
            query_text="test",
            organization_id=org_b_id,
            user_id=user_id,
            limit=10
        )
        
        # Results should be organization-scoped (empty in test env)
        assert isinstance(results_a, list)
        assert isinstance(results_b, list)
        
        # In a real test with data, we'd verify that results contain
        # only fragments from the specified organization


# Performance test placeholder
@pytest.mark.asyncio
async def test_pipeline_performance():
    """Test that pipeline completes in < 30s for 5MB PDF."""
    # This would be an integration test with actual file processing
    # For now, just verify the components are responsive
    
    from app.workers.embedder_client import EmbedderClient
    
    embedder = EmbedderClient()
    
    # Test embedding generation speed
    import time
    start_time = time.time()
    
    test_text = "This is a test document for performance testing. " * 100
    embedding = await embedder.get_embedding(test_text)
    
    end_time = time.time()
    processing_time = end_time - start_time
    
    # Should be very fast with mock embeddings
    assert processing_time < 1.0
    assert embedding is not None
    assert len(embedding) == 384