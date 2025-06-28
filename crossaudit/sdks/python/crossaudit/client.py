"""
CrossAudit Python SDK - Synchronous Client
"""

import json
import time
from typing import Dict, List, Optional, Union, Iterator
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .models import (
    LLMRequest,
    LLMResponse,
    EvaluationResult,
    PolicyViolation,
    DocumentUpload,
    AuditLog,
    APIError,
    ConfigurationError,
    AuthenticationError
)


class CrossAuditClient:
    """
    Synchronous client for CrossAudit AI Governance Gateway.
    
    This client provides a Python interface to interact with the CrossAudit
    gateway for AI governance, policy enforcement, and audit logging.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.crossaudit.ai",
        timeout: int = 30,
        max_retries: int = 3,
        organization_id: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        """
        Initialize the CrossAudit client.

        Args:
            api_key: Your CrossAudit API key
            base_url: Base URL for the CrossAudit API
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            organization_id: Optional organization ID
            user_id: Optional user ID for audit tracking
        """
        if not api_key:
            raise ConfigurationError("API key is required")

        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.organization_id = organization_id
        self.user_id = user_id

        # Configure session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            status_forcelist=[429, 500, 502, 503, 504],
            method_whitelist=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Set default headers
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"crossaudit-python/1.0.0"
        })

        if organization_id:
            self.session.headers["X-Organization-ID"] = organization_id
        if user_id:
            self.session.headers["X-User-ID"] = user_id

    def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        stream: bool = False
    ) -> Union[Dict, Iterator[str]]:
        """Make an HTTP request to the CrossAudit API."""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                timeout=self.timeout,
                stream=stream
            )
            
            if response.status_code == 401:
                raise AuthenticationError("Invalid API key or unauthorized access")
            elif response.status_code == 403:
                raise AuthenticationError("Insufficient permissions")
            elif response.status_code >= 400:
                try:
                    error_data = response.json()
                    raise APIError(
                        message=error_data.get('error', 'Unknown error'),
                        status_code=response.status_code,
                        details=error_data
                    )
                except json.JSONDecodeError:
                    raise APIError(
                        message=f"HTTP {response.status_code}: {response.text}",
                        status_code=response.status_code
                    )

            if stream:
                return self._handle_stream_response(response)
            else:
                return response.json()

        except requests.exceptions.Timeout:
            raise APIError("Request timeout")
        except requests.exceptions.ConnectionError:
            raise APIError("Connection error")
        except requests.exceptions.RequestException as e:
            raise APIError(f"Request failed: {str(e)}")

    def _handle_stream_response(self, response: requests.Response) -> Iterator[str]:
        """Handle streaming response from the API."""
        try:
            for line in response.iter_lines(decode_unicode=True):
                if line and line.startswith('data: '):
                    data = line[6:]  # Remove 'data: ' prefix
                    if data.strip() == '[DONE]':
                        break
                    yield data
        except Exception as e:
            raise APIError(f"Stream processing error: {str(e)}")

    def evaluate_llm_request(
        self,
        request: LLMRequest,
        stream: bool = False
    ) -> Union[LLMResponse, Iterator[str]]:
        """
        Send an LLM request through CrossAudit for evaluation and policy enforcement.

        Args:
            request: The LLM request to evaluate
            stream: Whether to stream the response

        Returns:
            LLM response with evaluation results or stream iterator
        """
        data = {
            "prompt": request.prompt,
            "model": request.model,
            "provider": request.provider,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "metadata": request.metadata,
            "stream": stream
        }

        if stream:
            return self._make_request("POST", "/api/gateway/evaluate", data=data, stream=True)
        else:
            response_data = self._make_request("POST", "/api/gateway/evaluate", data=data)
            return LLMResponse.from_dict(response_data)

    def upload_document(
        self,
        file_path: str,
        filename: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> DocumentUpload:
        """
        Upload a document for processing and context augmentation.

        Args:
            file_path: Path to the file to upload
            filename: Optional custom filename
            metadata: Optional document metadata

        Returns:
            Document upload result
        """
        import os
        from pathlib import Path

        if not os.path.exists(file_path):
            raise ConfigurationError(f"File not found: {file_path}")

        file_name = filename or Path(file_path).name
        
        # For file uploads, we need to use multipart/form-data
        with open(file_path, 'rb') as f:
            files = {'file': (file_name, f)}
            data = {'metadata': json.dumps(metadata or {})}
            
            # Temporarily remove Content-Type header for multipart upload
            headers = dict(self.session.headers)
            headers.pop('Content-Type', None)
            
            response = requests.post(
                f"{self.base_url}/api/documents/process",
                files=files,
                data=data,
                headers=headers,
                timeout=self.timeout
            )

            if response.status_code >= 400:
                raise APIError(f"Upload failed: {response.text}")

            response_data = response.json()
            return DocumentUpload.from_dict(response_data)

    def get_audit_logs(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLog]:
        """
        Retrieve audit logs for the organization.

        Args:
            start_date: Start date filter (ISO format)
            end_date: End date filter (ISO format)  
            user_id: Filter by specific user
            limit: Maximum number of logs to return
            offset: Offset for pagination

        Returns:
            List of audit logs
        """
        params = {
            "limit": limit,
            "offset": offset
        }
        
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        if user_id:
            params["user_id"] = user_id

        response_data = self._make_request("GET", "/api/audit/logs", params=params)
        return [AuditLog.from_dict(log) for log in response_data.get('logs', [])]

    def get_policy_violations(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100
    ) -> List[PolicyViolation]:
        """
        Retrieve policy violations for the organization.

        Args:
            start_date: Start date filter (ISO format)
            end_date: End date filter (ISO format)
            severity: Filter by violation severity
            limit: Maximum number of violations to return

        Returns:
            List of policy violations
        """
        params = {"limit": limit}
        
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        if severity:
            params["severity"] = severity

        response_data = self._make_request("GET", "/api/audit/violations", params=params)
        return [PolicyViolation.from_dict(v) for v in response_data.get('violations', [])]

    def get_evaluation_result(self, evaluation_id: str) -> EvaluationResult:
        """
        Get detailed evaluation result by ID.

        Args:
            evaluation_id: The evaluation ID to retrieve

        Returns:
            Detailed evaluation result
        """
        response_data = self._make_request("GET", f"/api/evaluations/{evaluation_id}")
        return EvaluationResult.from_dict(response_data)

    def test_policy(
        self,
        prompt: str,
        response: str,
        metadata: Optional[Dict] = None
    ) -> EvaluationResult:
        """
        Test a prompt/response pair against current policies.

        Args:
            prompt: The input prompt
            response: The AI response to test
            metadata: Optional test metadata

        Returns:
            Evaluation result with policy violations
        """
        data = {
            "prompt": prompt,
            "response": response,
            "metadata": metadata or {}
        }

        response_data = self._make_request("POST", "/api/policies/test", data=data)
        return EvaluationResult.from_dict(response_data)

    def get_organization_metrics(self) -> Dict:
        """
        Get organization-level metrics and analytics.

        Returns:
            Metrics and analytics data
        """
        return self._make_request("GET", "/api/analytics/metrics")

    def health_check(self) -> Dict:
        """
        Check the health status of the CrossAudit API.

        Returns:
            Health status information
        """
        return self._make_request("GET", "/api/health")

    def close(self):
        """Close the HTTP session."""
        self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()