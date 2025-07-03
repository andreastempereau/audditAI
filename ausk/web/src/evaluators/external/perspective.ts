interface PerspectiveResult {
  score: number;
  violations: string[];
  categories: {
    toxicity: number;
    severeToxicity: number;
    identityAttack: number;
    insult: number;
    profanity: number;
    threat: number;
    sexuallyExplicit: number;
    flirtation: number;
  };
}

export class PerspectiveAPIEvaluator {
  private apiKey: string;
  private baseUrl = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PERSPECTIVE_API_KEY || '';
  }

  async evaluate(text: string): Promise<PerspectiveResult> {
    if (!this.apiKey) {
      console.warn('Perspective API key not configured, using fallback');
      return this.fallbackEvaluation(text);
    }

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: { text },
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {},
            SEXUALLY_EXPLICIT: {},
            FLIRTATION: {}
          },
          languages: ['en'],
          doNotStore: true
        })
      });

      if (!response.ok) {
        console.error('Perspective API error:', response.status);
        return this.fallbackEvaluation(text);
      }

      const data = await response.json();
      return this.parseResponse(data);

    } catch (error) {
      console.error('Perspective API evaluation error:', error);
      return this.fallbackEvaluation(text);
    }
  }

  private parseResponse(data: any): PerspectiveResult {
    const attributes = data.attributeScores || {};
    
    const categories = {
      toxicity: attributes.TOXICITY?.summaryScore?.value || 0,
      severeToxicity: attributes.SEVERE_TOXICITY?.summaryScore?.value || 0,
      identityAttack: attributes.IDENTITY_ATTACK?.summaryScore?.value || 0,
      insult: attributes.INSULT?.summaryScore?.value || 0,
      profanity: attributes.PROFANITY?.summaryScore?.value || 0,
      threat: attributes.THREAT?.summaryScore?.value || 0,
      sexuallyExplicit: attributes.SEXUALLY_EXPLICIT?.summaryScore?.value || 0,
      flirtation: attributes.FLIRTATION?.summaryScore?.value || 0
    };

    // Calculate overall score (inverted for consistency - higher = safer)
    const scores = Object.values(categories);
    const maxScore = Math.max(...scores);
    const overallScore = 1 - maxScore;

    // Identify violations
    const violations: string[] = [];
    const threshold = 0.7;

    if (categories.toxicity > threshold) violations.push('High toxicity detected');
    if (categories.severeToxicity > threshold) violations.push('Severe toxicity detected');
    if (categories.identityAttack > threshold) violations.push('Identity attack detected');
    if (categories.insult > threshold) violations.push('Insulting language detected');
    if (categories.profanity > threshold) violations.push('Profanity detected');
    if (categories.threat > threshold) violations.push('Threatening language detected');
    if (categories.sexuallyExplicit > threshold) violations.push('Sexually explicit content detected');

    return {
      score: overallScore,
      violations,
      categories
    };
  }

  private fallbackEvaluation(text: string): PerspectiveResult {
    // Simple pattern-based fallback
    const toxicPatterns = [
      /\b(hate|stupid|idiot|moron|kill|die|death)\b/gi,
      /\b(f[*]ck|sh[*]t|damn|hell|ass)\b/gi
    ];

    let violationCount = 0;
    const violations: string[] = [];

    for (const pattern of toxicPatterns) {
      if (pattern.test(text)) {
        violationCount++;
        violations.push('Potentially toxic language detected (fallback evaluation)');
      }
    }

    const score = Math.max(0, 1 - (violationCount * 0.3));

    return {
      score,
      violations,
      categories: {
        toxicity: violationCount > 0 ? 0.5 : 0.1,
        severeToxicity: 0,
        identityAttack: 0,
        insult: 0,
        profanity: 0,
        threat: 0,
        sexuallyExplicit: 0,
        flirtation: 0
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: { text: 'Hello world' },
          requestedAttributes: { TOXICITY: {} },
          doNotStore: true
        })
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}