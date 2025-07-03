"""Policy framework with declarative YAML DSL support."""

import re
import yaml
import logging
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import Policy, PolicyEvaluation, PolicyViolation, ResponseCache
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class PolicyValidator:
    """Validates policy YAML definitions."""
    
    REQUIRED_FIELDS = ["name", "conditions", "actions"]
    VALID_CONDITIONS = ["regex", "pii_detection", "classification", "sentiment", "toxicity", "custom"]
    VALID_ACTIONS = ["allow", "block", "rewrite", "redact", "log_only"]
    VALID_SEVERITIES = ["low", "medium", "high", "critical"]
    
    @classmethod
    def validate_policy_yaml(cls, policy_yaml: str) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """Validate policy YAML and return parsed config."""
        try:
            # Parse YAML
            config = yaml.safe_load(policy_yaml)
            
            # Check required fields
            for field in cls.REQUIRED_FIELDS:
                if field not in config:
                    return False, f"Missing required field: {field}", None
            
            # Validate conditions
            conditions = config.get("conditions", {})
            if not isinstance(conditions, dict):
                return False, "Conditions must be a dictionary", None
            
            for condition_type, condition_config in conditions.items():
                if condition_type not in cls.VALID_CONDITIONS:
                    return False, f"Invalid condition type: {condition_type}", None
                
                # Validate specific condition types
                if not cls._validate_condition(condition_type, condition_config):
                    return False, f"Invalid configuration for condition: {condition_type}", None
            
            # Validate actions
            actions = config.get("actions", {})
            if not isinstance(actions, dict):
                return False, "Actions must be a dictionary", None
            
            primary_action = actions.get("primary")
            if primary_action not in cls.VALID_ACTIONS:
                return False, f"Invalid primary action: {primary_action}", None
            
            # Validate severity
            severity = config.get("severity", "medium")
            if severity not in cls.VALID_SEVERITIES:
                return False, f"Invalid severity: {severity}", None
            
            # Validate thresholds
            thresholds = config.get("thresholds", {})
            if not isinstance(thresholds, dict):
                return False, "Thresholds must be a dictionary", None
            
            return True, None, config
            
        except yaml.YAMLError as e:
            return False, f"Invalid YAML: {str(e)}", None
        except Exception as e:
            return False, f"Validation error: {str(e)}", None
    
    @classmethod
    def _validate_condition(cls, condition_type: str, config: Any) -> bool:
        """Validate specific condition configuration."""
        if condition_type == "regex":
            if not isinstance(config, dict) or "patterns" not in config:
                return False
            patterns = config["patterns"]
            if not isinstance(patterns, list):
                return False
            # Test regex compilation
            for pattern in patterns:
                try:
                    re.compile(pattern)
                except re.error:
                    return False
        
        elif condition_type == "pii_detection":
            if not isinstance(config, dict):
                return False
            types = config.get("types", [])
            if not isinstance(types, list):
                return False
            valid_pii_types = ["ssn", "email", "phone", "credit_card", "address", "ip_address"]
            for pii_type in types:
                if pii_type not in valid_pii_types:
                    return False
        
        elif condition_type == "classification":
            if not isinstance(config, dict):
                return False
            levels = config.get("blocked_levels", [])
            if not isinstance(levels, list):
                return False
            valid_levels = ["public", "internal", "confidential", "restricted", "top_secret"]
            for level in levels:
                if level not in valid_levels:
                    return False
        
        elif condition_type in ["sentiment", "toxicity"]:
            if not isinstance(config, dict):
                return False
            threshold = config.get("threshold")
            if threshold is not None and (not isinstance(threshold, (int, float)) or threshold < 0 or threshold > 1):
                return False
        
        return True


