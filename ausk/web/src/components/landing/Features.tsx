import React from 'react';
import { RefreshCw } from 'lucide-react';

const Features = () => {
  const aiCompanies = [
    {
      name: "OpenAI",
      logo: (
        <svg className="h-8 w-auto opacity-60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4954zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zm-2.4107-16.0259a4.4755 4.4755 0 0 1 2.3478-1.9739L5.3392 7.4629a.7855.7855 0 0 0 .3976.6765l5.8428 3.3734-2.02 1.1686a.0804.0804 0 0 1-.071 0L4.718 10.1838a4.4992 4.4992 0 0 1-.0308-6.1398zm16.5963 3.8558L18.2915 5.716a.0756.0756 0 0 1-.0284-.0615V.0295a.0804.0804 0 0 1 .0332-.0615l4.7735-2.7534a4.4992 4.4992 0 0 1 6.1408 1.6464 4.4708 4.4708 0 0 1 .5346 3.0137l-.142-.0852-4.783-2.7582a.7712.7712 0 0 0-.7806 0l-5.8428 3.3685z"/>
        </svg>
      )
    },
    {
      name: "Anthropic",
      logo: (
        <svg className="h-8 w-auto opacity-60" viewBox="0 0 200 200" fill="currentColor">
          <path d="M60 40h20l60 120h-20l-12-24h-76l-12 24h-20L60 40zm10 20l-26 52h52l-26-52z"/>
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
        <svg className="h-8 w-auto opacity-60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
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