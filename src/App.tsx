import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer,
  FileText,
  Upload,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StationHeader } from './components/StationHeader';
import { FileUploader } from './components/FileUploader';
import { PrintOptionCard } from './components/PrintOptionCard';
import { OfficialPrintModal } from './components/OfficialPrintModal';
import { PaymentQR } from './components/PaymentQR';
import { JobStatusView } from './components/JobStatusView';
import { AdminPortal } from './components/AdminPortal';
import { PrintableQrCard } from './components/PrintableQrCard';
import { ApiService } from './services/api';
import {
  StationInfo,
  PrinterInfo,
  UploadSuccessData,
  PaymentCreationResponse,
  PrintType
} from './types';

export function App() {
  // Session & station state
  const [sessionId, setSessionId] = useState<string>('');
  const [stationId, setStationId] = useState<string>('office-printer-01');
  const [stationData, setStationData] = useState<{
    station: StationInfo;
    printer: PrinterInfo | null;
    pricing: any;
  } | null>(null);

  // App view step: 'UPLOAD' | 'OPTIONS' | 'PAYMENT' | 'STATUS'
  const [viewStep, setViewStep] = useState<'UPLOAD' | 'OPTIONS' | 'PAYMENT' | 'STATUS'>('UPLOAD');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Uploaded state
  const [uploadedData, setUploadedData] = useState<UploadSuccessData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Option selection
  const [selectedPrintType, setSelectedPrintType] = useState<PrintType>('BLACK_WHITE');
  const [isOfficialModalOpen, setIsOfficialModalOpen] = useState(false);
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);

  // Payment state
  const [paymentData, setPaymentData] = useState<PaymentCreationResponse | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  // Active Job ID for status
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Initialize session and read station from URL if present
  useEffect(() => {
    // 1. Check path for /station/:id or /status/:id
    const path = window.location.pathname;
    const stationMatch = path.match(/\/station\/([^/]+)/);
    const statusMatch = path.match(/\/status\/([^/]+)/);

    let initialStation = 'office-printer-01';
    if (stationMatch && stationMatch[1]) {
      initialStation = stationMatch[1];
      setStationId(initialStation);
    }

    if (statusMatch && statusMatch[1]) {
      setActiveJobId(statusMatch[1]);
      setViewStep('STATUS');
    }

    // 2. Initialize Session
    ApiService.createSession()
      .then(res => {
        setSessionId(res.sessionId);
      })
      .catch(err => console.error('Session init error:', err));

    // 3. Load Station Info
    ApiService.getStation(initialStation)
      .then(data => {
        setStationData(data);
      })
      .catch(err => console.error('Station load error:', err));
  }, []);

  // Handle File Selection & Upload
  const handleFileSelected = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      const result = await ApiService.uploadDocument(
        file,
        sessionId,
        stationId,
        progress => {
          setUploadProgress(progress);
        }
      );

      setUploadedData(result);
      setActiveJobId(result.jobId);
      setViewStep('OPTIONS');
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle Option Selection and Next Step
  const handleProceedToPayment = async () => {
    if (!uploadedData || !activeJobId) return;

    if (selectedPrintType === 'OFFICIAL') {
      setIsOfficialModalOpen(true);
      return;
    }

    setIsSubmittingOption(true);
    try {
      // 1. Update job print type on server
      await ApiService.selectPrintType(activeJobId, selectedPrintType, 1);

      // 2. Request fixed UPI Payment
      setIsCreatingPayment(true);
      const paymentRes = await ApiService.createPayment(activeJobId);
      setPaymentData(paymentRes);
      setViewStep('PAYMENT');
    } catch (err: any) {
      alert(err.message || 'Failed to initialize payment.');
    } finally {
      setIsSubmittingOption(false);
      setIsCreatingPayment(false);
    }
  };

  // Handle Official Form Submission
  const handleConfirmOfficial = async (employeeId: string, section: string, purpose: string) => {
    if (!activeJobId) return;
    await ApiService.confirmOfficialPrint(activeJobId, employeeId, section, purpose);
    setIsOfficialModalOpen(false);
    setViewStep('STATUS');
  };

  // Handle Successful Payment
  const handlePaymentVerified = () => {
    setViewStep('STATUS');
  };

  // Reset to Start
  const handleReset = () => {
    setViewStep('UPLOAD');
    setUploadedData(null);
    setPaymentData(null);
    setActiveJobId(null);
    setUploadError(null);
    setSelectedPrintType('BLACK_WHITE');
  };

  return (
    <div id="app-root" className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        onAdminClick={() => setIsAdminOpen(!isAdminOpen)}
        isAdminOpen={isAdminOpen}
        onReset={handleReset}
        showBack={viewStep !== 'UPLOAD' && !isAdminOpen}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8">
        {isAdminOpen ? (
          <AdminPortal onClose={() => setIsAdminOpen(false)} />
        ) : (
          <div className="w-full">
            {/* Station Header */}
            <StationHeader
              station={stationData?.station || null}
              printer={stationData?.printer || null}
            />

            {/* PC Operator Quick Bar */}
            <div className="mb-6 p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>PC Station Console:</span>
                <span className="font-mono text-slate-500">{stationData?.station?.stationCode || stationId}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-all flex items-center shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Print QR Standee
                </button>
                <button
                  onClick={() => setIsAdminOpen(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
                  Live Print Queue & Admin
                </button>
              </div>
            </div>

            {/* STEP 1: WELCOME & FILE UPLOAD */}
            {viewStep === 'UPLOAD' && (
              <motion.div
                key="step-upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Intro Card */}
                <div className="bg-gradient-to-b from-blue-600 to-blue-700 text-white rounded-3xl p-6 sm:p-8 shadow-sm">
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Instant Office Remote Print</span>
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Upload & Print Your Document
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-100 mt-2 max-w-lg leading-relaxed">
                    Upload files directly from your mobile phone or laptop. No office Wi-Fi connection
                    required — documents are securely dispatched to the office printer.
                  </p>
                </div>

                {/* Upload Component */}
                <FileUploader
                  onFileSelected={handleFileSelected}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                  errorMessage={uploadError}
                  onClearError={() => setUploadError(null)}
                />
              </motion.div>
            )}

            {/* STEP 2: PRINT OPTIONS & CALCULATION */}
            {viewStep === 'OPTIONS' && uploadedData && (
              <motion.div
                key="step-options"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="max-w-md mx-auto space-y-5"
              >
                {/* Document Ready Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                    ✓ Document Ready
                  </span>
                  <div className="flex items-center space-x-3 mt-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {uploadedData.file.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {(uploadedData.file.size / 1024).toFixed(0)} KB •{' '}
                        <strong className="text-blue-600 font-bold">{uploadedData.file.pageCount} Pages</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Options List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                    Select Print Mode
                  </h3>

                  {/* Black & White */}
                  <PrintOptionCard
                    type="BLACK_WHITE"
                    title="BLACK & WHITE"
                    rateDescription={`₹${(uploadedData.pricingPreview.blackWhite.pricePerPagePaise / 100).toFixed(2)} per page`}
                    totalFormatted={uploadedData.pricingPreview.blackWhite.formatted}
                    calculationText={`${uploadedData.file.pageCount} × ₹${(uploadedData.pricingPreview.blackWhite.pricePerPagePaise / 100).toFixed(2)}`}
                    isSelected={selectedPrintType === 'BLACK_WHITE'}
                    onSelect={() => setSelectedPrintType('BLACK_WHITE')}
                    badgeText="Standard"
                  />

                  {/* Colour */}
                  <PrintOptionCard
                    type="COLOR"
                    title="COLOUR"
                    rateDescription={`₹${(uploadedData.pricingPreview.color.pricePerPagePaise / 100).toFixed(2)} per page`}
                    totalFormatted={uploadedData.pricingPreview.color.formatted}
                    calculationText={`${uploadedData.file.pageCount} × ₹${(uploadedData.pricingPreview.color.pricePerPagePaise / 100).toFixed(2)}`}
                    isSelected={selectedPrintType === 'COLOR'}
                    onSelect={() => setSelectedPrintType('COLOR')}
                  />

                  {/* Official Document */}
                  <PrintOptionCard
                    type="OFFICIAL"
                    title="OFFICIAL DOCUMENT"
                    rateDescription="Internal company quota (Audit Logged)"
                    totalFormatted="FREE"
                    calculationText="0 paise"
                    isSelected={selectedPrintType === 'OFFICIAL'}
                    onSelect={() => setSelectedPrintType('OFFICIAL')}
                    badgeText="Work"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    id="continue-print-btn"
                    type="button"
                    disabled={isSubmittingOption || isCreatingPayment}
                    onClick={handleProceedToPayment}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-2"
                  >
                    <span>
                      {selectedPrintType === 'OFFICIAL'
                        ? 'CONFIRM OFFICIAL PRINT'
                        : selectedPrintType === 'COLOR'
                        ? `PRINT IN COLOUR • ${uploadedData.pricingPreview.color.formatted}`
                        : `PRINT BLACK & WHITE • ${uploadedData.pricingPreview.blackWhite.formatted}`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: PAYMENT REQUIRED */}
            {viewStep === 'PAYMENT' && paymentData && activeJobId && (
              <motion.div
                key="step-payment"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <PaymentQR
                  paymentData={paymentData}
                  jobId={activeJobId}
                  onPaymentVerified={handlePaymentVerified}
                  onCancel={() => setViewStep('OPTIONS')}
                />
              </motion.div>
            )}

            {/* STEP 4: JOB STATUS TRACKER */}
            {viewStep === 'STATUS' && activeJobId && (
              <motion.div
                key="step-status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <JobStatusView
                  jobId={activeJobId}
                  onStartNewPrint={handleReset}
                />
              </motion.div>
            )}

            {/* Official Print Modal */}
            <OfficialPrintModal
              isOpen={isOfficialModalOpen}
              onClose={() => setIsOfficialModalOpen(false)}
              onSubmit={handleConfirmOfficial}
              pageCount={uploadedData?.file.pageCount || 1}
            />

            {/* Printable Station QR Standee Modal */}
            {isQrModalOpen && (
              <PrintableQrCard
                stationCode={stationData?.station?.stationCode || stationId}
                stationName={stationData?.station?.name || 'Office Print Station'}
                stationLocation={stationData?.station?.locationDesc || 'Office Desk & Workstation'}
                stationUrl={stationData?.station?.stationUrl || `${window.location.origin}/station/${stationId}`}
                onClose={() => setIsQrModalOpen(false)}
              />
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
