import crypto from "crypto";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  IPaymentProvider,
  NormalizedWebhook,
} from "./types";

// In-memory mock provider used only when PAYMENT_PROVIDER=mock.
// Useful for local development without Saweria credentials.
export class MockProvider implements IPaymentProvider {
  readonly name = "mock";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const id = "mock_" + crypto.randomBytes(8).toString("hex");
    return {
      providerTransactionId: id,
      amount: input.amount,
      qrString: `MOCKQR:${id}:${input.amount}`,
      qrImageUrl: null,
      paymentUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/pay/${id}`,
      expiresAt: new Date(Date.now() + input.expirationMinutes * 60_000),
      raw: { id, amount: input.amount, mock: true },
    };
  }

  parseWebhook(_headers: Record<string, string>, body: unknown): NormalizedWebhook {
    const payload = (body ?? {}) as Record<string, unknown>;
    return {
      provider: this.name,
      eventId:
        typeof payload.id === "string"
          ? payload.id
          : `mock_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventType: "donation",
      providerTransactionId:
        typeof payload.trx_id === "string" ? payload.trx_id : undefined,
      referenceId:
        typeof payload.trx_id === "string" ? payload.trx_id : undefined,
      amount: typeof payload.amount === "number" ? payload.amount : undefined,
      rawAmount: typeof payload.amount === "number" ? payload.amount : undefined,
      customerName:
        typeof payload.customer_name === "string" ? payload.customer_name : undefined,
      customerEmail:
        typeof payload.customer_email === "string"
          ? payload.customer_email
          : undefined,
      message: typeof payload.message === "string" ? payload.message : undefined,
      payload,
    };
  }
}