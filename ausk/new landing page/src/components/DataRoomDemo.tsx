import React, { useState, useEffect } from 'react';
import { Database, FileText, Search, Shield, Clock, Tag, Eye, Zap, Lock, GitBranch, ArrowRight, CheckCircle } from 'lucide-react';

const DataRoomDemo = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFragments, setShowFragments] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);

  const documents = [
    {
      id: 1,
      name: "Financial Report Q4 2024",
      type: "Financial",
      sensitivity: "High",
      chunks: 24,
      lastUpdated: "2024-01-15",
      status: "active",
      fragments: [
        { id: 1, text: "Q4 revenue increased by 23% to $4.2M...", relevance: 95, source: "Page 3, Section 2.1" },
        { id: 2, text: "Operating expenses were controlled at $1.8M...", relevance: 87, source: "Page 7, Section 3.2" },
        { id: 3, text: "Net profit margin improved to 18.5%...", relevance: 92, source: "Page 12, Section 4.1" }
      ]
    },
    {
      id: 2,
      name: "Customer Support Guidelines",
      type: "Policy",
      sensitivity: "Medium",
      chunks: 18,
      lastUpdated: "2024-01-10",
      status: "active",
      fragments: [
        { id: 4, text: "Always verify customer identity before sharing account details...", relevance: 98, source: "Section 1.3" },
        { id: 5, text: "Escalate billing disputes over $500 to management...", relevance: 85, source: "Section 2.7" },
        { id: 6, text: "Response time target is 24 hours for non-urgent issues...", relevance: 78, source: "Section 3.1" }
      ]
    },
    {
      id: 3,
      name: "Product Specifications",
      type: "Technical",
      sensitivity: "Medium",
      chunks: 31,
      lastUpdated: "2024-01-12",
      status: "active",
      fragments: [
        { id: 7, text: "API rate limits are set to 1000 requests per minute...", relevance: 89, source: "API Docs, Section 4" },
        { id: 8, text: "Database encryption uses AES-256 standard...", relevance: 94, source: "Security Specs, Page 2" },
        { id: 9, text: "System supports up to 10,000 concurrent users...", relevance: 82, source: "Performance Specs" }
      ]
    },
    {
      id: 4,
      name: "Employee Handbook (Deprecated)",
      type: "HR",
      sensitivity: "Low",
      chunks: 12,
      lastUpdated: "2023-08-15",
      status: "deprecated",
      fragments: []
    }
  ];

  const steps = [
    {
      title: "Document Upload",
      description: "Enterprise documents are uploaded to encrypted storage",
      icon: <FileText className="h-6 w-6" />
    },
    {
      title: "Chunking & Indexing",
      description: "Files are split into chunks and vector embeddings are created",
      icon: <Database className="h-6 w-6" />
    },
    {
      title: "Metadata Tagging",
      description: "Each chunk gets sensitivity levels, expiry dates, and provenance tags",
      icon: <Tag className="h-6 w-6" />
    },
    {
      title: "Semantic Search",
      description: "AI queries find only the most relevant fragments",
      icon: <Search className="h-6 w-6" />
    },
    {
      title: "Controlled Access",
      description: "Only relevant fragments are shared, never the full document",
      icon: <Shield className="h-6 w-6" />
    },
    {
      title: "Audit Trail",
      description: "Every access is logged with full provenance tracking",
      icon: <Eye className="h-6 w-6" />
    }
  ];

  const runDemo = () => {
    setIsAnimating(true);
    setActiveStep(0);
    setShowFragments(false);
    setShowProvenance(false);
    setSelectedDocument(null);

    // Animate through steps
    const stepInterval = setInterval(() => {
      setActiveStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(stepInterval);
          setIsAnimating(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    setShowFragments(true);
    setSelectedDocument(null);
    
    // Simulate search delay
    setTimeout(() => {
      setShowProvenance(true);
    }, 1000);
  };

  const getSensitivityColor = (sensitivity: string) => {
    switch (sensitivity) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'text-green-600' : 'text-gray-400';
  };

  return (
    <section id="data-room" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Welcome to The Data Room
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            A secure, version-controlled repository that gives AI models exactly the information they need—nothing more, nothing less. This ensures that your data is protected and never used by LLMs.
          </p>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            <strong>Data so secure, that even WE can't see it.</strong>
          </p>
          
          <button
            onClick={runDemo}
            disabled={isAnimating}
            className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 mb-12"
          >
            {isAnimating ? 'Running Demo...' : 'See How It Works'}
          </button>
        </div>

        {/* Process Flow */}
        <div className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border-2 transition-all duration-500 ${
                  index <= activeStep && isAnimating
                    ? 'border-gray-900 bg-gray-50 scale-105'
                    : index <= activeStep
                    ? 'border-gray-300 bg-white'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-lg mb-3 ${
                  index <= activeStep ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step.icon}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Interactive Demo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Document Repository */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Database className="h-6 w-6 text-gray-700" />
              <h3 className="text-xl font-bold text-gray-900">Document Repository</h3>
            </div>

            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocument(doc.id)}
                  className={`p-4 bg-white rounded-lg border cursor-pointer transition-all ${
                    selectedDocument === doc.id ? 'border-gray-900 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                  } ${doc.status === 'deprecated' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{doc.name}</h4>
                    <div className={`text-xs px-2 py-1 rounded-full border ${getSensitivityColor(doc.sensitivity)}`}>
                      {doc.sensitivity}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>{doc.chunks} chunks</span>
                      <span className={getStatusColor(doc.status)}>
                        {doc.status === 'active' ? '● Active' : '● Deprecated'}
                      </span>
                    </div>
                    <span>{doc.lastUpdated}</span>
                  </div>

                  {doc.status === 'deprecated' && (
                    <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                      ⚠️ Excluded from AI responses
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Security Features</span>
              </div>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Customer-managed encryption keys</li>
                <li>• Version control with Git-like branching</li>
                <li>• Automatic content expiry</li>
                <li>• Role-based access control</li>
              </ul>
            </div>
          </div>

          {/* Search & Retrieval */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Search className="h-6 w-6 text-gray-700" />
              <h3 className="text-xl font-bold text-gray-900">Semantic Search</h3>
            </div>

            <div className="mb-6">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask about company data..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                <button
                  onClick={handleSearch}
                  className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Search
                </button>
              </div>
            </div>

            {showFragments && (
              <div className="space-y-3 animate-fadeIn">
                <h4 className="font-medium text-gray-900 mb-3">Relevant Fragments Found:</h4>
                {documents
                  .filter(doc => doc.status === 'active')
                  .slice(0, 2)
                  .map(doc => 
                    doc.fragments.slice(0, 2).map(fragment => (
                      <div key={fragment.id} className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">{doc.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-green-600 font-medium">{fragment.relevance}% match</span>
                            <div className="w-12 bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-green-500 h-1 rounded-full"
                                style={{ width: `${fragment.relevance}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{fragment.text}</p>
                        <div className="text-xs text-gray-500">{fragment.source}</div>
                      </div>
                    ))
                  )}
              </div>
            )}

            {showProvenance && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 animate-fadeIn">
                <div className="flex items-center space-x-2 mb-3">
                  <GitBranch className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Provenance Tracking</span>
                </div>
                <div className="space-y-2 text-xs text-green-700">
                  <div className="flex justify-between">
                    <span>Fragments accessed:</span>
                    <span className="font-medium">4 from 2 documents</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Access timestamp:</span>
                    <span className="font-medium">{new Date().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Query hash:</span>
                    <span className="font-mono">a7f3d9e2...</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compliance status:</span>
                    <span className="font-medium text-green-600">✓ Logged</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Key Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-gray-50 rounded-xl">
            <div className="bg-white p-3 rounded-lg w-fit mx-auto mb-4">
              <Zap className="h-8 w-8 text-gray-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
            <p className="text-gray-600 text-sm">Vector search returns relevant fragments in milliseconds, not seconds</p>
          </div>

          <div className="text-center p-6 bg-gray-50 rounded-xl">
            <div className="bg-white p-3 rounded-lg w-fit mx-auto mb-4">
              <Shield className="h-8 w-8 text-gray-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Zero Exposure</h3>
            <p className="text-gray-600 text-sm">AI models never see full documents, only the fragments they need</p>
          </div>

          <div className="text-center p-6 bg-gray-50 rounded-xl">
            <div className="bg-white p-3 rounded-lg w-fit mx-auto mb-4">
              <Eye className="h-8 w-8 text-gray-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Full Traceability</h3>
            <p className="text-gray-600 text-sm">Track every answer back to its exact source paragraph</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DataRoomDemo;