interface BrandAlignmentResult {
  score: number;
  violations: string[];
  categories: {
    tone: number;
    values: number;
    messaging: number;
    voice: number;
  };
}

interface BrandGuidelines {
  tone: {
    preferred: string[];
    forbidden: string[];
  };
  values: {
    core: string[];
    forbidden: string[];
  };
  messaging: {
    keyPhrases: string[];
    avoidPhrases: string[];
  };
  voice: {
    style: 'formal' | 'casual' | 'professional' | 'friendly';
    personality: string[];
  };
}

export class BrandAlignmentEvaluator {
  // Default brand guidelines - in production these would be loaded per organization
  private defaultGuidelines: BrandGuidelines = {
    tone: {
      preferred: ['professional', 'helpful', 'respectful', 'clear', 'informative'],
      forbidden: ['aggressive', 'dismissive', 'condescending', 'sarcastic', 'rude']
    },
    values: {
      core: ['transparency', 'integrity', 'innovation', 'customer-first', 'quality'],
      forbidden: ['deceptive', 'misleading', 'manipulative', 'unethical']
    },
    messaging: {
      keyPhrases: ['committed to', 'dedicated to', 'excellence', 'trust', 'reliable'],
      avoidPhrases: ['cheap', 'quick fix', 'guaranteed', 'miracle', 'instant']
    },
    voice: {
      style: 'professional',
      personality: ['knowledgeable', 'approachable', 'trustworthy', 'solution-oriented']
    }
  };

  // Organization-specific guidelines
  private orgGuidelines: Map<string, BrandGuidelines> = new Map();

  async evaluate(
    response: string,
    clientId: string
  ): Promise<BrandAlignmentResult> {
    try {
      const guidelines = this.orgGuidelines.get(clientId) || this.defaultGuidelines;
      
      const categories = {
        tone: 0,
        values: 0,
        messaging: 0,
        voice: 0
      };

      const violations: string[] = [];
      const text = response.toLowerCase();

      // Evaluate tone alignment
      const toneScore = this.evaluateTone(text, guidelines.tone);
      categories.tone = toneScore.score;
      violations.push(...toneScore.violations);

      // Evaluate values alignment
      const valuesScore = this.evaluateValues(text, guidelines.values);
      categories.values = valuesScore.score;
      violations.push(...valuesScore.violations);

      // Evaluate messaging alignment
      const messagingScore = this.evaluateMessaging(text, guidelines.messaging);
      categories.messaging = messagingScore.score;
      violations.push(...messagingScore.violations);

      // Evaluate voice alignment
      const voiceScore = this.evaluateVoice(text, guidelines.voice);
      categories.voice = voiceScore.score;
      violations.push(...voiceScore.violations);

      // Calculate overall brand alignment score
      const overallScore = (
        categories.tone * 0.3 +
        categories.values * 0.3 +
        categories.messaging * 0.2 +
        categories.voice * 0.2
      );

      return {
        score: overallScore,
        violations,
        categories
      };

    } catch (error) {
      console.error('Brand alignment evaluation error:', error);
      return {
        score: 0.5,
        violations: ['Brand alignment evaluation failed'],
        categories: {
          tone: 0.5,
          values: 0.5,
          messaging: 0.5,
          voice: 0.5
        }
      };
    }
  }

