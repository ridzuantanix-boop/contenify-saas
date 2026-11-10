import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AffiMatik by Pawarna — Affiliate Jadi Automatik',
  description: 'Jana video produk dengan 20 gaya AffiMatik Voice V6. Muat naik imej, pilih gaya dan simpan MP4 dalam pustaka anda.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AffiMatik Admin' },
  icons: { icon: [{ url: '/admin-pwa-icon-192.png', sizes: '192x192', type: 'image/png' }], apple: [{ url: '/admin-pwa-icon-192.png', sizes: '192x192', type: 'image/png' }] },
};

export const viewport: Viewport = { themeColor: '#4f46e5' };

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
