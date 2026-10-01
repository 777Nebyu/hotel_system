export interface ChapaInitializeRequest {
  amount: number | string;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  tx_ref: string;
  callback_url?: string;
  return_url?: string;
  customization?: {
    title?: string;
    description?: string;
  };
}

export interface ChapaInitializeResponse {
  message: string;
  status: 'success' | 'failed' | string;
  data?: {
    checkout_url: string;
  };
}

export interface ChapaVerifyResponse {
  message: string;
  status: 'success' | 'failed' | string;
  data?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    currency: string;
    amount: number | string;
    charge?: number | string;
    mode?: string;
    method?: string;
    type?: string;
    status: 'success' | 'failed' | 'pending' | 'cancelled' | string;
    reference?: string;
    tx_ref: string;
    customization?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
  };
}

export interface ChapaWebhookPayload {
  event?: string;
  tx_ref: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  reference?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}
