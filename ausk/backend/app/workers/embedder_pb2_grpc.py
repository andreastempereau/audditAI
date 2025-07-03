"""Generated gRPC stub for embedder service."""

# This is a simplified mock of the gRPC generated code
# In production, this would be generated from a .proto file

from . import embedder_pb2

class EmbedderServiceStub:
    """Mock gRPC stub for embedder service."""
    
    def __init__(self, channel):
        self.channel = channel
    
    async def Health(self, request):
        """Health check."""
        return embedder_pb2.HealthResponse()
    
    async def GetEmbedding(self, request):
        """Get single embedding."""
        # Mock embedding generation
        import random
        import hashlib
        
        text_hash = hashlib.md5(request.text.encode()).hexdigest()
        seed = int(text_hash[:8], 16)
        random.seed(seed)
        
        embedding = [random.uniform(-1.0, 1.0) for _ in range(384)]
        magnitude = sum(x * x for x in embedding) ** 0.5
        if magnitude > 0:
            embedding = [x / magnitude for x in embedding]
        
        return embedder_pb2.EmbedResponse(embedding=embedding)
    
    async def GetEmbeddingsBatch(self, request):
        """Get batch embeddings."""
        embeddings = []
        for text in request.texts:
            # Mock embedding generation
            import random
            import hashlib
            
            text_hash = hashlib.md5(text.encode()).hexdigest()
            seed = int(text_hash[:8], 16)
            random.seed(seed)
            
            embedding = [random.uniform(-1.0, 1.0) for _ in range(384)]
            magnitude = sum(x * x for x in embedding) ** 0.5
            if magnitude > 0:
                embedding = [x / magnitude for x in embedding]
            
            embeddings.append(embedder_pb2.EmbedResponse(embedding=embedding))
        
        return embedder_pb2.BatchEmbedResponse(embeddings=embeddings)