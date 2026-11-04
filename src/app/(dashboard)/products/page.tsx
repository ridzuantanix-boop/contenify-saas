import React from 'react';
import { ShoppingBag, Plus, Folder, Search } from 'lucide-react';

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Product Library</h2>
          <p className="text-sm text-slate-500 mt-1">
            Simpan gambar produk, tangkap layar TikTok/Shopee, fakta disahkan, dan tuntutan larangan iklan.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-xs hover:bg-indigo-700 transition">
          <Plus className="w-4 h-4" />
          <span>Tambah Produk Baharu</span>
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800">Tiada Produk Disimpan Lagi</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Daftarkan produk dan muat naik gambar untuk membolehkan enjin kecerdasan produk AffiMatik menjalankan analisis automatik.
        </p>
      </div>
    </div>
  );
}
