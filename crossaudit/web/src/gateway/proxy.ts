import { LLMRequest, LLMResponse, EvaluationResult, ProviderType } from './types';
import { EvaluatorMesh } from '../evaluators/mesh';
import { AuditLogger } from '../audit/logger';
import { PolicyEngine } from '../policy/engine';
import { ProviderManager } from './providers/manager';
import { ContextRetriever } from '../vectordb/context-retriever';

export class LLMGateway {
  private providerManager: ProviderManager;
  private evaluatorMesh: EvaluatorMesh;
  private auditLogger: AuditLogger;
  private policyEngine: PolicyEngine;
  private contextRetriever: ContextRetriever;

  constructor(
    providerManager: ProviderManager,
    evaluatorMesh: EvaluatorMesh,
    auditLogger: AuditLogger,
    policyEngine: PolicyEngine,
    contextRetriever: ContextRetriever
  ) {
    this.providerManager = providerManager;
    this.evaluatorMesh = evaluatorMesh;
    this.auditLogger = auditLogger;
    this.policyEngine = policyEngine;
    this.contextRetriever = contextRetriever;
  }

  async interceptLLMCall(
    request: LLMRequest, 
    clientId: string, 
    userId?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    try {
      // 1. Log incoming request
      await this.auditLogger.logRequest(requestId, clientId, request, userId);
      
      // 2. Get relevant context from data room
      const context = await this.getRelevantContext(request, clientId);
      
      // 3. Augment request with context if available
      const augmentedRequest = this.augmentRequestWithContext(request, context);
      
      // 4. Get initial LLM response
      const originalResponse = await this.callUpstreamLLM(augmentedRequest);
      
      // 5. Run through evaluator mesh
      const evaluation = await this.evaluatorMesh.evaluate({
        prompt: request.messages,
        response: originalResponse.choices[0].message.content,
        clientId,
        context: context.map(doc => doc.content),
        documentsUsed: context.map(doc => doc.id)
      });
      
      // 6. Apply policy decisions
      const finalResponse = await this.applyPolicyDecision(
        originalResponse,
        evaluation,
        requestId,
        context
      );
      
      // 7. Log complete interaction
      await this.auditLogger.logComplete(requestId, {
        originalPrompt: request,
        originalResponse: originalResponse.choices[0].message.content,
        evaluation,
        finalResponse: finalResponse.choices[0].message.content,
        latency: Date.now() - startTime,
        documentsUsed: context.map(doc => doc.id),
        clientId,
        userId
      });
      
      return finalResponse;
      
    } catch (error) {
      // Log error and re-throw
      await this.auditLogger.logError(requestId, clientId, error, userId);
      throw error;
    }
  }

  private async getRelevantContext(
    request: LLMRequest, 
    clientId: string
  ): Promise<any[]> {
    try {
      // Extract the user's query from the last message
      const userMessage = request.messages
        .filter(msg => msg.role === 'user')
        .pop()?.content || '';
      
      if (!userMessage.trim()) {
        return [];
      }
      
      // Use semantic search to find relevant documents
      const contextResults = await this.contextRetriever.search(
        userMessage,
        clientId,
        {
          limit: 5,
          threshold: 0.7
        }
      );
      
      return contextResults.documents;
    } catch (error) {
      console.error('Error retrieving context:', error);
      return [];
    }
  }

  private augmentRequestWithContext(
    request: LLMRequest, 
    context: any[]
  ): LLMRequest {
    if (context.length === 0) {
      return request;
    }
    
    // Create context string from relevant documents
    const contextString = context
      .map(doc => `[Document: ${doc.metadata.filename}]\n${doc.content}`)
      .join('\n\n---\n\n');
    
    // Find system message or create one
    const messages = [...request.messages];
    const systemMessageIndex = messages.findIndex(msg => msg.role === 'system');
    
    const contextPrompt = `You have access to the following relevant documents from the organization's data room. Use this information to provide accurate, contextual responses:\n\n${contextString}\n\nWhen referencing information from these documents, please cite the document name.`;
    
    if (systemMessageIndex !== -1) {
      // Append to existing system message
      messages[systemMessageIndex].content += '\n\n' + contextPrompt;
    } else {
      // Add new system message at the beginning
      messages.unshift({
        role: 'system',
        content: contextPrompt
      });
    }
    
    return {
      ...request,
      messages
    };
  }

  private async callUpstreamLLM(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.getProviderForModel(request.model);
    return await this.providerManager.callProvider(provider, request);
  }

  private getProviderForModel(model: string): ProviderType {
    // Route based on model name
    if (model.startsWith('gpt-') || model.startsWith('o1-')) {
      return 'openai';
    } else if (model.startsWith('claude-')) {
      return 'anthropic';
    } else if (model.startsWith('gemini-')) {
      return 'google';
    } else if (model.startsWith('command-')) {
      return 'cohere';
    } else {
      // Default to OpenAI for unknown models
      return 'openai';
    }
  }

  private async applyPolicyDecision(
    original: LLMResponse,
    evaluation: EvaluationResult,
    requestId: string,
    context: any[]
  ): Promise<LLMResponse> {
    const response = { ...original };
    
    // Add audit info to response
    response.audit_info = {
      rewritten: evaluation.action === 'REWRITE',
      violations: evaluation.violations,
      requestId,
      evaluationScores: evaluation.evaluationScores,
      documentsUsed: context.map(doc => doc.id),
      latency: 0 // Will be updated by caller
    };
    
    switch (evaluation.action) {
      case 'PASS':
        return response;
      
      case 'REWRITE':
        if (evaluation.rewrite) {
          response.choices[0].message.content = evaluation.rewrite;
        }
        return response;
      
      case 'BLOCK':
        throw new Error(`Content blocked due to policy violations: ${evaluation.violations.join(', ')}`);
      
      default:
        return response;
    }
  }

  // Health check endpoint
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: Date;
  }> {
    const services = {
      providers: await this.providerManager.healthCheck(),
      evaluators: await this.evaluatorMesh.healthCheck(),
      auditLogger: await this.auditLogger.healthCheck(),
      policyEngine: await this.policyEngine.healthCheck(),
      contextRetriever: await this.contextRetriever.healthCheck()
    };
    
    const allHealthy = Object.values(services).every(Boolean);
    const anyHealthy = Object.values(services).some(Boolean);
    
    return {
      status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
      services,
      timestamp: new Date()
    };
  }
}