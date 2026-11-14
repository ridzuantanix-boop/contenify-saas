import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://affimatik.online'),
  title: 'AffiMatik — Jana Video Affiliate Dari Gambar Produk',
  description: 'Upload gambar produk, pilih gaya dan jana video affiliate 15 saat. Mula dengan Launch Pack RM19 untuk sehingga 15 video, tanpa langganan automatik.',
  keywords: ['video affiliate', 'TikTok Shop Malaysia', 'AI video produk', 'video affiliate Malaysia', 'AffiMatik'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ms_MY',
    url: '/',
    siteName: 'AffiMatik by Pawarna',
    title: 'Penat Nak Buat Video Affiliate Satu-Satu?',
    description: 'Upload gambar produk, pilih gaya dan biar AI hasilkan video affiliate 15 saat. Launch Pack RM19, bayaran sekali sahaja.',
    images: [{ url: '/marketing/affimatik-og.jpg', width: 1200, height: 630, alt: 'Contoh produk untuk video affiliate AffiMatik' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AffiMatik — Video Affiliate Dari Gambar Produk',
    description: 'Launch Pack RM19 untuk sehingga 15 video affiliate 15 saat.',
    images: ['/marketing/affimatik-og.jpg'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AffiMatik' },
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
