import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { JobDetails, JobStatus } from '../types';
import { ApiService } from '../services/api';

interface JobStatusViewProps {
  jobId: string;
  onStartNewPrint: () => void;
}

export const JobStatusView: React.FC<JobStatusViewProps> = ({ jobId, onStartNewPrint }) => {
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await ApiService.getJob(jobId);
      setJobDetails(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh job status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll for status updates while job is active
    const interval = setInterval(() => {
      fetchStatus();
    }, 2500);

    return () => clearInterval(interval);
  }, [jobId]);

  if (loading && !jobDetails) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center max-w-md mx-auto shadow-sm">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-semibold text-slate-800">Fetching Job Status...</h3>
        <p className="text-xs text-slate-400 mt-1 font-mono">{jobId}</p>
      </div>
    );
  }

  if (error && !jobDetails) {
    return (
      <div className="bg-white border border-red-200 rounded-3xl p-8 text-center max-w-md mx-auto shadow-sm">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Job Lookup Issue</h3>
        <p className="text-xs text-red-600 mt-1 mb-6">{error}</p>
        <button
          onClick={onStartNewPrint}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold"
        >
          Start New Print
        </button>
      </div>
    );
  }

  const job = jobDetails!.job;
  const file = jobDetails!.file;
  const station = jobDetails!.station;
  const printer = jobDetails!.printer;

  const isCompleted = job.status === 'COMPLETED';
  const isFailed = job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'EXPIRED';
  const isPrinting = job.status === 'PRINTING';
  const isQueued = job.status === 'QUEUED';

  // State Machine Step Logic
  const steps = [
    {
      id: 'uploaded',
      label: 'Uploaded & Verified',
      done: true
    },
    {
      id: 'paid',
      label: job.printType === 'OFFICIAL' ? 'Official Approved' : 'Payment Verified',
      done: job.paymentVerified || job.status !== 'WAITING_PAYMENT'
    },
    {
      id: 'queued',
      label: 'Queued at Station',
      done: isQueued || isPrinting || isCompleted
    },
    {
      id: 'printing',
      label: 'Printing in Progress',
      active: isPrinting,
      done: isCompleted
    },
    {
      id: 'completed',
      label: 'Print Completed',
      done: isCompleted
    }
  ];

  return (
    <div id="job-status-view" className="max-w-md mx-auto space-y-4">
      {/* Top Banner Status */}
      <div
        className={`rounded-3xl p-6 sm:p-7 text-center border shadow-sm ${
          isCompleted
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : isFailed
            ? 'bg-red-50/70 border-red-200 text-red-950'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {isCompleted ? (
          <div>
            <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900 tracking-tight">
              ✓ PRINT COMPLETED
            </h2>
            <p className="text-xs text-emerald-700 mt-1 max-w-xs mx-auto">
              Your document has been sent to the printer tray. Collect your pages at{' '}
              <strong className="font-semibold">{station?.name || 'the printer'}</strong>.
            </p>
          </div>
        ) : isFailed ? (
          <div>
            <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-bold text-red-900 tracking-tight">
              ⚠ PRINT FAILED
            </h2>
            <p className="text-xs text-red-700 mt-1 max-w-xs mx-auto">
              {job.failReason || 'An error occurred during spooling. Please contact the administrator.'}
            </p>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-inner">
              <Printer className="w-8 h-8 animate-pulse text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {isPrinting ? '● Printing Document...' : 'Queued for Spooling'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isPrinting
                ? 'Print Gateway is actively delivering pages to the printer.'
                : 'Waiting for Print Gateway on Office PC to fetch and spool.'}
            </p>
          </div>
        )}
      </div>

      {/* Stepper Progress */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          Status Progress
        </h4>

        <div className="space-y-4">
          {steps.map((step, idx) => {
            return (
              <div key={step.id} className="flex items-center space-x-3.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    step.done
                      ? 'bg-emerald-600 text-white'
                      : step.active
                      ? 'bg-blue-600 text-white animate-pulse'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : step.active ? (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      step.done
                        ? 'text-slate-900'
                        : step.active
                        ? 'text-blue-600 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Document Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Job Summary
        </h4>

        <div className="flex items-center space-x-3 py-2 border-b border-slate-100">
          <div className="w-9 h-9 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{file?.name || 'Document'}</p>
            <p className="text-[11px] text-slate-400">
              {job.pageCount} {job.pageCount === 1 ? 'Page' : 'Pages'} •{' '}
              {job.printType.replace('_', ' ')}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-slate-900">
              {job.printType === 'OFFICIAL' ? 'FREE' : `₹${(job.totalAmount / 100).toFixed(2)}`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Station</span>
            <span className="text-slate-700 font-medium truncate block">
              {station?.name || 'Station 1'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Job ID</span>
            <span className="text-slate-600 font-mono text-[11px] truncate block">
              {job.id.slice(0, 12)}...
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-500 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700 font-semibold">Privacy Guaranteed:</strong> Uploaded
          files are stored in isolated private storage and automatically erased permanently within
          10 minutes after completion.
        </p>
      </div>

      {/* Actions */}
      <div className="pt-2">
        <button
          id="start-new-print-btn"
          onClick={onStartNewPrint}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Print Another Document
        </button>
      </div>
    </div>
  );
};
