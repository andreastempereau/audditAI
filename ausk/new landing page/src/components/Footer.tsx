import React from 'react';
import { Shield } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <Shield className="h-8 w-8 text-white" />
              <span className="text-2xl font-bold">CrossAudit</span>
            </div>
            <p className="text-gray-300 mb-6 max-w-md">
              The simple way to make your AI safe and compliant. 
              Automatic checking, fixing, and logging for every AI response.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <li><span className="text-gray-300">Multi-Model AI</span></li>
              <li><span className="text-gray-300">Micro-Functions</span></li>
              <li><span className="text-gray-300">Data Room</span></li>
              <li><span className="text-gray-300">Pipeline</span></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              <li><span className="text-gray-300">About</span></li>
              <li><span className="text-gray-300">Careers</span></li>
              <li><span className="text-gray-300">Contact</span></li>
              <li><span className="text-gray-300">Support</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2025 CrossAudit. All rights reserved.
            </p>
            <div className="flex space-x-6 text-sm">
              <span className="text-gray-400">Privacy Policy</span>
              <span className="text-gray-400">Terms of Service</span>
              <span className="text-gray-400">Security</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;