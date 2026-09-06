"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApiKeyCard({ hasKey, prefix, publicKey }: { hasKey: boolean; prefix: string | null; publicKey: string }) {
  const router = useRouter();
  const [reveal, setReveal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function mint() {
    setBusy(true);
    const r = await fetch("/api/v1/me/api-key", { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (r.ok) setReveal(j.data.api_key);
    router.refresh();
  }
  async function revoke() {
    if (!confirm("Revoke API key? Existing integrations will stop working.")) return;
    setBusy(true);
    await fetch("/api/v1/me/api-key", { method: "DELETE" });
    setBusy(false);
    setReveal(null);
    router.refresh();
  }

  return (
    <div className="card p-6">
      <div className="text-xs text-white/40 mb-1">Integration credentials</div>
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div>
          <div className="text-white/40 text-xs mb-1">ID-USERS (your account id)</div>
          <div className="mono text-sm break-all">— revealed in docs after sign in</div>
        </div>
        <div>
          <div className="text-white/40 text-xs mb-1">APIKEY (server-side, never expose to browser)</div>
          <div className="mono text-sm">
            {reveal ? (
              <div className="space-y-2">
                <div className="break-all bg-white/5 border border-white/10 rounded-md p-2">{reveal}</div>
                <div className="text-xs text-amber-300">Save this now — it will not be shown again.</div>
              </div>
            ) : hasKey ? (
              <div className="text-white/70">Active · prefix <span className="mono">{prefix}</span></div>
            ) : (
              <div className="text-white/40">No key yet.</div>
            )}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="text-white/40 text-xs mb-1">PUBLIC-KEY (client-side, safe to embed in browser)</div>
          <div className="mono text-sm break-all bg-white/5 border border-white/10 rounded-md p-2">{publicKey}</div>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button onClick={mint} disabled={busy} className="btn btn-primary">{hasKey ? "Rotate key" : "Generate key"}</button>
        {hasKey && <button onClick={revoke} disabled={busy} className="btn btn-ghost">Revoke</button>}
      </div>
    </div>
  );
}