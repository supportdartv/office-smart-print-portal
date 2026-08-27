import React, { useState } from 'react';
import { ShieldCheck, X, AlertCircle, Loader2 } from 'lucide-react';

interface OfficialPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employeeId: string, section: string, purpose: string) => Promise<void>;
  pageCount: number;
}

export const OfficialPrintModal: React.FC<OfficialPrintModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  pageCount
}) => {
  const [employeeId, setEmployeeId] = useState('');
  const [section, setSection] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !section.trim() || !purpose.trim()) {
      setError('Please complete all required fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(employeeId, section, purpose);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm official print');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="official-print-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in duration-150">
        <button
          id="close-official-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">Official Document Print</h3>
            <p className="text-xs text-slate-500 font-normal">Internal company quota ({pageCount} Pages • Free)</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Employee ID <span className="text-red-500">*</span>
            </label>
            <input
              id="official-employee-id"
              type="text"
              required
              placeholder="e.g. EMP-4091"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department / Section <span className="text-red-500">*</span>
            </label>
            <input
              id="official-section"
              type="text"
              required
              placeholder="e.g. Operations / Finance"
              value={section}
              onChange={e => setSection(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Printing Purpose <span className="text-red-500">*</span>
            </label>
            <textarea
              id="official-purpose"
              required
              rows={2}
              placeholder="e.g. Quarterly audit report for client meeting"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              id="cancel-official-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-official-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'CONFIRM OFFICIAL PRINT'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
