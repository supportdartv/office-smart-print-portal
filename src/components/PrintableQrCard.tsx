import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  WifiOff,
  Download,
  Printer as PrintIcon,
  ShieldCheck,
  X,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Info
} from 'lucide-react';
import { downloadGatewayPackage } from '../utils/gatewayZip';

interface PrintableQrCardProps {
  stationCode: string;
  stationName: string;
  locationDesc?: string;
  stationLocation?: string;
  stationUrl?: string;
  onClose?: () => void;
}

export const PrintableQrCard: React.FC<PrintableQrCardProps> = ({
  stationCode,
  stationName,
  locationDesc,
  stationLocation,
  stationUrl: initialStationUrl,
  onClose
}) => {
  const effectiveLocation = locationDesc || stationLocation || 'Office Print Zone';
  const getAutoResolvedOrigin = (): string => {
    if (typeof window === 'undefined') return '';
    let origin = window.location.origin;

    // Replace internal private developer URL with public shared URL
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    } else if (origin.includes('aistudio.google.com') || origin.includes('google.com') || origin.includes('localhost')) {
      // If inside Google AI Studio editor frame, use the live shared cloud host
      origin = 'https://ais-pre-r23stbv3zof3ahi4xmqvj5-247817327051.asia-southeast1.run.app';
    }
    return origin;
  };

  const [baseOrigin, setBaseOrigin] = useState<string>(() => {
    if (initialStationUrl && !initialStationUrl.includes('localhost') && !initialStationUrl.includes('ais-dev-')) {
      try {
        const parsed = new URL(initialStationUrl);
        return parsed.origin;
      } catch {
        // fallback
      }
    }
    return getAutoResolvedOrigin();
  });

  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');

  const cleanBase = baseOrigin.trim().replace(/\/+$/, '');
  const targetUrl = `${cleanBase}/station/${stationCode}`;

  useEffect(() => {
    QRCode.toDataURL(targetUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(setQrUrl)
      .catch(err => console.error('QR generation failed:', err));
  }, [targetUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `QR_${stationCode}.png`;
    a.click();
  };

  return (
    <div id="printable-qr-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 relative my-6">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Alert for Mobile Accessibility */}
        <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start space-x-2.5 text-xs text-blue-900">
          <Globe className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-bold">Public Cloud QR (No 403 Error):</span>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Encoded with public cloud link. Any smartphone on 4G/5G/Wi-Fi can scan and upload instantly.
            </p>
          </div>
        </div>

        {/* Printable Card Area */}
        <div id="printable-standee-area" className="border-4 border-slate-900 rounded-3xl p-5 text-center bg-white shadow-inner">
          <div className="inline-flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider mb-3">
            <Printer className="w-4 h-4" />
            <span>Office Smart Print</span>
          </div>

          <h2 className="text-2xl font-black text-slate-950 tracking-tight leading-tight">
            SCAN TO UPLOAD & PRINT
          </h2>
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mt-1">
            "Upload • Pay • Instant Print"
          </p>

          {/* QR Code Container */}
          <div className="my-4 bg-white p-3.5 rounded-2xl border-2 border-slate-200 inline-block shadow-sm">
            {qrUrl ? (
              <img src={qrUrl} alt={`QR Code for ${stationName}`} className="w-52 h-52 mx-auto object-contain" />
            ) : (
              <div className="w-52 h-52 bg-slate-100 animate-pulse rounded-xl" />
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 truncate">{stationName}</h3>
              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded">
                Code: {stationCode}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{effectiveLocation}</p>

            {/* Direct URL text for manual entry */}
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Direct Link:</span>
              <span className="font-mono text-blue-700 font-semibold truncate max-w-[240px] text-[10px]">
                {targetUrl}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 text-[11px] font-semibold text-slate-700">
            <span className="flex items-center text-emerald-700">
              <WifiOff className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              No Wi-Fi Needed
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center text-blue-700">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-600" />
              UPI & Cash Pay
            </span>
          </div>
        </div>

        {/* Target URL Controls & Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center">
              <Globe className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Encoded URL:
            </span>
            <button
              onClick={() => setIsEditingUrl(!isEditingUrl)}
              className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer text-[11px]"
            >
              {isEditingUrl ? 'Done Editing' : 'Customize Domain / URL'}
            </button>
          </div>

          {isEditingUrl ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={baseOrigin}
                onChange={e => setBaseOrigin(e.target.value)}
                placeholder="https://your-public-url.com"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Must start with http:// or https://</span>
                <button
                  onClick={() => setBaseOrigin(getAutoResolvedOrigin())}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Reset to Live Cloud URL
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="font-mono text-[11px] text-slate-700 truncate mr-2">{targetUrl}</span>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer"
                  title="Copy link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 rounded-lg border border-slate-200 transition-all cursor-pointer"
                  title="Test link in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={handleDownload}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download QR Image
            </button>
            <button
              onClick={handlePrint}
              className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer"
            >
              <PrintIcon className="w-3.5 h-3.5 mr-1.5" />
              Print Desk Standee
            </button>
          </div>

          <button
            onClick={() => downloadGatewayPackage(stationCode)}
            className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-all flex items-center justify-center cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Download Offline PC Gateway ZIP
          </button>
        </div>
      </div>
    </div>
  );
};

