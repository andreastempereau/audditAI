#!/usr/bin/env python3
"""
Smoke tests for CrossAudit AI deployment validation.
Tests critical functionality after deployment.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin

import aiohttp
import pytest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SmokeTestRunner:
    """Smoke test runner for deployment validation."""
    
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_results: List[Dict[str, Any]] = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def run_test(self, test_name: str, test_func, *args, **kwargs):
        """Run a single test and record results."""
        start_time = time.time()
        try:
            result = await test_func(*args, **kwargs)
            duration = time.time() - start_time
            
            self.test_results.append({
                "test": test_name,
                "status": "PASS",
                "duration": duration,
                "result": result
            })
            logger.info(f"✅ {test_name} - PASSED ({duration:.2f}s)")
            return True
            
        except Exception as e:
            duration = time.time() - start_time
            
            self.test_results.append({
                "test": test_name,
                "status": "FAIL",
                "duration": duration,
                "error": str(e)
            })
            logger.error(f"❌ {test_name} - FAILED ({duration:.2f}s): {e}")
            return False
    
    async def test_health_endpoint(self):
        """Test basic health endpoint."""
        url = urljoin(self.base_url, "/health")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"Health check failed with status {response.status}")
            
            data = await response.json()
            if data.get("status") != "healthy":
                raise Exception(f"Health check returned unhealthy status: {data}")
            
            return data
    
    async def test_api_health(self):
        """Test API health endpoint."""
        url = urljoin(self.base_url, "/api/health")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"API health check failed with status {response.status}")
            
            data = await response.json()
            return data
    
    async def test_database_connectivity(self):
        """Test database connectivity."""
        url = urljoin(self.base_url, "/api/health/db")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"Database health check failed with status {response.status}")
            
            data = await response.json()
            if not data.get("database_connected"):
                raise Exception("Database is not connected")
            
            return data
    
    async def test_redis_connectivity(self):
        """Test Redis connectivity."""
        url = urljoin(self.base_url, "/api/health/redis")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"Redis health check failed with status {response.status}")
            
            data = await response.json()
            if not data.get("redis_connected"):
                raise Exception("Redis is not connected")
            
            return data
    
    async def test_authentication_endpoint(self):
        """Test authentication endpoint availability."""
        url = urljoin(self.base_url, "/api/auth/health")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"Auth endpoint failed with status {response.status}")
            
            return await response.json()
    
    async def test_rbac_endpoint(self):
        """Test RBAC endpoint availability."""
        url = urljoin(self.base_url, "/api/rbac/health")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"RBAC endpoint failed with status {response.status}")
            
            return await response.json()
    
    async def test_documents_endpoint(self):
        """Test documents endpoint availability."""
        url = urljoin(self.base_url, "/api/documents/health")
        async with self.session.get(url) as response:
            # 404 is acceptable if endpoint doesn't exist yet
            if response.status not in [200, 404]:
                raise Exception(f"Documents endpoint failed with status {response.status}")
            
            if response.status == 200:
                return await response.json()
            return {"status": "endpoint_not_implemented"}
    
    async def test_governance_endpoint(self):
        """Test governance endpoint availability."""
        url = urljoin(self.base_url, "/api/policies/health")
        async with self.session.get(url) as response:
            # 404 is acceptable if endpoint doesn't exist yet
            if response.status not in [200, 404]:
                raise Exception(f"Governance endpoint failed with status {response.status}")
            
            if response.status == 200:
                return await response.json()
            return {"status": "endpoint_not_implemented"}
    
    async def test_metrics_endpoint(self):
        """Test metrics endpoint availability."""
        url = urljoin(self.base_url, "/api/metrics/health")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"Metrics endpoint failed with status {response.status}")
            
            return await response.json()
    
    async def test_openapi_docs(self):
        """Test OpenAPI documentation availability."""
        url = urljoin(self.base_url, "/docs")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"OpenAPI docs failed with status {response.status}")
            
            content = await response.text()
            if "swagger" not in content.lower() and "openapi" not in content.lower():
                raise Exception("OpenAPI docs don't contain expected content")
            
            return {"docs_available": True}
    
    async def test_openapi_json(self):
        """Test OpenAPI JSON specification."""
        url = urljoin(self.base_url, "/openapi.json")
        async with self.session.get(url) as response:
            if response.status != 200:
                raise Exception(f"OpenAPI JSON failed with status {response.status}")
            
            data = await response.json()
            if "openapi" not in data or "paths" not in data:
                raise Exception("Invalid OpenAPI specification")
            
            return {"openapi_version": data.get("openapi"), "paths_count": len(data.get("paths", {}))}
    
    async def test_cors_headers(self):
        """Test CORS headers are present."""
        url = urljoin(self.base_url, "/api/health")
        async with self.session.options(url) as response:
            headers = response.headers
            
            cors_headers = [
                "Access-Control-Allow-Origin",
                "Access-Control-Allow-Methods",
                "Access-Control-Allow-Headers"
            ]
            
            missing_headers = [h for h in cors_headers if h not in headers]
            if missing_headers:
                logger.warning(f"Missing CORS headers: {missing_headers}")
            
            return {"cors_headers_present": len(missing_headers) == 0}
    
    async def test_response_time(self):
        """Test API response time is acceptable."""
        url = urljoin(self.base_url, "/api/health")
        
        response_times = []
        for i in range(5):
            start_time = time.time()
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"Health check failed on attempt {i+1}")
            duration = time.time() - start_time
            response_times.append(duration)
        
        avg_response_time = sum(response_times) / len(response_times)
        max_response_time = max(response_times)
        
        if avg_response_time > 2.0:  # 2 second threshold
            raise Exception(f"Average response time too high: {avg_response_time:.2f}s")
        
        if max_response_time > 5.0:  # 5 second max threshold
            raise Exception(f"Max response time too high: {max_response_time:.2f}s")
        
        return {
            "avg_response_time": avg_response_time,
            "max_response_time": max_response_time,
            "response_times": response_times
        }
    
    async def run_all_tests(self):
        """Run all smoke tests."""
        logger.info(f"Starting smoke tests for {self.base_url}")
        
        tests = [
            ("Health Endpoint", self.test_health_endpoint),
            ("API Health", self.test_api_health),
            ("Database Connectivity", self.test_database_connectivity),
            ("Redis Connectivity", self.test_redis_connectivity),
            ("Authentication Endpoint", self.test_authentication_endpoint),
            ("RBAC Endpoint", self.test_rbac_endpoint),
            ("Documents Endpoint", self.test_documents_endpoint),
            ("Governance Endpoint", self.test_governance_endpoint),
            ("Metrics Endpoint", self.test_metrics_endpoint),
            ("OpenAPI Documentation", self.test_openapi_docs),
            ("OpenAPI JSON", self.test_openapi_json),
            ("CORS Headers", self.test_cors_headers),
            ("Response Time", self.test_response_time),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            success = await self.run_test(test_name, test_func)
            if success:
                passed += 1
            else:
                failed += 1
        
        # Generate summary
        total_tests = passed + failed
        success_rate = (passed / total_tests) * 100 if total_tests > 0 else 0
        
        logger.info(f"\n{'='*50}")
        logger.info(f"SMOKE TEST SUMMARY")
        logger.info(f"{'='*50}")
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Success Rate: {success_rate:.1f}%")
        
        if failed > 0:
            logger.error(f"\n❌ {failed} tests failed. Deployment validation FAILED.")
            return False
        else:
            logger.info(f"\n✅ All tests passed. Deployment validation SUCCESSFUL.")
            return True
    
    def save_results(self, output_file: str):
        """Save test results to JSON file."""
        with open(output_file, 'w') as f:
            json.dump({
                "base_url": self.base_url,
                "timestamp": time.time(),
                "test_results": self.test_results
            }, f, indent=2)
        
        logger.info(f"Test results saved to {output_file}")


async def main():
    """Main function to run smoke tests."""
    parser = argparse.ArgumentParser(description="Run smoke tests for CrossAudit AI deployment")
    parser.add_argument("--environment", required=True, choices=["staging", "production"], 
                       help="Environment to test")
    parser.add_argument("--base-url", help="Base URL to test (overrides environment detection)")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    parser.add_argument("--output", default="smoke_test_results.json", help="Output file for results")
    parser.add_argument("--wait-for-deployment", type=int, default=0, 
                       help="Wait time in seconds before starting tests")
    
    args = parser.parse_args()
    
    # Determine base URL
    if args.base_url:
        base_url = args.base_url
    else:
        # Environment-specific URLs (would be configured based on deployment)
        env_urls = {
            "staging": os.getenv("STAGING_URL", "https://staging.crossaudit.ai"),
            "production": os.getenv("PRODUCTION_URL", "https://crossaudit.ai")
        }
        base_url = env_urls.get(args.environment)
        
        if not base_url:
            logger.error(f"No URL configured for environment: {args.environment}")
            sys.exit(1)
    
    # Wait for deployment if specified
    if args.wait_for_deployment > 0:
        logger.info(f"Waiting {args.wait_for_deployment} seconds for deployment to stabilize...")
        await asyncio.sleep(args.wait_for_deployment)
    
    # Run smoke tests
    async with SmokeTestRunner(base_url, args.timeout) as runner:
        success = await runner.run_all_tests()
        runner.save_results(args.output)
        
        if not success:
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())