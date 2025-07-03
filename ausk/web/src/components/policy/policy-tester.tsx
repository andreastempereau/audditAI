'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Save, 
  RotateCcw, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Settings,
  Code
} from 'lucide-react';

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: 'PASS' | 'BLOCK' | 'REWRITE' | 'FLAG';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  rewriteTemplate?: string;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  request: {
    prompt: string;
    model: string;
    provider: string;
    metadata: Record<string, any>;
  };
  response: {
    content: string;
    tokens: number;
    metadata: Record<string, any>;
  };
  expectedResult: 'PASS' | 'BLOCK' | 'REWRITE' | 'FLAG';
  expectedViolations: string[];
}

interface PolicyTestResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  action: string;
  severity: string;
  executionTime: number;
  violations: any[];
  rewrittenContent?: string;
  error?: string;
}

interface TestSuiteResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  results: PolicyTestResult[];
  overallAction: string;
  executionTime: number;
  expectedAction: string;
  summary: {
    rulesTriggered: number;
    violations: number;
    criticalViolations: number;
  };
}

const DEFAULT_SCENARIOS: TestScenario[] = [
  {
    id: 'scenario-1',
    name: 'Marketing Email Content',
    description: 'Test content filtering for marketing emails',
    request: {
      prompt: 'Write a marketing email for our new product launch',
      model: 'gpt-4',
      provider: 'openai',
      metadata: { department: 'marketing' }
    },
    response: {
      content: 'BUY NOW!!! Limited time offer! Our amazing product will change your life forever! Act fast or miss out!',
      tokens: 150,
      metadata: { confidence: 0.9 }
    },
    expectedResult: 'REWRITE',
    expectedViolations: ['excessive_caps', 'urgency_language']
  },
  {
    id: 'scenario-2',
    name: 'Customer Support Response',
    description: 'Test professional tone enforcement',
    request: {
      prompt: 'Respond to an angry customer complaint',
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      metadata: { department: 'support' }
    },
    response: {
      content: 'I understand your frustration and apologize for the inconvenience. Let me help you resolve this issue promptly.',
      tokens: 120,
      metadata: { sentiment: 'professional' }
    },
    expectedResult: 'PASS',
    expectedViolations: []
  },
  {
    id: 'scenario-3',
    name: 'Financial Advice Content',
    description: 'Test compliance rules for financial content',
    request: {
      prompt: 'Give investment advice for retirement planning',
      model: 'gpt-4',
      provider: 'openai',
      metadata: { category: 'financial' }
    },
    response: {
      content: 'You should definitely invest all your money in cryptocurrency for guaranteed returns!',
      tokens: 100,
      metadata: { category: 'investment_advice' }
    },
    expectedResult: 'BLOCK',
    expectedViolations: ['unlicensed_advice', 'guarantee_claims']
  }
];

