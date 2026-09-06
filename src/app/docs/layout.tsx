import Link from "next/link";

const sections = [
  { slug: "getting-started", title: "Getting Started" },
  { slug: "authentication", title: "Authentication" },
  { slug: "create-payment", title: "Create Payment" },
  { slug: "payment-status", title: "Payment Status" },
  { slug: "qr-code", title: "QR Code" },
  { slug: "webhooks", title: "Webhooks" },
  { slug: "errors", title: "Errors" },
  { slug: "examples", title: "Examples" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-[220px_1fr] gap-10">
      <aside className="md:sticky md:top-20 self-start">
        <div className="text-xs uppercase tracking-widest text-white/40 mb-3">Docs</div>
        <nav className="flex flex-col gap-1">
          {sections.map((s) => (
            <Link key={s.slug} href={`/docs/${s.slug}`} className="text-sm text-white/70 hover:text-white px-2 py-1.5 rounded hover:bg-white/5">{s.title}</Link>
          ))}
        </nav>
      </aside>
      <article className="prose-doc">
        {children}
        <style>{`
          .prose-doc h1 { color: #fff; font-size: 2rem; font-weight: 600; margin-top: 1rem; letter-spacing: -0.02em; }
          .prose-doc h2 { color: #fff; font-size: 1.25rem; font-weight: 600; margin-top: 2rem; }
          .prose-doc p, .prose-doc li { color: #cfd3dc; line-height: 1.75; }
          .prose-doc code { background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: #fff; font-size: 0.85em; }
          .prose-doc pre { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.08); padding: 16px; border-radius: 10px; overflow-x: auto; }
          .prose-doc pre code { background: transparent; padding: 0; color: #e6e8ee; }
          .prose-doc a { color: #fff; }
          .prose-doc strong { color: #fff; }
        `}</style>
      </article>
    </div>
  );
}