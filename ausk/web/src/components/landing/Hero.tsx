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
            No-Code Generative AI
            <br />
            <span className="text-gray-600">For Businesses and Enterprises</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Automatically check every AI response before it reaches your users. 
            Stay compliant, reduce risk, and build trust.
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