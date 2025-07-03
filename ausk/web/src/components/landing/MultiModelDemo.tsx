import React, { useState, useEffect } from 'react';
import { Brain, Shield, CheckCircle, AlertTriangle, Eye, Zap, Users, Building2, Database, FileText, Clock, User } from 'lucide-react';

interface BaseQuery {
  text: string;
  type: string;
  risk: string;
  user: string;
}

interface CustomerQuery extends BaseQuery {}

interface EmployeeQuery extends BaseQuery {
  dataAccess: string[];
}

type Query = CustomerQuery | EmployeeQuery;

const MultiModelDemo = () => {
  const [activeTab, setActiveTab] = useState<'customer' | 'employee'>('customer');
  const [selectedQuery, setSelectedQuery] = useState(0);
  const [activeModel, setActiveModel] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  const isEmployeeQuery = (query: Query): query is EmployeeQuery => {
    return 'dataAccess' in query;
  };

  const customerQueries: CustomerQuery[] = [
    {
      text: "What's your company's revenue this quarter?",
      type: "Financial Inquiry",
      risk: "high",
      user: "External Customer"
    },
    {
      text: "How do I reset my account password?",
      type: "Support Request",
      risk: "low",
      user: "Customer Support"
    },
    {
      text: "Can you share your customer database?",
      type: "Data Request",
      risk: "critical",
      user: "External User"
    }
  ];

  const employeeQueries: EmployeeQuery[] = [
    {
      text: "Generate a marketing email for our Q4 product launch",
      type: "Content Generation",
      risk: "medium",
      user: "Marketing Team",
      dataAccess: ["Brand Guidelines", "Product Specs", "Previous Campaigns"]
    },
    {
      text: "Create a financial report summary for the board meeting",
      type: "Internal Report",
      risk: "high",
      user: "Finance Team",
      dataAccess: ["Q4 Financial Data", "Revenue Reports", "Budget Analysis"]
    },
    {
      text: "Draft a response to the customer complaint about delivery delays",
      type: "Customer Service",
      risk: "medium",
      user: "Support Team",
      dataAccess: ["Customer History", "Shipping Data", "Policy Documents"]
    }
  ];

  const currentQueries = activeTab === 'customer' ? customerQueries : employeeQueries;

  const models = [
    {
      id: 1,
      name: "Privacy Guard",
      icon: <Shield className="h-5 w-5" />,
      specialty: "Data Protection",
      color: "blue",
      customerAnalysis: {
        0: { score: 15, status: "risk", reason: "Contains financial data request from external user" },
        1: { score: 95, status: "safe", reason: "Standard support question, no sensitive data" },
        2: { score: 5, status: "critical", reason: "Unauthorized data access attempt detected" }
      },
      employeeAnalysis: {
        0: { score: 85, status: "safe", reason: "Authorized employee with marketing data access" },
        1: { score: 70, status: "risk", reason: "Financial data requires additional verification" },
        2: { score: 90, status: "safe", reason: "Customer service data within policy bounds" }
      }
    },
    {
      id: 2,
      name: "Access Control",
      icon: <Eye className="h-5 w-5" />,
      specialty: "Authorization",
      color: "green",
      customerAnalysis: {
        0: { score: 20, status: "risk", reason: "External user lacks authorization for financial data" },
        1: { score: 90, status: "safe", reason: "Public support information accessible" },
        2: { score: 10, status: "critical", reason: "No authorization for database access" }
      },
      employeeAnalysis: {
        0: { score: 95, status: "safe", reason: "Employee verified, marketing role confirmed" },
        1: { score: 85, status: "safe", reason: "Finance team member with proper clearance" },
        2: { score: 90, status: "safe", reason: "Support team authorized for customer data" }
      }
    },
    {
      id: 3,
      name: "Content Filter",
      icon: <Brain className="h-5 w-5" />,
      specialty: "Safety & Brand",
      color: "purple",
      customerAnalysis: {
        0: { score: 30, status: "risk", reason: "Sensitive information category detected" },
        1: { score: 85, status: "safe", reason: "Safe content category, standard response" },
        2: { score: 0, status: "critical", reason: "Malicious intent pattern identified" }
      },
      employeeAnalysis: {
        0: { score: 90, status: "safe", reason: "Marketing content aligns with brand guidelines" },
        1: { score: 75, status: "risk", reason: "Financial content requires compliance review" },
        2: { score: 85, status: "safe", reason: "Customer service tone appropriate" }
      }
    },
    {
      id: 4,
      name: "Audit Logger",
      icon: <FileText className="h-5 w-5" />,
      specialty: "Compliance",
      color: "orange",
      customerAnalysis: {
        0: { score: 25, status: "risk", reason: "High-risk interaction requires detailed logging" },
        1: { score: 95, status: "safe", reason: "Standard interaction, basic logging sufficient" },
        2: { score: 10, status: "critical", reason: "Security incident logged for investigation" }
      },
      employeeAnalysis: {
        0: { score: 95, status: "safe", reason: "Employee action logged with data provenance" },
        1: { score: 90, status: "safe", reason: "Financial access logged for compliance audit" },
        2: { score: 95, status: "safe", reason: "Customer interaction logged with full context" }
      }
    }
  ];

  const getColorClasses = (color: string, variant: 'bg' | 'text' | 'border') => {
    const colors = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
      green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
    };
    return colors[color as keyof typeof colors][variant];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return 'text-green-600';
      case 'risk': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'safe': return <CheckCircle className="h-4 w-4" />;
      case 'risk': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  const runAnalysis = () => {
    setIsAnalyzing(true);
    setShowResults(false);
    setActiveModel(null);
    setShowAuditTrail(false);

    // Animate through steps with longer delays
    setTimeout(() => {
      setActiveModel(1);
      setTimeout(() => {
        setActiveModel(2);
        setTimeout(() => {
          setActiveModel(3);
          setTimeout(() => {
            setActiveModel(4);
            setTimeout(() => {
              setActiveModel(null);
              setShowResults(true);
              setIsAnalyzing(false);
              // Show audit trail after results for employee tab
              if (activeTab === 'employee') {
                setTimeout(() => setShowAuditTrail(true), 1500);
              }
            }, 2000);
          }, 2000);
        }, 2000);
      }, 2000);
    }, 1000);
  };

  const getFinalDecision = () => {
    const analysisKey = activeTab === 'customer' ? 'customerAnalysis' : 'employeeAnalysis';
    const scores = models.map(model => model[analysisKey][selectedQuery as keyof typeof model[typeof analysisKey]].score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (avgScore >= 70) return { status: 'approved', color: 'green', text: 'Response Approved' };
    if (avgScore >= 30) return { status: 'modified', color: 'orange', text: 'Response Modified' };
    return { status: 'blocked', color: 'red', text: 'Response Blocked' };
  };

  const resetDemo = () => {
    setSelectedQuery(0);
    setShowResults(false);
    setActiveModel(null);
    setShowAuditTrail(false);
  };

  useEffect(() => {
    resetDemo();
  }, [activeTab]);

  return (
    <section id="multi-model" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Multi-Model AI Analysis
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ausk can work on two sides: for consumer-facing AI modules, as well as employees using generative AI to aid their work.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'customer'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>Customer-Facing AI</span>
            </button>
            <button
              onClick={() => setActiveTab('employee')}
              className={`flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === 'employee'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 className="h-5 w-5" />
              <span>Internal Employee AI</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          {/* Scenario Description */}
          <div className="mb-8 p-6 bg-gray-50 rounded-xl">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-white rounded-lg">
                {activeTab === 'customer' ? <Users className="h-6 w-6 text-gray-700" /> : <Building2 className="h-6 w-6 text-gray-700" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {activeTab === 'customer' ? 'Customer-Facing AI Protection' : 'Internal Employee AI Governance'}
                </h3>
                <p className="text-gray-600">
                  {activeTab === 'customer' 
                    ? 'External users interact with your AI systems. Ausk ensures no sensitive data is exposed and all interactions are secure.'
                    : 'Employees use AI for content generation and analysis. Ausk verifies access permissions, logs data usage, and maintains audit trails.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Query Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose a test scenario:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedQuery(index);
                    setShowResults(false);
                    setActiveModel(null);
                    setShowAuditTrail(false);
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedQuery === index
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 mb-2">"{query.text}"</div>
                  <div className="text-sm text-gray-600 mb-2">{query.type}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-500">{query.user}</span>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      query.risk === 'low' ? 'bg-green-100 text-green-700' :
                      query.risk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      query.risk === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {query.risk} risk
                    </div>
                  </div>
                  {activeTab === 'employee' && isEmployeeQuery(query) && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Data Access:</div>
                      <div className="flex flex-wrap gap-1">
                        {query.dataAccess.map((data, i) => (
                          <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {data}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Analysis Button */}
          <div className="text-center mb-8">
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing...' : 'Run Multi-Model Analysis'}
            </button>
          </div>

          {/* Models Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {models.map((model) => {
              const analysisKey = activeTab === 'customer' ? 'customerAnalysis' : 'employeeAnalysis';
              const analysis = model[analysisKey][selectedQuery as keyof typeof model[typeof analysisKey]];
              const isActive = activeModel === model.id;
              const shouldShow = showResults || isActive;

              return (
                <div
                  key={model.id}
                  className={`border-2 rounded-xl p-6 transition-all duration-500 ${
                    isActive 
                      ? `${getColorClasses(model.color, 'border')} ${getColorClasses(model.color, 'bg')} scale-105 shadow-lg` 
                      : showResults 
                        ? 'border-gray-200 bg-white' 
                        : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-2 rounded-lg ${getColorClasses(model.color, 'bg')}`}>
                      {model.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{model.name}</h4>
                      <p className="text-sm text-gray-600">{model.specialty}</p>
                    </div>
                  </div>

                  {shouldShow && (
                    <div className="animate-fadeIn">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl font-bold text-gray-900">{analysis.score}/100</span>
                        <div className={`flex items-center space-x-1 ${getStatusColor(analysis.status)}`}>
                          {getStatusIcon(analysis.status)}
                          <span className="text-sm font-medium capitalize">{analysis.status}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{analysis.reason}</p>
                      
                      {/* Score Bar */}
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-1000 ${
                            analysis.score >= 70 ? 'bg-green-500' :
                            analysis.score >= 30 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${analysis.score}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isActive && (
                    <div className="mt-4 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Final Decision */}
          {showResults && (
            <div className="bg-gray-50 rounded-xl p-6 text-center animate-fadeIn mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Final Decision</h3>
              <div className={`inline-flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold ${
                getFinalDecision().color === 'green' ? 'bg-green-100 text-green-800' :
                getFinalDecision().color === 'orange' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {getFinalDecision().color === 'green' ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <span>{getFinalDecision().text}</span>
              </div>
              <p className="text-gray-600 mt-4">
                Based on consensus analysis from all four specialized models
              </p>
            </div>
          )}

          {/* Audit Trail for Employee Tab */}
          {showAuditTrail && activeTab === 'employee' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 animate-fadeIn">
              <div className="flex items-center space-x-2 mb-4">
                <Database className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Audit Trail Generated</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Timestamp</span>
                  </div>
                  <span className="text-sm font-mono text-gray-900">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Employee ID</span>
                  </div>
                  <span className="text-sm font-mono text-gray-900">{currentQueries[selectedQuery].user}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Data Sources</span>
                  </div>
                  <div className="flex space-x-1">
                    {(isEmployeeQuery(currentQueries[selectedQuery]) ? currentQueries[selectedQuery].dataAccess : []).map((data, i) => (
                      <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {data}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Compliance Status</span>
                  </div>
                  <span className="text-sm font-semibold text-green-600">✓ Logged & Verified</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {activeTab === 'customer' ? 'Customer Protection' : 'Employee Governance'}
            </h3>
            <ul className="space-y-2 text-gray-600">
              {activeTab === 'customer' ? (
                <>
                  <li>• Block unauthorized access to sensitive data</li>
                  <li>• Prevent information leakage to external users</li>
                  <li>• Maintain security without blocking legitimate requests</li>
                  <li>• Log all interactions for security monitoring</li>
                </>
              ) : (
                <>
                  <li>• Verify employee identity and access permissions</li>
                  <li>• Track which data sources are accessed</li>
                  <li>• Maintain complete audit trails for compliance</li>
                  <li>• Enable safe AI-powered content generation</li>
                </>
              )}
            </ul>
          </div>
          
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-Time Performance</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• All models run in parallel for speed</li>
              <li>• Results combined in under 1 second</li>
              <li>• Automatic fallbacks if any model fails</li>
              <li>• Scales to handle thousands of requests</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MultiModelDemo;