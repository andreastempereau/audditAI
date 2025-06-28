"""
CrossAudit Python SDK - Data Models
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any, Union
from datetime import datetime


class APIError(Exception):
    """Base exception for CrossAudit API errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Dict] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class ConfigurationError(Exception):
    """Exception for configuration errors."""
    pass


class AuthenticationError(APIError):
    """Exception for authentication errors."""
    pass


@dataclass
class LLMRequest:
    """Represents an LLM request to be processed by CrossAudit."""
    
    prompt: str
    model: str = "gpt-3.5-turbo"
    provider: str = "openai"
    max_tokens: Optional[int] = None
    temperature: float = 0.7
    metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LLMRequest':
        """Create instance from dictionary."""
        return cls(**data)


@dataclass
class PolicyViolation:
    """Represents a policy violation detected during evaluation."""
    
    type: str
    severity: str
    message: str
    confidence: float
    location: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[str]] = None
    evidence: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PolicyViolation':
        """Create instance from dictionary."""
        return cls(
            type=data['type'],
            severity=data['severity'],
            message=data['message'],
            confidence=data['confidence'],
            location=data.get('location'),
            suggestions=data.get('suggestions'),
            evidence=data.get('evidence')
        )


@dataclass
class EvaluationResult:
    """Represents the result of policy evaluation."""
    
    evaluation_id: str
    score: float
    action: str
    violations: List[PolicyViolation]
    processing_time: int
    metadata: Dict[str, Any]
    rewritten_content: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EvaluationResult':
        """Create instance from dictionary."""
        violations = [
            PolicyViolation.from_dict(v) for v in data.get('violations', [])
        ]
        
        return cls(
            evaluation_id=data['evaluation_id'],
            score=data['score'],
            action=data['action'],
            violations=violations,
            processing_time=data['processing_time'],
            metadata=data.get('metadata', {}),
            rewritten_content=data.get('rewritten_content')
        )


@dataclass
class LLMResponse:
    """Represents an LLM response from CrossAudit."""
    
    content: str
    model: str
    provider: str
    tokens: int
    evaluation: EvaluationResult
    cached: bool = False
    metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LLMResponse':
        """Create instance from dictionary."""
        evaluation = EvaluationResult.from_dict(data['evaluation'])
        
        return cls(
            content=data['content'],
            model=data['model'],
            provider=data['provider'],
            tokens=data['tokens'],
            evaluation=evaluation,
            cached=data.get('cached', False),
            metadata=data.get('metadata', {})
        )


@dataclass
class DocumentChunk:
    """Represents a chunk of processed document content."""
    
    id: str
    content: str
    metadata: Dict[str, Any]


@dataclass 
class DocumentUpload:
    """Represents the result of a document upload."""
    
    document_id: str
    filename: str
    size: int
    mime_type: str
    chunks: List[DocumentChunk]
    processing_time: int
    metadata: Dict[str, Any]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DocumentUpload':
        """Create instance from dictionary."""
        document_data = data.get('document', {})
        chunks = [
            DocumentChunk(
                id=chunk['id'],
                content=chunk['content'],
                metadata=chunk['metadata']
            ) for chunk in document_data.get('chunks', [])
        ]
        
        return cls(
            document_id=document_data.get('document_id', ''),
            filename=document_data.get('metadata', {}).get('filename', ''),
            size=document_data.get('metadata', {}).get('size', 0),
            mime_type=document_data.get('metadata', {}).get('mimeType', ''),
            chunks=chunks,
            processing_time=document_data.get('processingTime', 0),
            metadata=document_data.get('metadata', {})
        )


@dataclass
class AuditLog:
    """Represents an audit log entry."""
    
    id: str
    timestamp: datetime
    user_id: str
    organization_id: str
    action: str
    resource: str
    details: Dict[str, Any]
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AuditLog':
        """Create instance from dictionary."""
        timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
        
        return cls(
            id=data['id'],
            timestamp=timestamp,
            user_id=data['user_id'],
            organization_id=data['organization_id'],
            action=data['action'],
            resource=data['resource'],
            details=data.get('details', {}),
            ip_address=data.get('ip_address'),
            user_agent=data.get('user_agent')
        )