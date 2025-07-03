import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, CheckCircle, Eye, FileText, Shield, Cpu, Database, Zap, GitBranch, Terminal, Code, Filter } from 'lucide-react';

interface ProcessingStepData {
  startTime: number;
  [key: string]: any;
}

interface ProcessingData {
  [stepId: string]: ProcessingStepData;
}

const InteractiveTutorial = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processingData, setProcessingData] = useState<ProcessingData>({});
  const [showCode, setShowCode] = useState(false);

  const pipelineSteps = [
    {
      id: 'intercept',
      title: "Request Interception",
      description: "AI response captured before user delivery",
      icon: <Eye className="h-5 w-5" />,
      status: 'idle',
      technical: "HTTP proxy layer captures outbound response",
      code: `POST /api/v1/intercept
Content-Type: application/json
{
  "response_id": "resp_7x9k2m",
  "content": "Our Q4 revenue was $4.2M...",
  "timestamp": "2025-01-15T10:30:45Z"
}`,
      metrics: { latency: "2ms", throughput: "10k/sec" }
    },
    {
      id: 'parse',
      title: "Content Parsing",
      description: "Response tokenized and structured for analysis",
      icon: <Code className="h-5 w-5" />,
      status: 'idle',
      technical: "NLP tokenization and semantic structure extraction",
      code: `{
  "tokens": 847,
  "entities": ["revenue", "Q4", "$4.2M"],
  "sentiment": 0.72,
  "topics": ["financial_data", "earnings"]
}`,
      metrics: { tokens: "847", entities: "12" }
    },
    {
      id: 'evaluate',
      title: "Multi-Model Evaluation",
      description: "Parallel analysis across specialized AI models",
      icon: <Cpu className="h-5 w-5" />,
      status: 'idle',
      technical: "Distributed inference across 4 specialized models",
      code: `{
  "privacy_guard": {"score": 15, "risk": "financial_disclosure"},
  "access_control": {"score": 20, "risk": "unauthorized_data"},
  "content_filter": {"score": 30, "risk": "sensitive_info"},
  "audit_logger": {"score": 25, "risk": "compliance_violation"}
}`,
      metrics: { models: "4", parallel: "true" }
    },
    {
      id: 'decision',
      title: "Decision Engine",
      description: "Consensus algorithm determines response action",
      icon: <GitBranch className="h-5 w-5" />,
      status: 'idle',
      technical: "Weighted consensus with configurable thresholds",
      code: `{
  "consensus_score": 22.5,
  "threshold": 70,
  "action": "BLOCK_AND_REGENERATE",
  "confidence": 0.94
}`,
      metrics: { threshold: "70", confidence: "94%" }
    },
    {
      id: 'regenerate',
      title: "Content Regeneration",
      description: "Safe alternative response generated automatically",
      icon: <Zap className="h-5 w-5" />,
      status: 'idle',
      technical: "Context-aware safe response synthesis",
      code: `{
  "original_intent": "financial_inquiry",
  "safe_response": "I can't share specific financial data. Please contact our finance team for authorized information.",
  "preservation_score": 0.87
}`,
      metrics: { intent: "preserved", safety: "100%" }
    },
    {
      id: 'audit',
      title: "Audit Logging",
      description: "Complete interaction logged for compliance",
      icon: <Database className="h-5 w-5" />,
      status: 'idle',
      technical: "Immutable audit trail with cryptographic signatures",
      code: `{
  "audit_id": "aud_9m3k7x",
  "original_hash": "sha256:a7f3d9e2...",
  "modified_hash": "sha256:b8g4e0f3...",
  "compliance_tags": ["EU_AI_ACT", "GDPR"]
}`,
      metrics: { logged: "100%", retention: "7yr" }
    },
    {
      id: 'deliver',
      title: "Safe Delivery",
      description: "Verified response delivered to end user",
      icon: <CheckCircle className="h-5 w-5" />,
      status: 'idle',
      technical: "Secure response delivery with integrity verification",
      code: `HTTP/1.1 200 OK
Content-Type: application/json
X-Ausk-Status: MODIFIED
X-Ausk-ID: aud_9m3k7x

{
  "response": "I can't share specific financial data..."
}`,
      metrics: { delivery: "secure", integrity: "verified" }
    }
  ];

  const [steps, setSteps] = useState(pipelineSteps);

  const runPipeline = () => {
    setIsPlaying(true);
    setCurrentStep(0);
    setProcessingData({});
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'idle' })));

    // Animate through pipeline
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        const nextStep = prev + 1;
        
        // Update step status
        setSteps(current => current.map((step, index) => ({
          ...step,
          status: index < nextStep ? 'completed' : 
                 index === nextStep ? 'processing' : 'idle'
        })));

        // Add processing data for current step
        if (nextStep < pipelineSteps.length) {
          setProcessingData(prev => ({
            ...prev,
            [pipelineSteps[nextStep].id]: {
              startTime: Date.now(),
              ...pipelineSteps[nextStep].metrics
            }
          }));
        }

        if (nextStep >= pipelineSteps.length) {
          clearInterval(stepInterval);
          setIsPlaying(false);
          return prev;
        }
        return nextStep;
      });
    }, 1200);
  };

  const resetPipeline = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    setProcessingData({});
    setSteps(pipelineSteps.map(step => ({ ...step, status: 'idle' })));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'border-blue-500 bg-blue-50';
      case 'completed': return 'border-green-500 bg-green-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  return (
    <section id="pipeline" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-900 rounded-2xl p-8 mb-12 text-white">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Technical Pipeline</h2>
            <p className="text-lg text-gray-300 mb-6">
              Real-time AI response processing and safety verification
            </p>
            
            <div className="flex justify-center space-x-4 mb-8">
              <button
                onClick={runPipeline}
                disabled={isPlaying}
                className="flex items-center space-x-2 bg-white text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                <span>{isPlaying ? 'Processing...' : 'Run Pipeline'}</span>
              </button>
              
              <button
                onClick={resetPipeline}
                className="flex items-center space-x-2 border border-gray-600 text-gray-300 px-6 py-3 rounded-lg hover:border-gray-500 transition-colors"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Reset</span>
              </button>

              <button
                onClick={() => setShowCode(!showCode)}
                className="flex items-center space-x-2 border border-gray-600 text-gray-300 px-6 py-3 rounded-lg hover:border-gray-500 transition-colors"
              >
                <Terminal className="h-5 w-5" />
                <span>{showCode ? 'Hide Code' : 'Show Code'}</span>
              </button>
            </div>
          </div>

          {/* Pipeline Visualization */}
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 mb-8">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`border-2 rounded-xl p-4 transition-all duration-500 ${getStatusColor(step.status)}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${
                      step.status === 'processing' ? 'bg-blue-100' :
                      step.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {step.icon}
                    </div>
                    {getStatusIcon(step.status)}
                  </div>
                  
                  <h3 className="font-semibold text-sm mb-2 text-gray-900">{step.title}</h3>
                  <p className="text-xs text-gray-600 mb-3">{step.description}</p>
                  
                  {/* Technical Details */}
                  <div className="text-xs text-gray-500 mb-2">{step.technical}</div>
                  
                  {/* Metrics */}
                  {processingData[step.id] && (
                    <div className="space-y-1">
                      {Object.entries(step.metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-gray-500">{key}:</span>
                          <span className="font-mono text-gray-700">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connection Arrow */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2">
                      <div className="w-4 h-0.5 bg-gray-400"></div>
                      <div className="w-0 h-0 border-l-4 border-l-gray-400 border-t-2 border-b-2 border-t-transparent border-b-transparent absolute right-0 top-1/2 transform -translate-y-1/2"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Code Display */}
            {showCode && currentStep < steps.length && (
              <div className="bg-black rounded-xl p-6 mb-8 animate-fadeIn">
                <div className="flex items-center space-x-2 mb-4">
                  <Terminal className="h-5 w-5 text-green-400" />
                  <span className="text-green-400 font-mono text-sm">
                    {steps[currentStep]?.id || 'pipeline'} $ processing
                  </span>
                </div>
                <pre className="text-green-400 font-mono text-sm overflow-x-auto">
                  {steps[currentStep]?.code || '// Pipeline ready'}
                </pre>
              </div>
            )}

            {/* Real-time Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-gray-800 rounded-xl p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">
                  {isPlaying ? `${Math.max(0, currentStep * 1.2).toFixed(1)}s` : '0.0s'}
                </div>
                <div className="text-gray-400 text-sm">Total Latency</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">
                  {isPlaying ? `${currentStep}/${steps.length}` : `0/${steps.length}`}
                </div>
                <div className="text-gray-400 text-sm">Steps Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">
                  {isPlaying && currentStep >= 2 ? '4' : '0'}
                </div>
                <div className="text-gray-400 text-sm">Models Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">
                  {isPlaying && currentStep >= 6 ? '100%' : '0%'}
                </div>
                <div className="text-gray-400 text-sm">Safety Score</div>
              </div>
            </div>

            {/* Technical Architecture */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Infrastructure</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Kubernetes-native deployment</li>
                  <li>• Sub-second response times</li>
                  <li>• Auto-scaling to 100k+ requests/sec</li>
                  <li>• 99.99% uptime SLA</li>
                </ul>
              </div>
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Security</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• End-to-end encryption</li>
                  <li>• Zero-trust architecture</li>
                  <li>• Immutable audit logs</li>
                  <li>• SOC 2 Type II compliant</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveTutorial;