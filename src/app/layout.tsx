import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CONTENIFY — Malaysian AI Video Automation SaaS',
  description: 'Production-quality AI video production for Malaysian affiliates, creators, and sellers.',
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
