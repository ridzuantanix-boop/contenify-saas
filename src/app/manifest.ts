import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AffiMatik Admin & CRM',
    short_name: 'AffiMatik Admin',
    description: 'Pusat operasi mudah alih AffiMatik untuk pelanggan, jualan, pembayaran, affiliate dan Smart Queue.',
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    categories: ['business', 'productivity', 'finance'],
    icons: [
      { src: '/admin-pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/admin-pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Admin Dashboard', short_name: 'Dashboard', url: '/admin', icons: [{ src: '/admin-pwa-icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'CRM Pelanggan', short_name: 'CRM', url: '/admin?tab=users', icons: [{ src: '/admin-pwa-icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Pembayaran', short_name: 'Bayaran', url: '/admin/finance-ops', icons: [{ src: '/admin-pwa-icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Affiliate', short_name: 'Affiliate', url: '/admin/affiliates', icons: [{ src: '/admin-pwa-icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
