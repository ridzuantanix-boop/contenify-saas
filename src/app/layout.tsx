import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AffiMatik by Pawarna — Affiliate Jadi Automatik',
  description: 'Jana video produk dengan 13 gaya AffiMatik Voice dan Motion. Muat naik imej, pilih gaya dan simpan MP4 dalam pustaka anda.',
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
