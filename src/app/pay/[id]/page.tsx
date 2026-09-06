"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Tx = {
  transaction_id: string;
  reference_id: string;
  amount: number;
  status: "pending" | "paid" | "expired" | "failed";
  expires_at?: string | null;
  paid_at?: string | null;
  qr_image_url?: string;
  payment_url?: string;
};

function PayContent() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const id = params.id;
  const publicKey = sp.get("pk") ?? "";
  const [tx, setTx] = useState<Tx | null>(null);
  const [remaining, setRemaining] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) { setErr("Missing public key."); return; }
    let stop = false;
    const fetchOnce = async () => {
      const r = await fetch(`/api/v1/public/payments/${encodeURIComponent(id)}`, {
        headers: { "X-Public-Key": publicKey },
      });
      if (!r.ok) {
        if (!stop) setErr("Transaction not found");
        return;
      }
      const j = await r.json();
      if (!stop) setTx(j.data);
    };
    fetchOnce();
    const t = setInterval(fetchOnce, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [id, publicKey]);

  useEffect(() => {
    if (!tx?.expires_at) { setRemaining(""); return; }
    const tick = () => {
      const ms = new Date(tx.expires_at!).getTime() - Date.now();
      if (ms <= 0) { setRemaining("expired"); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [tx?.expires_at]);

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <div className="card p-6 text-center">
        <div className="text-xs uppercase tracking-widest text-white/40">QRIS Payment</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">
          Rp{(tx?.amount ?? 0).toLocaleString("id-ID")}
        </div>
        <div className="mt-1 text-sm text-white/60">
          {tx?.status === "paid" ? "Payment received" : err ?? "Awaiting payment..."}
        </div>

        <div className="mt-6 mx-auto inline-flex p-3 bg-white rounded-2xl">
          {tx?.qr_image_url ? (
            <img src={tx.qr_image_url} alt="QRIS" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-zinc-500 text-sm">Loading QR</div>
          )}
        </div>

        <div className="mt-5 text-sm text-white/70">
          {tx?.status === "paid" ? "Done" : `Expires in ${remaining}`}
        </div>
        {tx?.payment_url && tx.status !== "paid" && (
          <a href={tx.payment_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-white/50 hover:text-white">
            Open Saweria invoice ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-6 py-20 text-center text-sm text-white/50">Loading payment...</div>}>
      <PayContent />
    </Suspense>
  );
}