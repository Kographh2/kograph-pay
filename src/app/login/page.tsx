"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error?.message ?? "Login failed"); return; }
    router.push(next);
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-3 fade-up fade-up-2">
      <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {err && <div className="text-sm text-rose-400">{err}</div>}
      <button disabled={busy} className="btn btn-primary w-full">{busy ? "Signing in..." : "Sign in"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="text-3xl tracking-tight fade-up">Sign in</h1>
      <p className="text-white/50 mt-2 fade-up fade-up-1">Access your dashboard and API keys.</p>
      <Suspense fallback={<div className="mt-10 text-sm text-white/50">Loading...</div>}>
        <LoginForm />
      </Suspense>
      <div className="mt-6 text-sm text-white/50 fade-up fade-up-3">
        No account? <Link href="/register" className="text-white underline">Register</Link>
      </div>
    </div>
  );
}