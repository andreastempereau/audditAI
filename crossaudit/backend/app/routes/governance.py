"""Governance management routes for CrossAudit AI."""

import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.exceptions import GovernanceError, ValidationError, NotFoundError
from app.services.auth import get_current_user
from app.services.governance import GovernanceService
from app.models.auth import User
from app.schemas.base import BaseResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def governance_health_check():
    """Health check for governance endpoints."""
    return {"status": "healthy", "service": "governance"}


@router.get("/dashboard")
async def get_governance_dashboard(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get governance dashboard data."""
    try:
        service = GovernanceService(session)
        
        dashboard_data = await service.get_dashboard_data(
            organization_id=current_user.organization_id
        )
        
        return BaseResponse(
            data=dashboard_data
        )
        
    except Exception as e:
        logger.error(f"Failed to get governance dashboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard data"
        )


@router.get("/violations")
async def get_policy_violations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    severity: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get policy violations."""
    try:
        service = GovernanceService(session)
        
        violations = await service.get_policy_violations(
            organization_id=current_user.organization_id,
            skip=skip,
            limit=limit,
            severity=severity,
            start_date=start_date,
            end_date=end_date
        )
        
        violation_list = []
        for violation in violations:
            violation_list.append({
                "id": str(violation.id),
                "policy_id": str(violation.policy_id),
                "policy_name": violation.policy_name,
                "severity": violation.severity,
                "message": violation.message,
                "context": violation.context,
                "resolved": violation.resolved,
                "resolved_at": violation.resolved_at.isoformat() if violation.resolved_at else None,
                "created_at": violation.created_at.isoformat()
            })
        
        return BaseResponse(
            data={
                "violations": violation_list,
                "total": len(violation_list),
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get policy violations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve violations"
        )


@router.post("/violations/{violation_id}/resolve")
async def resolve_violation(
    violation_id: UUID,
    resolution_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Resolve a policy violation."""
    try:
        service = GovernanceService(session)
        
        result = await service.resolve_violation(
            violation_id=violation_id,
            organization_id=current_user.organization_id,
            resolution_notes=resolution_data.get("notes", ""),
            resolved_by=current_user.id
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Violation not found"
            )
        
        return BaseResponse(
            data={
                "violation_id": str(violation_id),
                "resolved": True,
                "resolved_at": datetime.utcnow().isoformat(),
                "resolved_by": str(current_user.id)
            },
            message="Violation resolved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve violation {violation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve violation"
        )


@router.get("/compliance-reports")
async def get_compliance_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    report_type: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get compliance reports."""
    try:
        service = GovernanceService(session)
        
        reports = await service.get_compliance_reports(
            organization_id=current_user.organization_id,
            skip=skip,
            limit=limit,
            report_type=report_type
        )
        
        report_list = []
        for report in reports:
            report_list.append({
                "id": str(report.id),
                "name": report.name,
                "report_type": report.report_type,
                "status": report.status,
                "summary": report.summary,
                "findings": report.findings,
                "recommendations": report.recommendations,
                "generated_at": report.created_at.isoformat()
            })
        
        return BaseResponse(
            data={
                "reports": report_list,
                "total": len(report_list),
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get compliance reports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reports"
        )


@router.post("/compliance-reports/generate")
async def generate_compliance_report(
    report_config: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Generate a new compliance report."""
    try:
        service = GovernanceService(session)
        
        report = await service.generate_compliance_report(
            organization_id=current_user.organization_id,
            report_type=report_config.get("report_type", "standard"),
            config=report_config.get("config", {}),
            generated_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "report_id": str(report.id),
                "name": report.name,
                "report_type": report.report_type,
                "status": report.status,
                "generated_at": report.created_at.isoformat()
            },
            message="Compliance report generation started"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to generate compliance report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report"
        )


@router.get("/risk-assessments")
async def get_risk_assessments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    risk_level: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get risk assessments."""
    try:
        service = GovernanceService(session)
        
        assessments = await service.get_risk_assessments(
            organization_id=current_user.organization_id,
            skip=skip,
            limit=limit,
            risk_level=risk_level
        )
        
        assessment_list = []
        for assessment in assessments:
            assessment_list.append({
                "id": str(assessment.id),
                "name": assessment.name,
                "risk_level": assessment.risk_level,
                "risk_score": assessment.risk_score,
                "categories": assessment.categories,
                "findings": assessment.findings,
                "mitigation_strategies": assessment.mitigation_strategies,
                "assessed_at": assessment.created_at.isoformat()
            })
        
        return BaseResponse(
            data={
                "assessments": assessment_list,
                "total": len(assessment_list),
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get risk assessments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve assessments"
        )


@router.post("/risk-assessments/generate")
async def generate_risk_assessment(
    assessment_config: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Generate a new risk assessment."""
    try:
        service = GovernanceService(session)
        
        assessment = await service.generate_risk_assessment(
            organization_id=current_user.organization_id,
            config=assessment_config.get("config", {}),
            assessed_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "assessment_id": str(assessment.id),
                "name": assessment.name,
                "risk_level": assessment.risk_level,
                "risk_score": assessment.risk_score,
                "assessed_at": assessment.created_at.isoformat()
            },
            message="Risk assessment generated successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to generate risk assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate assessment"
        )


@router.get("/frameworks")
async def get_governance_frameworks(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get available governance frameworks."""
    try:
        service = GovernanceService(session)
        
        frameworks = await service.get_available_frameworks()
        
        return BaseResponse(
            data={
                "frameworks": frameworks,
                "total": len(frameworks)
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get governance frameworks: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve frameworks"
        )


@router.post("/frameworks/{framework_id}/apply")
async def apply_governance_framework(
    framework_id: str,
    application_config: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Apply a governance framework to the organization."""
    try:
        service = GovernanceService(session)
        
        result = await service.apply_framework(
            organization_id=current_user.organization_id,
            framework_id=framework_id,
            config=application_config.get("config", {}),
            applied_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "framework_id": framework_id,
                "application_id": result.get("application_id"),
                "status": result.get("status"),
                "applied_policies": result.get("policies", []),
                "applied_at": result.get("applied_at")
            },
            message="Governance framework applied successfully"
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to apply framework {framework_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to apply framework"
        )


@router.get("/metrics/summary")
async def get_governance_metrics_summary(
    days: int = Query(30, ge=1, le=365),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get governance metrics summary."""
    try:
        service = GovernanceService(session)
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        metrics = await service.get_metrics_summary(
            organization_id=current_user.organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return BaseResponse(
            data={
                "summary": metrics,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": days
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get governance metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics"
        )


@router.post("/policy-effectiveness/analyze")
async def analyze_policy_effectiveness(
    analysis_config: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Analyze policy effectiveness."""
    try:
        service = GovernanceService(session)
        
        analysis = await service.analyze_policy_effectiveness(
            organization_id=current_user.organization_id,
            config=analysis_config.get("config", {}),
            analyzed_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "analysis_id": analysis.get("analysis_id"),
                "effectiveness_score": analysis.get("effectiveness_score"),
                "recommendations": analysis.get("recommendations", []),
                "policy_performance": analysis.get("policy_performance", {}),
                "analyzed_at": analysis.get("analyzed_at")
            },
            message="Policy effectiveness analysis completed"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to analyze policy effectiveness: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze policy effectiveness"
        )


@router.get("/settings")
async def get_governance_settings(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get governance settings for the organization."""
    try:
        service = GovernanceService(session)
        
        settings = await service.get_governance_settings(
            organization_id=current_user.organization_id
        )
        
        return BaseResponse(
            data=settings
        )
        
    except Exception as e:
        logger.error(f"Failed to get governance settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve settings"
        )


@router.put("/settings")
async def update_governance_settings(
    settings_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update governance settings for the organization."""
    try:
        service = GovernanceService(session)
        
        updated_settings = await service.update_governance_settings(
            organization_id=current_user.organization_id,
            settings=settings_data,
            updated_by=current_user.id
        )
        
        return BaseResponse(
            data=updated_settings,
            message="Governance settings updated successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update governance settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings"
        )