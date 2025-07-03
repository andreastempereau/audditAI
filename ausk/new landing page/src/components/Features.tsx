import React from 'react';
import { RefreshCw } from 'lucide-react';

const Features = () => {
  const aiCompanies = [
    {
      name: "OpenAI",
      logo: "/src/assets/logos/openai.png"
    },
    {
      name: "Anthropic",
      logo: "/src/assets/logos/anthropic.png"
    },
    {
      name: "Google",
      logo: "/src/assets/logos/google.png"
    },
    {
      name: "Meta",
      logo: "/src/assets/logos/meta.png"
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
            <div className="flex animate-scroll items-center space-x-12">
              {/* First set of logos */}
              {aiCompanies.map((company, index) => (
                <div
                  key={`first-${index}`}
                  className="flex-shrink-0 group hover:scale-110 transition-transform duration-300"
                >
                  <div className="w-32 h-16 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors flex items-center justify-center overflow-hidden">
                    <img 
                      src={company.logo} 
                      alt={`${company.name} logo`}
                      className="w-full h-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                      onError={(e) => {
                        // Fallback to a placeholder if logo doesn't exist
                        const target = e.target as HTMLImageElement;
                        target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="%23f3f4f6"/><text x="60" y="35" text-anchor="middle" font-family="Arial" font-size="12" fill="%236b7280">${company.name}</text></svg>`;
                      }}
                    />
                  </div>
                </div>
              ))}
              {/* Duplicate set for seamless loop */}
              {aiCompanies.map((company, index) => (
                <div
                  key={`second-${index}`}
                  className="flex-shrink-0 group hover:scale-110 transition-transform duration-300"
                >
                  <div className="w-32 h-16 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors flex items-center justify-center overflow-hidden">
                    <img 
                      src={company.logo} 
                      alt={`${company.name} logo`}
                      className="w-full h-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                      onError={(e) => {
                        // Fallback to a placeholder if logo doesn't exist
                        const target = e.target as HTMLImageElement;
                        target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="%23f3f4f6"/><text x="60" y="35" text-anchor="middle" font-family="Arial" font-size="12" fill="%236b7280">${company.name}</text></svg>`;
                      }}
                    />
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