import React from 'react';
import { RefreshCw } from 'lucide-react';

const Features = () => {
  const aiCompanies = [
    {
      name: "OpenAI",
      color: "bg-green-100 text-green-700"
    },
    {
      name: "Anthropic", 
      color: "bg-purple-100 text-purple-700"
    },
    {
      name: "Google",
      color: "bg-blue-100 text-blue-700"
    },
    {
      name: "Meta",
      color: "bg-red-100 text-red-700"
    }
  ];

  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Different Micro-Functions, Leveraged by the Best AI Models
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built on top of industry-leading AI models, constantly verified and upgraded
          </p>
        </div>

        {/* AI Companies Logo Slider */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Powered by Leading AI Models
          </h3>
          
          {/* Horizontal Scrolling Logos */}
          <div className="relative overflow-hidden mb-8">
            <div className="flex items-center space-x-12">
              {/* First set of logos */}
              {aiCompanies.map((company, index) => (
                <div
                  key={`first-${index}`}
                  className="flex-shrink-0 group hover:scale-110 transition-transform duration-300"
                >
                  <div className={`w-32 h-16 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors flex items-center justify-center ${company.color}`}>
                    <span className="font-semibold text-sm">{company.name}</span>
                  </div>
                </div>
              ))}
              {/* Duplicate set for seamless loop */}
              {aiCompanies.map((company, index) => (
                <div
                  key={`second-${index}`}
                  className="flex-shrink-0 group hover:scale-110 transition-transform duration-300"
                >
                  <div className={`w-32 h-16 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors flex items-center justify-center ${company.color}`}>
                    <span className="font-semibold text-sm">{company.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-full">
              <RefreshCw className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-700">Continuously updated with latest model versions</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;