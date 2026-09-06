import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { getSessionUser } from "@/lib/auth";
import { ApiKeyCard } from "@/components/ApiKeyCard";
import { shapeTransaction } from "@/lib/shape";
import Link from "next/link";
import type { PaymentTransaction, User } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const admin = getSupabaseAdmin();
  const { data: dbUser } = await admin
    .from("users")
    .select("id, email, name, public_key, api_key_hash, api_key_prefix")
    .eq("id", user.id)
    .maybeSingle<User>();
  if (!dbUser) redirect("/login");

  const { data: txs } = await admin
    .from("payment_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const txsShaped = await Promise.all((txs ?? []).map((t) => shapeTransaction(t as PaymentTransaction)));

  const { data: allRows } = await admin
    .from("payment_transactions")
    .select("status, amount")
    .eq("user_id", user.id);
  const all = allRows ?? [];
  const totalRevenue = all.filter((t) => t.status === "paid").reduce((s, t) => s + t.amount, 0);
  const paid = all.filter((t) => t.status === "paid").length;
  const pending = all.filter((t) => t.status === "pending").length;

  const fmtIDR = (n: number) => "Rp" + n.toLocaleString("id-ID");

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-end justify-between flex-wrap gap-3 fade-up">
        <div>
          <div className="text-white/40 text-xs mono">{user.id}</div>
          <h1 className="text-3xl tracking-tight mt-1">Hello, {user.name}</h1>
        </div>
        <Link href="/docs" className="btn btn-ghost">View docs</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden mt-10">
        {[
          { k: fmtIDR(totalRevenue), v: "Total revenue" },
          { k: all.length, v: "Transactions" },
          { k: paid, v: "Paid" },
          { k: pending, v: "Pending" },
        ].map((s) => (
          <div key={s.v} className="bg-black p-6">
            <div className="text-2xl font-semibold tracking-tight">{s.k}</div>
            <div className="text-xs text-white/50 mt-1">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 fade-up fade-up-2">
        <ApiKeyCard
          hasKey={!!dbUser.api_key_hash}
          prefix={dbUser.api_key_prefix}
          publicKey={dbUser.public_key}
        />
      </div>

      <h2 className="text-xl tracking-tight mt-12 mb-3">Recent transactions</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr>
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {txsShaped.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">No transactions yet.</td></tr>
            )}
            {txsShaped.map((t) => (
              <tr key={t.transaction_id} className="text-white/80">
                <td className="px-4 py-3 mono text-xs">{t.transaction_id}</td>
                <td className="px-4 py-3 mono text-xs">{t.reference_id}</td>
                <td className="px-4 py-3">{fmtIDR(t.amount)}</td>
                <td className="px-4 py-3"><span className="chip">{t.status}</span></td>
                <td className="px-4 py-3 text-white/50 text-xs">{new Date(t.created_at).toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}