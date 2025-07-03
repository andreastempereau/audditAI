# CrossAudit AI Policy DSL Quick Reference

## Basic Policy Template

```yaml
name: "Policy Name"
description: "Policy description"
version: "1.0"

evaluators:
  - name: "evaluator_name"
    type: "llm"  # llm, custom, builtin
    config: {}

rules:
  - name: "rule_name"
    evaluator: "evaluator_name"
    threshold: 0.8
    action: "block"  # block, warn, flag, modify, require_review
    enabled: true
```

## Evaluator Types

### LLM Evaluator
```yaml
evaluators:
  - name: "safety_llm"
    type: "llm"
    config:
      provider: "openai"  # openai, anthropic, google, azure
      model: "gpt-4"
      temperature: 0.0
      system_prompt: "Evaluate content safety..."
```

### Custom Code Evaluator
```yaml
evaluators:
  - name: "custom_filter"
    type: "custom"
    config:
      code: |
        def evaluate(prompt, response, context):
            return {"score": 0.8, "passed": True}
```

### Built-in Evaluator
```yaml
evaluators:
  - name: "toxicity_check"
    type: "builtin"
    config:
      model: "detoxify"
      threshold: 0.8
```

## Actions

| Action | Description | Config Options |
|--------|-------------|----------------|
| `block` | Stop processing | `message`, `error_code`, `http_status` |
| `warn` | Log warning, continue | `message`, `log_level` |
| `flag` | Mark for review | `severity`, `assignee` |
| `modify` | Alter content | `strategy`, `replacement_text` |
| `require_review` | Require human review | `reviewer_role`, `max_review_time` |

## Conditions

```yaml
conditions:
  - field: "user.role"
    operator: "in"  # equals, not_equals, in, not_in, contains, greater_than, less_than
    value: ["admin", "moderator"]
```

### Common Context Fields
- `user.id`, `user.role`, `user.subscription_tier`
- `content.type`, `content.length`, `content.language`
- `request.ip`, `request.user_agent`
- `time.hour`, `time.day_of_week`

## Advanced Features

### Multi-Evaluator Rules
```yaml
rules:
  - name: "consensus_check"
    evaluators:
      - name: "eval1"
        weight: 0.5
      - name: "eval2"
        weight: 0.5
    consensus_strategy: "weighted_average"
    threshold: 0.8
```

### Dynamic Thresholds
```yaml
rules:
  - name: "adaptive_rule"
    threshold: "dynamic"
    threshold_config:
      base_threshold: 0.8
      user_trust_modifier: 0.1
```

### Rule Chaining
```yaml
rules:
  - name: "first_check"
    action: "continue"
  - name: "second_check"
    conditions:
      - field: "previous_rule.first_check.score"
        operator: "less_than"
        value: 0.9
```

## Policy Examples

### Basic Safety Policy
```yaml
name: "Content Safety"
description: "Basic content safety checking"
version: "1.0"

evaluators:
  - name: "safety"
    type: "llm"
    config:
      provider: "openai"
      model: "gpt-4"
      system_prompt: "Rate content safety 0-1"

rules:
  - name: "safety_check"
    evaluator: "safety"
    threshold: 0.8
    action: "block"
```

### Enterprise Policy
```yaml
name: "Enterprise Governance"
description: "Comprehensive enterprise policy"
version: "2.0"

evaluators:
  - name: "safety_eval"
    type: "llm"
    config:
      provider: "openai"
      model: "gpt-4"
  - name: "pii_detector"
    type: "builtin"
    config:
      model: "presidio"

rules:
  - name: "safety_gate"
    evaluator: "safety_eval"
    threshold: 0.9
    action: "block"
    priority: 100
    
  - name: "pii_protection"
    evaluator: "pii_detector"
    threshold: 0.8
    action: "modify"
    action_config:
      strategy: "redact"
    priority: 90
```

### Conditional Policy
```yaml
name: "Role-Based Policy"
description: "Different rules for different user roles"
version: "1.0"

evaluators:
  - name: "content_check"
    type: "llm"
    config:
      provider: "openai"
      model: "gpt-4"

rules:
  - name: "strict_check"
    evaluator: "content_check"
    threshold: 0.95
    action: "block"
    conditions:
      - field: "user.role"
        operator: "equals"
        value: "standard"
        
  - name: "relaxed_check"
    evaluator: "content_check"
    threshold: 0.7
    action: "warn"
    conditions:
      - field: "user.role"
        operator: "in"
        value: ["admin", "moderator"]
```

## CLI Commands

```bash
# Validate policy
crossaudit policy validate policy.yaml

# Test policy
crossaudit policy test policy.yaml --input test_data.json

# Deploy policy
crossaudit policy deploy policy.yaml --environment production

# List policies
crossaudit policy list

# Get policy status
crossaudit policy status policy-id

# Activate/deactivate policy
crossaudit policy activate policy-id
crossaudit policy deactivate policy-id
```

## Best Practices

1. **Use semantic versioning** for policy versions
2. **Test policies thoroughly** before production deployment
3. **Document all custom evaluators** with clear descriptions
4. **Set appropriate timeouts** for evaluators
5. **Use conditions** to apply rules selectively
6. **Monitor policy performance** and adjust thresholds as needed
7. **Keep policies modular** and focused on specific concerns
8. **Use descriptive names** for policies, rules, and evaluators

## Common Patterns

### Multi-Stage Filtering
```yaml
rules:
  - name: "quick_filter"
    evaluator: "fast_check"
    threshold: 0.5
    action: "continue"
    
  - name: "detailed_analysis"
    evaluator: "thorough_check"
    threshold: 0.8
    action: "block"
    conditions:
      - field: "previous_rule.quick_filter.score"
        operator: "less_than"
        value: 0.8
```

### Escalation Pattern
```yaml
rules:
  - name: "auto_check"
    threshold: 0.9
    action: "block"
    
  - name: "review_required"
    threshold: 0.7
    action: "require_review"
    conditions:
      - field: "previous_rule.auto_check.passed"
        operator: "equals"
        value: false
```

### Time-Based Rules
```yaml
rules:
  - name: "business_hours_check"
    threshold: 0.8
    action: "block"
    conditions:
      - field: "time.hour"
        operator: "greater_than"
        value: 9
      - field: "time.hour"
        operator: "less_than"
        value: 17
```

This quick reference provides the essential syntax and patterns for creating effective CrossAudit AI policies.