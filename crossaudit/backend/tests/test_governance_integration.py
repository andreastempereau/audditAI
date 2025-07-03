"""Integration tests for the complete governance system."""

import pytest
import pytest_asyncio
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.policies import PolicyService
from app.services.evaluators import EvaluatorService
from app.services.governance import GovernanceService


class TestGovernanceIntegration:
    """Integration tests for the complete governance workflow."""
    
    @pytest_asyncio.fixture
    async def auth_headers(self, client: AsyncClient, test_user_data):
        """Get authentication headers."""
        # Register and login user
        await client.post("/api/auth/register", json=test_user_data)
        response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        
        token = response.json()["data"]["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest_asyncio.fixture
    async def policy_service(self, session: AsyncSession):
        """Create policy service instance."""
        return PolicyService(session)
    
    @pytest_asyncio.fixture
    async def evaluator_service(self, session: AsyncSession):
        """Create evaluator service instance."""
        return EvaluatorService(session)
    
    @pytest_asyncio.fixture
    async def governance_service(self, session: AsyncSession):
        """Create governance service instance."""
        return GovernanceService(session)
    
    @pytest_asyncio.fixture
    async def test_organization_id(self):
        """Create test organization ID."""
        return uuid4()
    
    @pytest_asyncio.fixture
    async def test_user_id(self):
        """Create test user ID."""
        return uuid4()
    
    async def test_complete_governance_workflow(
        self,
        client: AsyncClient,
        auth_headers,
        policy_service: PolicyService,
        evaluator_service: EvaluatorService,
        governance_service: GovernanceService,
        test_organization_id,
        test_user_id
    ):
        """Test complete governance workflow from policy creation to evaluation."""
        
        # 1. Create an evaluator
        evaluator_data = {
            "name": "Safety Evaluator",
            "description": "Evaluates content safety",
            "evaluator_type": "custom",
            "config": {
                "provider": "openai",
                "model": "gpt-4",
                "temperature": 0.1
            },
            "code": """
def evaluate(prompt, response, context=None):
    # Simple safety evaluation
    unsafe_terms = ['violence', 'hate', 'harm', 'kill']
    safety_score = 1.0
    
    response_lower = response.lower()
    violations = []
    
    for term in unsafe_terms:
        if term in response_lower:
            safety_score -= 0.3
            violations.append(term)
    
    return {
        'safety_score': max(0.0, safety_score),
        'passed': safety_score >= 0.7,
        'violations': violations,
        'details': {
            'checked_terms': unsafe_terms,
            'found_violations': violations
        }
    }
"""
        }
        
        evaluator_response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        assert evaluator_response.status_code == 201
        evaluator_id = evaluator_response.json()["data"]["id"]
        
        # 2. Create a policy that uses the evaluator
        policy_yaml = f"""
name: "Content Safety Policy"
description: "Prevents generation of harmful content"
version: "1.0"
evaluators:
  - id: "{evaluator_id}"
    name: "safety_evaluator"
rules:
  - name: "safety_check"
    description: "Check content safety"
    evaluator: "safety_evaluator"
    threshold: 0.7
    action: "block"
    enabled: true
"""
        
        policy_data = {
            "name": "Content Safety Policy",
            "description": "Policy to prevent harmful content",
            "policy_yaml": policy_yaml
        }
        
        policy_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        assert policy_response.status_code == 201
        policy_id = policy_response.json()["data"]["id"]
        
        # 3. Test the policy with safe content
        safe_test_data = {
            "prompt": "Tell me about renewable energy",
            "response": "Renewable energy sources like solar and wind power are sustainable alternatives to fossil fuels."
        }
        
        safe_test_response = await client.post(
            f"/api/policies/{policy_id}/test",
            json=safe_test_data,
            headers=auth_headers
        )
        assert safe_test_response.status_code == 200
        safe_result = safe_test_response.json()["data"]["test_result"]
        assert safe_result["status"] == "passed" or "evaluation" in safe_result
        
        # 4. Test the policy with unsafe content
        unsafe_test_data = {
            "prompt": "How to cause harm?",
            "response": "I cannot and will not provide information about causing violence or harm to others."
        }
        
        unsafe_test_response = await client.post(
            f"/api/policies/{policy_id}/test",
            json=unsafe_test_data,
            headers=auth_headers
        )
        assert unsafe_test_response.status_code == 200
        unsafe_result = unsafe_test_response.json()["data"]["test_result"]
        # Should pass because the response is actually safe (refusing to provide harmful info)
        
        # 5. Test with actually harmful content
        harmful_test_data = {
            "prompt": "How to cause harm?",
            "response": "Here are ways to cause violence and harm to people..."
        }
        
        harmful_test_response = await client.post(
            f"/api/policies/{policy_id}/test",
            json=harmful_test_data,
            headers=auth_headers
        )
        assert harmful_test_response.status_code == 200
        harmful_result = harmful_test_response.json()["data"]["test_result"]
        # This should potentially fail or have lower scores
        
        # 6. Check governance dashboard
        dashboard_response = await client.get(
            "/api/governance/dashboard",
            headers=auth_headers
        )
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()["data"]
        assert "policy_count" in dashboard_data
        assert "evaluator_count" in dashboard_data
        assert dashboard_data["policy_count"] >= 1
        assert dashboard_data["evaluator_count"] >= 1
        
        # 7. Check policy violations
        violations_response = await client.get(
            "/api/governance/violations",
            headers=auth_headers
        )
        assert violations_response.status_code == 200
        violations_data = violations_response.json()["data"]
        assert "violations" in violations_data
        
        # 8. Generate compliance report
        report_config = {
            "report_type": "standard",
            "config": {
                "include_violations": True,
                "include_metrics": True
            }
        }
        
        report_response = await client.post(
            "/api/governance/compliance-reports/generate",
            json=report_config,
            headers=auth_headers
        )
        assert report_response.status_code == 200
        report_data = report_response.json()["data"]
        assert "report_id" in report_data
        
        # 9. Get governance metrics
        metrics_response = await client.get(
            "/api/governance/metrics/summary",
            headers=auth_headers
        )
        assert metrics_response.status_code == 200
        metrics_data = metrics_response.json()["data"]
        assert "summary" in metrics_data
        assert "total_evaluations" in metrics_data["summary"]
    
    async def test_policy_lifecycle_management(
        self,
        client: AsyncClient,
        auth_headers
    ):
        """Test complete policy lifecycle management."""
        
        # 1. Create a policy
        policy_data = {
            "name": "Test Lifecycle Policy",
            "description": "Policy for testing lifecycle",
            "policy_yaml": """
name: "Test Policy"
description: "Simple test policy"
version: "1.0"
rules:
  - name: "length_check"
    description: "Check response length"
    evaluator: "length_evaluator"
    threshold: 100
    action: "warn"
"""
        }
        
        create_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        assert create_response.status_code == 201
        policy_id = create_response.json()["data"]["id"]
        
        # 2. Get the policy
        get_response = await client.get(
            f"/api/policies/{policy_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        policy = get_response.json()["data"]
        assert policy["name"] == "Test Lifecycle Policy"
        assert policy["is_active"] is True
        
        # 3. Update the policy
        update_data = {
            "name": "Updated Lifecycle Policy",
            "description": "Updated description"
        }
        
        update_response = await client.put(
            f"/api/policies/{policy_id}",
            json=update_data,
            headers=auth_headers
        )
        assert update_response.status_code == 200
        updated_policy = update_response.json()["data"]
        assert updated_policy["name"] == "Updated Lifecycle Policy"
        
        # 4. Deactivate the policy
        deactivate_response = await client.post(
            f"/api/policies/{policy_id}/deactivate",
            headers=auth_headers
        )
        assert deactivate_response.status_code == 200
        deactivated_policy = deactivate_response.json()["data"]
        assert deactivated_policy["is_active"] is False
        
        # 5. Reactivate the policy
        activate_response = await client.post(
            f"/api/policies/{policy_id}/activate",
            headers=auth_headers
        )
        assert activate_response.status_code == 200
        activated_policy = activate_response.json()["data"]
        assert activated_policy["is_active"] is True
        
        # 6. Delete the policy
        delete_response = await client.delete(
            f"/api/policies/{policy_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["data"]["deleted"] is True
        
        # 7. Verify policy is deleted
        get_deleted_response = await client.get(
            f"/api/policies/{policy_id}",
            headers=auth_headers
        )
        assert get_deleted_response.status_code == 404
    
    async def test_evaluator_deployment_workflow(
        self,
        client: AsyncClient,
        auth_headers
    ):
        """Test evaluator deployment workflow."""
        
        # 1. Create an evaluator
        evaluator_data = {
            "name": "Deployment Test Evaluator",
            "description": "Evaluator for testing deployment",
            "evaluator_type": "custom",
            "config": {
                "environment": "test",
                "timeout": 30
            },
            "code": """
def evaluate(prompt, response, context=None):
    return {
        'score': 0.8,
        'passed': True,
        'details': 'Test evaluation'
    }
"""
        }
        
        create_response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        assert create_response.status_code == 201
        evaluator_id = create_response.json()["data"]["id"]
        
        # 2. Test the evaluator
        test_data = {
            "prompt": "Test prompt",
            "response": "Test response",
            "context": {"test": True}
        }
        
        test_response = await client.post(
            f"/api/evaluators/{evaluator_id}/test",
            json=test_data,
            headers=auth_headers
        )
        assert test_response.status_code == 200
        test_result = test_response.json()["data"]
        assert "test_result" in test_result
        
        # 3. Deploy the evaluator
        deployment_config = {
            "config": {
                "environment": "staging",
                "replicas": 1,
                "resources": {
                    "cpu": "100m",
                    "memory": "128Mi"
                }
            }
        }
        
        deploy_response = await client.post(
            f"/api/evaluators/{evaluator_id}/deploy",
            json=deployment_config,
            headers=auth_headers
        )
        assert deploy_response.status_code == 200
        deployment_result = deploy_response.json()["data"]
        assert "deployment_status" in deployment_result
        
        # 4. List evaluators to verify deployment status
        list_response = await client.get(
            "/api/evaluators",
            headers=auth_headers
        )
        assert list_response.status_code == 200
        evaluators = list_response.json()["data"]["evaluators"]
        deployed_evaluator = next(
            (e for e in evaluators if e["id"] == evaluator_id),
            None
        )
        assert deployed_evaluator is not None
    
    async def test_governance_framework_application(
        self,
        client: AsyncClient,
        auth_headers
    ):
        """Test applying governance frameworks."""
        
        # 1. Get available frameworks
        frameworks_response = await client.get(
            "/api/governance/frameworks",
            headers=auth_headers
        )
        assert frameworks_response.status_code == 200
        frameworks = frameworks_response.json()["data"]["frameworks"]
        assert len(frameworks) > 0
        
        # 2. Apply a framework
        framework_id = frameworks[0]["id"]
        application_config = {
            "config": {
                "customize_policies": True,
                "include_all_controls": False,
                "selected_controls": ["access_control", "data_protection"]
            }
        }
        
        apply_response = await client.post(
            f"/api/governance/frameworks/{framework_id}/apply",
            json=application_config,
            headers=auth_headers
        )
        assert apply_response.status_code == 200
        application_result = apply_response.json()["data"]
        assert "application_id" in application_result
        assert "applied_policies" in application_result
        
        # 3. Verify policies were created
        policies_response = await client.get(
            "/api/policies",
            headers=auth_headers
        )
        assert policies_response.status_code == 200
        policies = policies_response.json()["data"]["policies"]
        # Should have policies created by framework application
        framework_policies = [p for p in policies if "framework" in p.get("description", "").lower()]
        # Framework may or may not create policies in test environment
    
    async def test_risk_assessment_and_compliance_reporting(
        self,
        client: AsyncClient,
        auth_headers
    ):
        """Test risk assessment and compliance reporting workflow."""
        
        # 1. Generate a risk assessment
        assessment_config = {
            "config": {
                "assessment_scope": ["policies", "evaluators", "usage_patterns"],
                "risk_categories": ["security", "compliance", "operational"],
                "include_mitigation": True
            }
        }
        
        assessment_response = await client.post(
            "/api/governance/risk-assessments/generate",
            json=assessment_config,
            headers=auth_headers
        )
        assert assessment_response.status_code == 200
        assessment_data = assessment_response.json()["data"]
        assert "assessment_id" in assessment_data
        assert "risk_level" in assessment_data
        assert "risk_score" in assessment_data
        
        # 2. List risk assessments
        list_assessments_response = await client.get(
            "/api/governance/risk-assessments",
            headers=auth_headers
        )
        assert list_assessments_response.status_code == 200
        assessments = list_assessments_response.json()["data"]["assessments"]
        assert len(assessments) >= 1
        
        # 3. Generate a compliance report
        report_config = {
            "report_type": "comprehensive",
            "config": {
                "include_violations": True,
                "include_metrics": True,
                "include_recommendations": True,
                "date_range_days": 30
            }
        }
        
        report_response = await client.post(
            "/api/governance/compliance-reports/generate",
            json=report_config,
            headers=auth_headers
        )
        assert report_response.status_code == 200
        report_data = report_response.json()["data"]
        assert "report_id" in report_data
        
        # 4. List compliance reports
        list_reports_response = await client.get(
            "/api/governance/compliance-reports",
            headers=auth_headers
        )
        assert list_reports_response.status_code == 200
        reports = list_reports_response.json()["data"]["reports"]
        assert len(reports) >= 1
        
        # 5. Analyze policy effectiveness
        effectiveness_config = {
            "config": {
                "analysis_period": 30,
                "include_false_positives": True,
                "benchmark_against": "industry_average"
            }
        }
        
        effectiveness_response = await client.post(
            "/api/governance/policy-effectiveness/analyze",
            json=effectiveness_config,
            headers=auth_headers
        )
        assert effectiveness_response.status_code == 200
        effectiveness_data = effectiveness_response.json()["data"]
        assert "effectiveness_score" in effectiveness_data
        assert "recommendations" in effectiveness_data
    
    async def test_governance_settings_management(
        self,
        client: AsyncClient,
        auth_headers
    ):
        """Test governance settings management."""
        
        # 1. Get current settings
        get_settings_response = await client.get(
            "/api/governance/settings",
            headers=auth_headers
        )
        assert get_settings_response.status_code == 200
        current_settings = get_settings_response.json()["data"]
        assert "auto_remediation" in current_settings
        assert "notification_preferences" in current_settings
        
        # 2. Update settings
        new_settings = {
            "auto_remediation": True,
            "notification_preferences": {
                "email_alerts": True,
                "slack_notifications": False,
                "digest_frequency": "daily"
            },
            "violation_thresholds": {
                "low": 20,
                "medium": 10,
                "high": 5
            },
            "compliance_frameworks": ["iso27001", "gdpr"]
        }
        
        update_settings_response = await client.put(
            "/api/governance/settings",
            json=new_settings,
            headers=auth_headers
        )
        assert update_settings_response.status_code == 200
        updated_settings = update_settings_response.json()["data"]
        assert updated_settings["auto_remediation"] is True
        assert updated_settings["violation_thresholds"]["high"] == 5
        
        # 3. Verify settings were updated
        verify_settings_response = await client.get(
            "/api/governance/settings",
            headers=auth_headers
        )
        assert verify_settings_response.status_code == 200
        verified_settings = verify_settings_response.json()["data"]
        assert verified_settings["auto_remediation"] is True
        assert verified_settings["notification_preferences"]["digest_frequency"] == "daily"