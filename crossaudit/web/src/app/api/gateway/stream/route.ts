import { NextRequest } from 'next/server';
import { validateAuth, checkRateLimit } from '@/lib/auth-middleware';
import { LLMGateway } from '@/gateway/proxy';
import { ProviderManager } from '@/gateway/providers/manager';
import { EvaluatorMesh } from '@/evaluators/mesh';
import { AuditLogger } from '@/audit/logger';
import { PolicyEngine } from '@/policy/engine';
import { ContextRetriever } from '@/vectordb/context-retriever';
import { LLMRequest } from '@/gateway/types';

export const dynamic = 'force-dynamic';

// Initialize gateway (reuse from main route)
let gateway: LLMGateway | null = null;

function initializeGateway() {
  if (gateway) return gateway;

  const providerConfigs = [
    {
      type: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY || 'demo-key',
      defaultModel: 'gpt-3.5-turbo'
    },
    {
      type: 'anthropic' as const,
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
      defaultModel: 'claude-3-haiku-20240307'
    }
  ];

  const providerManager = new ProviderManager(providerConfigs);
  const evaluatorMesh = new EvaluatorMesh();
  const auditLogger = new AuditLogger();
  const policyEngine = new PolicyEngine();
  const contextRetriever = new ContextRetriever();

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
      return new Response(
        JSON.stringify({ error: auth.error || 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limits
    const rateLimitOk = await checkRateLimit(
      auth.user!.id,
      'gateway-stream',
      50, // Lower limit for streaming
      60000
    );
    
    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { messages, model, ...options } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!model || typeof model !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: model is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clientId = auth.user!.organizationId;
    const userId = auth.user!.id;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const aiGateway = initializeGateway();
          
          // Stream the response with evaluation
          await aiGateway.interceptLLMCallStream(
            {
              model,
              messages,
              temperature: options.temperature || 0.7,
              max_tokens: options.max_tokens || 1000,
              stream: true,
              user: userId,
              metadata: {
                userAgent: request.headers.get('user-agent'),
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                timestamp: new Date().toISOString()
              }
            },
            clientId,
            userId,
            {
              onChunk: (chunk: string) => {
                const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                controller.enqueue(encoder.encode(data));
              },
              onComplete: (evaluation: any) => {
                // Send evaluation results
                const data = `data: ${JSON.stringify({ 
                  type: 'evaluation',
                  evaluation: {
                    action: evaluation.action,
                    violations: evaluation.violations,
                    scores: evaluation.evaluationScores,
                    rewritten: evaluation.action === 'REWRITE'
                  }
                })}\n\n`;
                controller.enqueue(encoder.encode(data));
                
                // Send done signal
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              },
              onError: (error: Error) => {
                const data = `data: ${JSON.stringify({ 
                  type: 'error',
                  error: error.message 
                })}\n\n`;
                controller.enqueue(encoder.encode(data));
                controller.close();
              }
            }
          );
        } catch (error) {
          console.error('Streaming error:', error);
          const data = `data: ${JSON.stringify({ 
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`;
          controller.enqueue(encoder.encode(data));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Gateway streaming API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}