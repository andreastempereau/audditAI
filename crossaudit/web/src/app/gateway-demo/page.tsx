'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Loader2, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface GatewayResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  audit_info?: {
    rewritten: boolean;
    violations: string[];
    evaluationScores: {
      toxicity: number;
      policyCompliance: number;
      factualAccuracy: number;
      brandAlignment: number;
      overall: number;
    };
    latency: number;
  };
}

export default function GatewayDemo() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [clientId, setClientId] = useState('demo-client');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<GatewayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model,
          clientId,
          userId: 'demo-user',
          temperature: 0.7,
          max_tokens: 500
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gateway request failed');
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getActionIcon = (rewritten: boolean, violations: string[]) => {
    if (violations.length === 0) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (rewritten) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          CrossAudit AI Governance Gateway Demo
        </h1>
        <p className="text-gray-600 mt-2">
          Test the AI governance and safety evaluation system
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle>LLM Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Model</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                  <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Client ID</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo-client">Demo Client</SelectItem>
                  <SelectItem value="test-healthcare">Healthcare Org</SelectItem>
                  <SelectItem value="test-finance">Finance Org</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Prompt</label>
              <Textarea
                placeholder="Enter your prompt here... Try something that might trigger safety filters!"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={loading || !prompt.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing through Gateway...
                </>
              ) : (
                'Send through AI Gateway'
              )}
            </Button>

            {/* Test Examples */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Try these examples:</p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt("Write a professional email about our Q4 results")}
                >
                  Safe Content
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt("You're an idiot if you don't invest in crypto now")}
                >
                  Toxic Content
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt("Based on inside information, buy ACME stock tomorrow")}
                >
                  Compliance Issue
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt("The moon is made of cheese and aliens live there")}
                >
                  Factual Inaccuracy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Gateway Response</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {response && (
              <div className="space-y-4">
                {/* Response Text */}
                <div>
                  <p className="text-sm font-medium mb-2">LLM Response:</p>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{response.choices[0]?.message.content}</p>
                  </div>
                </div>

                {/* Audit Information */}
                {response.audit_info && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {getActionIcon(response.audit_info.rewritten, response.audit_info.violations)}
                      <span className="font-medium">
                        {response.audit_info.rewritten ? 'Content Rewritten' :
                         response.audit_info.violations.length > 0 ? 'Violations Detected' :
                         'Content Approved'}
                      </span>
                    </div>

                    {/* Evaluation Scores */}
                    <div>
                      <p className="text-sm font-medium mb-2">Evaluation Scores:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(response.audit_info.evaluationScores).map(([key, score]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                            <div className="flex items-center gap-1">
                              <div className={`w-3 h-3 rounded-full ${getScoreColor(score)}`} />
                              <span className="text-xs">{(score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Violations */}
                    {response.audit_info.violations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Violations:</p>
                        <div className="space-y-1">
                          {response.audit_info.violations.map((violation, index) => (
                            <Badge key={index} variant="destructive" className="text-xs">
                              {violation}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Processing Time */}
                    <div className="text-xs text-gray-500">
                      Processing time: {response.audit_info.latency}ms
                    </div>
                  </div>
                )}
              </div>
            )}

            {!response && !error && !loading && (
              <div className="text-center text-gray-500 py-8">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Enter a prompt and click submit to test the AI governance gateway</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>Gateway Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1" />
              <p className="text-xs">Provider Manager</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1" />
              <p className="text-xs">Evaluator Mesh</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1" />
              <p className="text-xs">Policy Engine</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1" />
              <p className="text-xs">Audit Logger</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}