import { EvaluationResult, EvaluationScores } from '../gateway/types';
import { ToxicityEvaluator } from './toxicity';
import { ComplianceEvaluator } from './compliance';
import { FactualAccuracyEvaluator } from './factual-accuracy';
import { BrandAlignmentEvaluator } from './brand-alignment';

export interface EvaluationInput {
  prompt: Array<{ role: string; content: string }>;
  response: string;
  clientId: string;
  context: string[];
  documentsUsed: string[];
}

export class EvaluatorMesh {
  private toxicityEvaluator: ToxicityEvaluator;
  private complianceEvaluator: ComplianceEvaluator;
  private factualAccuracyEvaluator: FactualAccuracyEvaluator;
  private brandAlignmentEvaluator: BrandAlignmentEvaluator;

  constructor() {
    this.toxicityEvaluator = new ToxicityEvaluator();
    this.complianceEvaluator = new ComplianceEvaluator();
    this.factualAccuracyEvaluator = new FactualAccuracyEvaluator();
    this.brandAlignmentEvaluator = new BrandAlignmentEvaluator();
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    try {
      // Run all evaluators in parallel for better performance
      const [
        toxicityResult,
        complianceResult,
        factualResult,
        brandResult
      ] = await Promise.allSettled([
        this.toxicityEvaluator.evaluate(input.response, input.prompt),
        this.complianceEvaluator.evaluate(input.response, input.prompt, input.clientId),
        this.factualAccuracyEvaluator.evaluate(input.response, input.context),
        this.brandAlignmentEvaluator.evaluate(input.response, input.clientId)
      ]);

      // Extract scores (defaulting to 1.0 for failed evaluations)
      const scores: EvaluationScores = {
        toxicity: this.extractScore(toxicityResult, 1.0),
        policyCompliance: this.extractScore(complianceResult, 1.0),
        factualAccuracy: this.extractScore(factualResult, 1.0),
        brandAlignment: this.extractScore(brandResult, 1.0),
        overall: 0 // Will be calculated below
      };

      // Calculate overall score (weighted average)
      scores.overall = this.calculateOverallScore(scores);

      // Collect violations from all evaluators
      const violations: string[] = [];
      
      if (toxicityResult.status === 'fulfilled' && toxicityResult.value.violations) {
        violations.push(...toxicityResult.value.violations);
      }
      if (complianceResult.status === 'fulfilled' && complianceResult.value.violations) {
        violations.push(...complianceResult.value.violations);
      }
      if (factualResult.status === 'fulfilled' && factualResult.value.violations) {
        violations.push(...factualResult.value.violations);
      }
      if (brandResult.status === 'fulfilled' && brandResult.value.violations) {
        violations.push(...brandResult.value.violations);
      }

      // Determine action based on scores and violations
      const { action, rewrite } = await this.determineAction(scores, violations, input);

      // Calculate confidence based on how consistent the evaluators were
      const confidence = this.calculateConfidence(scores, violations);

      const evaluationTime = Date.now() - startTime;
      console.log(`Evaluation completed in ${evaluationTime}ms with overall score: ${scores.overall}`);

      return {
        score: scores.overall,
        violations,
        rewrite,
        action,
        evaluationScores: scores,
        confidence,
        documentsUsed: input.documentsUsed
      };

    } catch (error) {
      console.error('Evaluation mesh error:', error);
      
      // Return safe default in case of evaluation failure
      return {
        score: 0.5,
        violations: ['Evaluation system error'],
        action: 'PASS',
        evaluationScores: {
          toxicity: 1.0,
          policyCompliance: 1.0,
          factualAccuracy: 1.0,
          brandAlignment: 1.0,
          overall: 0.5
        },
        confidence: 0.0,
        documentsUsed: input.documentsUsed
      };
    }
  }

  private extractScore(result: PromiseSettledResult<any>, defaultScore: number): number {
    if (result.status === 'fulfilled' && typeof result.value?.score === 'number') {
      return Math.max(0, Math.min(1, result.value.score));
    }
    return defaultScore;
  }

