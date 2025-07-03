"""gRPC embedder microservice using Hugging Face e5-small-v2 model."""

import asyncio
import logging
from concurrent import futures
import grpc
from typing import List

# Import protobuf classes
from . import embedder_pb2
from . import embedder_pb2_grpc

# ML libraries
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)


class EmbedderServiceImpl(embedder_pb2_grpc.EmbedderServiceServicer):
    """Implementation of the embedder gRPC service."""
    
    def __init__(self):
        self.model = None
        self.model_name = "intfloat/e5-small-v2"
        self._load_model()
    
    def _load_model(self):
        """Load the sentence transformer model."""
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            logger.warning("sentence-transformers not available, using mock embeddings")
            return
        
        try:
            logger.info(f"Loading model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            
            # Set to evaluation mode and move to appropriate device
            if TORCH_AVAILABLE and torch.cuda.is_available():
                self.model = self.model.cuda()
                logger.info("Model loaded on CUDA")
            else:
                logger.info("Model loaded on CPU")
                
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            self.model = None
    
    async def Health(self, request, context):
        """Health check endpoint."""
        return embedder_pb2.HealthResponse()
    
    async def GetEmbedding(self, request, context):
        """Get embedding for a single text."""
        try:
            text = request.text.strip()
            if not text:
                return embedder_pb2.EmbedResponse(embedding=[])
            
            # Preprocess text for e5 model (add query prefix)
            if not text.startswith("query:"):
                text = f"query: {text}"
            
            embedding = self._generate_embedding(text)
            return embedder_pb2.EmbedResponse(embedding=embedding)
            
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Embedding generation failed: {str(e)}")
            return embedder_pb2.EmbedResponse(embedding=[])
    
    async def GetEmbeddingsBatch(self, request, context):
        """Get embeddings for multiple texts."""
        try:
            texts = [text.strip() for text in request.texts if text.strip()]
            if not texts:
                return embedder_pb2.BatchEmbedResponse(embeddings=[])
            
            # Preprocess texts for e5 model
            processed_texts = []
            for text in texts:
                if not text.startswith("query:"):
                    text = f"query: {text}"
                processed_texts.append(text)
            
            embeddings = self._generate_embeddings_batch(processed_texts)
            
            # Convert to response format
            response_embeddings = [
                embedder_pb2.EmbedResponse(embedding=emb) for emb in embeddings
            ]
            
            return embedder_pb2.BatchEmbedResponse(embeddings=response_embeddings)
            
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Batch embedding generation failed: {str(e)}")
            return embedder_pb2.BatchEmbedResponse(embeddings=[])
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        if self.model:
            try:
                # Generate embedding using sentence-transformers
                embedding = self.model.encode(text, normalize_embeddings=True)
                return embedding.tolist()
            except Exception as e:
                logger.error(f"Model embedding failed: {str(e)}")
        
        # Fallback to mock embedding
        return self._mock_embedding(text)
    
    def _generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        if self.model:
            try:
                # Generate embeddings using sentence-transformers
                embeddings = self.model.encode(texts, normalize_embeddings=True)
                return embeddings.tolist()
            except Exception as e:
                logger.error(f"Model batch embedding failed: {str(e)}")
        
        # Fallback to mock embeddings
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


async def serve():
    """Start the gRPC server."""
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
    embedder_pb2_grpc.add_EmbedderServiceServicer_to_server(
        EmbedderServiceImpl(), server
    )
    
    listen_addr = '[::]:50051'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Starting embedder service on {listen_addr}")
    await server.start()
    
    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down embedder service")
        await server.stop(5)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(serve())