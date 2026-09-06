"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [errHint, setErrHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setErrHint(null);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErr(j.error?.message ?? "Registration failed");
      const hint = j.error?.details?.hint;
      if (typeof hint === "string") setErrHint(hint);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="text-3xl tracking-tight fade-up">Create account</h1>
      <p className="text-white/50 mt-2 fade-up fade-up-1">
        You will be registered as <span className="text-white">USER</span>. Admin roles are provisioned manually.
      </p>
      <form onSubmit={submit} className="mt-10 space-y-3 fade-up fade-up-2">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={60} />
        <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" placeholder="Password (min 8 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {err && (
          <div className="text-sm text-rose-400 space-y-1">
            <div>{err}</div>
            {errHint && <div className="text-rose-300/70 text-xs">{errHint}</div>}
          </div>
        )}
        <button disabled={busy} className="btn btn-primary w-full">{busy ? "Creating..." : "Create account"}</button>
      </form>
      <div className="mt-6 text-sm text-white/50 fade-up fade-up-3">
        Already have an account? <Link href="/login" className="text-white underline">Sign in</Link>
      </div>
    </div>
  );
}
