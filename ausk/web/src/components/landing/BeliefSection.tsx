import React from 'react';
import { ChevronDown } from 'lucide-react';

const BeliefSection = () => {
  const scrollToHero = () => {
    const element = document.querySelector('.hero-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-white relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 leading-tight max-w-5xl mx-auto">
          We believe businesses deserve generative-AI, without the risk of exposing company data
        </h1>
      </div>
      
      <div className="absolute bottom-20 flex flex-col items-center">
        <p className="text-lg text-gray-600 mb-4 font-medium">Introducing Ausk</p>
        <button 
          onClick={scrollToHero}
          className="animate-bounce"
          aria-label="Scroll down"
        >
          <ChevronDown className="h-8 w-8 text-gray-600" />
        </button>
      </div>
    </section>
  );
};

export default BeliefSection;