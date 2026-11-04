import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AffiMatik by Pawarna — Affiliate Jadi Automatik',
  description: 'Dari Research Produk, Video AI Hingga Auto-Posting — Semua Dalam Satu Platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
