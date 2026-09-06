import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

const words = ["QRIS", "payments", "webhooks", "settlements", "subscriptions", "transfers"];

export default async function Home() {
  const user = await getSessionUser();

  return (
    <div>
      <section className="max-w-6xl mx-auto px-6 pt-28 pb-24">
        <div className="chip fade-up">v1.0 · production</div>
        <h1 className="mt-8 text-6xl md:text-8xl font-semibold tracking-tighter leading-[0.95] fade-up fade-up-1">
          A payment gateway
          <br />
          for Indonesian{" "}
          <span className="text-white/40">internet.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-white/60 fade-up fade-up-2">
          QRIS Engine exposes your Saweria account through a single REST API.
          Create payments, return a QR, receive webhooks, settle funds.
          No SDK. No iframe. Just <span className="text-white">HTTP</span>.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3 fade-up fade-up-3">
          <Link href="/docs" className="btn btn-primary">Read the docs</Link>
          {!user && <Link href="/register" className="btn btn-ghost">Create account</Link>}
          {user && <Link href="/dashboard" className="btn btn-ghost">Open dashboard</Link>}
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
          {[
            { k: "99.9%", v: "Webhook delivery" },
            { k: "<300ms", v: "Median create-payment" },
            { k: "IDR", v: "Native currency" },
          ].map((s) => (
            <div key={s.k} className="bg-black p-8">
              <div className="text-4xl font-semibold tracking-tight">{s.k}</div>
              <div className="mt-2 text-sm text-white/50">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 py-6 overflow-hidden">
        <div className="flex gap-12 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-12 text-white/30 text-sm">
              {words.map((w) => (
                <span key={w} className="flex items-center gap-12">
                  <span>{w}</span>
                  <span>·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <h2 className="text-4xl tracking-tight">Built for integration.</h2>
          <p className="mt-4 text-white/60 max-w-md">
            One POST creates a transaction. One webhook tells you it paid.
            Everything is signed, idempotent, and scoped to your account.
          </p>
        </div>
        <div className="card p-6">
          <div className="text-xs text-white/40 mb-3">POST /api/v1/payments</div>
          <pre className="mono text-[12.5px] leading-relaxed text-white/80 overflow-x-auto">
{`curl -X POST $API_URL/api/v1/payments \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "X-User-Id: $USER_ID" \\
  -H "Idempotency-Key: ORDER-1" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25000,
    "reference_id": "ORDER-1",
    "customer_name": "Budi"
  }'`}
          </pre>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { t: "Per-account keys", d: "Every account gets its own API key and public key. Keys are stored hashed." },
          { t: "Per-account scope", d: "Transactions are scoped to the owning user. No cross-account reads." },
          { t: "Saweria-native", d: "Powered by the official saweria-createqr library. No headless browsers." },
          { t: "Webhook idempotency", d: "Saweria can retry. We dedupe by event id and never double-fulfill." },
          { t: "Amount validation", d: "Underpaid webhooks are recorded but never mark a transaction paid." },
          { t: "Telegram alerts", d: "Receive a clean payment notification the moment a webhook fires." },
        ].map((f) => (
          <div key={f.t} className="card p-6">
            <div className="text-white">{f.t}</div>
            <div className="mt-2 text-sm text-white/50">{f.d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}