  private evaluateTone(
    text: string,
    toneGuidelines: { preferred: string[]; forbidden: string[] }
  ): { score: number; violations: string[] } {
    const violations: string[] = [];
    let score = 0.8; // Start with good score

    // Check for forbidden tones
    const forbiddenPatterns = {
      aggressive: /\b(?:demand|insist|must|have to|need to)\b/gi,
      dismissive: /\b(?:obviously|clearly|simply|just|merely)\b/gi,
      condescending: /\b(?:surely you|of course you|anyone knows|common sense)\b/gi,
      sarcastic: /\b(?:oh great|wonderful|fantastic|sure thing)\b/gi,
      rude: /\b(?:stupid|dumb|ridiculous|absurd|nonsense)\b/gi
    };

    for (const [tone, pattern] of Object.entries(forbiddenPatterns)) {
      if (toneGuidelines.forbidden.includes(tone) && pattern.test(text)) {
        score -= 0.2;
        violations.push(`Inappropriate ${tone} tone detected`);
      }
    }

    // Check for preferred tones
    const preferredPatterns = {
      professional: /\b(?:please|thank you|appreciate|consider|recommend)\b/gi,
      helpful: /\b(?:assist|support|help|guide|provide)\b/gi,
      respectful: /\b(?:understand|respect|value|appreciate)\b/gi,
      clear: /\b(?:explain|clarify|outline|specify|detail)\b/gi,
      informative: /\b(?:information|details|facts|data|research)\b/gi
    };

    let preferredCount = 0;
    for (const [tone, pattern] of Object.entries(preferredPatterns)) {
      if (toneGuidelines.preferred.includes(tone) && pattern.test(text)) {
        preferredCount++;
      }
    }

    // Boost score for preferred tones
    score += Math.min(0.2, preferredCount * 0.05);

    return {
      score: Math.max(0, Math.min(1, score)),
      violations
    };
  }

  private evaluateValues(
    text: string,
    valuesGuidelines: { core: string[]; forbidden: string[] }
  ): { score: number; violations: string[] } {
    const violations: string[] = [];
    let score = 0.8;

    // Check for forbidden values
    const forbiddenPatterns = {
      deceptive: /\b(?:hide|conceal|secret|undisclosed|mislead)\b/gi,
      misleading: /\b(?:exaggerate|overstate|falsify|fabricate)\b/gi,
      manipulative: /\b(?:trick|deceive|fool|exploit|take advantage)\b/gi,
      unethical: /\b(?:cheat|steal|lie|corrupt|illegal)\b/gi
    };

    for (const [value, pattern] of Object.entries(forbiddenPatterns)) {
      if (valuesGuidelines.forbidden.includes(value) && pattern.test(text)) {
        score -= 0.3;
        violations.push(`Content conflicts with company values: ${value}`);
      }
    }

    // Check for core values
    const corePatterns = {
      transparency: /\b(?:transparent|open|honest|clear|upfront)\b/gi,
      integrity: /\b(?:integrity|honest|ethical|moral|principled)\b/gi,
      innovation: /\b(?:innovative|creative|cutting-edge|advanced|novel)\b/gi,
      'customer-first': /\b(?:customer|client|user|satisfaction|service)\b/gi,
      quality: /\b(?:quality|excellence|premium|superior|best)\b/gi
    };

    let coreCount = 0;
    for (const [value, pattern] of Object.entries(corePatterns)) {
      if (valuesGuidelines.core.includes(value) && pattern.test(text)) {
        coreCount++;
      }
    }

    // Boost score for core values
    score += Math.min(0.2, coreCount * 0.04);

    return {
      score: Math.max(0, Math.min(1, score)),
      violations
    };
  }

  private evaluateMessaging(
    text: string,
    messagingGuidelines: { keyPhrases: string[]; avoidPhrases: string[] }
  ): { score: number; violations: string[] } {
    const violations: string[] = [];
    let score = 0.8;

    // Check for phrases to avoid
    for (const phrase of messagingGuidelines.avoidPhrases) {
      const regex = new RegExp(phrase.replace(/\s+/g, '\\s+'), 'gi');
      if (regex.test(text)) {
        score -= 0.15;
        violations.push(`Avoided phrase detected: "${phrase}"`);
      }
    }

    // Check for key phrases
    let keyPhraseCount = 0;
    for (const phrase of messagingGuidelines.keyPhrases) {
      const regex = new RegExp(phrase.replace(/\s+/g, '\\s+'), 'gi');
      if (regex.test(text)) {
        keyPhraseCount++;
      }
    }

    // Boost score for key phrases
    score += Math.min(0.2, keyPhraseCount * 0.05);

    return {
      score: Math.max(0, Math.min(1, score)),
      violations
    };
  }

