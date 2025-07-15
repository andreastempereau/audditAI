import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Network, 
  Zap, 
  Brain, 
  Settings, 
  ArrowRight, 
  Play, 
  CheckCircle,
  Bot,
  Workflow,
  Target,
  TrendingUp
} from 'lucide-react';

const AgentOrchestrator = () => {
  const [isAnimating, setIsAnimating] = useState(false);

  const features = [
    {
      icon: <Workflow className="h-6 w-6" />,
      title: "Multi-agent task routing",
      description: "Intelligently routes tasks to the most suitable AI agents based on their specialized capabilities"
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Specialized model selection",
      description: "Automatically selects the optimal AI model for each specific task or domain requirement"
    },
    {
      icon: <Settings className="h-6 w-6" />,
      title: "Automated workflow coordination",
      description: "Seamlessly coordinates complex workflows across multiple AI agents without manual intervention"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Performance optimization",
      description: "Continuously optimizes agent performance and resource allocation for maximum efficiency"
    }
  ];

  const agents = [
    { name: "Document AI", type: "Specialist", status: "active", load: 75 },
    { name: "Code Review", type: "Technical", status: "active", load: 45 },
    { name: "Data Analysis", type: "Analytics", status: "active", load: 90 },
    { name: "Content Writer", type: "Creative", status: "idle", load: 10 },
    { name: "Security Audit", type: "Security", status: "active", load: 65 }
  ];

  const runDemo = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 5000);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.div 
            className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl mb-6"
            variants={itemVariants}
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Network className="h-12 w-12 text-white" />
          </motion.div>
          
          <motion.h2 
            className="text-5xl font-bold text-gray-900 mb-4"
            variants={itemVariants}
          >
            Agent-of-Agents Orchestrator
          </motion.h2>
          
          <motion.p 
            className="text-2xl text-gray-600 mb-6 font-medium"
            variants={itemVariants}
          >
            Intelligent multi-agent coordination
          </motion.p>
          
          <motion.p 
            className="text-xl text-gray-600 max-w-4xl mx-auto mb-8 leading-relaxed"
            variants={itemVariants}
          >
            Advanced orchestration system that coordinates multiple AI agents, automatically routing tasks to specialized models for optimal results.
          </motion.p>

          <motion.button
            onClick={runDemo}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-300 inline-flex items-center space-x-2 shadow-lg hover:shadow-xl"
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isAnimating}
          >
            <Play className="h-5 w-5" />
            <span>{isAnimating ? 'Orchestrating...' : 'See Orchestration in Action'}</span>
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Features Grid */}
          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-8">Core Capabilities</h3>
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="flex items-start space-x-4 p-6 bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-lg transition-all duration-300"
                variants={itemVariants}
                whileHover={{ x: 5 }}
              >
                <div className="flex-shrink-0 p-3 bg-green-50 text-green-600 rounded-lg">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Agent Dashboard Demo */}
          <motion.div
            className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Agent Dashboard</h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Live Orchestration</span>
              </div>
            </div>

            <div className="space-y-4">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent.name}
                  className={`p-4 rounded-lg border transition-all duration-300 ${
                    isAnimating && index % 2 === 0 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <Bot className="h-5 w-5 text-gray-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">{agent.name}</h4>
                        <p className="text-sm text-gray-500">{agent.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        agent.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {agent.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Load:</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <motion.div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          agent.load > 80 ? 'bg-red-500' : 
                          agent.load > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${agent.load}%` }}
                        transition={{ delay: index * 0.2, duration: 1 }}
                        viewport={{ once: true }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{agent.load}%</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {isAnimating && (
              <motion.div
                className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Orchestration Active</span>
                </div>
                <p className="text-sm text-green-700">
                  Routing new document analysis task to Document AI agent...
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Benefits Section */}
        <motion.div
          className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-12 text-white text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h3 className="text-3xl font-bold mb-6">
            Why Agent Orchestration Matters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-white/20 p-4 rounded-full w-fit mx-auto mb-4">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-2">Intelligent Routing</h4>
              <p className="text-green-100">
                Each task goes to the AI agent best equipped to handle it, maximizing quality and efficiency.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 p-4 rounded-full w-fit mx-auto mb-4">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-2">Faster Results</h4>
              <p className="text-green-100">
                Parallel processing and optimized task distribution reduce response times by up to 70%.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 p-4 rounded-full w-fit mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-2">Better Outcomes</h4>
              <p className="text-green-100">
                Specialized agents deliver higher quality results than generalist AI models.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AgentOrchestrator;