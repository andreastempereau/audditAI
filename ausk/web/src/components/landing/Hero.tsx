import React from 'react';
import { useRouter } from 'next/navigation';

const Hero = () => {
  const router = useRouter();

  const scrollToMultiModel = () => {
    const element = document.getElementById('multi-model');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleEnterApp = () => {
    router.push('/login');
  };

  return (
    <section className="pt-44 pb-16 bg-white relative overflow-hidden">
      {/* Background AUSK text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <div 
          className="text-[15rem] md:text-[25rem] font-black text-gray-300 opacity-30"
          style={{ letterSpacing: '0.3em' }}
        >
          AUSK
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            AI for Businesses and Enterprises
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Each response automatically captured, optimized with company data, and fully rewritten by our model. 
            All in a pure web interface, <span className="font-semibold text-gray-900">no code, no API required</span>. 
            Just a simple sign up to get started.
          </p>

          <div className="flex justify-center space-x-4">
            <button 
              onClick={scrollToMultiModel}
              className="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Watch Demo
            </button>
            <button 
              onClick={handleEnterApp}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Enter App
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;