class PolicyEngine:
    """Core policy evaluation engine."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self._compiled_patterns = {}  # Cache for compiled regex patterns
    
    async def get_active_policies(self, organization_id: UUID) -> List[Policy]:
        """Get all active policies for organization, ordered by priority."""
        stmt = select(Policy).where(
            Policy.organization_id == organization_id,
            Policy.is_active == True
        ).order_by(Policy.priority.asc())
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def evaluate_text(
        self,
        text: str,
        organization_id: UUID,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[UUID] = None,
        thread_id: Optional[UUID] = None,
        message_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Evaluate text against all active policies."""
        context = context or {}
        start_time = datetime.utcnow()
        
        # Get active policies
        policies = await self.get_active_policies(organization_id)
        
        evaluation_results = []
        highest_severity = "low"
        final_action = "allow"
        policy_violations = []
        
        for policy in policies:
            policy_result = await self._evaluate_policy(text, policy, context)
            evaluation_results.append(policy_result)
            
            # Track highest severity and most restrictive action
            if self._severity_level(policy_result["severity"]) > self._severity_level(highest_severity):
                highest_severity = policy_result["severity"]
            
            if policy_result["action"] in ["block", "rewrite", "redact"]:
                final_action = policy_result["action"]
                if policy_result["violations"]:
                    policy_violations.extend(policy_result["violations"])
        
        # Create policy evaluation record
        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        evaluation = PolicyEvaluation(
            organization_id=organization_id,
            policy_id=policies[0].id if policies else None,  # Primary policy
            user_id=user_id,
            thread_id=thread_id,
            message_id=message_id,
            input_text=text,
            action_taken=final_action,
            severity=highest_severity,
            evaluator_scores={
                "policy_results": [
                    {
                        "policy_id": str(result["policy_id"]),
                        "action": result["action"],
                        "confidence": result["confidence"],
                        "violations": result["violations"]
                    }
                    for result in evaluation_results
                ]
            },
            metadata=context,
            processing_time_ms=processing_time
        )
        
        self.session.add(evaluation)
        await self.session.commit()
        await self.session.refresh(evaluation)
        
        # Log policy violations
        for violation in policy_violations:
            violation_record = PolicyViolation(
                organization_id=organization_id,
                policy_evaluation_id=evaluation.id,
                violation_type=violation["type"],
                severity=violation["severity"],
                rule_matched=violation["rule"],
                confidence_score=violation["confidence"],
                metadata=violation.get("metadata", {})
            )
            self.session.add(violation_record)
        
        await self.session.commit()
        
        return {
            "evaluation_id": evaluation.id,
            "action": final_action,
            "severity": highest_severity,
            "violations": policy_violations,
            "policy_results": evaluation_results,
            "processing_time_ms": processing_time
        }
    
    async def _evaluate_policy(
        self,
        text: str,
        policy: Policy,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate text against a single policy."""
        config = policy.parsed_config
        violations = []
        confidence_scores = []
        
        # Evaluate each condition
        for condition_type, condition_config in config.get("conditions", {}).items():
            violation = await self._evaluate_condition(
                text, condition_type, condition_config, context
            )
            if violation:
                violations.append(violation)
                confidence_scores.append(violation["confidence"])
        
        # Determine overall confidence and action
        overall_confidence = max(confidence_scores) if confidence_scores else 0.0
        severity = config.get("severity", "medium")
        
        # Apply thresholds
        thresholds = config.get("thresholds", {})
        action_threshold = thresholds.get("action_threshold", 0.7)
        
        if overall_confidence >= action_threshold:
            action = config["actions"]["primary"]
        elif overall_confidence >= thresholds.get("warning_threshold", 0.5):
            action = config["actions"].get("warning", "log_only")
        else:
            action = "allow"
        
        return {
            "policy_id": policy.id,
            "policy_name": policy.name,
            "action": action,
            "severity": severity,
            "confidence": overall_confidence,
            "violations": violations
        }
    
    async def _evaluate_condition(
        self,
        text: str,
        condition_type: str,
        config: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Evaluate a specific condition against text."""
        if condition_type == "regex":
            return self._evaluate_regex_condition(text, config)
        elif condition_type == "pii_detection":
            return self._evaluate_pii_condition(text, config)
        elif condition_type == "classification":
            return self._evaluate_classification_condition(text, config, context)
        elif condition_type == "sentiment":
            return await self._evaluate_sentiment_condition(text, config)
        elif condition_type == "toxicity":
            return await self._evaluate_toxicity_condition(text, config)
        elif condition_type == "custom":
            return await self._evaluate_custom_condition(text, config, context)
        
        return None
    
    def _evaluate_regex_condition(self, text: str, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Evaluate regex patterns against text."""
        patterns = config.get("patterns", [])
        case_sensitive = config.get("case_sensitive", False)
        
        flags = 0 if case_sensitive else re.IGNORECASE
        
        for pattern in patterns:
            # Use cached compiled patterns for performance
            cache_key = f"{pattern}:{flags}"
            if cache_key not in self._compiled_patterns:
                try:
                    self._compiled_patterns[cache_key] = re.compile(pattern, flags)
                except re.error:
                    continue
            
            compiled_pattern = self._compiled_patterns[cache_key]
            match = compiled_pattern.search(text)
            
            if match:
                return {
                    "type": "regex_match",
                    "severity": config.get("severity", "medium"),
                    "rule": pattern,
                    "confidence": 1.0,
                    "metadata": {
                        "matched_text": match.group(),
                        "match_start": match.start(),
                        "match_end": match.end()
                    }
                }
        
        return None
    
    def _evaluate_pii_condition(self, text: str, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Evaluate PII detection against text."""
        pii_types = config.get("types", [])
        
        # PII detection patterns
        pii_patterns = {
            "ssn": r"\b\d{3}-?\d{2}-?\d{4}\b",
            "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "phone": r"\b\d{3}-?\d{3}-?\d{4}\b",
            "credit_card": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
            "ip_address": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"
        }
        
        for pii_type in pii_types:
            if pii_type in pii_patterns:
                pattern = pii_patterns[pii_type]
                match = re.search(pattern, text)
                
                if match:
                    return {
                        "type": "pii_detected",
                        "severity": config.get("severity", "high"),
                        "rule": f"PII detection: {pii_type}",
                        "confidence": 0.9,
                        "metadata": {
                            "pii_type": pii_type,
                            "matched_text": "***REDACTED***"  # Don't log actual PII
                        }
                    }
        
        return None
    
    def _evaluate_classification_condition(
        self,
        text: str,
        config: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Evaluate classification level restrictions."""
        blocked_levels = config.get("blocked_levels", [])
        document_classification = context.get("classification", "public")
        
        if document_classification in blocked_levels:
            return {
                "type": "classification_violation",
                "severity": config.get("severity", "high"),
                "rule": f"Blocked classification: {document_classification}",
                "confidence": 1.0,
                "metadata": {
                    "classification": document_classification,
                    "blocked_levels": blocked_levels
                }
            }
        
        return None
    
    async def _evaluate_sentiment_condition(
        self,
        text: str,
        config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Evaluate sentiment analysis (placeholder for ML model)."""
        threshold = config.get("threshold", 0.8)
        target_sentiment = config.get("target", "negative")
        
        # Placeholder sentiment analysis - in production, use actual ML model
        negative_words = ["hate", "terrible", "awful", "horrible", "disgusting"]
        negative_count = sum(1 for word in negative_words if word in text.lower())
        
        if negative_count > 0 and target_sentiment == "negative":
            confidence = min(negative_count * 0.3, 1.0)
            if confidence >= threshold:
                return {
                    "type": "sentiment_violation",
                    "severity": config.get("severity", "medium"),
                    "rule": f"Negative sentiment threshold: {threshold}",
                    "confidence": confidence,
                    "metadata": {
                        "sentiment": "negative",
                        "score": confidence
                    }
                }
        
        return None
    
    async def _evaluate_toxicity_condition(
        self,
        text: str,
        config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Evaluate toxicity detection (placeholder for ML model)."""
        threshold = config.get("threshold", 0.7)
        
        # Placeholder toxicity detection - in production, use actual ML model
        toxic_words = ["idiot", "stupid", "moron", "loser", "hate"]
        toxic_count = sum(1 for word in toxic_words if word in text.lower())
        
        if toxic_count > 0:
            confidence = min(toxic_count * 0.4, 1.0)
            if confidence >= threshold:
                return {
                    "type": "toxicity_detected",
                    "severity": config.get("severity", "high"),
                    "rule": f"Toxicity threshold: {threshold}",
                    "confidence": confidence,
                    "metadata": {
                        "toxicity_score": confidence
                    }
                }
        
        return None
    
    async def _evaluate_custom_condition(
        self,
        text: str,
        config: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Evaluate custom condition logic."""
        # Custom conditions can include complex business logic
        custom_type = config.get("type")
        
        if custom_type == "time_restriction":
            current_hour = datetime.utcnow().hour
            allowed_hours = config.get("allowed_hours", [])
            
            if allowed_hours and current_hour not in allowed_hours:
                return {
                    "type": "time_restriction",
                    "severity": config.get("severity", "medium"),
                    "rule": f"Time restriction: {allowed_hours}",
                    "confidence": 1.0,
                    "metadata": {
                        "current_hour": current_hour,
                        "allowed_hours": allowed_hours
                    }
                }
        
        elif custom_type == "user_role_restriction":
            user_role = context.get("user_role")
            blocked_roles = config.get("blocked_roles", [])
            
            if user_role in blocked_roles:
                return {
                    "type": "user_role_restriction",
                    "severity": config.get("severity", "high"),
                    "rule": f"Blocked role: {user_role}",
                    "confidence": 1.0,
                    "metadata": {
                        "user_role": user_role,
                        "blocked_roles": blocked_roles
                    }
                }
        
        return None
    
    def _severity_level(self, severity: str) -> int:
        """Convert severity string to numeric level for comparison."""
        levels = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        return levels.get(severity, 1)


class PolicyService:
    """Service for managing policies."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.engine = PolicyEngine(session)
    
    async def create_policy(
        self,
        organization_id: UUID,
        name: str,
        description: Optional[str],
        policy_yaml: str,
        evaluator_pool_id: Optional[UUID] = None,
        created_by: Optional[UUID] = None
    ) -> Policy:
        """Create a new policy."""
        # Validate YAML
        is_valid, error, parsed_config = PolicyValidator.validate_policy_yaml(policy_yaml)
        if not is_valid:
            raise ValueError(f"Invalid policy YAML: {error}")
        
        policy = Policy(
            organization_id=organization_id,
            name=name,
            description=description,
            policy_yaml=policy_yaml,
            parsed_config=parsed_config,
            priority=parsed_config.get("priority", 100),
            evaluator_pool_id=evaluator_pool_id,
            created_by=created_by
        )
        
        self.session.add(policy)
        await self.session.commit()
        await self.session.refresh(policy)
        
        return policy
    
    async def update_policy(
        self,
        policy_id: UUID,
        policy_yaml: Optional[str] = None,
        is_active: Optional[bool] = None,
        priority: Optional[int] = None
    ) -> Policy:
        """Update an existing policy."""
        stmt = select(Policy).where(Policy.id == policy_id)
        result = await self.session.execute(stmt)
        policy = result.scalar_one_or_none()
        
        if not policy:
            raise ValueError("Policy not found")
        
        if policy_yaml is not None:
            # Validate new YAML
            is_valid, error, parsed_config = PolicyValidator.validate_policy_yaml(policy_yaml)
            if not is_valid:
                raise ValueError(f"Invalid policy YAML: {error}")
            
            policy.policy_yaml = policy_yaml
            policy.parsed_config = parsed_config
            policy.priority = parsed_config.get("priority", policy.priority)
        
        if is_active is not None:
            policy.is_active = is_active
        
        if priority is not None:
            policy.priority = priority
        
        policy.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(policy)
        
        return policy
    
    async def get_policy(self, policy_id: UUID) -> Optional[Policy]:
        """Get a policy by ID."""
        return await self.session.get(Policy, policy_id)
    
    async def get_organization_policies(self, organization_id: UUID) -> List[Policy]:
        """Get all policies for an organization."""
        stmt = select(Policy).where(
            Policy.organization_id == organization_id
        ).order_by(Policy.priority.asc(), Policy.created_at.desc())
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def delete_policy(self, policy_id: UUID) -> bool:
        """Delete a policy."""
        policy = await self.get_policy(policy_id)
        if not policy:
            return False
        
        await self.session.delete(policy)
        await self.session.commit()
        return True
    
    async def check_cache(
        self,
        prompt: str,
        context: str,
        organization_id: UUID
    ) -> Optional[str]:
        """Check response cache for identical prompt + context."""
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        context_hash = hashlib.sha256(context.encode()).hexdigest()
        
        stmt = select(ResponseCache).where(
            ResponseCache.organization_id == organization_id,
            ResponseCache.prompt_hash == prompt_hash,
            ResponseCache.context_hash == context_hash,
            ResponseCache.expires_at > datetime.utcnow()
        )
        
        result = await self.session.execute(stmt)
        cache_entry = result.scalar_one_or_none()
        
        if cache_entry:
            # Increment hit count
            cache_entry.hit_count += 1
            await self.session.commit()
            return cache_entry.cached_response
        
        return None
    
    async def save_to_cache(
        self,
        prompt: str,
        context: str,
        response: str,
        organization_id: UUID,
        policy_evaluation_id: Optional[UUID] = None,
        cache_duration_minutes: int = 60
    ):
        """Save response to cache."""
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        context_hash = hashlib.sha256(context.encode()).hexdigest()
        
        expires_at = datetime.utcnow()
        expires_at = expires_at.replace(
            minute=expires_at.minute + cache_duration_minutes
        )
        
        cache_entry = ResponseCache(
            organization_id=organization_id,
            prompt_hash=prompt_hash,
            context_hash=context_hash,
            cached_response=response,
            policy_evaluation_id=policy_evaluation_id,
            expires_at=expires_at
        )
        
        self.session.add(cache_entry)
        await self.session.commit()
    
    async def get_policy_analytics(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get policy analytics for organization."""
        start_date = datetime.utcnow().replace(
            day=datetime.utcnow().day - days
        )
        
        # Get policy evaluation stats
        stmt = text("""
            SELECT 
                p.name as policy_name,
                pe.action_taken,
                pe.severity,
                COUNT(*) as count,
                AVG(pe.processing_time_ms) as avg_processing_time
            FROM policy_evaluations pe
            JOIN policies p ON pe.policy_id = p.id
            WHERE pe.organization_id = :org_id 
            AND pe.created_at >= :start_date
            GROUP BY p.name, pe.action_taken, pe.severity
            ORDER BY count DESC
        """)
        
        result = await self.session.execute(stmt, {
            "org_id": organization_id,
            "start_date": start_date
        })
        
        policy_stats = []
        for row in result.fetchall():
            policy_stats.append({
                "policy_name": row[0],
                "action": row[1],
                "severity": row[2],
                "count": row[3],
                "avg_processing_time_ms": float(row[4]) if row[4] else 0
            })
        
        # Get violation stats
        violation_stmt = text("""
            SELECT 
                pv.violation_type,
                pv.severity,
                COUNT(*) as count,
                AVG(pv.confidence_score) as avg_confidence
            FROM policy_violations pv
            WHERE pv.organization_id = :org_id
            AND pv.created_at >= :start_date
            GROUP BY pv.violation_type, pv.severity
            ORDER BY count DESC
        """)
        
        violation_result = await self.session.execute(violation_stmt, {
            "org_id": organization_id,
            "start_date": start_date
        })
        
        violation_stats = []
        for row in violation_result.fetchall():
            violation_stats.append({
                "violation_type": row[0],
                "severity": row[1],
                "count": row[2],
                "avg_confidence": float(row[3]) if row[3] else 0
            })
        
        return {
            "period_days": days,
            "policy_evaluations": policy_stats,
            "policy_violations": violation_stats,
            "generated_at": datetime.utcnow().isoformat()
        }