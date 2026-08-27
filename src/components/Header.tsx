import React from 'react';
import { Printer, ShieldCheck, Settings, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  onAdminClick: () => void;
  isAdminOpen: boolean;
  onReset?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onAdminClick,
  isAdminOpen,
  onReset,
  showBack
}) => {
  return (
    <header id="app-header" className="bg-slate-900 text-white sticky top-0 z-40 shadow-sm border-b border-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {showBack && (
            <button
              id="header-back-btn"
              onClick={onReset}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Start over"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div
            onClick={onReset}
            className="flex items-center space-x-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-inner">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                Office Smart Print
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-950 text-blue-300 border border-blue-800/60">
                  WLAN Bridge
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-normal leading-none">
                Upload. Pay. Print.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Private & Encrypted</span>
          </div>

          <button
            id="header-admin-toggle-btn"
            onClick={onAdminClick}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isAdminOpen
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{isAdminOpen ? 'User Portal' : 'Admin'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
