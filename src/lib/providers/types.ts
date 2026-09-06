export type CreatePaymentInput = {
  amount: number;
  expirationMinutes: number;
  referenceId: string;
  customerName?: string;
  customerEmail?: string;
  description?: string;
};

export type CreatePaymentResult = {
  providerTransactionId: string;
  amount: number;
  qrString: string | null;
  qrImageUrl: string | null;
  paymentUrl: string | null;
  expiresAt: Date;
  raw: unknown;
};

export type NormalizedWebhook = {
  provider: string;
  eventId: string;
  eventType: string;
  providerTransactionId?: string;
  referenceId?: string;
  amount?: number;
  rawAmount?: number;
  customerName?: string;
  customerEmail?: string;
  message?: string;
  payload: unknown;
};

export interface IPaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(headers: Record<string, string>, body: unknown): NormalizedWebhook;
  setWebhook?(url: string): Promise<unknown>;
}