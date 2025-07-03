# CrossAudit AI Policy DSL Guide

## Overview

The CrossAudit AI Policy DSL (Domain Specific Language) is a YAML-based configuration system that allows you to define AI governance policies in a declarative, human-readable format. This guide covers the complete syntax, features, and best practices for creating effective governance policies.

## Table of Contents

1. [Basic Structure](#basic-structure)
2. [Policy Metadata](#policy-metadata)
3. [Evaluators](#evaluators)
4. [Rules](#rules)
5. [Actions](#actions)
6. [Conditions](#conditions)
7. [Advanced Features](#advanced-features)
8. [Examples](#examples)
9. [Best Practices](#best-practices)
10. [Validation](#validation)

## Basic Structure

Every policy is defined using YAML syntax with the following top-level structure:

```yaml
# Required fields
name: "Policy Name"
description: "Policy description"
version: "1.0"

# Optional metadata
metadata:
  author: "Policy Author"
  created: "2024-01-01"
  tags: ["safety", "compliance"]

# Evaluators used by this policy
evaluators:
  - id: "evaluator-uuid"
    name: "safety_evaluator"
    config: {}

# Policy rules
rules:
  - name: "rule_name"
    description: "Rule description"
    evaluator: "safety_evaluator"
    threshold: 0.8
    action: "block"
    enabled: true

# Optional global settings
settings:
  timeout: 30
  retries: 3
  cache_results: true
```

## Policy Metadata

### Required Fields

- **name**: Human-readable policy name (string)
- **description**: Detailed policy description (string)
- **version**: Semantic version (string, e.g., "1.0", "2.1.3")

### Optional Metadata

```yaml
metadata:
  author: "John Doe <john@company.com>"
  created: "2024-01-01T00:00:00Z"
  updated: "2024-01-15T10:30:00Z"
  tags: ["safety", "content-filter", "production"]
  category: "content-safety"
  priority: "high"  # low, medium, high, critical
  compliance_frameworks: ["gdpr", "hipaa", "iso27001"]
  documentation_url: "https://docs.company.com/policies/safety"
```

## Evaluators

Evaluators are the components that perform the actual content evaluation. They must be defined before being used in rules.

### Basic Evaluator Definition

```yaml
evaluators:
  - id: "550e8400-e29b-41d4-a716-446655440000"
    name: "content_safety"
    type: "llm"  # llm, custom, builtin
    config:
      provider: "openai"
      model: "gpt-4"
      temperature: 0.1
      system_prompt: "You are a content safety evaluator..."
```

### Evaluator Types

#### 1. LLM Evaluators

```yaml
evaluators:
  - name: "llm_safety_check"
    type: "llm"
    config:
      provider: "openai"  # openai, anthropic, google, azure
      model: "gpt-4"
      temperature: 0.0
      max_tokens: 500
      system_prompt: |
        Evaluate the safety of the AI response. Return a JSON object with:
        - safety_score: float between 0-1
        - violations: list of detected violations
        - reasoning: explanation of the evaluation
      response_format: "json"
```

#### 2. Custom Code Evaluators

```yaml
evaluators:
  - name: "custom_profanity_filter"
    type: "custom"
    config:
      language: "python"
      dependencies: ["nltk", "textblob"]
      code: |
        import re
        from typing import Dict, Any
        
        def evaluate(prompt: str, response: str, context: Dict[str, Any]) -> Dict[str, Any]:
            profanity_words = ["badword1", "badword2"]
            violations = []
            
            for word in profanity_words:
                if word.lower() in response.lower():
                    violations.append(word)
            
            safety_score = 1.0 - (len(violations) * 0.2)
            
            return {
                "safety_score": max(0.0, safety_score),
                "violations": violations,
                "passed": len(violations) == 0,
                "details": {
                    "checked_words": len(profanity_words),
                    "found_violations": len(violations)
                }
            }
```

#### 3. Built-in Evaluators

```yaml
evaluators:
  - name: "toxicity_detector"
    type: "builtin"
    config:
      model: "detoxify"
      threshold: 0.8
      categories: ["toxicity", "severe_toxicity", "obscene", "threat"]
  
  - name: "pii_detector"
    type: "builtin"
    config:
      model: "presidio"
      entities: ["PERSON", "EMAIL", "PHONE_NUMBER", "SSN"]
      confidence_threshold: 0.8
```

## Rules

Rules define the governance logic by combining evaluators with thresholds and actions.

### Basic Rule Structure

```yaml
rules:
  - name: "safety_check"
    description: "Ensure response safety"
    evaluator: "content_safety"
    threshold: 0.8
    action: "block"
    enabled: true
    priority: 100
```

### Rule Fields

- **name**: Unique rule identifier
- **description**: Human-readable description
- **evaluator**: Reference to evaluator name
- **threshold**: Minimum score required (0.0-1.0)
- **action**: Action to take when rule fails
- **enabled**: Whether rule is active (default: true)
- **priority**: Rule execution order (higher = first)

### Advanced Rule Configuration

```yaml
rules:
  - name: "comprehensive_safety"
    description: "Multi-factor safety evaluation"
    evaluator: "safety_evaluator"
    threshold: 0.7
    action: "block"
    enabled: true
    priority: 100
    
    # Conditional execution
    conditions:
      - field: "user.role"
        operator: "not_in"
        value: ["admin", "moderator"]
      - field: "content.type"
        operator: "equals"
        value: "public"
    
    # Custom action parameters
    action_config:
      message: "Content blocked due to safety concerns"
      redirect_url: "/safety-guidelines"
      log_level: "warning"
      notify_admins: true
    
    # Rule-specific settings
    settings:
      timeout: 15
      cache_duration: 300
      retry_on_failure: true
```

## Actions

Actions define what happens when a rule is triggered (fails its threshold).

### Standard Actions

#### 1. Block
```yaml
action: "block"
action_config:
  message: "Content violates safety policy"
  error_code: "SAFETY_VIOLATION"
  http_status: 403
```

#### 2. Warn
```yaml
action: "warn"
action_config:
  message: "Content may violate policy"
  log_level: "warning"
  continue_processing: true
```

#### 3. Flag
```yaml
action: "flag"
action_config:
  severity: "medium"  # low, medium, high, critical
  assignee: "content-review-team"
  auto_escalate_after: "24h"
```

#### 4. Modify
```yaml
action: "modify"
action_config:
  strategy: "redact"  # redact, replace, summarize
  replacement_text: "[REDACTED]"
  preserve_meaning: true
```

#### 5. Require Review
```yaml
action: "require_review"
action_config:
  reviewer_role: "content_moderator"
  max_review_time: "2h"
  auto_approve_after: "24h"
```

### Custom Actions

```yaml
action: "custom"
action_config:
  webhook_url: "https://api.company.com/policy-violation"
  method: "POST"
  headers:
    Authorization: "Bearer ${WEBHOOK_TOKEN}"
  payload:
    violation_type: "{{rule.name}}"
    content_hash: "{{content.hash}}"
    timestamp: "{{timestamp}}"
```

## Conditions

Conditions allow rules to be applied selectively based on context.

### Condition Operators

- **equals**: Exact match
- **not_equals**: Not equal
- **contains**: String contains substring
- **not_contains**: String does not contain
- **starts_with**: String starts with prefix
- **ends_with**: String ends with suffix
- **in**: Value in list
- **not_in**: Value not in list
- **greater_than**: Numeric comparison
- **less_than**: Numeric comparison
- **regex_match**: Regular expression match

### Context Fields

Common context fields available for conditions:

```yaml
conditions:
  # User context
  - field: "user.id"
    operator: "equals"
    value: "user-123"
  
  - field: "user.role"
    operator: "in"
    value: ["admin", "moderator"]
  
  - field: "user.subscription_tier"
    operator: "equals"
    value: "premium"
  
  # Content context
  - field: "content.type"
    operator: "equals"
    value: "chat_message"
  
  - field: "content.length"
    operator: "greater_than"
    value: 1000
  
  - field: "content.language"
    operator: "in"
    value: ["en", "es", "fr"]
  
  # Request context
  - field: "request.ip"
    operator: "not_in"
    value: ["192.168.1.0/24"]
  
  - field: "request.user_agent"
    operator: "contains"
    value: "bot"
  
  # Time context
  - field: "time.hour"
    operator: "greater_than"
    value: 9
  
  - field: "time.day_of_week"
    operator: "in"
    value: ["monday", "tuesday", "wednesday", "thursday", "friday"]
```

## Advanced Features

### 1. Rule Chaining

```yaml
rules:
  - name: "initial_safety_check"
    evaluator: "basic_safety"
    threshold: 0.9
    action: "continue"  # Special action to continue to next rule
    
  - name: "detailed_safety_check"
    evaluator: "advanced_safety"
    threshold: 0.8
    action: "block"
    conditions:
      - field: "previous_rule.initial_safety_check.score"
        operator: "less_than"
        value: 0.95
```

### 2. Dynamic Thresholds

```yaml
rules:
  - name: "adaptive_safety"
    evaluator: "safety_evaluator"
    threshold: "dynamic"
    threshold_config:
      base_threshold: 0.8
      user_trust_modifier: 0.1  # Increase threshold for trusted users
      content_sensitivity_modifier: -0.2  # Decrease for sensitive content
      time_of_day_modifier:
        "09:00-17:00": 0.0  # Business hours
        "17:00-09:00": -0.1  # Outside business hours
```

### 3. Multi-Evaluator Rules

```yaml
rules:
  - name: "consensus_safety"
    description: "Require multiple evaluators to agree"
    evaluators:
      - name: "safety_eval_1"
        weight: 0.4
      - name: "safety_eval_2"
        weight: 0.4
      - name: "safety_eval_3"
        weight: 0.2
    consensus_strategy: "weighted_average"  # majority, unanimous, weighted_average
    threshold: 0.8
    action: "block"
```

### 4. Feedback Loops

```yaml
rules:
  - name: "learning_safety_check"
    evaluator: "ml_safety_model"
    threshold: 0.8
    action: "flag"
    feedback_config:
      collect_user_feedback: true
      update_model: true
      feedback_weight: 0.1
      min_feedback_count: 10
```

## Examples

### 1. Basic Content Safety Policy

```yaml
name: "Basic Content Safety"
description: "Prevents harmful content generation"
version: "1.0"

evaluators:
  - name: "safety_check"
    type: "llm"
    config:
      provider: "openai"
      model: "gpt-4"
      system_prompt: |
        Evaluate if the AI response contains harmful content.
        Return a safety score from 0-1 where 1 is completely safe.

rules:
  - name: "block_unsafe_content"
    description: "Block responses with safety score below threshold"
    evaluator: "safety_check"
    threshold: 0.8
    action: "block"
    action_config:
      message: "Response blocked due to safety concerns"
```

### 2. Comprehensive Enterprise Policy

```yaml
name: "Enterprise Content Governance"
description: "Comprehensive policy for enterprise AI usage"
version: "2.1"

metadata:
  author: "AI Governance Team"
  compliance_frameworks: ["gdpr", "hipaa", "sox"]
  category: "enterprise-governance"

evaluators:
  - name: "safety_evaluator"
    type: "llm"
    config:
      provider: "openai"
      model: "gpt-4"
      temperature: 0.0
  
  - name: "pii_detector"
    type: "builtin"
    config:
      model: "presidio"
      entities: ["PERSON", "EMAIL", "SSN", "CREDIT_CARD"]
  
  - name: "compliance_checker"
    type: "custom"
    config:
      compliance_rules: ["gdpr", "hipaa"]

rules:
  - name: "safety_gate"
    description: "Primary safety check"
    evaluator: "safety_evaluator"
    threshold: 0.9
    action: "block"
    priority: 100
    
  - name: "pii_protection"
    description: "Detect and redact PII"
    evaluator: "pii_detector"
    threshold: 0.8
    action: "modify"
    action_config:
      strategy: "redact"
    priority: 90
    
  - name: "compliance_review"
    description: "Flag for compliance review"
    evaluator: "compliance_checker"
    threshold: 0.7
    action: "require_review"
    action_config:
      reviewer_role: "compliance_officer"
    priority: 80
    conditions:
      - field: "content.category"
        operator: "in"
        value: ["financial", "medical", "legal"]

settings:
  timeout: 45
  cache_results: true
  audit_all_evaluations: true
```

### 3. Multi-Language Policy

```yaml
name: "Multi-Language Content Policy"
description: "Governance policy supporting multiple languages"
version: "1.0"

evaluators:
  - name: "language_detector"
    type: "builtin"
    config:
      model: "langdetect"
  
  - name: "en_safety"
    type: "llm"
    config:
      provider: "openai"
      model: "gpt-4"
      system_prompt: "Evaluate English content safety..."
  
  - name: "es_safety"
    type: "llm"
    config:
      provider: "openai"
      model: "gpt-4"
      system_prompt: "Evalúa la seguridad del contenido en español..."

rules:
  - name: "detect_language"
    evaluator: "language_detector"
    threshold: 0.8
    action: "continue"
    priority: 100
    
  - name: "english_safety"
    evaluator: "en_safety"
    threshold: 0.8
    action: "block"
    priority: 90
    conditions:
      - field: "previous_rule.detect_language.detected_language"
        operator: "equals"
        value: "en"
        
  - name: "spanish_safety"
    evaluator: "es_safety"
    threshold: 0.8
    action: "block"
    priority: 90
    conditions:
      - field: "previous_rule.detect_language.detected_language"
        operator: "equals"
        value: "es"
```

## Best Practices

### 1. Policy Organization

- **Use semantic versioning** for policy versions
- **Group related rules** by priority and function
- **Document all custom evaluators** thoroughly
- **Use descriptive names** for rules and evaluators

### 2. Performance Optimization

```yaml
# Cache expensive evaluations
settings:
  cache_results: true
  cache_duration: 3600  # 1 hour

# Set appropriate timeouts
rules:
  - name: "quick_check"
    settings:
      timeout: 5  # Fast check
  - name: "thorough_analysis"
    settings:
      timeout: 30  # More complex evaluation
```

### 3. Error Handling

```yaml
rules:
  - name: "safety_with_fallback"
    evaluator: "primary_safety"
    threshold: 0.8
    action: "block"
    fallback:
      evaluator: "backup_safety"
      on_error: "warn"  # warn, block, allow
```

### 4. Testing and Validation

```yaml
# Include test cases in policy
test_cases:
  - name: "safe_content_test"
    input:
      prompt: "Tell me about renewable energy"
      response: "Renewable energy sources include solar, wind, and hydroelectric power..."
    expected_result: "pass"
    
  - name: "unsafe_content_test"
    input:
      prompt: "How to harm someone"
      response: "I cannot and will not provide information on harming others."
    expected_result: "pass"  # Should pass because response is appropriate
```

### 5. Security Considerations

- **Never include sensitive credentials** in policy YAML
- **Use environment variables** for secrets
- **Validate all inputs** from external evaluators
- **Implement rate limiting** for expensive operations

```yaml
evaluators:
  - name: "external_api"
    config:
      api_key: "${EXTERNAL_API_KEY}"  # Use environment variable
      rate_limit: 100  # requests per minute
      timeout: 10
```

## Validation

### Schema Validation

All policies are validated against a JSON schema before deployment:

```bash
# Validate policy file
crossaudit policy validate policy.yaml

# Test policy with sample data
crossaudit policy test policy.yaml --input test_cases.json

# Deploy policy
crossaudit policy deploy policy.yaml --environment production
```

### Common Validation Errors

1. **Missing required fields**
   ```yaml
   # ❌ Missing required fields
   name: "Test Policy"
   # Missing description and version
   
   # ✅ Correct
   name: "Test Policy"
   description: "Test policy description"
   version: "1.0"
   ```

2. **Invalid evaluator references**
   ```yaml
   # ❌ Undefined evaluator
   rules:
     - name: "test_rule"
       evaluator: "undefined_evaluator"  # Not defined in evaluators section
   
   # ✅ Correct
   evaluators:
     - name: "safety_check"
       type: "llm"
   rules:
     - name: "test_rule"
       evaluator: "safety_check"
   ```

3. **Invalid threshold values**
   ```yaml
   # ❌ Invalid threshold
   rules:
     - name: "test_rule"
       threshold: 1.5  # Must be between 0.0 and 1.0
   
   # ✅ Correct
   rules:
     - name: "test_rule"
       threshold: 0.8
   ```

### Testing Framework

```python
# Python testing example
from crossaudit import PolicyTester

def test_safety_policy():
    tester = PolicyTester("safety_policy.yaml")
    
    # Test safe content
    result = tester.evaluate(
        prompt="Tell me about science",
        response="Science is the systematic study of the natural world..."
    )
    assert result.passed is True
    
    # Test unsafe content
    result = tester.evaluate(
        prompt="How to harm someone",
        response="Here's how to cause harm..."
    )
    assert result.passed is False
    assert result.action == "block"
```

This comprehensive guide covers all aspects of the CrossAudit AI Policy DSL, from basic syntax to advanced features and best practices. Use this as a reference when creating and maintaining your AI governance policies.