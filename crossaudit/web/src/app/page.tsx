"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-supabase';
import MultiModelDemo from '@/components/landing/MultiModelDemo';
import Features from '@/components/landing/Features';
import DataRoomDemo from '@/components/landing/DataRoomDemo';
import InteractiveTutorial from '@/components/landing/InteractiveTutorial';

// Header Component
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const handleEnterApp = () => {
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Shield className="h-7 w-7 text-gray-900" />
            <span className="text-xl font-semibold text-gray-900">CrossAudit</span>
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
            <button 
              onClick={handleEnterApp}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Enter App
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
              <button 
                onClick={handleEnterApp}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Enter App
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

// Hero Component
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
    <section className="pt-24 pb-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            AI Safety Made
            <br />
            <span className="text-gray-600">Simple</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Automatically check every AI response before it reaches your users. 
            Stay compliant, reduce risk, and build trust.
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

export default function Page() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect authenticated users to app
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/app');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      
      {/* Actual demo components */}
      <div id="multi-model">
        <MultiModelDemo />
      </div>

      <div id="features">
        <Features />
      </div>

      <div id="data-room">
        <DataRoomDemo />
      </div>

      <div id="pipeline">
        <InteractiveTutorial />
      </div>
    </div>
  );
}
