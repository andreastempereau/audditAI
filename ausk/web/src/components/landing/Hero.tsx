import React from 'react';

const Hero = () => {
  const scrollToMultiModel = () => {
    const element = document.getElementById('multi-model');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="pt-24 pb-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            AI For Businesses and Enterprises
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Each response automatically capturedl, optimized with company data, and fully rewritten by our model. 
            All in a pure web interface, no code, no API required. 
            Just a simple sign up to get started.
          </p>

          <div className="flex justify-center">
            <button 
              onClick={scrollToMultiModel}
              className="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Watch Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;