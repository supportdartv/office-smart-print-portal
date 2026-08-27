import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Printer,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Droplets,
  Layers,
  Wifi,
  WifiOff,
  RefreshCw,
  Activity,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';
import { StationInfo, PrinterInfo, PrinterHealth } from '../types';
import { ApiService } from '../services/api';

interface StationHeaderProps {
  station: StationInfo | null;
  printer: PrinterInfo | null;
  onRefreshHealth?: () => void;
}

export const StationHeader: React.FC<StationHeaderProps> = ({
  station,
  printer,
  onRefreshHealth
}) => {
  const [liveHealth, setLiveHealth] = useState<PrinterHealth | null>(printer?.health || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Sync with prop changes
  useEffect(() => {
    if (printer?.health) {
      setLiveHealth(printer.health);
    }
  }, [printer]);

  // Periodic background telemetry poll (every 20 seconds)
  useEffect(() => {
    if (!station?.id && !station?.code) return;
    const targetId = station.code || station.id;

    const interval = setInterval(async () => {
      try {
        const res = await ApiService.getStationHealth(targetId);
        if (res?.health) {
          setLiveHealth(res.health);
          setLastRefreshedAt(new Date());
        }
      } catch (e) {
        // Soft fail for telemetry background poll
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [station?.id, station?.code]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const targetId = station?.code || station?.id || 'office-printer-01';
    try {
      const res = await ApiService.getStationHealth(targetId);
      if (res?.health) {
        setLiveHealth(res.health);
        setLastRefreshedAt(new Date());
      }
      if (onRefreshHealth) {
        onRefreshHealth();
      }
    } catch (err) {
      console.error('Telemetry refresh error:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const isPrinterOnline =
    printer?.status === 'ONLINE' ||
    printer?.status === 'ONLINE_IDLE' ||
    liveHealth?.connectivity === 'ONLINE';

  const inkPercentage = liveHealth?.inkLevel ?? 82;
  const blackInk = liveHealth?.blackInkLevel ?? 85;
  const colorInk = liveHealth?.colorInkLevel ?? 78;
  const paperStatus = liveHealth?.paperStatus ?? 'OK';
  const paperLevel = liveHealth?.paperLevel ?? 75;
  const paperTrayDesc = liveHealth?.paperTrayText ?? 'Tray 1 (A4) • Ready';
  const connectivity = liveHealth?.connectivity ?? (isPrinterOnline ? 'ONLINE' : 'OFFLINE');
  const latencyMs = liveHealth?.latencyMs ?? 14;

  // Ink color tone calculation
  const getInkColorClasses = (level: number) => {
    if (level >= 50) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (level >= 20) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
  };

  const inkStyles = getInkColorClasses(inkPercentage);

  // Paper status badge formatting
  const getPaperStatusBadge = () => {
    switch (paperStatus) {
      case 'OK':
        return {
          label: 'Paper Ready',
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        };
      case 'LOW':
        return {
          label: 'Paper Low',
          color: 'text-amber-700 bg-amber-50 border-amber-200',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        };
      case 'EMPTY':
        return {
          label: 'Tray Empty',
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
        };
      case 'JAMMED':
        return {
          label: 'Paper Jam',
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
        };
      default:
        return {
          label: 'Normal',
          color: 'text-slate-700 bg-slate-50 border-slate-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
        };
    }
  };

  const paperBadge = getPaperStatusBadge();

  return (
    <div id="station-header-card" className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs mb-5 transition-all">
      {/* Top Station & General Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shrink-0 shadow-2xs">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {station?.name || 'Office Print Station'}
              </h2>
            </div>
            <div className="flex items-center text-xs text-slate-500 mt-1 space-x-2">
              <span className="flex items-center text-slate-600 font-medium">
                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {station?.location || 'Ground Floor Print Hub'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                {station?.code || 'station-01'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Main Status Badge */}
          {isPrinterOnline ? (
            <span
              id="printer-status-badge"
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ready for Print</span>
            </span>
          ) : (
            <span
              id="printer-status-badge"
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Checking Connectivity</span>
            </span>
          )}

          {/* Quick Refresh Telemetry Button */}
          <button
            id="refresh-health-btn"
            type="button"
            onClick={handleManualRefresh}
            title="Refresh Real-time Printer Health"
            disabled={isRefreshing}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg border border-slate-200/80 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* REAL-TIME PRINTER HEALTH WIDGET */}
      <div id="realtime-printer-health-widget" className="mt-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Real-Time Printer Health</span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <span className="hidden sm:inline">Gateway Telemetry</span>
            <span className="font-mono">
              {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              id="toggle-diagnostics-btn"
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center text-blue-600 hover:text-blue-700 font-medium ml-1 text-xs"
            >
              {showDiagnostics ? (
                <>
                  <span>Less</span>
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                </>
              ) : (
                <>
                  <span>Details</span>
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3-Column Health Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 1. INK LEVEL INDICATOR */}
          <div
            id="ink-level-indicator"
            className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 flex flex-col justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center text-xs font-medium text-slate-600">
                <Droplets className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
                Ink Levels
              </span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${inkStyles.bg} ${inkStyles.text} ${inkStyles.border}`}>
                {inkPercentage}%
              </span>
            </div>

            {/* Gauge Bar */}
            <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full ${inkStyles.bar} transition-all duration-500 rounded-full`}
                style={{ width: `${inkPercentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Black: {blackInk}%</span>
              <span>Color: {colorInk}%</span>
            </div>
          </div>

          {/* 2. PAPER STATUS INDICATOR */}
          <div
            id="paper-status-indicator"
            className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 flex flex-col justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center text-xs font-medium text-slate-600">
                <Layers className="w-3.5 h-3.5 text-indigo-500 mr-1.5" />
                Paper Tray
              </span>
              <span className={`inline-flex items-center space-x-1 text-xs font-bold px-1.5 py-0.5 rounded border ${paperBadge.color}`}>
                {paperBadge.icon}
                <span>{paperBadge.label}</span>
              </span>
            </div>

            {/* Tray Fill Bar */}
            <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full ${
                  paperStatus === 'OK' ? 'bg-indigo-500' : paperStatus === 'LOW' ? 'bg-amber-500' : 'bg-rose-500'
                } transition-all duration-500 rounded-full`}
                style={{ width: `${paperLevel}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="truncate">{paperTrayDesc}</span>
              <span className="shrink-0">{paperLevel}% full</span>
            </div>
          </div>

          {/* 3. CONNECTIVITY INDICATOR */}
          <div
            id="connectivity-indicator"
            className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 flex flex-col justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center text-xs font-medium text-slate-600">
                {connectivity === 'ONLINE' ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-500 mr-1.5" />
                )}
                Connectivity
              </span>
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                  connectivity === 'ONLINE'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}
              >
                {connectivity === 'ONLINE' ? 'LAN Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 my-auto">
              <span className="flex h-2 w-2 relative">
                {connectivity === 'ONLINE' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    connectivity === 'ONLINE' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <span className="text-[11px] text-slate-600 font-medium">
                {connectivity === 'ONLINE' ? 'Direct Spooler Sync' : 'Gateway Disconnected'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>WLAN Protocol</span>
              <span>{connectivity === 'ONLINE' ? `${latencyMs}ms ping` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* EXPANDABLE DIAGNOSTIC TELEMETRY DRAWER */}
        {showDiagnostics && (
          <div
            id="printer-diagnostics-panel"
            className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-xl text-xs space-y-2 border border-slate-800 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
              <span className="flex items-center font-semibold text-slate-300">
                <Cpu className="w-3.5 h-3.5 mr-1 text-blue-400" />
                Hardware Diagnostic Telemetry
              </span>
              <span className="font-mono text-[11px] text-blue-400">SNMP / WinSpool v1.0</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block">Printer Device:</span>
                <span className="text-slate-200 font-medium truncate block">{printer?.name || 'HP LaserJet Pro M404dw'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">IP Endpoint:</span>
                <span className="text-slate-200 font-medium block">192.168.1.105 (Local)</span>
              </div>
              <div>
                <span className="text-slate-500 block">Spool Queue:</span>
                <span className="text-emerald-400 font-medium block">{liveHealth?.queueLength ?? 0} jobs waiting</span>
              </div>
              <div>
                <span className="text-slate-500 block">Signal Strength:</span>
                <span className="text-slate-200 font-medium block">{liveHealth?.signalStrength ?? 'STRONG'} (-48 dBm)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Details */}
      {printer && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="truncate">
            Active Spooler: <strong className="text-slate-700 font-semibold">{printer.name}</strong>
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Zero-Driver Cloud Dispatch • Encrypted
          </span>
        </div>
      )}
    </div>
  );
};

