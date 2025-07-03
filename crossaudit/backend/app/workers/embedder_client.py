"""gRPC client for embedder service."""

import asyncio
import logging
from typing import List, Optional
import grpc

# Import generated protobuf classes
try:
    from . import embedder_pb2
    from . import embedder_pb2_grpc
    GRPC_AVAILABLE = True
except ImportError:
    GRPC_AVAILABLE = False

logger = logging.getLogger(__name__)


class EmbedderClient:
    """Client for the embedder gRPC service."""
    
    def __init__(self, server_address: str = "localhost:50051"):
        self.server_address = server_address
        self.channel = None
        self.stub = None
    
    async def connect(self):
        """Connect to embedder service."""
        if not GRPC_AVAILABLE:
            logger.warning("gRPC not available, using mock embeddings")
            return
        
        try:
            self.channel = grpc.aio.insecure_channel(self.server_address)
            self.stub = embedder_pb2_grpc.EmbedderServiceStub(self.channel)
            
            # Test connection
            await self.stub.Health(embedder_pb2.HealthRequest())
            logger.info(f"Connected to embedder service at {self.server_address}")
            
        except Exception as e:
            logger.error(f"Failed to connect to embedder service: {str(e)}")
            self.channel = None
            self.stub = None
    
    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """Get embedding for text."""
        if not text.strip():
            return None
        
        # Connect if not already connected
        if not self.channel and GRPC_AVAILABLE:
            await self.connect()
        
        # Use gRPC service if available
        if self.stub:
            try:
                request = embedder_pb2.EmbedRequest(text=text)
                response = await self.stub.GetEmbedding(request)
                return list(response.embedding)
            except Exception as e:
                logger.error(f"gRPC embedding failed: {str(e)}")
                # Fall back to mock
        
        # Mock embedding for development/testing
        return self._mock_embedding(text)
    
    async def get_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Get embeddings for multiple texts."""
        if not texts:
            return []
        
        # Connect if not already connected
        if not self.channel and GRPC_AVAILABLE:
            await self.connect()
        
        # Use gRPC service if available
        if self.stub:
            try:
                request = embedder_pb2.BatchEmbedRequest(texts=texts)
                response = await self.stub.GetEmbeddingsBatch(request)
                return [list(emb.embedding) for emb in response.embeddings]
            except Exception as e:
                logger.error(f"gRPC batch embedding failed: {str(e)}")
                # Fall back to mock
        
        # Mock embeddings for development/testing
        return [self._mock_embedding(text) for text in texts]
    
    def _mock_embedding(self, text: str) -> List[float]:
        """Generate mock embedding for development."""
        import random
        import hashlib
        
        # Use text hash as seed for consistent embeddings
        text_hash = hashlib.md5(text.encode()).hexdigest()
        seed = int(text_hash[:8], 16)
        random.seed(seed)
        
        # Generate 384-dimensional embedding (matching e5-small-v2)
        embedding = [random.uniform(-1.0, 1.0) for _ in range(384)]
        
        # Normalize to unit vector
        magnitude = sum(x * x for x in embedding) ** 0.5
        if magnitude > 0:
            embedding = [x / magnitude for x in embedding]
        
        return embedding
    
    async def close(self):
        """Close connection to embedder service."""
        if self.channel:
            await self.channel.close()
            self.channel = None
            self.stub = None