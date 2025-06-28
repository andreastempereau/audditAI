import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ProblemSolutionFlip from './components/ProblemSolutionFlip';
import MultiModelDemo from './components/MultiModelDemo';
import Features from './components/Features';
import DataRoomDemo from './components/DataRoomDemo';
import InteractiveTutorial from './components/InteractiveTutorial';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <ProblemSolutionFlip />
      <MultiModelDemo />
      <Features />
      <DataRoomDemo />
      <InteractiveTutorial />
      <Footer />
    </div>
  );
}

export default App;