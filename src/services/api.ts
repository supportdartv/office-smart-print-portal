import {
  StationDataResponse,
  UploadSuccessData,
  JobDetails,
  PaymentCreationResponse,
  PrintType
} from '../types';

export class ApiService {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      const errMessage = data?.error?.message || `Request failed with status ${res.status}`;
      throw new Error(errMessage);
    }
    return data.data;
  }

  // Public Session
  public static async createSession(): Promise<{ sessionId: string; settings: any }> {
    return this.request<{ sessionId: string; settings: any }>('/api/sessions', {
      method: 'POST'
    });
  }

  // Station Info
  public static async getStation(stationId: string): Promise<StationDataResponse> {
    return this.request<StationDataResponse>(`/api/stations/${encodeURIComponent(stationId)}`);
  }

  // Real-time Station Printer Health
  public static async getStationHealth(stationId: string): Promise<{
    printerId?: string;
    printerName?: string;
    status: string;
    health: any;
    timestamp: string;
  }> {
    return this.request<any>(`/api/stations/${encodeURIComponent(stationId)}/health`);
  }

  // Upload Document
  public static async uploadDocument(
    file: File,
    sessionId: string,
    stationId?: string,
    onProgress?: (percent: number) => void
  ): Promise<UploadSuccessData> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      if (stationId) formData.append('stationId', stationId);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error?.message || 'File upload failed'));
          }
        } catch (err) {
          reject(new Error('Invalid response from upload server'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file upload. Check connection.'));
      };

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  }

  // Job Details
  public static async getJob(jobId: string): Promise<JobDetails> {
    return this.request<JobDetails>(`/api/jobs/${jobId}`);
  }

  // Select Print Type
  public static async selectPrintType(
    jobId: string,
    printType: PrintType,
    copies: number = 1
  ): Promise<{ job: any; nextStep: 'PAYMENT' | 'OFFICIAL_FORM' }> {
    return this.request<{ job: any; nextStep: 'PAYMENT' | 'OFFICIAL_FORM' }>(
      `/api/jobs/${jobId}/select-print-type`,
      {
        method: 'POST',
        body: JSON.stringify({ printType, copies })
      }
    );
  }

  // Official Confirm
  public static async confirmOfficialPrint(
    jobId: string,
    employeeId: string,
    section: string,
    purpose: string
  ): Promise<{ job: any; message: string }> {
    return this.request<{ job: any; message: string }>(`/api/jobs/${jobId}/official-confirm`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, section, purpose })
    });
  }

  // Create Payment
  public static async createPayment(jobId: string): Promise<PaymentCreationResponse> {
    return this.request<PaymentCreationResponse>('/api/payments/create', {
      method: 'POST',
      body: JSON.stringify({ jobId })
    });
  }

  // Poll Payment Status
  public static async getPaymentStatus(paymentId: string): Promise<{
    paymentId: string;
    status: string;
    verified: boolean;
    amountFormatted: string;
    jobStatus: string;
  }> {
    return this.request<any>(`/api/payments/status/${paymentId}`);
  }

  // Simulate Demo Payment (dev/demo only)
  public static async simulateDemoPayment(paymentId: string, jobId?: string): Promise<any> {
    return this.request<any>('/api/payments/simulate-demo', {
      method: 'POST',
      body: JSON.stringify({ paymentId, jobId })
    });
  }

  // Admin APIs
  public static async adminLogin(password: string): Promise<{ token: string; name: string }> {
    return this.request<{ token: string; name: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }

  public static async getAdminDashboard(token: string): Promise<any> {
    return this.request<any>('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async getAdminJobs(token: string, status?: string, printType?: string): Promise<any> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (printType) params.append('printType', printType);
    return this.request<any>(`/api/admin/jobs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async retryAdminJob(token: string, jobId: string): Promise<any> {
    return this.request<any>(`/api/admin/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async cancelAdminJob(token: string, jobId: string): Promise<any> {
    return this.request<any>(`/api/admin/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async getAdminPrinters(token: string): Promise<any> {
    return this.request<any>('/api/admin/printers', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async toggleAdminPrinter(token: string, printerId: string): Promise<any> {
    return this.request<any>(`/api/admin/printers/${printerId}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async testPrintAdminPrinter(token: string, printerId: string): Promise<any> {
    return this.request<any>(`/api/admin/printers/${printerId}/test-print`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async getAdminStations(token: string): Promise<any> {
    return this.request<any>('/api/admin/stations', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  public static async createAdminStation(token: string, payload: any): Promise<any> {
    return this.request<any>('/api/admin/stations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  }

  public static async updateAdminPricing(token: string, payload: any): Promise<any> {
    return this.request<any>('/api/admin/settings/pricing', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  }

  public static async dispatchTestPrint(stationCode: string): Promise<any> {
    return this.request<any>('/api/admin/dispatch-test-print', {
      method: 'POST',
      body: JSON.stringify({ stationCode })
    });
  }

  public static async getAdminReports(token: string, range: string): Promise<any> {
    return this.request<any>(`/api/admin/reports?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
