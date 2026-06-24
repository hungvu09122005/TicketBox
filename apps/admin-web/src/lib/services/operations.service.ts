import { apiClient } from '../api-client';

function extractListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    const nestedData = (payload as { data?: unknown }).data;
    if (Array.isArray(nestedData)) {
      return nestedData as T[];
    }
  }

  return [];
}

export interface OrderDetails {
  id: string;
  userId: string;
  concertId: string;
  ticketTypeId: string;
  quantity: number;
  totalAmount: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'PAYMENT_FAILED';
  tickets?: Array<{
    id: string;
  }>;
}

export interface ReportResponse {
  message?: string;
  [key: string]: unknown;
}

export interface ReportTimelinePoint {
  timestamp: string;
  value: number;
}

export interface ReportTimelineSeries {
  concertId: string;
  concertName: string;
  points: ReportTimelinePoint[];
}

export interface ReportTimelineResponse {
  granularity?: 'day' | 'week' | 'month';
  series: ReportTimelineSeries[];
}

export interface CsvImportJobStatus {
  id?: string;
  concertId?: string;
  triggeredBy?: string;
  objectKey?: string;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
  totalRows?: number;
  successRows?: number;
  errorRows?: number;
  createdAt?: string;
  message?: string;
  [key: string]: unknown;
}

export interface CsvErrorReportResponse {
  jobId?: string;
  filename?: string;
  rowCount?: number;
  csv?: string;
}

export interface NotificationProbePayload {
  email: string;
  ticketId: string;
}

export interface NotificationProbeResponse {
  message?: string;
}

export interface NotificationJobRecord {
  id?: string | number;
  name?: string;
  status?: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | string;
  rawStatus?: string;
  data?: Record<string, unknown>;
  failedReason?: string | null;
  timestamp?: number;
  finishedOn?: number | null;
  attemptsMade?: number;
}

export interface PaymentHistoryRecord {
  id?: string;
  orderId?: string;
  provider?: string;
  providerTransactionId?: string | null;
  status?: string;
  amount?: number | string;
  createdAt?: string;
  updatedAt?: string;
  rawData?: unknown;
  [key: string]: unknown;
}

