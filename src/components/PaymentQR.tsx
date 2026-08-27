import React, { useState, useEffect } from 'react';
import { QrCode, Copy, Check, Loader2, Sparkles, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { PaymentCreationResponse } from '../types';
import { ApiService } from '../services/api';

interface PaymentQRProps {
  paymentData: PaymentCreationResponse;
  jobId: string;
  onPaymentVerified: () => void;
  onCancel: () => void;
}

export const PaymentQR: React.FC<PaymentQRProps> = ({
  paymentData,
  jobId,
  onPaymentVerified,
  onCancel
}) => {
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for payment status
  useEffect(() => {
    let interval: any;
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await ApiService.getPaymentStatus(paymentData.paymentId);
        if (res.verified || res.status === 'VERIFIED') {
          if (isMounted) {
            setIsChecking(false);
            onPaymentVerified();
          }
        }
      } catch (err) {
        // Soft polling errors are ignored during retry
      }
    };

    interval = setInterval(checkStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [paymentData.paymentId, onPaymentVerified]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(paymentData.merchantUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateDemoPayment = async () => {
    try {
      setIsSimulating(true);
      setError(null);
      await ApiService.simulateDemoPayment(paymentData.paymentId, jobId);
      onPaymentVerified();
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div id="payment-view-container" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm max-w-md mx-auto text-center">
      {/* Header */}
      <div className="mb-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
          Payment Required
        </span>
        <div className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          {paymentData.amountFormatted}
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Scan with GPay, PhonePe, Paytm or BHIM UPI
        </p>
      </div>

      {/* QR Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 mb-5 flex flex-col items-center justify-center relative">
        {paymentData.upiQrDataUrl ? (
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <img
              id="payment-upi-qr-image"
              src={paymentData.upiQrDataUrl}
              alt="UPI Payment QR Code"
              className="w-56 h-56 object-contain"
            />
          </div>
        ) : (
          <div className="w-56 h-56 bg-slate-200 flex items-center justify-center rounded-xl text-slate-400">
            <QrCode className="w-16 h-16" />
          </div>
        )}

        {/* UPI ID pill */}
        <div className="mt-4 flex items-center space-x-2 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs max-w-full">
          <span className="text-xs text-slate-400 font-medium">UPI ID:</span>
          <span className="text-xs font-mono font-bold text-slate-800 truncate">
            {paymentData.merchantUpiId}
          </span>
          <button
            id="copy-merchant-upi-btn"
            onClick={handleCopyUpi}
            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
            title="Copy UPI ID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Live Polling Status */}
      <div className="flex items-center justify-center space-x-2 text-xs text-slate-600 font-medium mb-6 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100">
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
        <span>Waiting for payment verification...</span>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Demo Mode Simulation Button */}
      {(paymentData.provider === 'DEMO' || true) && (
        <div className="mb-5 p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-2xl text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3 mr-1" />
              Developer / Demo Test
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Simulate Banking PSP</span>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Testing in local sandbox? Simulate an instant banking webhook verification:
          </p>
          <button
            id="simulate-payment-btn"
            type="button"
            disabled={isSimulating}
            onClick={handleSimulateDemoPayment}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center"
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Simulating Webhook...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1.5 stroke-[3]" />
                [ SIMULATE TEST PAYMENT ]
              </>
            )}
          </button>
        </div>
      )}

      {/* Cancel button */}
      <button
        id="cancel-payment-btn"
        type="button"
        onClick={onCancel}
        className="w-full py-3 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Cancel & Choose Different Option
      </button>
    </div>
  );
};
