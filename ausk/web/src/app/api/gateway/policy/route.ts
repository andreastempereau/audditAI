import { NextRequest, NextResponse } from 'next/server';
import { PolicyEngine } from '@/policy/engine';
import { PolicyRule } from '@/gateway/types';

const policyEngine = new PolicyEngine();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const global = searchParams.get('global') === 'true';

    if (!clientId && !global) {
      return NextResponse.json(
        { error: 'clientId parameter is required unless requesting global rules' },
        { status: 400 }
      );
    }

    if (global) {
      const globalRules = await policyEngine.getGlobalRules();
      return NextResponse.json({
        rules: globalRules,
        count: globalRules.length,
        type: 'global'
      });
    } else {
      const clientRules = await policyEngine.getRules(clientId!);
      const stats = await policyEngine.getPolicyStats(clientId!);
      
      return NextResponse.json({
        rules: clientRules,
        stats,
        count: clientRules.length,
        type: 'client'
      });
    }

  } catch (error) {
    console.error('Policy GET API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve policy rules',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, clientId, ...params } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'addRule':
        const { rule } = params;
        if (!rule) {
          return NextResponse.json(
            { error: 'rule parameter is required' },
            { status: 400 }
          );
        }

        // Validate rule structure
        const requiredFields = ['id', 'name', 'description', 'condition', 'action', 'severity'];
        for (const field of requiredFields) {
          if (!rule[field]) {
            return NextResponse.json(
              { error: `Rule field '${field}' is required` },
              { status: 400 }
            );
          }
        }

        await policyEngine.addRule(clientId, rule as PolicyRule);
        return NextResponse.json({ 
          success: true, 
          message: 'Rule added successfully',
          ruleId: rule.id
        });

      case 'updateRule':
        const { ruleId, updates } = params;
        if (!ruleId || !updates) {
          return NextResponse.json(
            { error: 'ruleId and updates parameters are required' },
            { status: 400 }
          );
        }

        const updateSuccess = await policyEngine.updateRule(clientId, ruleId, updates);
        if (!updateSuccess) {
          return NextResponse.json(
            { error: 'Rule not found or update failed' },
            { status: 404 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Rule updated successfully' 
        });

      case 'removeRule':
        const { ruleId: removeRuleId } = params;
        if (!removeRuleId) {
          return NextResponse.json(
            { error: 'ruleId parameter is required' },
            { status: 400 }
          );
        }

        const removeSuccess = await policyEngine.removeRule(clientId, removeRuleId);
        if (!removeSuccess) {
          return NextResponse.json(
            { error: 'Rule not found or removal failed' },
            { status: 404 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Rule removed successfully' 
        });

      case 'testRule':
        const { testRule, evaluation, context } = params;
        if (!testRule || !evaluation || !context) {
          return NextResponse.json(
            { error: 'testRule, evaluation, and context parameters are required' },
            { status: 400 }
          );
        }

        const testResult = await policyEngine.testRule(testRule, evaluation, context);
        return NextResponse.json(testResult);

      case 'evaluatePolicy':
        const { evaluation: evalData, context: contextData } = params;
        if (!evalData || !contextData) {
          return NextResponse.json(
            { error: 'evaluation and context parameters are required' },
            { status: 400 }
          );
        }

        const policyDecision = await policyEngine.evaluatePolicy(evalData, {
          ...contextData,
          clientId
        });
        return NextResponse.json(policyDecision);

      case 'getStats':
        const policyStats = await policyEngine.getPolicyStats(clientId);
        return NextResponse.json(policyStats);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Policy POST API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute policy action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Alias for POST to support rule updates via PUT
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const ruleId = searchParams.get('ruleId');

    if (!clientId || !ruleId) {
      return NextResponse.json(
        { error: 'clientId and ruleId parameters are required' },
        { status: 400 }
      );
    }

    const success = await policyEngine.removeRule(clientId, ruleId);
    if (!success) {
      return NextResponse.json(
        { error: 'Rule not found or removal failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Rule removed successfully' 
    });

  } catch (error) {
    console.error('Policy DELETE API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete policy rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}