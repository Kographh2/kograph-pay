import { redirect } from "next/navigation";
import { getSessionUser, requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { shapeTransaction } from "@/lib/shape";
import Link from "next/link";
import type { PaymentTransaction, User } from "@/types/db";

export const dynamic = "force-dynamic";

type AdminUser = User & { tx_count?: number };

export default async function AdminPage() {
  // requireAdmin() reads the cookie-based session and redirects if not admin.
  const user = await requireAdmin();
  const admin = getSupabaseAdmin();
  const { data: usersData } = await admin
    .from("users")
    .select("id, email, name, role, active, api_key_prefix, public_key, last_login_at, created_at")
    .order("created_at", { ascending: false });
  const { data: counts } = await admin.from("payment_transactions").select("user_id");
  const tally: Record<string, number> = {};
  for (const r of counts ?? []) tally[r.user_id] = (tally[r.user_id] ?? 0) + 1;
  const users: AdminUser[] = (usersData ?? []).map((u) => ({ ...(u as User), tx_count: tally[u.id] ?? 0 }));

  const { data: txs } = await admin
    .from("payment_transactions")
    .select("*, user:users(id, email, name)")
    .order("created_at", { ascending: false })
    .limit(50);
  type TxWithUser = PaymentTransaction & { user: { id: string; email: string; name: string } | null };
  const txsRows = (txs ?? []) as TxWithUser[];
  const txsShaped = await Promise.all(txsRows.map(async (t) => ({
    ...(await shapeTransaction(t)),
    owner_email: t.user?.email ?? "—",
  })));

  const { count: events } = await admin.from("webhook_events").select("*", { count: "exact", head: true });
  const { data: allRows } = await admin.from("payment_transactions").select("status, amount");
  const all = allRows ?? [];
  const totalRevenue = all.filter((t) => t.status === "paid").reduce((s, t) => s + t.amount, 0);
  const fmtIDR = (n: number) => "Rp" + n.toLocaleString("id-ID");

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="chip fade-up">ADMIN</div>
      <h1 className="text-3xl tracking-tight mt-3 fade-up fade-up-1">Operations</h1>
      <p className="text-white/50 mt-1 fade-up fade-up-1">All users, all transactions, all webhook events.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden mt-10">
        {[
          { k: fmtIDR(totalRevenue), v: "Gross revenue" },
          { k: users.length, v: "Accounts" },
          { k: all.length, v: "Transactions" },
          { k: events ?? 0, v: "Webhook events" },
        ].map((s) => (
          <div key={s.v} className="bg-black p-6">
            <div className="text-2xl font-semibold tracking-tight">{s.k}</div>
            <div className="text-xs text-white/50 mt-1">{s.v}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl tracking-tight mt-12 mb-3">Users</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">API Key</th>
              <th className="px-4 py-3">Public Key</th>
              <th className="px-4 py-3">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white/80">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 mono text-xs">{u.email}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3"><span className="chip">{u.role}</span></td>
                <td className="px-4 py-3 mono text-xs">{u.api_key_prefix ?? "—"}</td>
                <td className="px-4 py-3 mono text-xs">{u.public_key.slice(0, 16)}…</td>
                <td className="px-4 py-3">{u.tx_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl tracking-tight mt-12 mb-3">All transactions</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white/80">
            {txsShaped.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">No transactions yet.</td></tr>
            )}
            {txsShaped.map((t) => (
              <tr key={t.transaction_id}>
                <td className="px-4 py-3 mono text-xs">{t.owner_email}</td>
                <td className="px-4 py-3 mono text-xs">{t.transaction_id}</td>
                <td className="px-4 py-3">{fmtIDR(t.amount)}</td>
                <td className="px-4 py-3"><span className="chip">{t.status}</span></td>
                <td className="px-4 py-3 text-white/50 text-xs">{new Date(t.created_at).toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/40 mt-8">
        Provider credentials (Saweria) are configured via environment variables only. They are not exposed in this UI.
      </p>
      <p className="text-xs text-white/40 mt-1">
        OpenAPI spec lives at <Link href="/openapi.yaml" className="underline">/openapi.yaml</Link>.
      </p>
    </div>
  );
}