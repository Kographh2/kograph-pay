export type TransactionShape = {
  user_id?: string;
  transaction_id: string;
  reference_id: string;
  provider: string;
  provider_transaction_id: string | null;
  amount: number;
  currency: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  description: string | null;
  qr_data: string | null;
  qr_image_url: string | null;
  payment_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function shapeTransaction(tx: TransactionShape) {
  const env = process.env.APP_URL ?? "http://localhost:3000";
  return {
    transaction_id: tx.transaction_id,
    reference_id: tx.reference_id,
    provider: tx.provider,
    provider_transaction_id: tx.provider_transaction_id,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    customer_name: tx.customer_name ?? undefined,
    customer_email: tx.customer_email ?? undefined,
    description: tx.description ?? undefined,
    qr_image_url: tx.qr_image_url ?? undefined,
    payment_url: tx.payment_url ?? undefined,
    qr_image: tx.qr_image_url ?? undefined,
    qr_endpoint: `${env}/api/v1/payments/${tx.transaction_id}/qr`,
    expires_at: tx.expires_at ?? undefined,
    paid_at: tx.paid_at ?? undefined,
    created_at: tx.created_at,
    updated_at: tx.updated_at,
  };
}