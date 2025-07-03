interface ComplianceResult {
  score: number;
  violations: string[];
  categories: {
    dataPrivacy: number;
    financialRegulation: number;
    healthcare: number;
    legal: number;
    corporate: number;
  };
}

interface ComplianceRule {
  id: string;
  category: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export class ComplianceEvaluator {
  private complianceRules: ComplianceRule[] = [
    // Data Privacy Rules
    {
      id: 'gdpr-pii',
      category: 'dataPrivacy',
      pattern: /\b(ssn|social\s+security|credit\s+card|passport|driver.*license)\b/gi,
      severity: 'critical',
      description: 'Potential personally identifiable information (PII) exposure'
    },
    {
      id: 'gdpr-email',
      category: 'dataPrivacy',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      severity: 'medium',
      description: 'Email address disclosure'
    },
    {
      id: 'gdpr-phone',
      category: 'dataPrivacy',
      pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
      severity: 'medium',
      description: 'Phone number disclosure'
    },

    // Financial Regulation Rules
    {
      id: 'fin-advice',
      category: 'financialRegulation',
      pattern: /\b(invest|buy|sell|stock|crypto|financial\s+advice|guaranteed\s+return)\b/gi,
      severity: 'high',
      description: 'Potential unlicensed financial advice'
    },
    {
      id: 'fin-insider',
      category: 'financialRegulation',
      pattern: /\b(insider\s+trading|market\s+manipulation|pump\s+and\s+dump)\b/gi,
      severity: 'critical',
      description: 'Potential market manipulation content'
    },

    // Healthcare Rules
    {
      id: 'health-diagnosis',
      category: 'healthcare',
      pattern: /\b(you\s+have|diagnosed\s+with|medical\s+advice|prescription|dosage)\b/gi,
      severity: 'high',
      description: 'Potential medical diagnosis or advice'
    },
    {
      id: 'health-drugs',
      category: 'healthcare',
      pattern: /\b(opioid|fentanyl|prescription\s+drug|controlled\s+substance)\b/gi,
      severity: 'critical',
      description: 'Controlled substance information'
    },

    // Legal Rules
    {
      id: 'legal-advice',
      category: 'legal',
      pattern: /\b(legal\s+advice|sue|lawsuit|attorney|lawyer|court\s+case)\b/gi,
      severity: 'high',
      description: 'Potential legal advice'
    },
    {
      id: 'legal-criminal',
      category: 'legal',
      pattern: /\b(illegal|crime|criminal|law\s+enforcement|warrant)\b/gi,
      severity: 'medium',
      description: 'Legal/criminal content'
    },

    // Corporate Rules
    {
      id: 'corp-confidential',
      category: 'corporate',
      pattern: /\b(confidential|proprietary|trade\s+secret|internal\s+only)\b/gi,
      severity: 'high',
      description: 'Potential confidential information'
    },
    {
      id: 'corp-competitors',
      category: 'corporate',
      pattern: /\b(competitor|rival|market\s+share|business\s+strategy)\b/gi,
      severity: 'medium',
      description: 'Competitive information'
    }
  ];

  private severityScores = {
    low: 0.1,
    medium: 0.3,
    high: 0.6,
    critical: 0.9
  };

  // Organization-specific rules loaded from database
  private orgRules: Map<string, ComplianceRule[]> = new Map();

  async evaluate(
    response: string,
    conversation: Array<{ role: string; content: string }>,
    clientId: string
  ): Promise<ComplianceResult> {
    try {
      const categories = {
        dataPrivacy: 0,
        financialRegulation: 0,
        healthcare: 0,
        legal: 0,
        corporate: 0
      };

      const violations: string[] = [];
      const text = response.toLowerCase();

      // Check global compliance rules
      for (const rule of this.complianceRules) {
        const matches = text.match(rule.pattern);
        if (matches && matches.length > 0) {
          const score = this.severityScores[rule.severity];
          categories[rule.category as keyof typeof categories] += score;
          violations.push(`${rule.description} (${rule.severity} severity)`);
        }
      }

      // Check organization-specific rules
      const orgSpecificRules = this.orgRules.get(clientId) || [];
      for (const rule of orgSpecificRules) {
        const matches = text.match(rule.pattern);
        if (matches && matches.length > 0) {
          const score = this.severityScores[rule.severity];
          categories[rule.category as keyof typeof categories] += score;
          violations.push(`Organization policy: ${rule.description} (${rule.severity})`);
        }
      }

      // Check context-specific compliance
      const contextViolations = await this.checkContextualCompliance(
        response, 
        conversation, 
        clientId
      );
      violations.push(...contextViolations);

      // Calculate overall compliance score
      const maxCategoryScore = Math.max(...Object.values(categories));
      const overallScore = Math.max(0, 1 - maxCategoryScore);

      return {
        score: overallScore,
        violations,
        categories
      };

    } catch (error) {
      console.error('Compliance evaluation error:', error);
      return {
        score: 0.5,
        violations: ['Compliance evaluation failed'],
        categories: {
          dataPrivacy: 0,
          financialRegulation: 0,
          healthcare: 0,
          legal: 0,
          corporate: 0
        }
      };
    }
  }

  private async checkContextualCompliance(
    response: string,
    conversation: Array<{ role: string; content: string }>,
    clientId: string
  ): Promise<string[]> {
    const violations: string[] = [];

    // Check if response contains industry-specific regulated content
    const industryContext = await this.getIndustryContext(clientId);
    
    if (industryContext === 'healthcare') {
      if (this.containsHealthcareAdvice(response) && !this.hasHealthcareDisclaimer(response)) {
        violations.push('Healthcare advice without proper disclaimer');
      }
    }

    if (industryContext === 'finance') {
      if (this.containsFinancialAdvice(response) && !this.hasFinancialDisclaimer(response)) {
        violations.push('Financial advice without proper disclaimer');
      }
    }

    // Check for data retention compliance
    if (this.containsPersonalData(response)) {
      violations.push('Response contains personal data that may violate retention policies');
    }

    return violations;
  }

  private async getIndustryContext(clientId: string): Promise<string> {
    // In production, this would query the database for client industry
    // For now, return a default
    return 'general';
  }

  private containsHealthcareAdvice(text: string): boolean {
    const healthcarePatterns = [
      /\b(take|use|try|should|recommend).*(medication|drug|treatment|therapy)\b/gi,
      /\b(symptoms|diagnosis|condition|disease|illness)\b/gi
    ];
    
    return healthcarePatterns.some(pattern => pattern.test(text));
  }

  private hasHealthcareDisclaimer(text: string): boolean {
    const disclaimers = [
      /not\s+medical\s+advice/gi,
      /consult.*doctor/gi,
      /seek.*professional.*medical/gi
    ];
    
    return disclaimers.some(pattern => pattern.test(text));
  }

  private containsFinancialAdvice(text: string): boolean {
    const financialPatterns = [
      /\b(should|recommend|suggest).*(invest|buy|sell|portfolio)\b/gi,
      /\b(guaranteed|certain|sure).*(profit|return|gain)\b/gi
    ];
    
    return financialPatterns.some(pattern => pattern.test(text));
  }

  private hasFinancialDisclaimer(text: string): boolean {
    const disclaimers = [
      /not\s+financial\s+advice/gi,
      /consult.*financial.*advisor/gi,
      /investment.*risk/gi
    ];
    
    return disclaimers.some(pattern => pattern.test(text));
  }

  private containsPersonalData(text: string): boolean {
    const personalDataPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b4[0-9]{12}(?:[0-9]{3})?\b/g, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email
    ];
    
    return personalDataPatterns.some(pattern => pattern.test(text));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.evaluate(
        'This is a test message for compliance checking',
        [],
        'test-client'
      );
      return testResult.score >= 0 && testResult.score <= 1;
    } catch (error) {
      console.error('Compliance evaluator health check failed:', error);
      return false;
    }
  }

  // Admin methods for managing organization-specific rules
  async addOrganizationRule(clientId: string, rule: ComplianceRule): Promise<void> {
    if (!this.orgRules.has(clientId)) {
      this.orgRules.set(clientId, []);
    }
    this.orgRules.get(clientId)!.push(rule);
  }

  async removeOrganizationRule(clientId: string, ruleId: string): Promise<void> {
    const rules = this.orgRules.get(clientId);
    if (rules) {
      const filteredRules = rules.filter(rule => rule.id !== ruleId);
      this.orgRules.set(clientId, filteredRules);
    }
  }

  async getOrganizationRules(clientId: string): Promise<ComplianceRule[]> {
    return this.orgRules.get(clientId) || [];
  }

  getGlobalRules(): ComplianceRule[] {
    return [...this.complianceRules];
  }
}