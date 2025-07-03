import React from 'react';
import { Users, Scale, DollarSign, TrendingUp } from 'lucide-react';

const Benefits = () => {
  const benefits = [
    {
      icon: <Scale className="h-8 w-8 text-gray-700" />,
      title: "Compliance Teams",
      subtitle: "Stay ahead of regulations",
      points: [
        "EU AI Act ready",
        "Automatic policy checks",
        "Complete audit records",
        "Risk reports"
      ]
    },
    {
      icon: <DollarSign className="h-8 w-8 text-gray-700" />,
      title: "Finance Teams",
      subtitle: "Reduce costs and risks",
      points: [
        "Avoid regulatory fines",
        "Reduce legal exposure",
        "Predictable pricing",
        "Clear ROI"
      ]
    },
    {
      icon: <Users className="h-8 w-8 text-gray-700" />,
      title: "IT Teams",
      subtitle: "Easy to deploy and manage",
      points: [
        "Fast setup",
        "Works with existing systems",
        "Enterprise security",
        "24/7 support"
      ]
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Built for Every Team
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            CrossAudit delivers value across your entire organization
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 hover:shadow-lg transition-all duration-300 border border-gray-100"
            >
              <div className="flex items-center mb-6">
                <div className="bg-gray-50 p-3 rounded-lg mr-4">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.subtitle}</p>
                </div>
              </div>

              <ul className="space-y-3">
                {benefit.points.map((point, pointIndex) => (
                  <li key={pointIndex} className="flex items-start">
                    <div className="w-2 h-2 bg-gray-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 text-white text-center">
          <div className="flex justify-center mb-6">
            <TrendingUp className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-4">
            Turn Compliance into Competitive Advantage
          </h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            While others struggle with AI safety, you'll have it handled automatically
          </p>
          <button className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Start Your Free Trial
          </button>
        </div>
      </div>
    </section>
  );
};

export default Benefits;