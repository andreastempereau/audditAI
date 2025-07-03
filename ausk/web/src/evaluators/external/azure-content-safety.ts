interface AzureContentSafetyResult {
  score: number;
  violations: string[];
  categories: {
    hate: number;
    selfHarm: number;
    sexual: number;
    violence: number;
  };
}

export class AzureContentSafetyEvaluator {
  private endpoint: string;
  private apiKey: string;
  private apiVersion = '2023-10-01';

  constructor(endpoint?: string, apiKey?: string) {
    this.endpoint = endpoint || process.env.AZURE_CONTENT_SAFETY_ENDPOINT || '';
    this.apiKey = apiKey || process.env.AZURE_CONTENT_SAFETY_KEY || '';
  }

  async evaluate(text: string): Promise<AzureContentSafetyResult> {
    if (!this.endpoint || !this.apiKey) {
      console.warn('Azure Content Safety not configured, using fallback');
      return this.fallbackEvaluation(text);
    }

    try {
      const response = await fetch(
        `${this.endpoint}/contentsafety/text:analyze?api-version=${this.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.apiKey
          },
          body: JSON.stringify({
            text,
            categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
            haltOnBlocklistHit: false,
            outputType: 'FourSeverityLevels'
          })
        }
      );

      if (!response.ok) {
        console.error('Azure Content Safety API error:', response.status);
        return this.fallbackEvaluation(text);
      }

      const data = await response.json();
      return this.parseResponse(data);

    } catch (error) {
      console.error('Azure Content Safety evaluation error:', error);
      return this.fallbackEvaluation(text);
    }
  }

  private parseResponse(data: any): AzureContentSafetyResult {
    const categoriesAnalysis = data.categoriesAnalysis || [];
    
    const categories = {
      hate: 0,
      selfHarm: 0,
      sexual: 0,
      violence: 0
    };

    const violations: string[] = [];

    for (const analysis of categoriesAnalysis) {
      const category = analysis.category.toLowerCase();
      const severity = analysis.severity; // 0-3 scale
      const normalizedScore = severity / 3; // Normalize to 0-1

      if (category === 'hate') {
        categories.hate = normalizedScore;
        if (severity >= 2) violations.push('Hate speech detected');
      } else if (category === 'selfharm') {
        categories.selfHarm = normalizedScore;
        if (severity >= 2) violations.push('Self-harm content detected');
      } else if (category === 'sexual') {
        categories.sexual = normalizedScore;
        if (severity >= 2) violations.push('Sexual content detected');
      } else if (category === 'violence') {
        categories.violence = normalizedScore;
        if (severity >= 2) violations.push('Violent content detected');
      }
    }

    // Calculate overall safety score (higher = safer)
    const maxSeverity = Math.max(...Object.values(categories));
    const overallScore = 1 - maxSeverity;

    return {
      score: overallScore,
      violations,
      categories
    };
  }

  private fallbackEvaluation(text: string): AzureContentSafetyResult {
    // Pattern-based fallback evaluation
    const patterns = {
      hate: [/\b(racist|nazi|fascist|bigot|fag|dyke)\b/gi],
      selfHarm: [/\b(suicide|self.*harm|cut.*myself|kill.*myself)\b/gi],
      sexual: [/\b(porn|sex|nude|explicit|sexual)\b/gi],
      violence: [/\b(kill|murder|shoot|stab|bomb|attack|violence)\b/gi]
    };

    const categories = { hate: 0, selfHarm: 0, sexual: 0, violence: 0 };
    const violations: string[] = [];

    for (const [category, categoryPatterns] of Object.entries(patterns)) {
      let matches = 0;
      for (const pattern of categoryPatterns) {
        const found = text.match(pattern);
        if (found) matches += found.length;
      }

      if (matches > 0) {
        categories[category as keyof typeof categories] = Math.min(1, matches * 0.3);
        violations.push(`Potential ${category} content detected (fallback evaluation)`);
      }
    }

    const maxScore = Math.max(...Object.values(categories));
    const overallScore = 1 - maxScore;

    return {
      score: overallScore,
      violations,
      categories
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.endpoint || !this.apiKey) return false;

    try {
      const response = await fetch(
        `${this.endpoint}/contentsafety/text:analyze?api-version=${this.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.apiKey
          },
          body: JSON.stringify({
            text: 'Hello world',
            categories: ['Hate'],
            outputType: 'FourSeverityLevels'
          })
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}