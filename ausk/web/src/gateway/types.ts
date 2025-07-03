// Core types for the AI governance gateway

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  user?: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  audit_info?: {
    rewritten: boolean;
    violations: string[];
    requestId: string;
    evaluationScores: EvaluationScores;
    documentsUsed: string[];
    latency: number;
  };
}

export interface EvaluationResult {
  score: number;
  violations: string[];
  rewrite?: string;
  action: 'PASS' | 'REWRITE' | 'BLOCK';
  evaluationScores: EvaluationScores;
  confidence: number;
  documentsUsed: string[];
}

export interface EvaluationScores {
  factualAccuracy: number;
  policyCompliance: number;
  brandAlignment: number;
  toxicity: number;
  overall: number;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: 'BLOCK' | 'REWRITE' | 'FLAG';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rewriteTemplate?: string;
  enabled: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  clientId: string;
  userId?: string;
  requestId: string;
  type: 'REQUEST' | 'EVALUATION' | 'REWRITE' | 'BLOCK' | 'PASS';
  data: {
    originalPrompt?: LLMRequest;
    originalResponse?: string;
    evaluationScores?: EvaluationScores;
    rewrittenResponse?: string;
    violations?: string[];
    latency?: number;
    documentsUsed?: string[];
    provenance?: ProvenanceInfo[];
  };
  hash: string;
}

export interface ProvenanceInfo {
  chunkId: string;
  documentId: string;
  filename: string;
  department: string;
  extractedAt: Date;
  relevanceScore: number;
}

export interface ContextDocument {
  id: string;
  content: string;
  metadata: {
    filename: string;
    department: string;
    sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
    lastUpdated: Date;
  };
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'cohere' | 'azure';

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}