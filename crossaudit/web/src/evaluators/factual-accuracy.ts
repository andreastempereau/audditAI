interface FactualAccuracyResult {
  score: number;
  violations: string[];
  supportedClaims: string[];
  unsupportedClaims: string[];
  confidence: number;
}

interface Claim {
  text: string;
  type: 'factual' | 'opinion' | 'subjective';
  confidence: number;
  sources?: string[];
}

export class FactualAccuracyEvaluator {
  private factualPatterns = [
    // Numerical claims
    /\b\d+(?:\.\d+)?(?:\s*%|\s*percent|\s*dollars?|\s*years?|\s*people|\s*users?)\b/gi,
    
    // Date claims
    /\b(?:in|on|since|during|by)\s+\d{4}|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}\b/gi,
    
    // Comparative claims
    /\b(?:more|less|higher|lower|faster|slower|bigger|smaller|better|worse)\s+than\b/gi,
    
    // Definitive statements
    /\b(?:always|never|all|none|every|no one|everyone|everything|nothing)\b/gi,
    
    // Research/study claims
    /\b(?:research shows|studies indicate|according to|based on|evidence suggests)\b/gi
  ];

  private uncertaintyIndicators = [
    /\b(?:might|could|may|possibly|perhaps|likely|probably|seems|appears)\b/gi,
    /\b(?:i think|i believe|in my opinion|it seems|it appears)\b/gi
  ];

  async evaluate(
    response: string,
    contextDocuments: string[]
  ): Promise<FactualAccuracyResult> {
    try {
      // Extract claims from the response
      const claims = this.extractClaims(response);
      
      // Categorize claims
      const factualClaims = claims.filter(claim => claim.type === 'factual');
      
      if (factualClaims.length === 0) {
        // No factual claims to verify
        return {
          score: 1.0,
          violations: [],
          supportedClaims: [],
          unsupportedClaims: [],
          confidence: 0.8
        };
      }

      // Check claims against context documents
      const supportedClaims: string[] = [];
      const unsupportedClaims: string[] = [];
      const violations: string[] = [];

      for (const claim of factualClaims) {
        const isSupported = this.checkClaimSupport(claim, contextDocuments);
        
        if (isSupported) {
          supportedClaims.push(claim.text);
        } else {
          unsupportedClaims.push(claim.text);
          
          // Check if this is potentially misinformation
          if (this.isPotentialMisinformation(claim, response)) {
            violations.push(`Potentially inaccurate claim: "${claim.text}"`);
          }
        }
      }

      // Calculate accuracy score
      const totalClaims = factualClaims.length;
      const supportedRatio = supportedClaims.length / totalClaims;
      
      // Penalize unsupported claims more heavily if they seem definitive
      const definitiveUnsupported = unsupportedClaims.filter(claim => 
        this.isDefinitiveStatement(claim)
      ).length;
      
      const definitivepenalty = definitiveUnsupported * 0.3;
      const baseScore = supportedRatio;
      const finalScore = Math.max(0, baseScore - definitivepenalty);

      // Calculate confidence based on various factors
      const confidence = this.calculateConfidence(
        response,
        contextDocuments,
        supportedClaims.length,
        unsupportedClaims.length
      );

      // Add violations for high-confidence false claims
      if (unsupportedClaims.length > 0 && confidence > 0.7) {
        violations.push(`${unsupportedClaims.length} factual claims lack supporting evidence`);
      }

      return {
        score: finalScore,
        violations,
        supportedClaims,
        unsupportedClaims,
        confidence
      };

    } catch (error) {
      console.error('Factual accuracy evaluation error:', error);
      return {
        score: 0.5,
        violations: ['Factual accuracy evaluation failed'],
        supportedClaims: [],
        unsupportedClaims: [],
        confidence: 0.0
      };
    }
  }

  private extractClaims(text: string): Claim[] {
    const claims: Claim[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 10) continue; // Skip very short sentences

      // Check if sentence contains factual patterns
      const hasFactualPattern = this.factualPatterns.some(pattern => 
        pattern.test(trimmed)
      );

      // Check for uncertainty indicators
      const hasUncertainty = this.uncertaintyIndicators.some(pattern => 
        pattern.test(trimmed)
      );

      let type: 'factual' | 'opinion' | 'subjective' = 'subjective';
      let confidence = 0.5;

      if (hasFactualPattern && !hasUncertainty) {
        type = 'factual';
        confidence = 0.8;
      } else if (hasFactualPattern && hasUncertainty) {
        type = 'opinion';
        confidence = 0.6;
      }

      claims.push({
        text: trimmed,
        type,
        confidence
      });
    }

    return claims;
  }

  private checkClaimSupport(claim: Claim, contextDocuments: string[]): boolean {
    if (contextDocuments.length === 0) return false;

    const claimWords = this.extractKeywords(claim.text);
    const contextText = contextDocuments.join(' ').toLowerCase();

    // Simple keyword matching - in production this would use semantic similarity
    const matchingKeywords = claimWords.filter(keyword => 
      contextText.includes(keyword.toLowerCase())
    );

    // Consider claim supported if majority of keywords are found
    return matchingKeywords.length / claimWords.length > 0.6;
  }

  private extractKeywords(text: string): string[] {
    // Extract important words (nouns, numbers, proper nouns)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Filter out common words
    const stopWords = new Set([
      'that', 'this', 'with', 'from', 'they', 'have', 'were', 'been', 
      'their', 'said', 'each', 'which', 'them', 'than', 'many', 'some',
      'time', 'very', 'when', 'much', 'more', 'also', 'your', 'what',
      'know', 'just', 'first', 'into', 'over', 'think', 'well', 'would'
    ]);

    return words.filter(word => !stopWords.has(word));
  }

  private isPotentialMisinformation(claim: Claim, fullResponse: string): boolean {
    // Check for common misinformation patterns
    const misinformationPatterns = [
      /\b(?:scientists|doctors|experts)\s+(?:agree|say|prove)\b/gi,
      /\b(?:studies|research)\s+(?:show|prove|confirm)\b/gi,
      /\b(?:100%|completely|totally|absolutely)\s+(?:safe|effective|proven)\b/gi,
      /\b(?:never|always|all|no)\s+(?:doctors|scientists|experts)\b/gi
    ];

    return misinformationPatterns.some(pattern => pattern.test(claim.text));
  }

  private isDefinitiveStatement(text: string): boolean {
    const definitivePatterns = [
      /\b(?:always|never|all|none|every|no one|everyone|everything|nothing)\b/gi,
      /\b(?:definitely|certainly|absolutely|without\s+doubt)\b/gi,
      /\b(?:fact|truth|reality|proven|confirmed)\b/gi
    ];

    return definitivePatterns.some(pattern => pattern.test(text));
  }

  private calculateConfidence(
    response: string,
    contextDocuments: string[],
    supportedCount: number,
    unsupportedCount: number
  ): number {
    let confidence = 0.5;

    // More context documents = higher confidence in evaluation
    const contextFactor = Math.min(1, contextDocuments.length / 5) * 0.3;
    confidence += contextFactor;

    // Clear support/lack of support increases confidence
    const totalClaims = supportedCount + unsupportedCount;
    if (totalClaims > 0) {
      const clarity = Math.abs(supportedCount - unsupportedCount) / totalClaims;
      confidence += clarity * 0.3;
    }

    // Longer responses with more claims = lower confidence per claim
    const lengthPenalty = Math.min(0.2, response.length / 10000);
    confidence -= lengthPenalty;

    // Presence of uncertainty indicators = lower confidence
    const uncertaintyCount = this.uncertaintyIndicators
      .map(pattern => (response.match(pattern) || []).length)
      .reduce((sum, count) => sum + count, 0);
    
    const uncertaintyPenalty = Math.min(0.3, uncertaintyCount * 0.05);
    confidence -= uncertaintyPenalty;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.evaluate(
        'The company was founded in 2020 and has 100 employees.',
        ['Company history: Founded in 2020 with initial team of 5, grew to 100 employees by 2023.']
      );
      return testResult.score >= 0 && testResult.score <= 1;
    } catch (error) {
      console.error('Factual accuracy evaluator health check failed:', error);
      return false;
    }
  }

  // Method to get claim extraction statistics
  getClaimStats(text: string): {
    totalSentences: number;
    factualClaims: number;
    opinionClaims: number;
    subjectiveClaims: number;
  } {
    const claims = this.extractClaims(text);
    return {
      totalSentences: claims.length,
      factualClaims: claims.filter(c => c.type === 'factual').length,
      opinionClaims: claims.filter(c => c.type === 'opinion').length,
      subjectiveClaims: claims.filter(c => c.type === 'subjective').length
    };
  }
}