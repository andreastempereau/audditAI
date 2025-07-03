"""AI Governance Engine with policy-driven multi-model inference orchestration."""

import asyncio
import hashlib
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.policies import PolicyService
from app.services.evaluators import EvaluatorPoolService
from app.services.secrets_manager import SecretsManagerService
from app.models.governance import PolicyEvaluation, ResponseCache
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GovernanceError(Exception):
    """Base exception for governance errors."""
    pass


class PolicyViolationError(GovernanceError):
    """Policy violation exception."""
    pass


class InferenceError(GovernanceError):
    """Inference generation error."""
    pass


class AIGovernor:
    """Main AI Governance Engine orchestrating policy-driven inference."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.policy_service = PolicyService(session)
        self.evaluator_service = EvaluatorPoolService(session)
        self.secrets_service = SecretsManagerService(session)
        
        # Configuration
        self.cache_duration_minutes = 60
        self.evaluation_timeout_ms = 800
        self.max_rewrite_attempts = 3
    
    async def generate_safe_response(
        self,
        prompt: str,
        context: Dict[str, Any],
        organization_id: UUID,
        user_id: Optional[UUID] = None,
        thread_id: Optional[UUID] = None,
        message_id: Optional[UUID] = None,
        primary_model_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main governance pipeline:
        1. Generate - calls primary model with Data Room context
        2. Score - fan-outs answer + prompt to evaluator pool
        3. Decide - merge scores, apply policy rules
        4. Rewrite/Redact - if required, call fixer model
        5. Emit - return safe answer, log policy_result
        """
        start_time = time.time()
        
        # Step 0: Check cache for identical prompt + context
        cache_key = self._build_cache_key(prompt, context)
        cached_response = await self.policy_service.check_cache(
            prompt, str(context), organization_id
        )
        
        if cached_response:
            logger.info(f"Cache hit for prompt hash: {cache_key[:8]}...")
            return {
                "response": cached_response,
                "action": "allow",
                "cached": True,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
        
        try:
            # Step 1: Generate initial response
            logger.info(f"Starting governance pipeline for org {organization_id}")
            initial_response = await self._generate_response(
                prompt, context, primary_model_config
            )
            
            # Step 2: Score with evaluator pool
            evaluation_result = await self._score_response(
                prompt, initial_response, context, organization_id
            )
            
            # Step 3: Decide based on policy evaluation
            decision = await self._make_decision(
                prompt, initial_response, evaluation_result, organization_id,
                user_id, thread_id, message_id
            )
            
            # Step 4: Apply decision (rewrite/redact if needed)
            final_response = await self._apply_decision(
                prompt, initial_response, decision, context, primary_model_config
            )
            
            # Step 5: Emit and log
            processing_time = int((time.time() - start_time) * 1000)
            result = await self._emit_result(
                prompt, initial_response, final_response, decision,
                evaluation_result, organization_id, processing_time
            )
            
            # Cache successful responses
            if decision["action"] == "allow":
                await self.policy_service.save_to_cache(
                    prompt, str(context), final_response,
                    organization_id, decision.get("evaluation_id"),
                    self.cache_duration_minutes
                )
            
            return result
            
        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            logger.error(f"Governance pipeline failed: {e}")
            
            return {
                "response": "I apologize, but I cannot process your request at this time due to a system error.",
                "action": "block",
                "error": str(e),
                "processing_time_ms": processing_time
            }
    
    async def _generate_response(
        self,
        prompt: str,
        context: Dict[str, Any],
        model_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate initial response using primary model."""
        # Extract data room context
        documents_context = context.get("documents", [])
        fragments_context = context.get("fragments", [])
        
        # Build enhanced prompt with context
        enhanced_prompt = self._build_context_prompt(prompt, documents_context, fragments_context)
        
        # Default model configuration
        default_config = {
            "model": "gpt-4",
            "temperature": 0.7,
            "max_tokens": 1500,
            "api_key_type": "openai"
        }
        
        if model_config:
            default_config.update(model_config)
        
        # Get API key from organization secrets
        api_key = await self._get_model_api_key(
            context.get("organization_id"),
            default_config["api_key_type"]
        )
        
        if not api_key:
            raise InferenceError(f"API key not found for {default_config['api_key_type']}")
        
        # Call primary model
        response = await self._call_primary_model(enhanced_prompt, default_config, api_key)
        
        logger.info(f"Generated response: {len(response)} characters")
        return response
    
    async def _score_response(
        self,
        prompt: str,
        response: str,
        context: Dict[str, Any],
        organization_id: UUID
    ) -> Dict[str, Any]:
        """Score response using evaluator pool with 800ms budget."""
        # Get default evaluator pool for organization
        evaluator_pools = await self.evaluator_service.get_organization_pools(organization_id)
        
        if not evaluator_pools:
            logger.warning(f"No evaluator pools found for org {organization_id}")
            return {
                "overall_score": 0.8,  # Default safe score
                "consensus_action": "allow",
                "evaluator_results": [],
                "evaluation_time_ms": 0
            }
        
        # Use first active pool (or create priority system)
        primary_pool = next((p for p in evaluator_pools if p.is_active), None)
        
        if not primary_pool:
            logger.warning(f"No active evaluator pools for org {organization_id}")
            return {
                "overall_score": 0.8,
                "consensus_action": "allow",
                "evaluator_results": [],
                "evaluation_time_ms": 0
            }
        
        try:
            # Run evaluation with timeout budget
            evaluation_result = await self.evaluator_service.evaluate_with_pool(
                primary_pool.id, prompt, response, context
            )
            
            return evaluation_result
            
        except Exception as e:
            logger.error(f"Evaluator pool failed: {e}")
            return {
                "overall_score": 0.5,  # Neutral score on failure
                "consensus_action": "allow",  # Default to allow
                "evaluator_results": [],
                "evaluation_time_ms": self.evaluation_timeout_ms,
                "error": str(e)
            }
    
    async def _make_decision(
        self,
        prompt: str,
        response: str,
        evaluation_result: Dict[str, Any],
        organization_id: UUID,
        user_id: Optional[UUID] = None,
        thread_id: Optional[UUID] = None,
        message_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Make decision based on policy evaluation and evaluator scores."""
        # Run policy evaluation
        policy_context = {
            "user_id": str(user_id) if user_id else None,
            "evaluator_score": evaluation_result.get("overall_score", 0.5),
            "evaluator_violations": evaluation_result.get("violations", [])
        }
        
        policy_result = await self.policy_service.engine.evaluate_text(
            text=f"Prompt: {prompt}\nResponse: {response}",
            organization_id=organization_id,
            context=policy_context,
            user_id=user_id,
            thread_id=thread_id,
            message_id=message_id
        )
        
        # Combine policy and evaluator results
        policy_action = policy_result["action"]
        evaluator_action = evaluation_result.get("consensus_action", "allow")
        
        # Take most restrictive action
        final_action = self._resolve_action_conflict(policy_action, evaluator_action)
        
        # Determine severity
        policy_severity = policy_result["severity"]
        evaluator_score = evaluation_result.get("overall_score", 0.5)
        
        # Combine scores (policy violations override evaluator scores)
        if policy_result["violations"]:
            final_severity = policy_severity
        else:
            # Convert evaluator score to severity
            if evaluator_score >= 0.8:
                eval_severity = "low"
            elif evaluator_score >= 0.6:
                eval_severity = "medium"
            elif evaluator_score >= 0.4:
                eval_severity = "high"
            else:
                eval_severity = "critical"
            
            final_severity = max(policy_severity, eval_severity, key=self._severity_level)
        
        return {
            "action": final_action,
            "severity": final_severity,
            "policy_result": policy_result,
            "evaluator_result": evaluation_result,
            "evaluation_id": policy_result["evaluation_id"],
            "violations": policy_result["violations"] + evaluation_result.get("violations", []),
            "reason": self._build_decision_reason(policy_result, evaluation_result)
        }
    
    async def _apply_decision(
        self,
        prompt: str,
        original_response: str,
        decision: Dict[str, Any],
        context: Dict[str, Any],
        model_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """Apply decision (rewrite/redact if needed)."""
        action = decision["action"]
        
        if action == "allow":
            return original_response
        
        elif action == "block":
            violations = decision.get("violations", [])
            reason = decision.get("reason", "Policy violation detected")
            
            return f"I cannot process this request as it violates our content policy. Reason: {reason}"
        
        elif action == "redact":
            # Apply redaction based on violations
            redacted_response = await self._apply_redaction(
                original_response, decision["violations"]
            )
            return redacted_response
        
        elif action == "rewrite":
            # Attempt rewrite with governance constraints
            rewritten_response = await self._rewrite_response(
                prompt, original_response, decision, context, model_config
            )
            return rewritten_response
        
        else:
            logger.warning(f"Unknown action: {action}")
            return original_response
    
    async def _emit_result(
        self,
        prompt: str,
        initial_response: str,
        final_response: str,
        decision: Dict[str, Any],
        evaluation_result: Dict[str, Any],
        organization_id: UUID,
        processing_time_ms: int
    ) -> Dict[str, Any]:
        """Emit final result and create audit log."""
        # Create comprehensive audit log
        audit_data = {
            "prompt": prompt[:500],  # Truncate for storage
            "initial_response": initial_response[:500],
            "final_response": final_response[:500],
            "action": decision["action"],
            "severity": decision["severity"],
            "policy_violations": len(decision.get("violations", [])),
            "evaluator_score": evaluation_result.get("overall_score", 0.5),
            "processing_time_ms": processing_time_ms,
            "cache_used": False
        }
        
        # Log to audit system via policy evaluation (already done in _make_decision)
        logger.info(f"Governance result: {decision['action']} ({decision['severity']}) - {processing_time_ms}ms")
        
        return {
            "response": final_response,
            "action": decision["action"],
            "severity": decision["severity"],
            "violations": decision.get("violations", []),
            "reason": decision.get("reason"),
            "evaluation_id": decision.get("evaluation_id"),
            "processing_time_ms": processing_time_ms,
            "cached": False,
            "audit_data": audit_data
        }
    
    def _build_cache_key(self, prompt: str, context: Dict[str, Any]) -> str:
        """Build cache key from prompt and context."""
        combined = f"{prompt}|{str(context)}"
        return hashlib.sha256(combined.encode()).hexdigest()
    
    def _build_context_prompt(
        self,
        prompt: str,
        documents: List[Dict[str, Any]],
        fragments: List[Dict[str, Any]]
    ) -> str:
        """Build enhanced prompt with data room context."""
        context_parts = [
            "You are an AI assistant with access to the organization's knowledge base.",
            "Use the following context to provide accurate and relevant responses.",
            ""
        ]
        
        # Add document context
        if documents:
            context_parts.append("Available Documents:")
            for doc in documents[:5]:  # Limit to top 5 documents
                context_parts.append(f"- {doc.get('title', 'Untitled')}: {doc.get('summary', '')[:200]}")
            context_parts.append("")
        
        # Add fragment context
        if fragments:
            context_parts.append("Relevant Information:")
            for fragment in fragments[:10]:  # Limit to top 10 fragments
                content = fragment.get('content', '')[:300]
                context_parts.append(f"- {content}")
            context_parts.append("")
        
        context_parts.extend([
            "User Question:",
            prompt,
            "",
            "Please provide a helpful and accurate response based on the available context. If the context doesn't contain relevant information, acknowledge this and provide what guidance you can."
        ])
        
        return "\n".join(context_parts)
    
    async def _get_model_api_key(self, organization_id: UUID, api_key_type: str) -> Optional[str]:
        """Get API key for model from organization secrets."""
        if not organization_id:
            return None
        
        secret_name = f"{api_key_type}_api_key"
        return await self.secrets_service.get_secret_by_name(organization_id, secret_name)
    
    async def _call_primary_model(
        self,
        prompt: str,
        config: Dict[str, Any],
        api_key: str
    ) -> str:
        """Call primary model for response generation."""
        # This is a simplified implementation
        # In production, you'd have different implementations for different providers
        
        model_type = config.get("api_key_type", "openai")
        
        if model_type == "openai":
            return await self._call_openai_model(prompt, config, api_key)
        elif model_type == "anthropic":
            return await self._call_anthropic_model(prompt, config, api_key)
        elif model_type == "gemini":
            return await self._call_gemini_model(prompt, config, api_key)
        else:
            raise InferenceError(f"Unsupported model type: {model_type}")
    
    async def _call_openai_model(self, prompt: str, config: Dict[str, Any], api_key: str) -> str:
        """Call OpenAI model."""
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": config.get("model", "gpt-4"),
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": config.get("temperature", 0.7),
            "max_tokens": config.get("max_tokens", 1500)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise InferenceError(f"OpenAI API error: {response.status} - {error_text}")
                
                result = await response.json()
                return result["choices"][0]["message"]["content"]
    
    async def _call_anthropic_model(self, prompt: str, config: Dict[str, Any], api_key: str) -> str:
        """Call Anthropic model."""
        import aiohttp
        
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": config.get("model", "claude-3-sonnet-20240229"),
            "max_tokens": config.get("max_tokens", 1500),
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise InferenceError(f"Anthropic API error: {response.status} - {error_text}")
                
                result = await response.json()
                return result["content"][0]["text"]
    
    async def _call_gemini_model(self, prompt: str, config: Dict[str, Any], api_key: str) -> str:
        """Call Gemini model."""
        import aiohttp
        
        model_name = config.get("model", "gemini-1.5-pro")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": config.get("temperature", 0.7),
                "maxOutputTokens": config.get("max_tokens", 1500)
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{url}?key={api_key}",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise InferenceError(f"Gemini API error: {response.status} - {error_text}")
                
                result = await response.json()
                return result["candidates"][0]["content"]["parts"][0]["text"]
    
    def _resolve_action_conflict(self, policy_action: str, evaluator_action: str) -> str:
        """Resolve conflicts between policy and evaluator actions."""
        # Action priority: block > rewrite > redact > allow
        action_priority = {
            "block": 4,
            "rewrite": 3,
            "redact": 2,
            "allow": 1
        }
        
        policy_priority = action_priority.get(policy_action, 1)
        evaluator_priority = action_priority.get(evaluator_action, 1)
        
        if policy_priority >= evaluator_priority:
            return policy_action
        else:
            return evaluator_action
    
    def _severity_level(self, severity: str) -> int:
        """Convert severity to numeric level."""
        levels = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        return levels.get(severity, 1)
    
    def _build_decision_reason(
        self,
        policy_result: Dict[str, Any],
        evaluator_result: Dict[str, Any]
    ) -> str:
        """Build human-readable decision reason."""
        reasons = []
        
        if policy_result["violations"]:
            policy_reasons = [v.get("rule_matched", "Policy violation") for v in policy_result["violations"]]
            reasons.extend(policy_reasons)
        
        if evaluator_result.get("violations"):
            eval_reasons = [f"Evaluator concern: {v}" for v in evaluator_result["violations"]]
            reasons.extend(eval_reasons)
        
        if not reasons:
            score = evaluator_result.get("overall_score", 0.5)
            if score < 0.5:
                reasons.append(f"Low safety score: {score:.2f}")
            else:
                reasons.append("Response approved by governance system")
        
        return "; ".join(reasons)
    
    async def _apply_redaction(self, text: str, violations: List[Dict[str, Any]]) -> str:
        """Apply redaction based on violations."""
        redacted_text = text
        
        for violation in violations:
            violation_type = violation.get("type", "")
            
            if violation_type == "pii_detected":
                # Simple PII redaction patterns
                import re
                redacted_text = re.sub(r'\b\d{3}-?\d{2}-?\d{4}\b', '[SSN REDACTED]', redacted_text)  # SSN
                redacted_text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL REDACTED]', redacted_text)  # Email
                redacted_text = re.sub(r'\b\d{3}-?\d{3}-?\d{4}\b', '[PHONE REDACTED]', redacted_text)  # Phone
            
            elif violation_type == "regex_match":
                # Redact based on matched patterns
                matched_text = violation.get("metadata", {}).get("matched_text")
                if matched_text:
                    redacted_text = redacted_text.replace(matched_text, "[REDACTED]")
        
        return redacted_text
    
    async def _rewrite_response(
        self,
        prompt: str,
        original_response: str,
        decision: Dict[str, Any],
        context: Dict[str, Any],
        model_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """Rewrite response to address policy violations."""
        violations = decision.get("violations", [])
        
        # Build rewrite instruction
        violation_descriptions = []
        for violation in violations:
            violation_descriptions.append(f"- {violation.get('type', 'Unknown')}: {violation.get('rule_matched', 'Policy violation')}")
        
        rewrite_prompt = f"""
Please rewrite the following response to address these policy concerns:
{chr(10).join(violation_descriptions)}

Original response:
{original_response}

Requirements:
1. Remove or rephrase content that violates policies
2. Maintain the helpful and informative nature of the response
3. Keep the same general intent and structure
4. Ensure the rewritten response is appropriate and safe

Rewritten response:
"""
        
        for attempt in range(self.max_rewrite_attempts):
            try:
                # Use same model configuration as original
                rewritten = await self._generate_response(rewrite_prompt, context, model_config)
                
                # Quick validation - check if rewrite is substantially different
                if len(rewritten) > 50 and rewritten != original_response:
                    return rewritten
                    
            except Exception as e:
                logger.warning(f"Rewrite attempt {attempt + 1} failed: {e}")
        
        # Fallback to generic safe response
        return "I apologize, but I cannot provide a response that meets our content guidelines for this request. Please rephrase your question or ask about a different topic."