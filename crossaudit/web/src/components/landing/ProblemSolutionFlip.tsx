import React, { useState } from 'react';
import { Shield, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';

const ProblemSolutionFlip = () => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Flip Container */}
          <div className="perspective-1000">
            <div 
              className={`relative w-full h-96 transition-transform duration-700 transform-style-preserve-3d ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Problem Side (Front) */}
              <div className="absolute inset-0 w-full h-full backface-hidden">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-12 h-full flex flex-col justify-center text-center">
                  <h2 className="text-4xl font-bold text-gray-900 mb-6">
                    The Problem with AI Today
                  </h2>
                  <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
                    AI can share sensitive data, make up facts, or violate company policies. 
                    Most companies only find out after it's too late.
                  </p>
                  
                  <div className="flex justify-center items-center space-x-4">
                    <button
                      onClick={handleFlip}
                      className="w-12 h-12 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors flex items-center justify-center"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Solution Side (Back) */}
              <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
                <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-lg p-12 h-full flex flex-col justify-center text-center">
                  <h2 className="text-4xl font-bold text-gray-900 mb-6">
                    So what do you do?
                  </h2>
                  <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-8">
                    We provide AI to companies and enterprises that intercepts and governs every large language model response in real time, retrieves only the necessary data from a secure Data Room, and produces the best tailored response with no data leak concern.
                  </p>
                  
                  <div className="flex justify-center items-center space-x-8 mb-8">
                    <div className="flex items-center space-x-2 text-gray-700">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Real-time Protection</span>
                    </div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="flex items-center space-x-2 text-gray-700">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Zero Data Leaks</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={handleFlip}
                      className="w-12 h-12 border border-gray-300 text-gray-700 rounded-full hover:border-gray-400 transition-colors flex items-center justify-center"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Flip Indicator */}
          <div className="text-center mt-8">
            <div className="inline-flex items-center space-x-2 text-gray-500 text-sm">
              <div className={`w-2 h-2 rounded-full transition-colors ${!isFlipped ? 'bg-gray-900' : 'bg-gray-300'}`}></div>
              <span>Problem</span>
              <div className="w-8 h-px bg-gray-300"></div>
              <span>Solution</span>
              <div className={`w-2 h-2 rounded-full transition-colors ${isFlipped ? 'bg-gray-900' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolutionFlip;