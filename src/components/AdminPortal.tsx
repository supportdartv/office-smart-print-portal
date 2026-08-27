import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileText,
  DollarSign,
  Activity,
  Layers,
  Radio,
  Download,
  RotateCcw,
  Ban,
  CheckCircle,
  AlertTriangle,
  Play,
  Lock,
  Plus,
  TrendingUp,
  Settings,
  RefreshCw,
  QrCode,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { ApiService } from '../services/api';
import { PrintableQrCard } from './PrintableQrCard';
import { downloadGatewayPackage } from '../utils/gatewayZip';

interface AdminPortalProps {
  onClose: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onClose }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('office_admin_token') || 'admin-session-token-demo'
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'printers' | 'stations' | 'reports' | 'pricing' | 'simulator'>('dashboard');

  // Data states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [jobsData, setJobsData] = useState<any[]>([]);
  const [printersData, setPrintersData] = useState<any[]>([]);
  const [stationsData, setStationsData] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [reportRange, setReportRange] = useState<string>('today');
  const [pricingSettings, setPricingSettings] = useState<any>(null);

  // Filter state for jobs
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // QR Modal
  const [selectedStationQr, setSelectedStationQr] = useState<any | null>(null);

  // Loading & notification states
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      const res = await ApiService.adminLogin(passwordInput);
      setToken(res.token);
      localStorage.setItem('office_admin_token', res.token);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid administrator password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('office_admin_token');
  };

  const loadDataForTab = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const data = await ApiService.getAdminDashboard(token);
        setDashboardData(data);
      } else if (activeTab === 'jobs') {
        const data = await ApiService.getAdminJobs(token, statusFilter, typeFilter);
        setJobsData(data.jobs || []);
      } else if (activeTab === 'printers') {
        const data = await ApiService.getAdminPrinters(token);
        setPrintersData(data);
      } else if (activeTab === 'stations') {
        const data = await ApiService.getAdminStations(token);
        setStationsData(data);
      } else if (activeTab === 'reports') {
        const data = await ApiService.getAdminReports(token, reportRange);
        setReportsData(data);
      } else if (activeTab === 'pricing') {
        const dash = await ApiService.getAdminDashboard(token);
        setPricingSettings(dash.pricing);
      }
    } catch (err: any) {
      if (err.message.includes('401') || err.message.includes('UNAUTHORIZED')) {
        setToken(null);
        localStorage.removeItem('office_admin_token');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDataForTab();
    }
  }, [token, activeTab, statusFilter, typeFilter, reportRange]);

  // Actions
  const handleRetryJob = async (jobId: string) => {
    if (!token) return;
    try {
      await ApiService.retryAdminJob(token, jobId);
      showNotification(`Job ${jobId.slice(0, 8)} requeued for printing.`);
      loadDataForTab();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!token) return;
    try {
      await ApiService.cancelAdminJob(token, jobId);
      showNotification(`Job ${jobId.slice(0, 8)} cancelled.`);
      loadDataForTab();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTogglePrinter = async (printerId: string) => {
    if (!token) return;
    try {
      await ApiService.toggleAdminPrinter(token, printerId);
      showNotification(`Printer status toggled.`);
      loadDataForTab();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestPrint = async (printerId: string) => {
    if (!token) return;
    try {
      const res = await ApiService.testPrintAdminPrinter(token, printerId);
      showNotification(res.message);
      loadDataForTab();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendTestPrint = async (stationCode: string = 'office-printer-01') => {
    try {
      setLoading(true);
      const res = await ApiService.dispatchTestPrint(stationCode);
      showNotification(res.data?.message || 'Test print queued successfully!');
      loadDataForTab();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch test print.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pricingSettings) return;
    try {
      await ApiService.updateAdminPricing(token, pricingSettings);
      showNotification('Pricing and UPI settings successfully updated.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Login view if unauthenticated
  if (!token) {
    return (
      <div id="admin-login-screen" className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-center text-slate-900">Administrator Access</h2>
        <p className="text-xs text-center text-slate-500 mt-1 mb-6">
          Authorized personnel only. (Default password: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">admin123</code>)
        </p>

        {loginError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Admin Password
            </label>
            <input
              id="admin-password-input"
              type="password"
              required
              placeholder="Enter administrator password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
            />
          </div>

          <button
            id="admin-login-submit-btn"
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center"
          >
            {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'AUTHENTICATE'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div id="admin-portal-container" className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Admin Subheader & Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Office Print Admin</h2>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
              Control Plane
            </span>
          </div>
          <p className="text-xs text-slate-500">Live printer queue, hardware gateways & transaction ledger</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'jobs', label: 'Job Queue', icon: FileText },
            { id: 'printers', label: 'Printers', icon: Printer },
            { id: 'stations', label: 'Stations & QR', icon: QrCode },
            { id: 'reports', label: 'Reports', icon: TrendingUp },
            { id: 'pricing', label: 'Pricing & UPI', icon: Settings },
            { id: 'simulator', label: 'Gateway Sim', icon: Radio }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={loadDataForTab}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-slate-200"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in">
          <span>✓ {actionNotice}</span>
        </div>
      )}

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && dashboardData && (
        <div className="space-y-6">
          {/* Top Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Today's Jobs
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {dashboardData.stats.todayJobs}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {dashboardData.stats.completedJobs} completed
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Today's Revenue
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {dashboardData.stats.todayRevenueFormatted}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Verified via UPI</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Breakdown
              </span>
              <div className="text-xs font-medium text-slate-700 mt-1 space-y-0.5">
                <div>B&W: <strong className="text-slate-900">{dashboardData.stats.bwJobs}</strong></div>
                <div>Colour: <strong className="text-slate-900">{dashboardData.stats.colorJobs}</strong></div>
                <div>Official: <strong className="text-slate-900">{dashboardData.stats.officialJobs}</strong></div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Hardware Status
              </span>
              <div className="text-xs font-medium text-slate-700 mt-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Printers:</span>
                  <span className="font-bold text-emerald-600">
                    🟢 {dashboardData.systemStatus.printersOnline}/{dashboardData.systemStatus.totalPrinters} ONLINE
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Gateways:</span>
                  <span className="font-bold text-emerald-600">
                    🟢 {dashboardData.systemStatus.gatewaysOnline}/{dashboardData.systemStatus.totalGateways} ONLINE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                Office WLAN Print Bridge Architecture
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                The printer is safely hidden inside your local office subnet. Users upload and pay
                using their phone's 4G/5G mobile connection. The Print Gateway on your Office PC polls
                outbound via HTTPS and spools directly to the Windows Spooler.
              </p>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 font-mono text-[11px] text-slate-600">
                Outbound Gateway API: <span className="text-blue-600 font-bold">GET /api/gateway/jobs</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Active Rates & Merchant UPI
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Black & White:</span>
                  <strong className="text-slate-900">₹{(dashboardData.pricing.blackWhitePricePaise / 100).toFixed(2)} / page</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Colour:</span>
                  <strong className="text-slate-900">₹{(dashboardData.pricing.colorPricePaise / 100).toFixed(2)} / page</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Official Print:</span>
                  <strong className="text-emerald-600">FREE (with audit ID)</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Configured Merchant UPI:</span>
                  <strong className="font-mono text-slate-900">{dashboardData.pricing.merchantUpiId}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JOBS QUEUE */}
      {activeTab === 'jobs' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="QUEUED">QUEUED</option>
                <option value="PRINTING">PRINTING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="WAITING_PAYMENT">WAITING_PAYMENT</option>
                <option value="FAILED">FAILED</option>
              </select>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
              >
                <option value="ALL">All Types</option>
                <option value="BLACK_WHITE">B&W</option>
                <option value="COLOR">Colour</option>
                <option value="OFFICIAL">Official</option>
              </select>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Total {jobsData.length} records
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="p-3.5">Job ID</th>
                  <th className="p-3.5">File</th>
                  <th className="p-3.5">Pages</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Payment</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobsData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No print jobs found matching filters.
                    </td>
                  </tr>
                ) : (
                  jobsData.map(j => (
                    <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-mono text-slate-600">{j.id.slice(0, 8)}...</td>
                      <td className="p-3.5 font-medium text-slate-900 truncate max-w-xs">{j.filename}</td>
                      <td className="p-3.5">{j.pages}</td>
                      <td className="p-3.5 font-semibold">
                        {j.printType === 'OFFICIAL' ? (
                          <span className="text-blue-600">Official</span>
                        ) : j.printType === 'COLOR' ? (
                          <span className="text-purple-600">Colour</span>
                        ) : (
                          <span className="text-slate-700">B&W</span>
                        )}
                      </td>
                      <td className="p-3.5 font-bold">{j.amountFormatted}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            j.paymentStatus === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {j.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            j.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : j.status === 'PRINTING'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                              : j.status === 'QUEUED'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        {(j.status === 'FAILED' || j.status === 'CANCELLED') && (
                          <button
                            onClick={() => handleRetryJob(j.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Re-queue print job"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {j.status !== 'COMPLETED' && j.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleCancelJob(j.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Cancel job"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRINTERS */}
      {activeTab === 'printers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {printersData.map(printer => (
            <div key={printer.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 border border-slate-200">
                    <Printer className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{printer.name}</h4>
                    <p className="text-xs text-slate-500">{printer.location}</p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                    printer.enabled && printer.status === 'ONLINE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {printer.enabled ? 'ONLINE' : 'DISABLED'}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Private IP (WLAN)</span>
                  <span className="font-mono text-slate-700">{printer.ipAddress}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Queue Count</span>
                  <span className="font-bold text-slate-900">{printer.queueCount} active</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ink Level</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                    {printer.health?.inkLevel ?? 82}% (B: {printer.health?.blackInkLevel ?? 85}% • C: {printer.health?.colorInkLevel ?? 78}%)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Paper Tray</span>
                  <span className="font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 inline-block mt-0.5">
                    {printer.health?.paperTrayText || 'Tray 1: Ready (75%)'}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  onClick={() => handleTogglePrinter(printer.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                    printer.enabled
                      ? 'text-red-700 border-red-200 hover:bg-red-50'
                      : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {printer.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleTestPrint(printer.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Test Print
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: STATIONS & QR */}
      {activeTab === 'stations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {stationsData.map(station => (
              <div key={station.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
                      {station.stationCode}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-bold">● Active</span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900">{station.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{station.locationDesc}</p>

                  <div className="mt-4 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    <div>Printer: <strong className="text-slate-800">{station.printer?.name || 'Default'}</strong></div>
                    <div>Target URL: <span className="text-blue-600 font-mono text-[10px] truncate block">{station.stationUrl}</span></div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 space-y-2">
                  <button
                    onClick={() => setSelectedStationQr(station)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center"
                  >
                    <QrCode className="w-4 h-4 mr-1.5" />
                    Generate & Print Standee QR
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSendTestPrint(station.stationCode || station.id)}
                      className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors flex items-center justify-center"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      Test Print
                    </button>

                    <button
                      onClick={() => downloadGatewayPackage(station.stationCode || station.id)}
                      className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Get ZIP
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Printing Analytics & Audit Ledger</h3>
              <p className="text-xs text-slate-500">Track aggregate print volumes and collected revenue</p>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={reportRange}
                onChange={e => setReportRange(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>

              <a
                href={`/api/admin/reports?range=${reportRange}&format=csv`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </a>
            </div>
          </div>

          {reportsData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Print Jobs</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{reportsData.totalJobs}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Revenue</span>
                <div className="text-xl font-bold text-emerald-600 mt-1">{reportsData.totalRevenueFormatted}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">B&W Pages</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{reportsData.bwPages}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Colour Pages</span>
                <div className="text-xl font-bold text-purple-600 mt-1">{reportsData.colorPages}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: PRICING & SETTINGS */}
      {activeTab === 'pricing' && pricingSettings && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-xl">
          <h3 className="text-base font-bold text-slate-900 mb-1">Pricing & Payment Configuration</h3>
          <p className="text-xs text-slate-500 mb-6">
            Prices are calculated strictly on the backend. Changes take effect on newly uploaded jobs.
          </p>

          <form onSubmit={handleSavePricing} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Black & White (Paise)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={pricingSettings.blackWhitePricePaise}
                    onChange={e =>
                      setPricingSettings({ ...pricingSettings, blackWhitePricePaise: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400">
                    = ₹{(pricingSettings.blackWhitePricePaise / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Colour (Paise)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={pricingSettings.colorPricePaise}
                    onChange={e =>
                      setPricingSettings({ ...pricingSettings, colorPricePaise: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400">
                    = ₹{(pricingSettings.colorPricePaise / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Merchant UPI ID
              </label>
              <input
                type="text"
                required
                value={pricingSettings.merchantUpiId}
                onChange={e =>
                  setPricingSettings({ ...pricingSettings, merchantUpiId: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default example: 7006686584@icici</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Provider Mode
              </label>
              <select
                value={pricingSettings.paymentProvider}
                onChange={e =>
                  setPricingSettings({ ...pricingSettings, paymentProvider: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              >
                <option value="UPI_DIRECT">UPI Direct (Fixed Amount QR via NPCI spec)</option>
                <option value="DEMO">DEMO / Sandbox Simulator (Development Only)</option>
                <option value="RAZORPAY">Razorpay Dynamic QR</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 7: GATEWAY SETUP & SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          {/* OFFLINE INSTALLATION BOX */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    One-Click Offline Gateway ZIP Package
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pre-configured for this server with <strong>all scripts & zero-pip dependencies</strong> included!
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => downloadGatewayPackage('office-printer-01')}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Gateway ZIP</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-3">
              <div className="font-semibold text-slate-900 flex items-center justify-between">
                <span>Everything is included in the ZIP file:</span>
                <span className="text-[11px] text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ 100% Offline (No Pip required)
                </span>
              </div>
              
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold shrink-0">1</span>
                <div>
                  <strong className="text-slate-900">Download & Extract the ZIP:</strong>
                  <p className="text-slate-600 mt-0.5">
                    Click the button above to download <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-slate-800">office-print-gateway.zip</code>. Copy or extract it on your Office Windows PC (e.g. into <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-slate-800">C:\OfficeSmartPrint</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
                <div>
                  <strong className="text-slate-900">Pre-configured Settings:</strong>
                  <p className="text-slate-600 mt-0.5">
                    The ZIP already contains your pre-filled <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-slate-800">.env</code> pointing directly to this cloud instance! No manual typing required.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold shrink-0">3</span>
                <div>
                  <strong className="text-slate-900">Double-Click Desktop Interface or Launcher:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
                    <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200">
                      <div className="font-mono font-bold text-blue-900 text-[11px] flex items-center">
                        <span className="w-2 h-2 rounded-full bg-blue-600 mr-1.5 animate-pulse"></span>
                        start_interface.bat
                      </div>
                      <p className="text-[10px] text-blue-700 mt-0.5 font-medium">✨ Graphical Desktop Window GUI (Visual dashboard & live queue).</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <div className="font-mono font-bold text-slate-900 text-[11px]">run_gateway.bat</div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Console terminal activity monitor.</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <div className="font-mono font-bold text-slate-900 text-[11px]">install_startup.bat</div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Auto-boots the gateway on Windows startup.</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <div className="font-mono font-bold text-slate-900 text-[11px]">test_printer.bat</div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Self-tests the physical printer locally.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action bar */}
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">Test physical spooler dispatch from cloud:</span>
                <button
                  onClick={() => handleSendTestPrint('office-printer-01')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Dispatch Test Print to Office PC
                </button>
              </div>
            </div>
          </div>

          {/* VIRTUAL SIMULATOR BOX */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Virtual Office PC Print Gateway Simulator</h3>
                <p className="text-xs text-slate-500">
                  Test the end-to-end cloud-to-spooler pipeline live right in your browser!
                </p>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-2">
              <div className="text-emerald-400">=== Print Gateway Active Simulation ===</div>
              <div>Gateway ID: <span className="text-white">gw-office-pc-01</span></div>
              <div>Target Subnet: <span className="text-white">192.168.1.0/24 (Office WLAN)</span></div>
              <div>Spooler Status: <span className="text-emerald-400">READY TO DISPATCH</span></div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              When a user uploads and verifies payment for a document, it transitions into <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">QUEUED</code>.
              The Python script in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">print-gateway/gateway.py</code> claims the job, reports <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">PRINTING</code>, delivers pages to Windows Spooler, and reports <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">COMPLETED</code>.
            </p>
          </div>
        </div>
      )}

      {/* QR Modal Standee */}
      {selectedStationQr && (
        <PrintableQrCard
          stationCode={selectedStationQr.stationCode}
          stationName={selectedStationQr.name}
          locationDesc={selectedStationQr.locationDesc}
          stationUrl={selectedStationQr.stationUrl}
          onClose={() => setSelectedStationQr(null)}
        />
      )}
    </div>
  );
};
