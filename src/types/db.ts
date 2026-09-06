// Hand-written types mirroring supabase/schema.sql.

export type UserRole = "USER" | "ADMIN";
export type TransactionStatus = "pending" | "paid" | "expired" | "failed";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  api_key_hash: string | null;
  api_key_prefix: string | null;
  public_key: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentTransaction = {
  id: string;
  user_id: string;
  transaction_id: string;
  reference_id: string;
  provider: string;
  provider_transaction_id: string | null;
  amount: number;
  currency: string;
  status: TransactionStatus;
  customer_name: string | null;
  customer_email: string | null;
  description: string | null;
  qr_data: string | null;
  qr_image_url: string | null;
  payment_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  raw_provider_response: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookEvent = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string | null;
  payload: string;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
};