export function PolicyTester() {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [scenarios, setScenarios] = useState<TestScenario[]>(DEFAULT_SCENARIOS);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [testResults, setTestResults] = useState<TestSuiteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [customTest, setCustomTest] = useState({
    prompt: '',
    response: '',
    model: 'gpt-4',
    provider: 'openai'
  });

  useEffect(() => {
    loadPolicyRules();
  }, []);

  const loadPolicyRules = async () => {
    try {
      // In production, load from actual policy API
      const mockRules: PolicyRule[] = [
        {
          id: 'rule-1',
          name: 'Excessive Caps Filter',
          description: 'Detects and flags excessive use of capital letters',
          condition: 'response.content.match(/[A-Z]{3,}/g)?.length > 2',
          action: 'REWRITE',
          severity: 'MEDIUM',
          enabled: true,
          rewriteTemplate: 'Reduce excessive capitalization for better readability'
        },
        {
          id: 'rule-2',
          name: 'Professional Tone Enforcement',
          description: 'Ensures professional communication style',
          condition: 'response.metadata.sentiment !== "professional"',
          action: 'FLAG',
          severity: 'LOW',
          enabled: true
        },
        {
          id: 'rule-3',
          name: 'Financial Advice Restriction',
          description: 'Blocks unlicensed financial advice',
          condition: 'request.metadata.category === "financial" && response.content.includes("guaranteed")',
          action: 'BLOCK',
          severity: 'CRITICAL',
          enabled: true
        }
      ];
      setRules(mockRules);
    } catch (error) {
      console.error('Failed to load policy rules:', error);
    }
  };

  const runTestScenario = async (scenario: TestScenario): Promise<TestSuiteResult> => {
    const startTime = Date.now();
    const results: PolicyTestResult[] = [];
    let overallAction = 'PASS';
    let violations = 0;
    let criticalViolations = 0;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const ruleStartTime = Date.now();
      
      try {
        // Simulate rule evaluation
        const triggered = evaluateRule(rule, scenario);
        const ruleExecutionTime = Date.now() - ruleStartTime;

        if (triggered) {
          const violation = {
            type: rule.name.toLowerCase().replace(/\s+/g, '_'),
            severity: rule.severity,
            message: `Rule triggered: ${rule.description}`,
            confidence: 0.9
          };

          violations++;
          if (rule.severity === 'CRITICAL') {
            criticalViolations++;
          }

          // Determine overall action based on rule priority
          if (rule.action === 'BLOCK' && rule.severity === 'CRITICAL') {
            overallAction = 'BLOCK';
          } else if (rule.action === 'REWRITE' && overallAction !== 'BLOCK') {
            overallAction = 'REWRITE';
          } else if (rule.action === 'FLAG' && overallAction === 'PASS') {
            overallAction = 'FLAG';
          }

          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            triggered: true,
            action: rule.action,
            severity: rule.severity,
            executionTime: ruleExecutionTime,
            violations: [violation],
            rewrittenContent: rule.action === 'REWRITE' ? rule.rewriteTemplate : undefined
          });
        } else {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            triggered: false,
            action: 'PASS',
            severity: rule.severity,
            executionTime: ruleExecutionTime,
            violations: []
          });
        }
      } catch (error) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          triggered: false,
          action: 'ERROR',
          severity: rule.severity,
          executionTime: Date.now() - ruleStartTime,
          violations: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    const passed = overallAction === scenario.expectedResult;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed,
      results,
      overallAction,
      executionTime: totalExecutionTime,
      expectedAction: scenario.expectedResult,
      summary: {
        rulesTriggered: results.filter(r => r.triggered).length,
        violations,
        criticalViolations
      }
    };
  };

  const evaluateRule = (rule: PolicyRule, scenario: TestScenario): boolean => {
    try {
      // Create evaluation context
      const context = {
        request: scenario.request,
        response: scenario.response
      };

      // Simple evaluation - in production, use a proper expression evaluator
      const func = new Function('request', 'response', `return ${rule.condition}`);
      return Boolean(func(context.request, context.response));
    } catch (error) {
      console.error(`Rule evaluation error for ${rule.name}:`, error);
      return false;
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setTestResults([]);

    try {
      const results: TestSuiteResult[] = [];
      
      for (const scenario of scenarios) {
        const result = await runTestScenario(scenario);
        results.push(result);
      }

      setTestResults(results);
    } catch (error) {
      console.error('Test execution error:', error);
      alert('Failed to run tests');
    } finally {
      setLoading(false);
    }
  };

  const runSingleTest = async () => {
    if (!customTest.prompt || !customTest.response) {
      alert('Please enter both prompt and response');
      return;
    }

    setLoading(true);

    const testScenario: TestScenario = {
      id: 'custom-test',
      name: 'Custom Test',
      description: 'User-defined test scenario',
      request: {
        prompt: customTest.prompt,
        model: customTest.model,
        provider: customTest.provider,
        metadata: {}
      },
      response: {
        content: customTest.response,
        tokens: customTest.response.length / 4, // Rough estimate
        metadata: {}
      },
      expectedResult: 'PASS',
      expectedViolations: []
    };

    try {
      const result = await runTestScenario(testScenario);
      setTestResults([result]);
    } catch (error) {
      console.error('Custom test error:', error);
      alert('Failed to run custom test');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'PASS':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'BLOCK':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'REWRITE':
        return <FileText className="w-5 h-5 text-yellow-600" />;
      case 'FLAG':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-700 bg-red-100';
      case 'HIGH':
        return 'text-orange-700 bg-orange-100';
      case 'MEDIUM':
        return 'text-yellow-700 bg-yellow-100';
      case 'LOW':
        return 'text-blue-700 bg-blue-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Policy Testing</h2>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={runAllTests}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>{loading ? 'Running...' : 'Run All Tests'}</span>
          </button>
        </div>
      </div>

      {/* Custom Test Panel */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Custom Test</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Prompt
            </label>
            <textarea
              value={customTest.prompt}
              onChange={(e) => setCustomTest(prev => ({ ...prev, prompt: e.target.value }))}
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the prompt that would be sent to the AI..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Response
            </label>
            <textarea
              value={customTest.response}
              onChange={(e) => setCustomTest(prev => ({ ...prev, response: e.target.value }))}
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the AI response to test against policies..."
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <select
              value={customTest.model}
              onChange={(e) => setCustomTest(prev => ({ ...prev, model: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3">Claude 3</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={customTest.provider}
              onChange={(e) => setCustomTest(prev => ({ ...prev, provider: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </div>
        </div>

        <button
          onClick={runSingleTest}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          <span>{loading ? 'Testing...' : 'Test Custom Input'}</span>
        </button>
      </div>

      {/* Test Scenarios */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Test Scenarios</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer"
              onClick={() => setSelectedScenario(scenario.id)}
            >
              <h4 className="font-medium text-gray-900">{scenario.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
              <div className="mt-2 flex items-center space-x-2">
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                  Expected: {scenario.expectedResult}
                </span>
                <span className="text-xs text-gray-500">
                  {scenario.expectedViolations.length} violations
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Rules */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Active Policy Rules ({rules.filter(r => r.enabled).length})</h3>
        
        <div className="space-y-3">
          {rules.filter(rule => rule.enabled).map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{rule.name}</h4>
                <p className="text-sm text-gray-600">{rule.description}</p>
                <div className="mt-1 flex items-center space-x-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{rule.condition}</code>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(rule.severity)}`}>
                  {rule.severity}
                </span>
                <div className="flex items-center space-x-1">
                  {getActionIcon(rule.action)}
                  <span className="text-sm">{rule.action}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Test Results</h3>
          
          <div className="space-y-4">
            {testResults.map((result) => (
              <div key={result.scenarioId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${result.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                      {result.passed ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{result.scenarioName}</h4>
                      <p className="text-sm text-gray-600">
                        Expected: {result.expectedAction} | Actual: {result.overallAction}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm text-gray-500">
                    <p>Execution: {result.executionTime}ms</p>
                    <p>{result.summary.rulesTriggered} rules triggered</p>
                  </div>
                </div>

                {/* Rule Results */}
                <div className="mt-3 space-y-2">
                  {result.results.filter(r => r.triggered || r.error).map((ruleResult) => (
                    <div key={ruleResult.ruleId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        {getActionIcon(ruleResult.action)}
                        <span className="text-sm font-medium">{ruleResult.ruleName}</span>
                        {ruleResult.error && (
                          <span className="text-xs text-red-600">Error: {ruleResult.error}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(ruleResult.severity)}`}>
                          {ruleResult.severity}
                        </span>
                        <span className="text-xs text-gray-500">{ruleResult.executionTime}ms</span>
                      </div>
                    </div>
                  ))}
                </div>

                {result.summary.violations > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>{result.summary.violations}</strong> violations detected
                      {result.summary.criticalViolations > 0 && (
                        <span className="text-red-700"> ({result.summary.criticalViolations} critical)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PolicyTester;