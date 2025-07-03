import React from 'react';
import { ArrowRight, Database, Shield, Cpu, Eye, FileText, CheckCircle } from 'lucide-react';

const Architecture = () => {
  const steps = [
    {
      icon: <Eye className="h-6 w-6" />,
      title: "Intercept",
      description: "Catch every AI request"
    },
    {
      icon: <Database className="h-6 w-6" />,
      title: "Check Data",
      description: "Find relevant information"
    },
    {
      icon: <Cpu className="h-6 w-6" />,
      title: "Evaluate",
      description: "Multiple AI models verify safety"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Fix Issues",
      description: "Automatically correct problems"
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Log Everything",
      description: "Record for compliance"
    },
    {
      icon: <CheckCircle className="h-6 w-6" />,
      title: "Deliver Safe",
      description: "Send approved response"
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            How CrossAudit Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Six simple steps to make your AI safe and compliant
          </p>
        </div>

        <div className="relative">
          {/* Desktop Flow */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-between relative">
              {steps.map((step, index) => (
                <div key={index} className="flex flex-col items-center relative group">
                  <div className="w-16 h-16 rounded-full bg-gray-900 text-white flex items-center justify-center mb-4 transition-all duration-300">
                    {step.icon}
                  </div>
                  
                  <div className="text-center max-w-xs">
                    <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>

                  {index < steps.length - 1 && (
                    <ArrowRight className="absolute top-8 left-20 h-6 w-6 text-gray-400 z-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Flow */}
          <div className="lg:hidden">
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start space-x-4 bg-gray-50 rounded-xl p-6">
                  <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center flex-shrink-0">
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 bg-gray-50 rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">&lt;1s</div>
              <div className="text-lg font-medium text-gray-700 mb-1">Response Time</div>
              <div className="text-gray-600 text-sm">Lightning fast protection</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">99.9%</div>
              <div className="text-lg font-medium text-gray-700 mb-1">Uptime</div>
              <div className="text-gray-600 text-sm">Always available</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">100%</div>
              <div className="text-lg font-medium text-gray-700 mb-1">Coverage</div>
              <div className="text-gray-600 text-sm">Every response checked</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Architecture;