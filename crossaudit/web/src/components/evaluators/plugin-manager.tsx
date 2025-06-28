'use client';

import React, { useState, useEffect } from 'react';
import { 
  Code, 
  Plus, 
  Play, 
  Settings, 
  Trash2, 
  Upload, 
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { PluginManifest } from '@/evaluators/plugin-framework';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  status: 'active' | 'inactive' | 'error';
  evaluatorCount: number;
  activeEvaluators: number;
  category: string;
}

interface TestResult {
  evaluatorId: string;
  evaluatorName: string;
  result?: {
    score: number;
    violations: any[];
    executionTime: number;
  };
  error?: string;
  success: boolean;
}

export function PluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [installData, setInstallData] = useState({
    manifest: '',
    code: ''
  });
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testContext, setTestContext] = useState({
    prompt: 'Create a marketing email for our new product',
    response: 'Buy our amazing product now! Limited time offer!!!',
    model: 'gpt-4'
  });

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/evaluators/plugins');
      if (response.ok) {
        const data = await response.json();
        setPlugins(data.plugins);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const installPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const manifest = JSON.parse(installData.manifest);
      
      const response = await fetch('/api/evaluators/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest,
          code: installData.code
        })
      });

      if (response.ok) {
        await loadPlugins();
        setShowInstallForm(false);
        setInstallData({ manifest: '', code: '' });
        alert('Plugin installed successfully');
      } else {
        const error = await response.json();
        alert(`Failed to install plugin: ${error.error}`);
      }
    } catch (error) {
      alert(`Invalid manifest format: ${error}`);
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return;

    try {
      const response = await fetch(`/api/evaluators/plugins?id=${pluginId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadPlugins();
        alert('Plugin uninstalled successfully');
      } else {
        const error = await response.json();
        alert(`Failed to uninstall plugin: ${error.error}`);
      }
    } catch (error) {
      console.error('Uninstall plugin error:', error);
      alert('Failed to uninstall plugin');
    }
  };

  const testAllEvaluators = async () => {
    try {
      setTestResults([]);
      
      const response = await fetch('/api/evaluators/test/all', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testContext })
      });

      if (response.ok) {
        const data = await response.json();
        setTestResults(data.results);
      } else {
        const error = await response.json();
        alert(`Test failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Test evaluators error:', error);
      alert('Failed to test evaluators');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'inactive':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const loadExamplePlugin = () => {
    const exampleManifest = {
      id: 'example-content-filter',
      name: 'Example Content Filter',
      version: '1.0.0',
      description: 'Example evaluator that filters inappropriate content',
      author: 'CrossAudit Team',
      license: 'MIT',
      keywords: ['content', 'filter', 'safety'],
      evaluators: [{
        id: 'example-profanity-filter',
        name: 'Profanity Filter',
        version: '1.0.0',
        description: 'Detects and flags profanity in responses',
        author: 'CrossAudit Team',
        category: 'safety',
        enabled: true,
        priority: 5,
        timeout: 5000,
        retries: 2,
        parameters: {
          strictMode: false,
          customWords: []
        },
        dependencies: [],
        triggers: [{
          condition: 'context.response.content.length > 0',
          description: 'Evaluate when response has content'
        }]
      }],
      permissions: [{
        type: 'api',
        resource: 'content-analysis',
        action: 'read',
        description: 'Access to content analysis APIs'
      }],
      sandbox: {
        memory: 50,
        timeout: 10,
        networkAccess: false,
        allowedDomains: [],
        allowedAPIs: []
      }
    };

    const exampleCode = `
async function evaluate(context) {
  const content = context.response.content.toLowerCase();
  const profanityWords = ['spam', 'scam', 'fake'];
  
  const violations = [];
  let score = 1.0;
  
  for (const word of profanityWords) {
    if (content.includes(word)) {
      violations.push({
        type: 'inappropriate_content',
        severity: 'MEDIUM',
        message: \`Detected potentially inappropriate content: "\${word}"\`,
        confidence: 0.8,
        suggestions: ['Consider rephrasing to be more professional']
      });
      score -= 0.3;
    }
  }
  
  return {
    score: Math.max(0, score),
    violations,
    metadata: {
      wordsChecked: profanityWords.length,
      contentLength: content.length
    },
    confidence: 0.9
  };
}`;

    setInstallData({
      manifest: JSON.stringify(exampleManifest, null, 2),
      code: exampleCode
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Evaluator Plugins</h2>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInstallForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Install Plugin</span>
          </button>
        </div>
      </div>

      {/* Install Form */}
      {showInstallForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Install New Plugin</h3>
            <button
              onClick={() => setShowInstallForm(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={installPlugin}>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Plugin Manifest (JSON)
                  </label>
                  <button
                    type="button"
                    onClick={loadExamplePlugin}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Load Example
                  </button>
                </div>
                <textarea
                  value={installData.manifest}
                  onChange={(e) => setInstallData(prev => ({ ...prev, manifest: e.target.value }))}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Paste plugin manifest JSON here..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evaluator Code (JavaScript)
                </label>
                <textarea
                  value={installData.code}
                  onChange={(e) => setInstallData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Paste evaluator JavaScript code here..."
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setShowInstallForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Install Plugin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Test Panel */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Test All Evaluators</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Prompt
            </label>
            <input
              type="text"
              value={testContext.prompt}
              onChange={(e) => setTestContext(prev => ({ ...prev, prompt: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Response
            </label>
            <input
              type="text"
              value={testContext.response}
              onChange={(e) => setTestContext(prev => ({ ...prev, response: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <select
              value={testContext.model}
              onChange={(e) => setTestContext(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3">Claude 3</option>
            </select>
          </div>
        </div>

        <button
          onClick={testAllEvaluators}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Play className="w-4 h-4" />
          <span>Test All Evaluators</span>
        </button>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-3">Test Results</h4>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium">{result.evaluatorName}</h5>
                      {result.success ? (
                        <div className="text-sm text-gray-600">
                          <p>Score: {(result.result!.score * 100).toFixed(1)}%</p>
                          <p>Violations: {result.result!.violations.length}</p>
                          <p>Execution time: {result.result!.executionTime}ms</p>
                        </div>
                      ) : (
                        <p className="text-sm text-red-600">{result.error}</p>
                      )}
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${
                      result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {result.success ? 'Success' : 'Failed'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Plugins List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Installed Plugins ({plugins.length})
          </h3>
        </div>
        
        {plugins.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No plugins installed yet</p>
            <p className="text-sm">Install your first evaluator plugin to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(plugin.status)}
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          {plugin.name}
                        </h4>
                        <p className="text-gray-600">{plugin.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>v{plugin.version}</span>
                          <span>by {plugin.author}</span>
                          <span>{plugin.activeEvaluators}/{plugin.evaluatorCount} evaluators active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => uninstallPlugin(plugin.id)}
                      className="p-2 text-gray-400 hover:text-red-600"
                      title="Uninstall plugin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PluginManager;