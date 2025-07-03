import React, { useState } from 'react';
import { Shield, Menu, X } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false); // Close mobile menu after clicking
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Shield className="h-7 w-7 text-gray-900" />
            <span className="text-xl font-semibold text-gray-900">Ausk</span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => scrollToSection('multi-model')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Multi-Model AI
            </button>
            <button 
              onClick={() => scrollToSection('features')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Micro-Functions
            </button>
            <button 
              onClick={() => scrollToSection('data-room')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Data Room
            </button>
            <button 
              onClick={() => scrollToSection('pipeline')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Pipeline
            </button>
            <button 
              onClick={() => scrollToSection('multi-model')}
              className="bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Watch Demo
            </button>
          </nav>

          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <nav className="flex flex-col space-y-4">
              <button 
                onClick={() => scrollToSection('multi-model')}
                className="text-gray-600 hover:text-gray-900 transition-colors text-left"
              >
                Multi-Model AI
              </button>
              <button 
                onClick={() => scrollToSection('features')}
                className="text-gray-600 hover:text-gray-900 transition-colors text-left"
              >
                Micro-Functions
              </button>
              <button 
                onClick={() => scrollToSection('data-room')}
                className="text-gray-600 hover:text-gray-900 transition-colors text-left"
              >
                Data Room
              </button>
              <button 
                onClick={() => scrollToSection('pipeline')}
                className="text-gray-600 hover:text-gray-900 transition-colors text-left"
              >
                Pipeline
              </button>
              <button 
                onClick={() => scrollToSection('multi-model')}
                className="bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Watch Demo
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;