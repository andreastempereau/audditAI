import React from 'react';
import { RefreshCw } from 'lucide-react';

const Features = () => {
  const aiCompanies = [
    {
      name: "OpenAI",
      logo: (
        <svg className="h-8 w-auto opacity-60" viewBox="0 0 320 320" fill="currentColor">
          <path d="M297.82 159.98c0-82.84-67.16-150-150-150s-150 67.16-150 150 67.16 150 150 150 150-67.16 150-150zm-150 120c-66.27 0-120-53.73-120-120s53.73-120 120-120 120 53.73 120 120-53.73 120-120 120z"/>
          <circle cx="147.82" cy="159.98" r="30"/>
        </svg>
      )
    },
    {
      name: "Anthropic",
      logo: (
        <svg className="h-8 w-auto opacity-60" viewBox="0 0 100 100" fill="currentColor">
          <path d="M20 80h60l-30-60-30 60zm30-50l20 40H30l20-40z"/>
        </svg>
      )
    },
    {
      name: "Google",
      logo: (
        <svg className="h-8 w-auto opacity-60" viewBox="0 0 272 92" fill="currentColor">
          <path d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
          <path d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
          <path d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"/>
          <path d="M225 3v65h-9.5V3h9.5z"/>
          <path d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"/>
          <path d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"/>
        </svg>
      )
    },
    {
      name: "Meta",
      logo: (
        <svg className="h-8 w-auto opacity-60" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 10C27.91 10 10 27.91 10 50s17.91 40 40 40 40-17.91 40-40S72.09 10 50 10zm0 72c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32z"/>
          <path d="M38 35h12v6H38v-6zm12 8H38v12h12V43z"/>
        </svg>
      )
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
            <div className="flex items-center space-x-16 animate-scroll">
              {/* First set of logos */}
              {aiCompanies.map((company, index) => (
                <div
                  key={`first-${index}`}
                  className="flex-shrink-0 group hover:scale-110 transition-transform duration-300"
                >
                  <div className="w-40 h-20 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors flex flex-col items-center justify-center bg-white shadow-sm group-hover:shadow-md">
                    <div className="text-gray-600 group-hover:text-gray-800 transition-colors">
                      {company.logo}
                    </div>
                    <span className="text-xs text-gray-500 mt-1 font-medium">{company.name}</span>
                  </div>
                </div>
              ))}
              {/* Duplicate set for seamless loop */}
              {aiCompanies.map((company, index) => (
                <div
                  key={`second-${index}`}
                  className="flex-shrink-0 group hover:scale-110 transition-transform duration-300"
                >
                  <div className="w-40 h-20 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors flex flex-col items-center justify-center bg-white shadow-sm group-hover:shadow-md">
                    <div className="text-gray-600 group-hover:text-gray-800 transition-colors">
                      {company.logo}
                    </div>
                    <span className="text-xs text-gray-500 mt-1 font-medium">{company.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <style jsx>{`
            @keyframes scroll {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
            
            .animate-scroll {
              animation: scroll 20s linear infinite;
            }
            
            .animate-scroll:hover {
              animation-play-state: paused;
            }
          `}</style>
          
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