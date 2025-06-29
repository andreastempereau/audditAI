import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth-middleware';
import { pluginManager, EvaluatorContext } from '@/evaluators/plugin-framework';

export const dynamic = 'force-dynamic';

// POST /api/evaluators/test - Test an evaluator with sample data
export const POST = withPermission('evaluators.write')(async (request) => {
  try {
    const body = await request.json();
    const { evaluatorId, testContext } = body;

    if (!evaluatorId || !testContext) {
      return NextResponse.json({ 
        error: 'Evaluator ID and test context are required' 
      }, { status: 400 });
    }

    const evaluator = pluginManager.getEvaluator(evaluatorId);
    if (!evaluator) {
      return NextResponse.json({ error: 'Evaluator not found' }, { status: 404 });
    }

    // Create test context
    const context: EvaluatorContext = {
      request: {
        prompt: testContext.prompt || 'Test prompt',
        model: testContext.model || 'gpt-4',
        provider: testContext.provider || 'openai',
        userId: 'test-user',
        organizationId: 'test-org',
        metadata: testContext.requestMetadata || {}
      },
      response: {
        content: testContext.response || 'Test response content',
        model: testContext.model || 'gpt-4',
        tokens: testContext.tokens || 100,
        metadata: testContext.responseMetadata || {}
      },
      document: testContext.document ? {
        content: testContext.document.content,
        metadata: testContext.document.metadata || {}
      } : undefined,
      environment: {
        organizationId: 'test-org',
        policies: testContext.policies || [],
        userRoles: testContext.userRoles || ['user'],
        departmentId: testContext.departmentId
      }
    };

    const startTime = Date.now();
    const result = await evaluator.evaluate(context);
    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      result: {
        ...result,
        totalExecutionTime: totalTime
      },
      testContext: context
    });

  } catch (error) {
    console.error('Test evaluator error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Evaluator test failed' 
    }, { status: 500 });
  }
});

// POST /api/evaluators/test/all - Test all active evaluators
export const PUT = withPermission('evaluators.write')(async (request) => {
  try {
    const body = await request.json();
    const { testContext } = body;

    if (!testContext) {
      return NextResponse.json({ 
        error: 'Test context is required' 
      }, { status: 400 });
    }

    const activeEvaluators = pluginManager.getActiveEvaluators();
    
    if (activeEvaluators.length === 0) {
      return NextResponse.json({ 
        error: 'No active evaluators found' 
      }, { status: 404 });
    }

    // Create test context
    const context: EvaluatorContext = {
      request: {
        prompt: testContext.prompt || 'Test prompt',
        model: testContext.model || 'gpt-4',
        provider: testContext.provider || 'openai',
        userId: 'test-user',
        organizationId: 'test-org',
        metadata: testContext.requestMetadata || {}
      },
      response: {
        content: testContext.response || 'Test response content',
        model: testContext.model || 'gpt-4',
        tokens: testContext.tokens || 100,
        metadata: testContext.responseMetadata || {}
      },
      document: testContext.document ? {
        content: testContext.document.content,
        metadata: testContext.document.metadata || {}
      } : undefined,
      environment: {
        organizationId: 'test-org',
        policies: testContext.policies || [],
        userRoles: testContext.userRoles || ['user'],
        departmentId: testContext.departmentId
      }
    };

    const results = [];
    const startTime = Date.now();

    // Run evaluators in priority order
    for (const evaluator of activeEvaluators) {
      try {
        const evalStartTime = Date.now();
        const result = await evaluator.evaluate(context);
        const evalTime = Date.now() - evalStartTime;

        results.push({
          evaluatorId: evaluator['config'].id,
          evaluatorName: evaluator['config'].name,
          result: {
            ...result,
            executionTime: evalTime
          },
          success: true
        });
      } catch (error) {
        results.push({
          evaluatorId: evaluator['config'].id,
          evaluatorName: evaluator['config'].name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    const totalTime = Date.now() - startTime;

    // Calculate aggregate scores
    const successfulResults = results.filter(r => r.success && r.result);
    const averageScore = successfulResults.length > 0 
      ? successfulResults.reduce((sum, r) => sum + (r.result?.score || 0), 0) / successfulResults.length
      : 0;
    
    const allViolations = successfulResults.flatMap(r => r.result?.violations || []);
    const criticalViolations = allViolations.filter(v => v.severity === 'CRITICAL').length;
    const highViolations = allViolations.filter(v => v.severity === 'HIGH').length;

    return NextResponse.json({
      success: true,
      summary: {
        totalEvaluators: activeEvaluators.length,
        successfulEvaluations: successfulResults.length,
        failedEvaluations: results.length - successfulResults.length,
        averageScore,
        totalViolations: allViolations.length,
        criticalViolations,
        highViolations,
        totalExecutionTime: totalTime
      },
      results,
      testContext: context
    });

  } catch (error) {
    console.error('Test all evaluators error:', error);
    return NextResponse.json({ 
      error: 'Failed to test evaluators' 
    }, { status: 500 });
  }
});