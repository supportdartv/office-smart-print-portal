import React from 'react';
import { Shield, Clock, WifiOff } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer id="app-footer" className="mt-auto border-t border-slate-200 bg-white/80 py-6 text-xs text-slate-500">
      <div className="max-w-4xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left mb-4">
          <div className="flex items-center justify-center sm:justify-start space-x-2">
            <WifiOff className="w-4 h-4 text-blue-600 shrink-0" />
            <span>No Office Wi-Fi Required</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start space-x-2">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero Public Exposure of Printer</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start space-x-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Auto-Deleted 10m After Print</span>
          </div>
        </div>
        <div className="text-center pt-3 border-t border-slate-100 text-slate-400">
          <p>© {new Date().getFullYear()} Office Smart Print Portal • Cloud to WLAN Gateway Engine</p>
        </div>
      </div>
    </footer>
  );
};
