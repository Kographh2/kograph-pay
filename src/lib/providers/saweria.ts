import { getEnv } from "@/lib/env";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  IPaymentProvider,
  NormalizedWebhook,
} from "./types";

type SaweriaLoginResponse = {
  data: {
    username: string;
    email: string;
    jwt: string;
  };
};

type SaweriaCreatePaymentResponse = {
  data: {
    id: string;
    qr_string: string;
    amount_raw: number;
    created_at: string;
  };
};

type SaweriaTransaction = {
  id: string;
  status: string;
  amount_raw: number;
  created_at: string;
};

const BASE_URL = "https://backend.saweria.co";
const FRONT_URL = "https://saweria.co";

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

  private jwtCache: { token: string; expiresAt: number } | null = null;

  private async ensureJwt(): Promise<string> {
    const env = getEnv();
    if (!env.SAWERIA_USERNAME || !env.SAWERIA_EMAIL || !env.SAWERIA_PASSWORD) {
      throw new Error(
        "Saweria credentials missing. Set SAWERIA_USERNAME, SAWERIA_EMAIL, SAWERIA_PASSWORD.",
      );
    }

    if (this.jwtCache && Date.now() < this.jwtCache.expiresAt) {
      return this.jwtCache.token;
    }

    const loginRes = await saweriaFetch(`${BASE_URL}/auth/login`, {
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

    const loginJson = (await loginRes.json()) as SaweriaLoginResponse;
    const token = loginJson.data.jwt;
    const expiresAt = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
    this.jwtCache = { token, expiresAt };
    return token;
  }

  private async getUserId(): Promise<string> {
    const env = getEnv();
    if (!env.SAWERIA_USERNAME) {
      throw new Error("SAWERIA_USERNAME is required to resolve the Saweria user id.");
    }

    const profileRes = await saweriaFetch(`${FRONT_URL}/${env.SAWERIA_USERNAME}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!profileRes.ok) {
      throw new Error(
        `Failed to fetch Saweria profile for @${env.SAWERIA_USERNAME} (${profileRes.status}).`,
      );
    }

    const html = await profileRes.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      throw new Error("Saweria profile page did not contain __NEXT_DATA__. Account may be missing or private.");
    }

    const nextData = JSON.parse(match[1]) as Record<string, unknown>;
    const pageProps = (nextData.props as Record<string, unknown> | undefined)?.pageProps as
      | Record<string, unknown>
      | undefined;
    const data = (pageProps?.data as Record<string, unknown> | undefined) ?? {};
    const userId = data.id as string | undefined;
    if (!userId) {
      throw new Error("Saweria user id not found in profile page data.");
    }
    return userId;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const env = getEnv();
    const jwt = await this.ensureJwt();
    const userId = await this.getUserId();

    const createRes = await saweriaFetch(`${BASE_URL}/donations/${encodeURIComponent(userId)}`, {
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
    });

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => "create payment failed");
      throw new Error(`Saweria create payment failed (${createRes.status}): ${text}`);
    }

    const created = (await createRes.json()) as SaweriaCreatePaymentResponse;
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
      expiresAt: new Date(Date.now() + input.expirationMinutes * 60 * 1000),
      raw: created,
    };
  }

  async checkPaymentStatus(transactionId: string): Promise<NormalizedWebhook> {
    const jwt = await this.ensureJwt();
    const res = await saweriaFetch(
      `${BASE_URL}/transactions?page=1&page_size=15&q=${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: jwt },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "status check failed");
      throw new Error(`Saweria status check failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { data: { transactions: SaweriaTransaction[] } };
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
      amount: tx.amount_raw,
      rawAmount: tx.amount_raw,
      payload: tx,
    };
  }

  async setWebhook(url: string): Promise<unknown> {
    const jwt = await this.ensureJwt();
    const res = await saweriaFetch(`${BASE_URL}/callbacks/webhook`, {
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
