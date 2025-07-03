"""Generated protocol buffer code for embedder service."""

# This is a simplified mock of the protobuf generated code
# In production, this would be generated from a .proto file

class HealthRequest:
    """Health check request."""
    pass

class HealthResponse:
    """Health check response."""
    def __init__(self):
        self.status = "OK"

class EmbedRequest:
    """Single embedding request."""
    def __init__(self, text=""):
        self.text = text

class EmbedResponse:
    """Single embedding response."""
    def __init__(self, embedding=None):
        self.embedding = embedding or []

class BatchEmbedRequest:
    """Batch embedding request."""
    def __init__(self, texts=None):
        self.texts = texts or []

class BatchEmbedResponse:
    """Batch embedding response."""
    def __init__(self, embeddings=None):
        self.embeddings = embeddings or []