import React from 'react';
import { FileText, Palette, ShieldAlert, Check } from 'lucide-react';
import { PrintType } from '../types';

interface PrintOptionCardProps {
  type: PrintType;
  title: string;
  rateDescription: string;
  totalFormatted: string;
  calculationText: string;
  isSelected: boolean;
  onSelect: () => void;
  badgeText?: string;
  accentColor?: 'blue' | 'purple' | 'slate';
}

export const PrintOptionCard: React.FC<PrintOptionCardProps> = ({
  type,
  title,
  rateDescription,
  totalFormatted,
  calculationText,
  isSelected,
  onSelect,
  badgeText,
  accentColor = 'blue'
}) => {
  const getIcon = () => {
    switch (type) {
      case 'BLACK_WHITE':
        return <FileText className="w-6 h-6 text-slate-700" />;
      case 'COLOR':
        return <Palette className="w-6 h-6 text-purple-600" />;
      case 'OFFICIAL':
        return <ShieldAlert className="w-6 h-6 text-blue-600" />;
    }
  };

  const getBorderClasses = () => {
    if (isSelected) {
      if (type === 'COLOR') return 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-50/20';
      if (type === 'OFFICIAL') return 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/20';
      return 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/20';
    }
    return 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60';
  };

  return (
    <div
      id={`print-option-${type.toLowerCase()}`}
      onClick={onSelect}
      className={`border rounded-2xl p-4 sm:p-5 cursor-pointer transition-all duration-150 relative shadow-sm ${getBorderClasses()}`}
    >
      {badgeText && (
        <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
          {badgeText}
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/80">
            {getIcon()}
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 tracking-tight">{title}</h4>
            <p className="text-xs text-slate-500 font-medium">{rateDescription}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-slate-900 leading-tight">{totalFormatted}</div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{calculationText}</div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">
          {type === 'OFFICIAL' ? 'Employee verification required' : 'Direct UPI / QR unlock'}
        </span>
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${
            isSelected
              ? type === 'COLOR'
                ? 'bg-purple-600'
                : 'bg-blue-600'
              : 'border border-slate-300'
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
      </div>
    </div>
  );
};
