import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, checkRateLimit } from '@/lib/auth-middleware';
import { LLMGateway } from '@/gateway/proxy';
import { ProviderManager } from '@/gateway/providers/manager';
import { EvaluatorMesh } from '@/evaluators/mesh';
import { AuditLogger } from '@/audit/logger';
import { PolicyEngine } from '@/policy/engine';
import { ContextRetriever } from '@/vectordb/context-retriever';
import { LLMRequest, ProviderConfig } from '@/gateway/types';

export const dynamic = 'force-dynamic';

// Initialize the AI governance gateway
let gateway: LLMGateway | null = null;

function initializeGateway() {
  if (gateway) return gateway;

  // Configure providers (in production, these would come from database)
  const providerConfigs: ProviderConfig[] = [
    {
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'demo-key',
      defaultModel: 'gpt-3.5-turbo'
    },
    {
      type: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
      defaultModel: 'claude-3-haiku-20240307'
    }
  ];

  // Initialize components
  const providerManager = new ProviderManager(providerConfigs);
  const evaluatorMesh = new EvaluatorMesh();
  const auditLogger = new AuditLogger();
  const policyEngine = new PolicyEngine();
  const contextRetriever = new ContextRetriever();

  // Create the gateway
  gateway = new LLMGateway(
    providerManager,
    evaluatorMesh,
    auditLogger,
    policyEngine,
    contextRetriever
  );

  return gateway;
}

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const auth = await validateAuth(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limits
    const rateLimitOk = await checkRateLimit(
      auth.user!.id,
      'gateway',
      100, // 100 requests
      60000 // per minute
    );
    
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Validate request
    const { messages, model, ...options } = body;
    
    // Use authenticated user's organization as clientId
    const clientId = auth.user!.organizationId;
    const userId = auth.user!.id;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    if (!model || typeof model !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: model is required' },
        { status: 400 }
      );
    }

    // ClientId is now derived from authenticated user

    // Construct LLM request
    const llmRequest: LLMRequest = {
      model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 1000,
      stream: false, // Streaming not supported in this demo
      user: userId,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    // Initialize gateway if needed
    const aiGateway = initializeGateway();

    // Process through AI governance gateway
    const response = await aiGateway.interceptLLMCall(
      llmRequest,
      clientId,
      userId
    );

    return NextResponse.json(response);

  } catch (error) {
    console.error('Gateway API error:', error);
    
    if (error instanceof Error && error.message.includes('Content blocked')) {
      return NextResponse.json(
        { 
          error: 'Content blocked by AI governance policy',
          details: error.message,
          type: 'CONTENT_BLOCKED'
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const gateway = initializeGateway();
    const healthStatus = await gateway.healthCheck();
    
    return NextResponse.json({
      status: 'AI Governance Gateway',
      health: healthStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });

  } catch (error) {
    console.error('Gateway health check error:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}