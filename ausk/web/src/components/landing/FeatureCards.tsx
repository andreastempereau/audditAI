import React from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Zap, 
  Sparkles, 
  Network,
  FileText,
  Clock,
  Users,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

const FeatureCards = () => {
  const features = [
    {
      title: "Secure Data Room",
      subtitle: "Enterprise-grade document security",
      description: "Version-controlled repository that fragments company data into untrackable vectors, ensuring AI models access only necessary information.",
      bulletPoints: [
        "Customer-managed encryption keys",
        "Automatic content expiry", 
        "Complete audit trails",
        "Zero data exposure to LLMs"
      ],
      icon: <Shield className="h-8 w-8" />,
      gradient: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600"
    },
    {
      title: "Real-time Policy Engine",
      subtitle: "Instant compliance monitoring",
      description: "AI governance that intercepts every response in real-time, applying company policies and regulatory requirements automatically.",
      bulletPoints: [
        "EU AI Act compliance",
        "Custom policy enforcement",
        "Real-time intervention",
        "Automated risk assessment"
      ],
      icon: <Zap className="h-8 w-8" />,
      gradient: "from-yellow-500 to-orange-500", 
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-600"
    },
    {
      title: "Prompt Vault",
      subtitle: "Pre-loaded industry templates",
      description: "Curated collection of admin-created, industry-specific prompt templates with variable substitution and usage analytics.",
      bulletPoints: [
        "Industry-specific templates",
        "Variable substitution",
        "Usage tracking & analytics",
        "Team collaboration features"
      ],
      icon: <Sparkles className="h-8 w-8" />,
      gradient: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50", 
      iconColor: "text-purple-600"
    },
    {
      title: "Agent-of-Agents Orchestrator",
      subtitle: "Intelligent multi-agent coordination",
      description: "Advanced orchestration system that coordinates multiple AI agents, automatically routing tasks to specialized models for optimal results.",
      bulletPoints: [
        "Multi-agent task routing",
        "Specialized model selection", 
        "Automated workflow coordination",
        "Performance optimization"
      ],
      icon: <Network className="h-8 w-8" />,
      gradient: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
      iconColor: "text-green-600"
    }
  ];

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.15,
        duration: 0.6,
        ease: "easeOut"
      }
    })
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        delay: 0.3,
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Complete AI Governance Platform
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Four integrated capabilities that work together to ensure your AI is secure, compliant, and optimized for your business needs.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group relative bg-white rounded-2xl border border-gray-100 hover:border-gray-200 p-8 hover:shadow-xl transition-all duration-300"
              variants={cardVariants}
              custom={index}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <div className="relative z-10">
                {/* Icon */}
                <motion.div 
                  className={`${feature.bgColor} ${feature.iconColor} p-4 rounded-xl w-fit mb-6`}
                  variants={iconVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  {feature.icon}
                </motion.div>

                {/* Title and Subtitle */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-gray-800 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-lg text-gray-600 mb-4 font-medium">
                  {feature.subtitle}
                </p>

                {/* Description */}
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {feature.description}
                </p>

                {/* Bullet Points */}
                <ul className="space-y-3 mb-6">
                  {feature.bulletPoints.map((point, pointIndex) => (
                    <motion.li 
                      key={pointIndex}
                      className="flex items-start space-x-3"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + pointIndex * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{point}</span>
                    </motion.li>
                  ))}
                </ul>

                {/* Learn More Link */}
                <motion.div 
                  className="flex items-center text-gray-600 group-hover:text-gray-800 transition-colors cursor-pointer"
                  whileHover={{ x: 5 }}
                >
                  <span className="text-sm font-medium mr-2">Learn more</span>
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div 
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="bg-gray-50 rounded-2xl p-8 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              See All Features in Action
            </h3>
            <p className="text-gray-600 mb-6">
              Experience how these four capabilities work together to create a comprehensive AI governance solution.
            </p>
            <motion.button 
              className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Schedule Live Demo</span>
              <ArrowRight className="h-5 w-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeatureCards;