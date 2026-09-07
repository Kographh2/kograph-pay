import { getEnv } from "@/lib/env";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  IPaymentProvider,
  NormalizedWebhook,
} from "./types";

type SaweriaCreateResponse = {
  trx_id: string;
  status: string;
  status_simbolic?: string;
  message?: string;
  amount: number;
  qr_string: string;
  created_at: string;
  invoice_url: string;
  total_dibayar?: number;
  saweria_username?: string;
  saweria_apikey?: string;
  qr_image: string;
  expired_in: string;
};

type SaweriaStatusResponse = {
  code?: number;
  trx_id: string;
  status: string;
  amount?: number;
  invoice_url?: string;
};

export class SaweriaProvider implements IPaymentProvider {
  readonly name = "saweria";

  private client: { login: () => Promise<unknown>; createPaymentQr: (amount: number, duration: number) => Promise<SaweriaCreateResponse>; cekPaymentV2: (trxId: string) => Promise<SaweriaStatusResponse>; setWebhook: () => Promise<unknown> } | null = null;

  private async getClient(): Promise<{ login: () => Promise<unknown>; createPaymentQr: (amount: number, duration: number) => Promise<SaweriaCreateResponse>; cekPaymentV2: (trxId: string) => Promise<SaweriaStatusResponse>; setWebhook: () => Promise<unknown> }> {
    if (this.client) return this.client;
    const env = getEnv();
    if (!env.SAWERIA_USERNAME || !env.SAWERIA_EMAIL || !env.SAWERIA_PASSWORD) {
      throw new Error(
        "Saweria credentials missing. Set SAWERIA_USERNAME, SAWERIA_EMAIL, SAWERIA_PASSWORD.",
      );
    }
    const { SumshiiySawer } = await import("saweria-createqr");
    const sawer = new SumshiiySawer({
      username: env.SAWERIA_USERNAME,
      email: env.SAWERIA_EMAIL,
      password: env.SAWERIA_PASSWORD,
    });
    const loginResult = await sawer.login();
    if ((loginResult as { status?: boolean } | null)?.status === false) {
      const reason = (loginResult as { error?: string } | null)?.error ?? "Unknown login failure";
      throw new Error(`Saweria login failed: ${reason}`);
    }
    this.client = sawer as { login: () => Promise<unknown>; createPaymentQr: (amount: number, duration: number) => Promise<SaweriaCreateResponse>; cekPaymentV2: (trxId: string) => Promise<SaweriaStatusResponse>; setWebhook: () => Promise<unknown> };
    return this.client;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const sawer = await this.getClient();
    const res = await sawer.createPaymentQr(input.amount, input.expirationMinutes);
    const qrImageUrl = res.qr_image ?? null;
    return {
      providerTransactionId: res.trx_id,
      amount: input.amount,
      qrString: res.qr_string ?? null,
      qrImageUrl,
      paymentUrl: res.invoice_url ?? null,
      expiresAt: new Date(res.expired_in),
      raw: res,
    };
  }

  async checkPaymentStatus(transactionId: string): Promise<NormalizedWebhook> {
    const sawer = await this.getClient();
    const res = await sawer.cekPaymentV2(transactionId);
    return {
      provider: this.name,
      eventId: res.trx_id,
      eventType: res.status === "Paid" ? "donation" : res.status === "Expired" ? "expired" : "pending",
      providerTransactionId: res.trx_id,
      referenceId: res.trx_id,
      amount: res.amount,
      rawAmount: res.amount,
      payload: res,
    };
  }

  async setWebhook(url: string): Promise<unknown> {
    const sawer = await this.getClient();
    return sawer.setWebhook();
  }

  parseWebhook(_headers: Record<string, string>, body: unknown): NormalizedWebhook {
    const payload = (body ?? {}) as Record<string, unknown>;
    const eventId =
      typeof payload.id === "string"
        ? payload.id
        : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return {
      provider: this.name,
      eventId,
      eventType: typeof payload.type === "string" ? payload.type : "donation",
      providerTransactionId:
        typeof payload.id === "string" ? payload.id : undefined,
      referenceId: typeof payload.id === "string" ? payload.id : undefined,
      amount: typeof payload.amount_raw === "number" ? payload.amount_raw : undefined,
      rawAmount: typeof payload.amount_raw === "number" ? payload.amount_raw : undefined,
      customerName:
        typeof payload.donator_name === "string" ? payload.donator_name : undefined,
      customerEmail:
        typeof payload.donator_email === "string" ? payload.donator_email : undefined,
      message: typeof payload.message === "string" ? payload.message : undefined,
      payload,
    };
  }
}