  private evaluateVoice(
    text: string,
    voiceGuidelines: { style: string; personality: string[] }
  ): { score: number; violations: string[] } {
    const violations: string[] = [];
    let score = 0.8;

    // Evaluate style consistency
    const stylePatterns = {
      formal: /\b(?:therefore|furthermore|consequently|nevertheless|however)\b/gi,
      casual: /\b(?:hey|hi|cool|awesome|yeah|sure)\b/gi,
      professional: /\b(?:recommend|suggest|propose|consider|evaluate)\b/gi,
      friendly: /\b(?:happy|glad|excited|pleased|delighted)\b/gi
    };

    const targetStyle = voiceGuidelines.style;
    const targetPattern = stylePatterns[targetStyle as keyof typeof stylePatterns];
    
    if (targetPattern && !targetPattern.test(text)) {
      // Check if conflicting style is present
      for (const [style, pattern] of Object.entries(stylePatterns)) {
        if (style !== targetStyle && pattern.test(text)) {
          score -= 0.1;
          violations.push(`Voice style mismatch: detected ${style} instead of ${targetStyle}`);
          break;
        }
      }
    }

    // Evaluate personality traits
    const personalityPatterns = {
      knowledgeable: /\b(?:research|data|studies|evidence|expertise)\b/gi,
      approachable: /\b(?:welcome|help|assist|support|understand)\b/gi,
      trustworthy: /\b(?:reliable|dependable|consistent|honest|transparent)\b/gi,
      'solution-oriented': /\b(?:solve|solution|resolve|address|fix)\b/gi
    };

    let personalityCount = 0;
    for (const trait of voiceGuidelines.personality) {
      const pattern = personalityPatterns[trait as keyof typeof personalityPatterns];
      if (pattern && pattern.test(text)) {
        personalityCount++;
      }
    }

    // Boost score for personality alignment
    score += Math.min(0.2, personalityCount * 0.05);

    return {
      score: Math.max(0, Math.min(1, score)),
      violations
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.evaluate(
        'Thank you for your inquiry. We are committed to providing excellent service and support.',
        'test-client'
      );
      return testResult.score >= 0 && testResult.score <= 1;
    } catch (error) {
      console.error('Brand alignment evaluator health check failed:', error);
      return false;
    }
  }

  // Admin methods for managing brand guidelines
  async updateOrganizationGuidelines(clientId: string, guidelines: BrandGuidelines): Promise<void> {
    this.orgGuidelines.set(clientId, guidelines);
  }

  async getOrganizationGuidelines(clientId: string): Promise<BrandGuidelines> {
    return this.orgGuidelines.get(clientId) || this.defaultGuidelines;
  }

  async removeOrganizationGuidelines(clientId: string): Promise<void> {
    this.orgGuidelines.delete(clientId);
  }

  // Method to analyze text for brand alignment insights
  async analyzeText(text: string, clientId: string): Promise<{
    overallScore: number;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  }> {
    const result = await this.evaluate(text, clientId);
    const guidelines = this.orgGuidelines.get(clientId) || this.defaultGuidelines;
    
    const strengths: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];

    // Identify strengths
    if (result.categories.tone > 0.8) strengths.push('Excellent tone alignment');
    if (result.categories.values > 0.8) strengths.push('Strong values representation');
    if (result.categories.messaging > 0.8) strengths.push('Effective messaging');
    if (result.categories.voice > 0.8) strengths.push('Consistent voice');

    // Identify improvements
    if (result.categories.tone < 0.6) improvements.push('Improve tone alignment');
    if (result.categories.values < 0.6) improvements.push('Better values integration');
    if (result.categories.messaging < 0.6) improvements.push('Refine messaging approach');
    if (result.categories.voice < 0.6) improvements.push('Maintain voice consistency');

    // Generate recommendations
    if (result.categories.tone < 0.7) {
      recommendations.push(`Use more ${guidelines.tone.preferred.join(', ')} language`);
    }
    if (result.categories.messaging < 0.7) {
      recommendations.push(`Incorporate key phrases: ${guidelines.messaging.keyPhrases.slice(0, 3).join(', ')}`);
    }

    return {
      overallScore: result.score,
      strengths,
      improvements,
      recommendations
    };
  }
}