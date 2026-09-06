import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { ensureInitialAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "QRIS Engine — Payment Gateway API",
  description: "Production payment gateway. QRIS as a service. One simple REST API.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Best-effort bootstrap of an initial admin from env (only runs once when DB has none).
  // Suppress errors here so a missing/misconfigured Supabase does not crash the
  // whole UI; the relevant routes will surface the misconfig themselves.
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try { await ensureInitialAdmin(); } catch { /* noop */ }
  try { user = await getSessionUser(); } catch { /* noop */ }

  return (
    <html lang="en">
      <body>
        <header className="border-b border-white/10 relative z-10 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-medium">
              <span className="w-2 h-2 bg-white rounded-full" />
              <span className="tracking-tight">QRIS Engine</span>
            </Link>
            <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
              <Link href="/docs" className="hover:text-white">Docs</Link>
              {user && <Link href="/dashboard" className="hover:text-white">Dashboard</Link>}
              {user?.role === "ADMIN" && <Link href="/admin" className="hover:text-white">Admin</Link>}
              {!user && <Link href="/login" className="hover:text-white">Sign in</Link>}
              {!user && <Link href="/register" className="btn btn-primary !h-9 !px-4 !text-[13px]">Get API key</Link>}
              {user && (
                <div className="flex items-center gap-3 text-white/70">
                  <span className="text-xs mono">{user.email}</span>
                  <LogoutButton />
                </div>
              )}
            </nav>
          </div>
        </header>
        <main className="relative z-10">{children}</main>
        <footer className="relative z-10 border-t border-white/10 mt-32">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
            <div>QRIS Engine · Payment gateway for Indonesia</div>
            <div>Powered by Saweria</div>
          </div>
        </footer>
      </body>
    </html>
  );
}