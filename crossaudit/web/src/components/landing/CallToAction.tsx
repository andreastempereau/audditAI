import React from 'react';
import { ArrowRight, Calendar, Users, Zap } from 'lucide-react';

const CallToAction = () => {
  return (
    <section className="py-20 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Secure Your AI?
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Join forward-thinking companies building trustworthy AI systems
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <Calendar className="h-8 w-8 text-white mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Quick Setup</h3>
            <p className="text-gray-300 text-sm">Deploy in hours, not months</p>
          </div>
          <div className="text-center">
            <Users className="h-8 w-8 text-white mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Expert Support</h3>
            <p className="text-gray-300 text-sm">Dedicated success managers</p>
          </div>
          <div className="text-center">
            <Zap className="h-8 w-8 text-white mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Immediate ROI</h3>
            <p className="text-gray-300 text-sm">See results from day one</p>
          </div>
        </div>

        <div className="text-center">
          <div className="bg-white rounded-xl p-8 mb-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Start Your Free Trial
            </h3>
            <p className="text-gray-600 mb-6">
              Try CrossAudit with your AI system for 30 days, completely free
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center justify-center space-x-2">
                <span>Start Free Trial</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 transition-colors">
                Schedule Demo
              </button>
            </div>
          </div>

          <p className="text-gray-400 text-sm">
            Questions? Email us at <a href="mailto:hello@crossaudit.ai" className="text-white hover:underline">hello@crossaudit.ai</a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;