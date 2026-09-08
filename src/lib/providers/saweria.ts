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
  id?: string;
  code?: number;
  trx_id: string;
  status: string;
  amount?: number;
  invoice_url?: string;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saweriaFetch(
  input: RequestInfo,
  init: RequestInit = {},
  retries = 3,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (!res.ok && res.status >= 500 && attempt < retries - 1) {
        await delay(500 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries - 1) {
        await delay(500 * (attempt + 1));
      }
    }
  }
  throw lastError ?? new Error("Saweria request failed");
}

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
    const loginResultAny = loginResult as { status?: boolean; error?: string } | null;
    if (loginResultAny?.status === false) {
      const reason = loginResultAny.error ?? "Unknown login failure";
      const msg = String(reason);
      if (msg.includes("403") || msg.includes("Attention Required") || msg.includes("blocked")) {
        throw new Error(
          `Saweria access blocked from Vercel IP. This is a Cloudflare block. ` +
          `Use SAWERIA_USER_ID env var and set PAYMENT_PROVIDER=mock, or deploy through a proxy/VPS. ` +
          `Original: ${msg}`,
        );
      }
      throw new Error(`Saweria login failed: ${msg}`);
    }
    this.client = sawer as {
      login: () => Promise<unknown>;
      createPaymentQr: (amount: number, duration: number) => Promise<SaweriaCreateResponse>;
      cekPaymentV2: (trxId: string) => Promise<SaweriaStatusResponse>;
      setWebhook: () => Promise<unknown>;
    };
    return this.client;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const env = getEnv();
    const proxyBase = env.SAWERIA_PROXY_URL?.replace(/\/$/, "");

    if (proxyBase && env.SAWERIA_USER_ID) {
      const loginRes = await saweriaFetch(`${proxyBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: env.SAWERIA_EMAIL,
          password: env.SAWERIA_PASSWORD,
        }),
      });

      if (!loginRes.ok) {
        const text = await loginRes.text().catch(() => "login failed");
        throw new Error(`Saweria login failed (${loginRes.status}): ${text}`);
      }

      const loginJson = (await loginRes.json()) as { data: { jwt: string } };
      const jwt = loginJson.data.jwt;

      const createRes = await saweriaFetch(
        `${proxyBase}/donations/${encodeURIComponent(env.SAWERIA_USER_ID)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwt,
          },
          body: JSON.stringify({
            agree: true,
            notUnderage: true,
            message: "Pembayaran QRIS",
            amount: Math.round(input.amount),
            payment_type: "qris",
            vote: "",
            currency: "IDR",
            customer_info: {
              first_name: input.customerName ?? "",
              email: input.customerEmail ?? env.SAWERIA_EMAIL ?? "",
              phone: "",
            },
          }),
        },
      );

      if (!createRes.ok) {
        const text = await createRes.text().catch(() => "create payment failed");
        throw new Error(`Saweria create payment failed (${createRes.status}): ${text}`);
      }

      const created = (await createRes.json()) as { data: { id: string; qr_string: string; amount_raw: number; created_at: string } };
      const qrString = created.data.qr_string ?? null;
      const qrImageUrl = qrString
        ? `data:image/png;base64,${await generateQrDataUrl(qrString)}`
        : null;

      return {
        providerTransactionId: created.data.id,
        amount: input.amount,
        qrString,
        qrImageUrl,
        paymentUrl: `https://saweria.co/qris/${created.data.id}`,
        expiresAt: new Date(Date.now() + input.expirationMinutes * 60_1000),
        raw: created,
      };
    }

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
    const env = getEnv();
    const proxyBase = env.SAWERIA_PROXY_URL?.replace(/\/$/, "");
    if (proxyBase) {
      const loginRes = await saweriaFetch(`${proxyBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: env.SAWERIA_EMAIL,
          password: env.SAWERIA_PASSWORD,
        }),
      });

      if (!loginRes.ok) {
        const text = await loginRes.text().catch(() => "login failed");
        throw new Error(`Saweria login failed (${loginRes.status}): ${text}`);
      }

      const loginJson = (await loginRes.json()) as { data: { jwt: string } };
      const jwt = loginJson.data.jwt;

      const res = await saweriaFetch(
        `${proxyBase}/transactions?page=1&page_size=15&q=${encodeURIComponent(transactionId)}`,
        {
          headers: { Authorization: jwt },
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "status check failed");
        throw new Error(`Saweria status check failed (${res.status}): ${text}`);
      }

      const json = (await res.json()) as { data: { transactions: SaweriaStatusResponse[] } };
      const tx = json.data.transactions.find((t) => t.id === transactionId);

      if (!tx) {
        return {
          provider: this.name,
          eventId: transactionId,
          eventType: "unknown",
          providerTransactionId: transactionId,
          referenceId: transactionId,
          payload: { not_found: true },
        };
      }

      const isPaid = tx.status === "Paid";
      const isExpired = tx.status === "Expired";

      return {
        provider: this.name,
        eventId: transactionId,
        eventType: isPaid ? "donation" : isExpired ? "expired" : "pending",
        providerTransactionId: tx.id,
        referenceId: tx.id,
        amount: tx.amount,
        rawAmount: tx.amount,
        payload: tx,
      };
    }

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
    const env = getEnv();
    const proxyBase = env.SAWERIA_PROXY_URL?.replace(/\/$/, "");
    if (proxyBase) {
      const loginRes = await saweriaFetch(`${proxyBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: env.SAWERIA_EMAIL,
          password: env.SAWERIA_PASSWORD,
        }),
      });

      if (!loginRes.ok) {
        const text = await loginRes.text().catch(() => "login failed");
        throw new Error(`Saweria login failed (${loginRes.status}): ${text}`);
      }

      const loginJson = (await loginRes.json()) as { data: { jwt: string } };
      const jwt = loginJson.data.jwt;

      const res = await saweriaFetch(`${proxyBase}/callbacks/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwt,
        },
        body: JSON.stringify({ active: true, endpoint: url }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "set webhook failed");
        throw new Error(`Saweria set webhook failed (${res.status}): ${text}`);
      }

      return res.json().catch(() => ({ status: true }));
    }

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

async function generateQrDataUrl(text: string): Promise<string> {
  const QRCode = await import("qrcode");
  const buffer = await QRCode.toBuffer(text, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
  return buffer.toString("base64");
}
