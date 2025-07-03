import { PolicyRule } from '@/gateway/types';

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'compliance' | 'safety' | 'brand' | 'security' | 'custom';
  industry?: string[];
  rules: Omit<PolicyRule, 'id'>[];
  variables?: TemplateVariable[];
  tags: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue?: any;
  required: boolean;
  options?: string[]; // For enumerated values
}

export class PolicyTemplateLibrary {
  private templates: Map<string, PolicyTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    const templates: PolicyTemplate[] = [
      // GDPR Compliance Template
      {
        id: 'gdpr-compliance',
        name: 'GDPR Data Protection',
        description: 'Comprehensive GDPR compliance rules for data protection and privacy',
        category: 'compliance',
        industry: ['technology', 'healthcare', 'finance', 'retail'],
        rules: [
          {
            name: 'PII Detection and Blocking',
            description: 'Block responses containing personally identifiable information',
            condition: 'contains_pii = true',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          },
          {
            name: 'Email Address Protection',
            description: 'Redact email addresses in responses',
            condition: 'contains_email = true',
            action: 'REWRITE',
            severity: 'HIGH',
            rewriteTemplate: 'Remove or redact email addresses',
            enabled: true
          },
          {
            name: 'Phone Number Protection',
            description: 'Redact phone numbers in responses',
            condition: 'contains_phone = true',
            action: 'REWRITE',
            severity: 'HIGH',
            rewriteTemplate: 'Remove or redact phone numbers',
            enabled: true
          }
        ],
        tags: ['gdpr', 'privacy', 'pii', 'data-protection']
      },

      // Financial Services Compliance
      {
        id: 'financial-compliance',
        name: 'Financial Services Compliance',
        description: 'Compliance rules for financial services industry (SEC, FINRA)',
        category: 'compliance',
        industry: ['finance', 'banking', 'insurance'],
        rules: [
          {
            name: 'Investment Advice Restriction',
            description: 'Block unlicensed investment advice',
            condition: 'contains_investment_advice = true AND licensed_advisor = false',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          },
          {
            name: 'Financial Guarantee Prohibition',
            description: 'Block guaranteed return claims',
            condition: 'contains_guarantee = true AND financial_context = true',
            action: 'BLOCK',
            severity: 'HIGH',
            enabled: true
          },
          {
            name: 'Risk Disclosure Requirement',
            description: 'Add risk disclaimers to financial content',
            condition: 'financial_content = true AND missing_disclaimer = true',
            action: 'REWRITE',
            severity: 'MEDIUM',
            rewriteTemplate: 'Add appropriate risk disclosure',
            enabled: true
          }
        ],
        variables: [
          {
            name: 'licensed_advisor',
            type: 'boolean',
            description: 'Whether the user is a licensed financial advisor',
            defaultValue: false,
            required: true
          }
        ],
        tags: ['finance', 'sec', 'finra', 'investment', 'compliance']
      },

      // Healthcare Compliance (HIPAA)
      {
        id: 'hipaa-compliance',
        name: 'HIPAA Healthcare Compliance',
        description: 'HIPAA compliance rules for healthcare organizations',
        category: 'compliance',
        industry: ['healthcare', 'pharmaceuticals'],
        rules: [
          {
            name: 'PHI Protection',
            description: 'Block protected health information',
            condition: 'contains_phi = true',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          },
          {
            name: 'Medical Diagnosis Restriction',
            description: 'Block unauthorized medical diagnoses',
            condition: 'contains_diagnosis = true AND authorized_provider = false',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          },
          {
            name: 'Medical Disclaimer Requirement',
            description: 'Add medical disclaimers to health content',
            condition: 'health_content = true AND missing_disclaimer = true',
            action: 'REWRITE',
            severity: 'HIGH',
            rewriteTemplate: 'Add medical disclaimer about consulting healthcare professionals',
            enabled: true
          }
        ],
        variables: [
          {
            name: 'authorized_provider',
            type: 'boolean',
            description: 'Whether the user is an authorized healthcare provider',
            defaultValue: false,
            required: true
          }
        ],
        tags: ['hipaa', 'healthcare', 'phi', 'medical', 'compliance']
      },

      // Content Safety Template
      {
        id: 'content-safety',
        name: 'Content Safety Standards',
        description: 'Comprehensive content safety rules for toxicity, harassment, and harmful content',
        category: 'safety',
        rules: [
          {
            name: 'Severe Toxicity Block',
            description: 'Block severely toxic content',
            condition: 'toxicity < 0.2',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          },
          {
            name: 'Moderate Toxicity Rewrite',
            description: 'Rewrite moderately toxic content',
            condition: 'toxicity < 0.6',
            action: 'REWRITE',
            severity: 'HIGH',
            rewriteTemplate: 'Rewrite to be more professional and respectful',
            enabled: true
          },
          {
            name: 'Harassment Detection',
            description: 'Block harassing content',
            condition: 'harassment_score > 0.7',
            action: 'BLOCK',
            severity: 'HIGH',
            enabled: true
          },
          {
            name: 'Violence Prevention',
            description: 'Block violent content',
            condition: 'violence_score > 0.8',
            action: 'BLOCK',
            severity: 'HIGH',
            enabled: true
          }
        ],
        variables: [
          {
            name: 'toxicity_threshold',
            type: 'number',
            description: 'Toxicity threshold for blocking (0-1)',
            defaultValue: 0.6,
            required: true
          }
        ],
        tags: ['safety', 'toxicity', 'harassment', 'violence', 'content-moderation']
      },

      // Brand Guidelines Template
      {
        id: 'brand-guidelines',
        name: 'Brand Voice and Guidelines',
        description: 'Maintain brand voice, tone, and messaging consistency',
        category: 'brand',
        rules: [
          {
            name: 'Brand Voice Consistency',
            description: 'Ensure responses match brand voice',
            condition: 'brandAlignment < 0.7',
            action: 'REWRITE',
            severity: 'MEDIUM',
            rewriteTemplate: 'Adjust tone and language to match brand guidelines',
            enabled: true
          },
          {
            name: 'Prohibited Language Filter',
            description: 'Remove prohibited words and phrases',
            condition: 'contains_prohibited_language = true',
            action: 'REWRITE',
            severity: 'HIGH',
            rewriteTemplate: 'Remove prohibited language and replace with approved alternatives',
            enabled: true
          },
          {
            name: 'Competitor Mention Policy',
            description: 'Flag responses mentioning competitors',
            condition: 'mentions_competitor = true',
            action: 'FLAG',
            severity: 'MEDIUM',
            enabled: true
          }
        ],
        variables: [
          {
            name: 'brand_voice',
            type: 'string',
            description: 'Preferred brand voice style',
            defaultValue: 'professional',
            required: true,
            options: ['professional', 'casual', 'friendly', 'authoritative', 'conversational']
          },
          {
            name: 'prohibited_words',
            type: 'array',
            description: 'List of prohibited words or phrases',
            defaultValue: [],
            required: false
          }
        ],
        tags: ['brand', 'voice', 'tone', 'messaging', 'consistency']
      },

      // Enterprise Security Template
      {
        id: 'enterprise-security',
        name: 'Enterprise Security Policy',
        description: 'Security-focused rules for enterprise environments',
        category: 'security',
        rules: [
          {
            name: 'Confidential Information Protection',
            description: 'Block responses containing confidential information',
            condition: 'contains_confidential = true',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          },
          {
            name: 'Source Code Protection',
            description: 'Block source code or sensitive technical details',
            condition: 'contains_source_code = true',
            action: 'BLOCK',
            severity: 'HIGH',
            enabled: true
          },
          {
            name: 'Internal URL Redaction',
            description: 'Remove internal URLs and IP addresses',
            condition: 'contains_internal_urls = true',
            action: 'REWRITE',
            severity: 'HIGH',
            rewriteTemplate: 'Remove internal URLs and replace with generic descriptions',
            enabled: true
          },
          {
            name: 'API Key Protection',
            description: 'Block API keys and tokens',
            condition: 'contains_api_keys = true',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          }
        ],
        tags: ['security', 'confidential', 'enterprise', 'data-protection', 'internal']
      },

      // Educational Content Template
      {
        id: 'educational-safety',
        name: 'Educational Content Safety',
        description: 'Safety rules for educational platforms and content',
        category: 'safety',
        industry: ['education', 'e-learning'],
        rules: [
          {
            name: 'Age-Appropriate Content',
            description: 'Ensure content is age-appropriate',
            condition: 'age_appropriate = false',
            action: 'REWRITE',
            severity: 'HIGH',
            rewriteTemplate: 'Modify content to be age-appropriate',
            enabled: true
          },
          {
            name: 'Academic Integrity',
            description: 'Flag potential academic dishonesty',
            condition: 'academic_dishonesty_risk > 0.7',
            action: 'FLAG',
            severity: 'MEDIUM',
            enabled: true
          },
          {
            name: 'Harmful Instructions Block',
            description: 'Block instructions for harmful activities',
            condition: 'harmful_instructions = true',
            action: 'BLOCK',
            severity: 'CRITICAL',
            enabled: true
          }
        ],
        variables: [
          {
            name: 'target_age_group',
            type: 'string',
            description: 'Target age group for content',
            defaultValue: 'general',
            required: true,
            options: ['elementary', 'middle-school', 'high-school', 'college', 'adult', 'general']
          }
        ],
        tags: ['education', 'age-appropriate', 'academic', 'safety', 'learning']
      }
    ];

