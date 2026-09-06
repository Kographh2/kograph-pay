import { getEnv } from "@/lib/env";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  IPaymentProvider,
  NormalizedWebhook,
} from "./types";

// Lazy import: saweria-createqr transitively requires node-cron, which
// can throw "Cannot read properties of undefined (reading 'startTime')"
// on some Node.js versions during module load. We don't need the
// scheduler (we poll / webhooks instead), so we swallow the error and
// continue — the rest of the package still works.
let _SumshiiySawer: typeof import("saweria-createqr").SumshiiySawer | null = null;
try {
  _SumshiiySawer = require("saweria-createqr").SumshiiySawer;
} catch (err) {
  console.warn("[saweria] failed to load saweria-createqr:", err instanceof Error ? err.message : err);
}

type SaweriaClass = import("saweria-createqr").SumshiiySawer;
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

export class SaweriaProvider implements IPaymentProvider {
  readonly name = "saweria";

  private client: SaweriaClass | null = null;

  private async getClient(): Promise<SaweriaClass> {
    if (!_SumshiiySawer) {
      throw new Error(
        "Saweria provider unavailable. The saweria-createqr module failed to load " +
        "(likely a node-cron / startTime issue on this Node version). " +
        "Set PAYMENT_PROVIDER=mock or install a Node version compatible with saweria-createqr.",
      );
    }
    if (this.client) return this.client;
    const env = getEnv();
    if (!env.SAWERIA_USERNAME || !env.SAWERIA_EMAIL || !env.SAWERIA_PASSWORD) {
      throw new Error(
        "Saweria credentials missing. Set SAWERIA_USERNAME, SAWERIA_EMAIL, SAWERIA_PASSWORD.",
      );
    }
    const sawer = new _SumshiiySawer({
      username: env.SAWERIA_USERNAME,
      email: env.SAWERIA_EMAIL,
      password: env.SAWERIA_PASSWORD,
    });
    await sawer.login();
    this.client = sawer;
    return this.client;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const sawer = await this.getClient();
    const res = (await sawer.createPaymentQr(input.amount, input.expirationMinutes)) as SaweriaCreateResponse;
    return {
      providerTransactionId: res.trx_id,
      amount: input.amount,
      qrString: res.qr_string ?? null,
      qrImageUrl: res.qr_image ?? null,
      paymentUrl: res.invoice_url ?? null,
      expiresAt: new Date(res.expired_in),
      raw: res,
    };
  }

  parseWebhook(_headers: Record<string, string>, body: unknown): NormalizedWebhook {
    // The actual Saweria webhook payload (per saweria.co dashboard documentation):
    // {
    //   "version": "2022.01",
    //   "created_at": "2021-01-01T12:00:00+00:00",
    //   "id": "00000000-0000-0000-0000-000000000000",
    //   "type": "donation",
    //   "amount_raw": 69420,
    //   "cut": 3471,
    //   "donator_name": "Someguy",
    //   "donator_email": "someguy@example.com",
    //   "donator_is_user": false,
    //   "message": "...",
    //   "etc": { "amount_to_display": 69420 }
    // }
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
      referenceId:
        typeof payload.id === "string" ? payload.id : undefined,
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

  async setWebhook(url: string): Promise<unknown> {
    const env = getEnv();
    const sawer = await this.getClient();
    // setWebhook() in the package is a no-arg call that registers the webhook
    // to the APP_URL configured in env. Documented behaviour.
    if (!env.APP_URL) return { skipped: true, reason: "APP_URL not set" };
    return sawer.setWebhook();
  }
}