export interface PaymentAuditRecord {
  id?: string;
  orderId?: string;
  provider?: string;
  providerTransactionId?: string | null;
  status?: string;
  amount?: number | string;
  createdAt?: string;
  updatedAt?: string;
  rawCallback?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface RetryResult {
  success?: boolean;
  message?: string;
}

export interface PaymentInitiationResult {
  paymentId?: string;
  paymentUrl?: string;
}

export interface AiBioRequestResult {
  id?: string;
  artistId?: string;
  requestedBy?: string;
  pdfObjectKey?: string;
  status?: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'DRAFT' | 'PUBLISHED' | 'FAILED';
  draftContent?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const operationsService = {
  getOrders: async (): Promise<OrderDetails[]> => {
    const response = await apiClient.get('/orders');
    return extractListData<OrderDetails>(response.data.data ?? response.data);
  },

  getRevenueReport: async (): Promise<ReportResponse> => {
    const response = await apiClient.get('/reports/revenue');
    return response.data.data ?? response.data;
  },

  getRevenueTimelineReport: async (): Promise<ReportTimelineResponse> => {
    const response = await apiClient.get('/reports/revenue/timeline');
    return response.data.data ?? response.data;
  },

  getTicketsSoldReport: async (): Promise<ReportResponse> => {
    const response = await apiClient.get('/reports/tickets-sold');
    return response.data.data ?? response.data;
  },

  getTicketsSoldTimelineReport: async (): Promise<ReportTimelineResponse> => {
    const response = await apiClient.get('/reports/tickets-sold/timeline');
    return response.data.data ?? response.data;
  },

  getCheckinRateReport: async (): Promise<ReportResponse> => {
    const response = await apiClient.get('/reports/checkin-rate');
    return response.data.data ?? response.data;
  },

  getCheckinRateTimelineReport: async (): Promise<ReportTimelineResponse> => {
    const response = await apiClient.get('/reports/checkin-rate/timeline');
    return response.data.data ?? response.data;
  },

  getOrderById: async (orderId: string): Promise<OrderDetails> => {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data.data;
  },

  initiatePayment: async (orderId: string): Promise<PaymentInitiationResult> => {
    const idempotencyKey =
      typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${orderId}-${Date.now()}`;

    const response = await apiClient.post(
      `/payments/${orderId}/initiate`,
      undefined,
      {
        headers: {
          'idempotency-key': idempotencyKey,
        },
      },
    );

    return response.data.data ?? response.data;
  },

  getCsvImportStatus: async (jobId: string): Promise<CsvImportJobStatus> => {
    const response = await apiClient.get(`/imports/${jobId}/status`);
    return response.data.data ?? response.data;
  },

  listCsvImportJobs: async (status?: CsvImportJobStatus['status']): Promise<CsvImportJobStatus[]> => {
    const response = await apiClient.get('/imports', {
      params: status ? { status } : undefined,
    });
    return extractListData<CsvImportJobStatus>(response.data.data ?? response.data);
  },

  retryCsvImportJob: async (jobId: string): Promise<RetryResult> => {
    const response = await apiClient.post(`/imports/${jobId}/retry`);
    return response.data.data ?? response.data;
  },

  downloadCsvErrorReport: async (jobId: string): Promise<CsvErrorReportResponse> => {
    const response = await apiClient.get(`/imports/${jobId}/error-report`);
    return response.data.data ?? response.data;
  },

  sendNotificationProbe: async (payload: NotificationProbePayload): Promise<NotificationProbeResponse> => {
    const response = await apiClient.post('/notifications/test-confirmation', payload);
    return response.data.data ?? response.data;
  },

  getNotificationJobs: async (status?: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'): Promise<NotificationJobRecord[]> => {
    const response = await apiClient.get('/notifications/jobs', {
      params: status ? { status } : undefined,
    });
    return extractListData<NotificationJobRecord>(response.data.data ?? response.data);
  },

  getFailedNotificationJobs: async (): Promise<NotificationJobRecord[]> => {
    const response = await apiClient.get('/notifications/failed');
    return extractListData<NotificationJobRecord>(response.data.data ?? response.data);
  },

  getNotificationJob: async (jobId: string): Promise<NotificationJobRecord> => {
    const response = await apiClient.get(`/notifications/jobs/${jobId}`);
    return response.data.data ?? response.data;
  },

  retryNotificationJob: async (jobId: string): Promise<RetryResult> => {
    const response = await apiClient.post(`/notifications/jobs/${jobId}/retry`);
    return response.data.data ?? response.data;
  },

  createAiBioRequest: async (pdfFile: File, artistId: string): Promise<AiBioRequestResult> => {
    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('artistId', artistId);

    const response = await apiClient.post('/api/artist-bio', formData);
    return response.data.data ?? response.data;
  },

  listAiBioJobs: async (status?: AiBioRequestResult['status'] | 'SUCCESS'): Promise<AiBioRequestResult[]> => {
    const response = await apiClient.get('/api/artist-bio', {
      params: status ? { status } : undefined,
    });
    return extractListData<AiBioRequestResult>(response.data.data ?? response.data);
  },

  getAiBioJobStatus: async (jobId: string): Promise<AiBioRequestResult> => {
    const response = await apiClient.get(`/api/artist-bio/${jobId}/status`);
    return response.data.data ?? response.data;
  },

  retryAiBioJob: async (jobId: string): Promise<RetryResult> => {
    const response = await apiClient.patch(`/api/artist-bio/${jobId}/retry`);
    return response.data.data ?? response.data;
  },

  updateAiBioDraft: async (jobId: string, draftContent: string): Promise<AiBioRequestResult> => {
    const response = await apiClient.patch(`/api/artist-bio/${jobId}`, { draftContent });
    return response.data.data ?? response.data;
  },

  publishAiBioDraft: async (jobId: string): Promise<AiBioRequestResult> => {
    const response = await apiClient.patch(`/api/artist-bio/${jobId}/publish`);
    return response.data.data ?? response.data;
  },

  getPaymentHistory: async (orderId: string): Promise<PaymentHistoryRecord[]> => {
    const response = await apiClient.get(`/payments/orders/${orderId}/history`);
    return extractListData<PaymentHistoryRecord>(response.data.data ?? response.data);
  },

  getPaymentAudit: async (orderId: string): Promise<PaymentAuditRecord[]> => {
    const response = await apiClient.get(`/payments/orders/${orderId}/audit`);
    return extractListData<PaymentAuditRecord>(response.data.data ?? response.data);
  },
};
