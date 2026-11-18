import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://affimatik.online'),
  title: 'AffiMatik — Tukar Gambar Produk Jadi Video Affiliate',
  description: 'Banyak produk nak promote tapi tak sempat buat video? Upload gambar, pilih daripada 30 gaya dan jana video affiliate dengan suara BM. Cuba 15 video dengan Launch Pack RM19.',
  keywords: ['30 gaya video affiliate', 'TikTok Shop Malaysia', 'AI video produk', 'avatar video affiliate', 'video affiliate Malaysia', 'AffiMatik'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ms_MY',
    url: '/',
    siteName: 'AffiMatik by Pawarna',
    title: 'Banyak Produk Nak Promote, Tapi Tak Sempat Buat Video?',
    description: 'Upload gambar produk, pilih gaya dan jana video affiliate dengan suara BM. Ada 30 gaya, avatar sendiri dan Auto Factory.',
    images: [{ url: '/marketing/affimatik-og.jpg', width: 1200, height: 630, alt: 'Contoh produk untuk video affiliate AffiMatik' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AffiMatik — Gambar Produk Jadi Video Affiliate',
    description: 'Upload gambar, pilih 30 gaya dan jana video affiliate dengan suara BM. Launch Pack RM19 untuk sehingga 15 video.',
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
