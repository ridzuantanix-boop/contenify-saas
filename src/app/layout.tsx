import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://affimatik.online'),
  title: 'AffiMatik — 30 Gaya Video Affiliate Dengan Avatar & Background Sendiri',
  description: 'Upload gambar produk, pilih daripada 30 gaya, personalize avatar atau background dan jana video affiliate Bahasa Melayu melalui Nexabot. Launch Pack RM19.',
  keywords: ['30 gaya video affiliate', 'TikTok Shop Malaysia', 'AI video produk', 'avatar video affiliate', 'video affiliate Malaysia', 'AffiMatik'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ms_MY',
    url: '/',
    siteName: 'AffiMatik by Pawarna',
    title: '30 Gaya Video Affiliate. Pilih, Personalize & Jana.',
    description: 'Upload produk, pilih gaya dan gunakan avatar atau background sendiri untuk video affiliate Bahasa Melayu. Launch Pack RM19, bayaran sekali sahaja.',
    images: [{ url: '/marketing/affimatik-og.jpg', width: 1200, height: 630, alt: 'Contoh produk untuk video affiliate AffiMatik' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AffiMatik — 30 Gaya Video Affiliate',
    description: 'Pilih 30 gaya dan personalize avatar atau background sendiri. Launch Pack RM19 untuk sehingga 15 video.',
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