    for (const template of templates) {
      this.templates.set(template.id, template);
    }
  }

  getTemplate(id: string): PolicyTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): PolicyTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: PolicyTemplate['category']): PolicyTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  getTemplatesByIndustry(industry: string): PolicyTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.industry?.includes(industry));
  }

  searchTemplates(query: string): PolicyTemplate[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.templates.values())
      .filter(template => 
        template.name.toLowerCase().includes(searchTerm) ||
        template.description.toLowerCase().includes(searchTerm) ||
        template.tags.some(tag => tag.includes(searchTerm))
      );
  }

  instantiateTemplate(
    templateId: string,
    organizationId: string,
    variables: Record<string, any> = {}
  ): PolicyRule[] {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    if (template.variables) {
      for (const variable of template.variables) {
        if (variable.required && !(variable.name in variables)) {
          throw new Error(`Required variable missing: ${variable.name}`);
        }
      }
    }

    // Create rules from template
    return template.rules.map((ruleTemplate, index) => {
      // Replace variables in conditions and templates
      let condition = ruleTemplate.condition;
      let rewriteTemplate = ruleTemplate.rewriteTemplate;

      // Replace template variables
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        condition = condition.replace(new RegExp(placeholder, 'g'), value.toString());
        if (rewriteTemplate) {
          rewriteTemplate = rewriteTemplate.replace(new RegExp(placeholder, 'g'), value.toString());
        }
      }

      return {
        id: `${templateId}-${index}-${crypto.randomUUID()}`,
        name: ruleTemplate.name,
        description: ruleTemplate.description,
        condition,
        action: ruleTemplate.action,
        severity: ruleTemplate.severity,
        rewriteTemplate,
        enabled: ruleTemplate.enabled
      };
    });
  }

  addCustomTemplate(template: PolicyTemplate): void {
    this.templates.set(template.id, template);
  }

  removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  updateTemplate(template: PolicyTemplate): void {
    this.templates.set(template.id, template);
  }

  exportTemplate(id: string): string {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }
    return JSON.stringify(template, null, 2);
  }

  importTemplate(templateJson: string): PolicyTemplate {
    const template = JSON.parse(templateJson) as PolicyTemplate;
    
    // Validate template structure
    if (!template.id || !template.name || !template.rules) {
      throw new Error('Invalid template structure');
    }

    this.addCustomTemplate(template);
    return template;
  }

  // Get template recommendations based on organization profile
  getRecommendedTemplates(organizationProfile: {
    industry?: string;
    size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    compliance?: string[];
    riskTolerance?: 'low' | 'medium' | 'high';
  }): PolicyTemplate[] {
    let recommended = this.getAllTemplates();

    // Filter by industry
    if (organizationProfile.industry) {
      recommended = recommended.filter(template => 
        !template.industry || template.industry.includes(organizationProfile.industry!)
      );
    }

    // Recommend based on compliance requirements
    if (organizationProfile.compliance?.length) {
      const complianceTemplates = recommended.filter(template =>
        organizationProfile.compliance!.some(req => 
          template.tags.includes(req.toLowerCase()) ||
          template.name.toLowerCase().includes(req.toLowerCase())
        )
      );
      recommended = [...complianceTemplates, ...recommended.filter(t => t.category === 'safety')];
    }

    // Risk-based recommendations
    if (organizationProfile.riskTolerance === 'low') {
      // Recommend more comprehensive templates
      recommended = recommended.filter(template => 
        template.category === 'compliance' || template.category === 'security'
      );
    }

    // Remove duplicates and limit results
    const unique = Array.from(new Set(recommended.map(t => t.id)))
      .map(id => recommended.find(t => t.id === id)!)
      .slice(0, 10);

    return unique;
  }
}

// Singleton instance
export const policyTemplateLibrary = new PolicyTemplateLibrary();