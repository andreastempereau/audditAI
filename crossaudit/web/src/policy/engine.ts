import { PolicyRule, EvaluationResult } from '../gateway/types';

export interface PolicyDecision {
  action: 'PASS' | 'REWRITE' | 'BLOCK' | 'FLAG';
  confidence: number;
  appliedRules: string[];
  rewrite?: string;
  reasoning: string;
}

interface PolicyContext {
  clientId: string;
  userId?: string;
  requestType: string;
  timeOfDay: string;
  dayOfWeek: string;
  evaluationScores: any;
}

export class PolicyEngine {
  private rules: Map<string, PolicyRule[]> = new Map(); // clientId -> rules
  private globalRules: PolicyRule[] = [];
  
  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    // Global safety rules that apply to all clients
    this.globalRules = [
      {
        id: 'global-toxicity',
        name: 'Toxicity Block',
        description: 'Block responses with high toxicity scores',
        condition: 'toxicity < 0.3',
        action: 'BLOCK',
        severity: 'CRITICAL',
        enabled: true
      },
      {
        id: 'global-compliance',
        name: 'Compliance Violation',
        description: 'Block responses with critical compliance violations',
        condition: 'policyCompliance < 0.2',
        action: 'BLOCK',
        severity: 'CRITICAL',
        enabled: true
      },
      {
        id: 'global-accuracy',
        name: 'Factual Accuracy',
        description: 'Rewrite responses with low factual accuracy',
        condition: 'factualAccuracy < 0.5',
        action: 'REWRITE',
        severity: 'HIGH',
        rewriteTemplate: 'Add accuracy disclaimer',
        enabled: true
      },
      {
        id: 'global-brand',
        name: 'Brand Alignment',
        description: 'Flag responses with poor brand alignment',
        condition: 'brandAlignment < 0.6',
        action: 'FLAG',
        severity: 'MEDIUM',
        enabled: true
      }
    ];
  }

  async evaluatePolicy(
    evaluation: EvaluationResult,
    context: PolicyContext
  ): Promise<PolicyDecision> {
    try {
      const clientRules = this.rules.get(context.clientId) || [];
      const allRules = [...this.globalRules, ...clientRules].filter(rule => rule.enabled);

      const appliedRules: string[] = [];
      let finalAction: 'PASS' | 'REWRITE' | 'BLOCK' | 'FLAG' = 'PASS';
      let rewrite: string | undefined;
      let reasoning = 'No policy violations detected';
      let confidence = 1.0;

      // Evaluate each rule
      for (const rule of allRules) {
        const ruleApplies = await this.evaluateRuleCondition(
          rule.condition,
          evaluation,
          context
        );

        if (ruleApplies) {
          appliedRules.push(rule.id);
          
          // Apply action precedence: BLOCK > REWRITE > FLAG > PASS
          if (rule.action === 'BLOCK') {
            finalAction = 'BLOCK';
            reasoning = `Blocked due to: ${rule.description}`;
            confidence = 0.95;
            break; // BLOCK is final
          } else if (rule.action === 'REWRITE' && finalAction !== 'BLOCK') {
            finalAction = 'REWRITE';
            rewrite = await this.generateRewrite(rule, evaluation, context);
            reasoning = `Rewritten due to: ${rule.description}`;
            confidence = 0.8;
          } else if (rule.action === 'FLAG' && finalAction === 'PASS') {
            finalAction = 'FLAG';
            reasoning = `Flagged due to: ${rule.description}`;
            confidence = 0.7;
          }
        }
      }

      // Apply business logic overrides
      const businessOverride = await this.applyBusinessLogic(
        evaluation,
        context,
        finalAction
      );

      if (businessOverride) {
        finalAction = businessOverride.action;
        reasoning += ` (Business override: ${businessOverride.reason})`;
        rewrite = businessOverride.rewrite || rewrite;
      }

      return {
        action: finalAction,
        confidence,
        appliedRules,
        rewrite,
        reasoning
      };

    } catch (error) {
      console.error('Policy evaluation error:', error);
      
      // Safe default - allow with flag
      return {
        action: 'FLAG',
        confidence: 0.0,
        appliedRules: [],
        reasoning: 'Policy evaluation failed - defaulting to FLAG'
      };
    }
  }

  private async evaluateRuleCondition(
    condition: string,
    evaluation: EvaluationResult,
    context: PolicyContext
  ): Promise<boolean> {
    try {
      // Simple DSL parser for policy conditions
      return this.parsePolicyDSL(condition, evaluation, context);
    } catch (error) {
      console.error('Rule condition evaluation error:', error);
      return false;
    }
  }

  private parsePolicyDSL(
    condition: string,
    evaluation: EvaluationResult,
    context: PolicyContext
  ): boolean {
    // Basic DSL support - in production this would be more sophisticated
    const normalizedCondition = condition.toLowerCase().trim();
    
    // Handle score conditions (e.g., "toxicity < 0.3")
    const scoreMatch = normalizedCondition.match(/(\w+)\s*([<>=!]+)\s*([\d.]+)/);
    if (scoreMatch) {
      const [, scoreType, operator, threshold] = scoreMatch;
      const scoreValue = this.getScoreValue(scoreType, evaluation);
      const thresholdValue = parseFloat(threshold);
      
      switch (operator) {
        case '<': return scoreValue < thresholdValue;
        case '<=': return scoreValue <= thresholdValue;
        case '>': return scoreValue > thresholdValue;
        case '>=': return scoreValue >= thresholdValue;
        case '=': case '==': return Math.abs(scoreValue - thresholdValue) < 0.001;
        case '!=': return Math.abs(scoreValue - thresholdValue) >= 0.001;
        default: return false;
      }
    }

    // Handle violation conditions (e.g., "contains violations")
    if (normalizedCondition.includes('violations')) {
      if (normalizedCondition.includes('contains')) {
        return evaluation.violations.length > 0;
      }
      if (normalizedCondition.includes('count')) {
        const countMatch = normalizedCondition.match(/count\s*([<>=!]+)\s*(\d+)/);
        if (countMatch) {
          const [, operator, threshold] = countMatch;
          const count = evaluation.violations.length;
          const thresholdValue = parseInt(threshold);
          
          switch (operator) {
            case '<': return count < thresholdValue;
            case '<=': return count <= thresholdValue;
            case '>': return count > thresholdValue;
            case '>=': return count >= thresholdValue;
            case '=': case '==': return count === thresholdValue;
            case '!=': return count !== thresholdValue;
            default: return false;
          }
        }
      }
    }

    // Handle time-based conditions
    if (normalizedCondition.includes('time')) {
      return this.evaluateTimeCondition(normalizedCondition, context);
    }

    // Handle user-based conditions
    if (normalizedCondition.includes('user')) {
      return this.evaluateUserCondition(normalizedCondition, context);
    }

    // Handle complex conditions with AND/OR
    if (normalizedCondition.includes('and') || normalizedCondition.includes('or')) {
      return this.evaluateComplexCondition(normalizedCondition, evaluation, context);
    }

    return false;
  }

  private getScoreValue(scoreType: string, evaluation: EvaluationResult): number {
    switch (scoreType.toLowerCase()) {
      case 'toxicity': return evaluation.evaluationScores.toxicity;
      case 'policycompliance': case 'compliance': 
        return evaluation.evaluationScores.policyCompliance;
      case 'factualaccuracy': case 'accuracy': 
        return evaluation.evaluationScores.factualAccuracy;
      case 'brandalignment': case 'brand': 
        return evaluation.evaluationScores.brandAlignment;
      case 'overall': return evaluation.evaluationScores.overall;
      case 'confidence': return evaluation.confidence;
      default: return 1.0;
    }
  }

  private evaluateTimeCondition(condition: string, context: PolicyContext): boolean {
    const timeOfDay = parseInt(context.timeOfDay.split(':')[0]);
    
    if (condition.includes('business hours')) {
      return timeOfDay >= 9 && timeOfDay <= 17;
    }
    if (condition.includes('after hours')) {
      return timeOfDay < 9 || timeOfDay > 17;
    }
    if (condition.includes('weekend')) {
      return context.dayOfWeek === 'Saturday' || context.dayOfWeek === 'Sunday';
    }
    if (condition.includes('weekday')) {
      return !['Saturday', 'Sunday'].includes(context.dayOfWeek);
    }
    
    return false;
  }

  private evaluateUserCondition(condition: string, context: PolicyContext): boolean {
    // In production, this would query user roles/permissions
    if (condition.includes('admin')) {
      return context.userId?.includes('admin') || false;
    }
    if (condition.includes('guest')) {
      return !context.userId;
    }
    
    return false;
  }

  private evaluateComplexCondition(
    condition: string,
    evaluation: EvaluationResult,
    context: PolicyContext
  ): boolean {
    // Simple AND/OR logic - in production this would use a proper parser
    if (condition.includes(' and ')) {
      const parts = condition.split(' and ');
      return parts.every(part => this.parsePolicyDSL(part.trim(), evaluation, context));
    }
    
    if (condition.includes(' or ')) {
      const parts = condition.split(' or ');
      return parts.some(part => this.parsePolicyDSL(part.trim(), evaluation, context));
    }
    
    return false;
  }

  private async generateRewrite(
    rule: PolicyRule,
    evaluation: EvaluationResult,
    context: PolicyContext
  ): Promise<string | undefined> {
    if (!rule.rewriteTemplate) return undefined;

    // Simple template system - in production this would be more sophisticated
    let rewrite = rule.rewriteTemplate;

    // Replace template variables
    rewrite = rewrite.replace(/\{rule_name\}/g, rule.name);
    rewrite = rewrite.replace(/\{violations\}/g, evaluation.violations.join(', '));
    rewrite = rewrite.replace(/\{score\}/g, evaluation.score.toString());

    // Add context-specific rewrites
    if (rule.rewriteTemplate === 'Add accuracy disclaimer') {
      rewrite = '\n\n*Please note: This information should be independently verified for accuracy.*';
    } else if (rule.rewriteTemplate === 'Add compliance disclaimer') {
      rewrite = '\n\n*This response has been reviewed for compliance purposes.*';
    }

    return rewrite;
  }

  private async applyBusinessLogic(
    evaluation: EvaluationResult,
    context: PolicyContext,
    currentAction: string
  ): Promise<{ action: 'PASS' | 'REWRITE' | 'BLOCK' | 'FLAG'; reason: string; rewrite?: string } | null> {
    
    // Example business logic overrides
    
    // During business hours, be more lenient
    if (this.evaluateTimeCondition('business hours', context) && currentAction === 'BLOCK') {
      if (evaluation.evaluationScores.overall > 0.3) {
        return {
          action: 'REWRITE',
          reason: 'Business hours leniency applied',
          rewrite: '\n\n*This response has been modified for compliance.*'
        };
      }
    }

    // For admin users, allow more content through with flags
    if (context.userId?.includes('admin') && currentAction === 'BLOCK') {
      if (evaluation.evaluationScores.toxicity > 0.1) {
        return {
          action: 'FLAG',
          reason: 'Admin user override'
        };
      }
    }

    // High-confidence evaluations get stronger actions
    if (evaluation.confidence > 0.9 && currentAction === 'FLAG') {
      return {
        action: 'REWRITE',
        reason: 'High confidence evaluation',
        rewrite: '\n\n*This response has been enhanced for quality.*'
      };
    }

    return null;
  }

  // Admin methods for managing rules
  async addRule(clientId: string, rule: PolicyRule): Promise<void> {
    if (!this.rules.has(clientId)) {
      this.rules.set(clientId, []);
    }
    this.rules.get(clientId)!.push(rule);
  }

  async updateRule(clientId: string, ruleId: string, updates: Partial<PolicyRule>): Promise<boolean> {
    const clientRules = this.rules.get(clientId);
    if (!clientRules) return false;

    const ruleIndex = clientRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) return false;

    clientRules[ruleIndex] = { ...clientRules[ruleIndex], ...updates };
    return true;
  }

  async removeRule(clientId: string, ruleId: string): Promise<boolean> {
    const clientRules = this.rules.get(clientId);
    if (!clientRules) return false;

    const ruleIndex = clientRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) return false;

    clientRules.splice(ruleIndex, 1);
    return true;
  }

  async getRules(clientId: string): Promise<PolicyRule[]> {
    return this.rules.get(clientId) || [];
  }

  async getGlobalRules(): Promise<PolicyRule[]> {
    return [...this.globalRules];
  }

  async testRule(
    rule: PolicyRule,
    evaluation: EvaluationResult,
    context: PolicyContext
  ): Promise<{ applies: boolean; reasoning: string }> {
    try {
      const applies = await this.evaluateRuleCondition(rule.condition, evaluation, context);
      return {
        applies,
        reasoning: applies 
          ? `Rule "${rule.name}" applies: ${rule.description}`
          : `Rule "${rule.name}" does not apply`
      };
    } catch (error) {
      return {
        applies: false,
        reasoning: `Rule evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test basic policy evaluation
      const testEvaluation: EvaluationResult = {
        score: 0.8,
        violations: [],
        action: 'PASS',
        evaluationScores: {
          toxicity: 0.9,
          policyCompliance: 0.8,
          factualAccuracy: 0.7,
          brandAlignment: 0.8,
          overall: 0.8
        },
        confidence: 0.8,
        documentsUsed: []
      };

      const testContext: PolicyContext = {
        clientId: 'test',
        requestType: 'chat',
        timeOfDay: '14:30',
        dayOfWeek: 'Monday',
        evaluationScores: testEvaluation.evaluationScores
      };

      const decision = await this.evaluatePolicy(testEvaluation, testContext);
      return decision.action !== undefined && decision.confidence >= 0;
    } catch (error) {
      console.error('Policy engine health check failed:', error);
      return false;
    }
  }

  // Method to get policy statistics
  async getPolicyStats(clientId: string): Promise<{
    totalRules: number;
    enabledRules: number;
    rulesByAction: Record<string, number>;
    rulesBySeverity: Record<string, number>;
  }> {
    const clientRules = this.rules.get(clientId) || [];
    const allRules = [...this.globalRules, ...clientRules];

    const stats = {
      totalRules: allRules.length,
      enabledRules: allRules.filter(rule => rule.enabled).length,
      rulesByAction: {} as Record<string, number>,
      rulesBySeverity: {} as Record<string, number>
    };

    // Count by action
    for (const rule of allRules) {
      stats.rulesByAction[rule.action] = (stats.rulesByAction[rule.action] || 0) + 1;
    }

    // Count by severity
    for (const rule of allRules) {
      stats.rulesBySeverity[rule.severity] = (stats.rulesBySeverity[rule.severity] || 0) + 1;
    }

    return stats;
  }
}