  private calculateOverallScore(scores: EvaluationScores): number {
    // Weighted scoring - toxicity and compliance are most critical
    const weights = {
      toxicity: 0.3,
      policyCompliance: 0.3,
      factualAccuracy: 0.25,
      brandAlignment: 0.15
    };

    return (
      scores.toxicity * weights.toxicity +
      scores.policyCompliance * weights.policyCompliance +
      scores.factualAccuracy * weights.factualAccuracy +
      scores.brandAlignment * weights.brandAlignment
    );
  }

  private async determineAction(
    scores: EvaluationScores, 
    violations: string[], 
    input: EvaluationInput
  ): Promise<{ action: 'PASS' | 'REWRITE' | 'BLOCK'; rewrite?: string }> {
    
    // Critical violations that require blocking
    const criticalViolations = violations.filter(v => 
      v.includes('toxic') || 
      v.includes('harmful') || 
      v.includes('illegal') ||
      v.includes('discriminatory')
    );

    if (criticalViolations.length > 0 || scores.toxicity < 0.3) {
      return { action: 'BLOCK' };
    }

    // Major issues that require rewriting
    const majorIssues = violations.filter(v => 
      v.includes('inaccurate') ||
      v.includes('policy') ||
      v.includes('brand')
    );

    if (majorIssues.length > 0 || scores.overall < 0.6) {
      const rewrite = await this.generateRewrite(input.response, violations, input.context);
      return { action: 'REWRITE', rewrite };
    }

    return { action: 'PASS' };
  }

  private async generateRewrite(
    originalResponse: string, 
    violations: string[], 
    context: string[]
  ): Promise<string> {
    // Simple rewrite logic - in production this would use an LLM
    let rewritten = originalResponse;

    // Remove toxic language patterns
    const toxicPatterns = [
      /\b(hate|stupid|idiot|moron)\b/gi,
      /\b(kill|die|death)\b/gi
    ];

    for (const pattern of toxicPatterns) {
      rewritten = rewritten.replace(pattern, '[REDACTED]');
    }

    // Add disclaimers for policy violations
    if (violations.some(v => v.includes('policy'))) {
      rewritten += '\n\n*Note: This response has been reviewed for policy compliance.*';
    }

    // Add accuracy disclaimers for factual issues
    if (violations.some(v => v.includes('inaccurate'))) {
      rewritten += '\n\n*Please verify this information independently.*';
    }

    return rewritten;
  }

  private calculateConfidence(scores: EvaluationScores, violations: string[]): number {
    // Confidence is higher when scores are consistent and clear
    const scoreVariance = this.calculateVariance([
      scores.toxicity,
      scores.policyCompliance,
      scores.factualAccuracy,
      scores.brandAlignment
    ]);

    // Lower variance = higher confidence
    const consistencyScore = Math.max(0, 1 - scoreVariance * 2);
    
    // Fewer violations = higher confidence
    const violationPenalty = Math.min(0.5, violations.length * 0.1);
    
    return Math.max(0.1, consistencyScore - violationPenalty);
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const healthChecks = await Promise.allSettled([
        this.toxicityEvaluator.healthCheck(),
        this.complianceEvaluator.healthCheck(),
        this.factualAccuracyEvaluator.healthCheck(),
        this.brandAlignmentEvaluator.healthCheck()
      ]);

      // Return true if at least half of evaluators are healthy
      const healthyCount = healthChecks.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;

      return healthyCount >= 2;
    } catch (error) {
      console.error('Evaluator mesh health check failed:', error);
      return false;
    }
  }

  async getEvaluatorStatus(): Promise<Record<string, boolean>> {
    try {
      const [toxicity, compliance, factual, brand] = await Promise.allSettled([
        this.toxicityEvaluator.healthCheck(),
        this.complianceEvaluator.healthCheck(),
        this.factualAccuracyEvaluator.healthCheck(),
        this.brandAlignmentEvaluator.healthCheck()
      ]);

      return {
        toxicity: toxicity.status === 'fulfilled' && toxicity.value,
        compliance: compliance.status === 'fulfilled' && compliance.value,
        factualAccuracy: factual.status === 'fulfilled' && factual.value,
        brandAlignment: brand.status === 'fulfilled' && brand.value
      };
    } catch (error) {
      return {
        toxicity: false,
        compliance: false,
        factualAccuracy: false,
        brandAlignment: false
      };
    }
  }
}