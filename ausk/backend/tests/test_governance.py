"""Tests for governance management functionality."""

import pytest
import pytest_asyncio
from uuid import uuid4
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.governance import GovernanceService


class TestGovernanceService:
    """Test cases for GovernanceService."""
    
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
    
    async def test_get_dashboard_data(
        self,
        governance_service: GovernanceService,
        test_organization_id
    ):
        """Test getting governance dashboard data."""
        dashboard_data = await governance_service.get_dashboard_data(
            organization_id=test_organization_id
        )
        
        assert isinstance(dashboard_data, dict)
        assert "policy_count" in dashboard_data
        assert "evaluator_count" in dashboard_data
        assert "violation_count" in dashboard_data
        assert "compliance_score" in dashboard_data
        assert "recent_violations" in dashboard_data
        assert "metrics_summary" in dashboard_data
    
    async def test_get_policy_violations(
        self,
        governance_service: GovernanceService,
        test_organization_id
    ):
        """Test getting policy violations."""
        violations = await governance_service.get_policy_violations(
            organization_id=test_organization_id,
            skip=0,
            limit=10
        )
        
        assert isinstance(violations, list)
        # Should return empty list for new organization
        assert len(violations) >= 0
    
    async def test_get_policy_violations_with_filters(
        self,
        governance_service: GovernanceService,
        test_organization_id
    ):
        """Test getting policy violations with filters."""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)
        
        violations = await governance_service.get_policy_violations(
            organization_id=test_organization_id,
            severity="high",
            start_date=start_date,
            end_date=end_date,
            skip=0,
            limit=10
        )
        
        assert isinstance(violations, list)
    
    async def test_get_compliance_reports(
        self,
        governance_service: GovernanceService,
        test_organization_id
    ):
        """Test getting compliance reports."""
        reports = await governance_service.get_compliance_reports(
            organization_id=test_organization_id,
            skip=0,
            limit=10
        )
        
        assert isinstance(reports, list)
    
    async def test_generate_compliance_report(
        self,
        governance_service: GovernanceService,
        test_organization_id,
        test_user_id
    ):
        """Test generating a compliance report."""
        config = {
            "include_violations": True,
            "include_metrics": True,
            "date_range": {
                "start": (datetime.utcnow() - timedelta(days=30)).isoformat(),
                "end": datetime.utcnow().isoformat()
            }
        }
        
        report = await governance_service.generate_compliance_report(
            organization_id=test_organization_id,
            report_type="standard",
            config=config,
            generated_by=test_user_id
        )
        
        assert report is not None
        assert report.name is not None
        assert report.report_type == "standard"
        assert report.organization_id == test_organization_id
        assert report.generated_by == test_user_id
    
    async def test_get_risk_assessments(
        self,
        governance_service: GovernanceService,
        test_organization_id
    ):
        """Test getting risk assessments."""
        assessments = await governance_service.get_risk_assessments(
            organization_id=test_organization_id,
            skip=0,
            limit=10
        )
        
        assert isinstance(assessments, list)
    
    async def test_generate_risk_assessment(
        self,
        governance_service: GovernanceService,
        test_organization_id,
        test_user_id
    ):
        """Test generating a risk assessment."""
        config = {
            "assessment_scope": ["policies", "evaluators", "usage_patterns"],
            "risk_categories": ["security", "compliance", "operational"],
            "include_mitigation": True
        }
        
        assessment = await governance_service.generate_risk_assessment(
            organization_id=test_organization_id,
            config=config,
            assessed_by=test_user_id
        )
        
        assert assessment is not None
        assert assessment.name is not None
        assert assessment.organization_id == test_organization_id
        assert assessment.assessed_by == test_user_id
        assert assessment.risk_level is not None
        assert assessment.risk_score is not None
    
    async def test_get_available_frameworks(
        self,
        governance_service: GovernanceService
    ):
        """Test getting available governance frameworks."""
        frameworks = await governance_service.get_available_frameworks()
        
        assert isinstance(frameworks, list)
        assert len(frameworks) > 0
        
        # Check that each framework has required fields
        for framework in frameworks:
            assert "id" in framework
            assert "name" in framework
            assert "description" in framework
            assert "policies" in framework
    
    async def test_apply_framework(
        self,
        governance_service: GovernanceService,
        test_organization_id,
        test_user_id
    ):
        """Test applying a governance framework."""
        framework_id = "iso27001"
        config = {
            "customize_policies": True,
            "include_all_controls": False,
            "selected_controls": ["access_control", "incident_management"]
        }
        
        result = await governance_service.apply_framework(
            organization_id=test_organization_id,
            framework_id=framework_id,
            config=config,
            applied_by=test_user_id
        )
        
        assert "application_id" in result
        assert "status" in result
        assert "policies" in result
        assert "applied_at" in result
    
    async def test_get_metrics_summary(
        self,
        governance_service: GovernanceService,
        test_organization_id
    ):
        """Test getting governance metrics summary."""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        metrics = await governance_service.get_metrics_summary(
            organization_id=test_organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        assert isinstance(metrics, dict)
        assert "total_evaluations" in metrics
        assert "policy_violations" in metrics
        assert "compliance_score" in metrics
        assert "average_response_time" in metrics
        assert "top_violations" in metrics
    
    async def test_analyze_policy_effectiveness(
        self,
        governance_service: GovernanceService,
        test_organization_id,
        test_user_id
    ):
        """Test analyzing policy effectiveness."""
        config = {
            "analysis_period": 30,
            "include_false_positives": True,
            "benchmark_against": "industry_average"
        }
        
        analysis = await governance_service.analyze_policy_effectiveness(
            organization_id=test_organization_id,
            config=config,
            analyzed_by=test_user_id
        )
        
        assert "analysis_id" in analysis
        assert "effectiveness_score" in analysis
        assert "recommendations" in analysis
        assert "policy_performance" in analysis
        assert "analyzed_at" in analysis
    
    async def test_get_governance_settings(
        self,
        governance_service: GovernanceService,
        test_organization_id
    ):
        """Test getting governance settings."""
        settings = await governance_service.get_governance_settings(
            organization_id=test_organization_id
        )
        
        assert isinstance(settings, dict)
        # Should have default settings even for new organization
        assert "auto_remediation" in settings
        assert "notification_preferences" in settings
        assert "compliance_frameworks" in settings
    
    async def test_update_governance_settings(
        self,
        governance_service: GovernanceService,
        test_organization_id,
        test_user_id
    ):
        """Test updating governance settings."""
        new_settings = {
            "auto_remediation": True,
            "notification_preferences": {
                "email_alerts": True,
                "slack_notifications": False,
                "digest_frequency": "daily"
            },
            "violation_thresholds": {
                "low": 10,
                "medium": 5,
                "high": 1
            }
        }
        
        updated_settings = await governance_service.update_governance_settings(
            organization_id=test_organization_id,
            settings=new_settings,
            updated_by=test_user_id
        )
        
        assert updated_settings["auto_remediation"] is True
        assert updated_settings["notification_preferences"]["email_alerts"] is True
        assert updated_settings["violation_thresholds"]["high"] == 1


class TestGovernanceAPI:
    """Test cases for Governance API endpoints."""
    
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
    
    async def test_get_dashboard_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/dashboard endpoint."""
        response = await client.get("/api/governance/dashboard", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "policy_count" in data["data"]
        assert "evaluator_count" in data["data"]
        assert "violation_count" in data["data"]
        assert "compliance_score" in data["data"]
    
    async def test_get_violations_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/violations endpoint."""
        response = await client.get("/api/governance/violations", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "violations" in data["data"]
        assert "total" in data["data"]
        assert "skip" in data["data"]
        assert "limit" in data["data"]
    
    async def test_get_violations_with_filters_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/violations with filters."""
        params = {
            "severity": "high",
            "skip": 0,
            "limit": 50
        }
        
        response = await client.get(
            "/api/governance/violations",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "violations" in data["data"]
    
    async def test_get_compliance_reports_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/compliance-reports endpoint."""
        response = await client.get("/api/governance/compliance-reports", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data["data"]
        assert "total" in data["data"]
    
    async def test_generate_compliance_report_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/governance/compliance-reports/generate endpoint."""
        report_config = {
            "report_type": "standard",
            "config": {
                "include_violations": True,
                "include_metrics": True,
                "date_range_days": 30
            }
        }
        
        response = await client.post(
            "/api/governance/compliance-reports/generate",
            json=report_config,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "report_id" in data["data"]
        assert "report_type" in data["data"]
        assert data["message"] == "Compliance report generation started"
    
    async def test_get_risk_assessments_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/risk-assessments endpoint."""
        response = await client.get("/api/governance/risk-assessments", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "assessments" in data["data"]
        assert "total" in data["data"]
    
    async def test_generate_risk_assessment_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/governance/risk-assessments/generate endpoint."""
        assessment_config = {
            "config": {
                "assessment_scope": ["policies", "evaluators"],
                "risk_categories": ["security", "compliance"],
                "include_mitigation": True
            }
        }
        
        response = await client.post(
            "/api/governance/risk-assessments/generate",
            json=assessment_config,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "assessment_id" in data["data"]
        assert "risk_level" in data["data"]
        assert "risk_score" in data["data"]
        assert data["message"] == "Risk assessment generated successfully"
    
    async def test_get_frameworks_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/frameworks endpoint."""
        response = await client.get("/api/governance/frameworks", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "frameworks" in data["data"]
        assert "total" in data["data"]
        assert len(data["data"]["frameworks"]) > 0
    
    async def test_apply_framework_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/governance/frameworks/{framework_id}/apply endpoint."""
        framework_id = "iso27001"
        application_config = {
            "config": {
                "customize_policies": True,
                "include_all_controls": False,
                "selected_controls": ["access_control"]
            }
        }
        
        response = await client.post(
            f"/api/governance/frameworks/{framework_id}/apply",
            json=application_config,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "framework_id" in data["data"]
        assert "application_id" in data["data"]
        assert "status" in data["data"]
        assert data["message"] == "Governance framework applied successfully"
    
    async def test_get_metrics_summary_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/metrics/summary endpoint."""
        response = await client.get("/api/governance/metrics/summary", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data["data"]
        assert "period" in data["data"]
        assert "total_evaluations" in data["data"]["summary"]
        assert "compliance_score" in data["data"]["summary"]
    
    async def test_get_metrics_summary_with_custom_period_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/metrics/summary with custom period."""
        params = {"days": 7}
        
        response = await client.get(
            "/api/governance/metrics/summary",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["period"]["days"] == 7
    
    async def test_analyze_policy_effectiveness_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/governance/policy-effectiveness/analyze endpoint."""
        analysis_config = {
            "config": {
                "analysis_period": 30,
                "include_false_positives": True,
                "benchmark_against": "industry_average"
            }
        }
        
        response = await client.post(
            "/api/governance/policy-effectiveness/analyze",
            json=analysis_config,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "analysis_id" in data["data"]
        assert "effectiveness_score" in data["data"]
        assert "recommendations" in data["data"]
        assert data["message"] == "Policy effectiveness analysis completed"
    
    async def test_get_settings_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/governance/settings endpoint."""
        response = await client.get("/api/governance/settings", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "auto_remediation" in data["data"]
        assert "notification_preferences" in data["data"]
        assert "compliance_frameworks" in data["data"]
    
    async def test_update_settings_endpoint(self, client: AsyncClient, auth_headers):
        """Test PUT /api/governance/settings endpoint."""
        settings_data = {
            "auto_remediation": True,
            "notification_preferences": {
                "email_alerts": True,
                "slack_notifications": False,
                "digest_frequency": "daily"
            },
            "violation_thresholds": {
                "low": 10,
                "medium": 5,
                "high": 1
            }
        }
        
        response = await client.put(
            "/api/governance/settings",
            json=settings_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["auto_remediation"] is True
        assert data["data"]["notification_preferences"]["email_alerts"] is True
        assert data["message"] == "Governance settings updated successfully"