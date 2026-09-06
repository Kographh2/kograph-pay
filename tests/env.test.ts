import { test } from "node:test";
import assert from "node:assert/strict";

test("env loader rejects bad config", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "short";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "short";
  process.env.SESSION_SECRET = "x";
  process.env.PAYMENT_PROVIDER = "saweria";
  delete process.env.SAWERIA_USERNAME;
  delete process.env.SAWERIA_EMAIL;
  delete process.env.SAWERIA_PASSWORD;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  delete require.cache[require.resolve("../src/lib/env")];
  const { getEnv } = require("../src/lib/env");
  assert.throws(() => getEnv());
});

test("env loader accepts good config", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghij.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aGFwcHktYW5vbi1rZXktMTIzNDU2Nzg5MA";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aGFwcHktc2VydmljZS1yb2xlLWtleS0xMjM0NTY3ODkw";
  process.env.SESSION_SECRET = "this-is-long-enough-32-chars";
  process.env.PAYMENT_PROVIDER = "saweria";
  delete require.cache[require.resolve("../src/lib/env")];
  const { getEnv: fresh } = require("../src/lib/env");
  const env = fresh();
  assert.equal(env.PAYMENT_EXPIRATION_MINUTES, 15);
  assert.equal(env.PAYMENT_PROVIDER, "saweria");
  assert.equal(typeof env.NEXT_PUBLIC_SUPABASE_URL, "string");
});

test("shapeTransaction returns snake_case", async () => {
  const { shapeTransaction } = require("../src/lib/shape");
  const shaped = await shapeTransaction({
    transaction_id: "trx_x",
    reference_id: "R1",
    provider: "mock",
    provider_transaction_id: "p1",
    amount: 1000,
    currency: "IDR",
    status: "pending",
    customer_name: null,
    customer_email: null,
    description: null,
    qr_data: "x",
    qr_image_url: "https://example.com/q.png",
    payment_url: "https://example.com/p",
    expires_at: "2026-01-01T00:00:00Z",
    paid_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });
  assert.equal(shaped.transaction_id, "trx_x");
  assert.equal(shaped.reference_id, "R1");
  assert.equal(shaped.amount, 1000);
  assert.equal(shaped.qr_image_url, "https://example.com/q.png");
  assert.equal(typeof shaped.qr_endpoint, "string");
});
