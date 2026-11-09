'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Heart,
  Layers,
  X,
} from 'lucide-react';
import { VIDEO_STYLES_REGISTRY, filterVideoStyles, STYLE_CATEGORIES_V6 } from '@/lib/styles/registry';
import { VideoStyle, StyleCategory } from '@/lib/styles/types';
import { getStyleMarketingMetadata } from '@/lib/styles/marketing-metadata';
import { StylePosterMedia } from '@/components/styles/style-poster-media';

export default function VideoStylesPage() {
  const [selectedCategory, setSelectedCategory] = useState<StyleCategory>('all');
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'with_voice' | 'no_voice'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | '10' | '15'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['NX01']);
  const [previewStyle, setPreviewStyle] = useState<VideoStyle | null>(null);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredStyles = filterVideoStyles({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    hasVoice: voiceFilter === 'all' ? undefined : voiceFilter === 'with_voice',
    duration: durationFilter === 'all' ? undefined : (Number(durationFilter) as 10 | 15),
    searchQuery: searchQuery.trim() || undefined,
  });

  const totalStylesCount = VIDEO_STYLES_REGISTRY.length;
  const testedCount = VIDEO_STYLES_REGISTRY.filter((s) => s.qualityStatus === 'video_tested').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Video Style Library</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              {testedCount} sampel sebenar · {totalStylesCount} gaya V6
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pilih gaya video dan tonton sampel sebenar sebelum menjana video produk anda.
          </p>
        </div>

        <Link
          href="/factory"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition shadow-sm self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Buka Video Factory</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        {/* Search & Top Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari gaya video (cth: Sembang Kawan, Goyang Produk, Tilt)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Voice filter */}
            <select
              value={voiceFilter}
              onChange={(e) => setVoiceFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Audio</option>
              <option value="with_voice">Dengan Suara (AffiMatik Voice 15s)</option>
              <option value="no_voice">Tanpa suara</option>
            </select>

            {/* Duration filter */}
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Durasi</option>
              <option value="10">10 Saat</option>
              <option value="15">15 Saat</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {STYLE_CATEGORIES_V6.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Styles Grid (9:16 Portrait Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredStyles.map((style) => {
          const isFav = favorites.includes(style.id);
          const hasVoice = style.audioMode !== 'no_speech' && style.audioMode !== 'ambient';
          const metadata = getStyleMarketingMetadata(style.id);
          if (!metadata) return null;

          return (
            <div
              key={style.id}
              className="group bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden hover:border-indigo-300"
            >
              <StylePosterMedia metadata={metadata} onPreview={() => setPreviewStyle(style)} />

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                      {style.id}
                    </span>
                    <button type="button" onClick={(e) => toggleFavorite(style.id, e)} className="rounded-full p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label={`${isFav ? 'Buang' : 'Tambah'} ${metadata.title} daripada kegemaran`}>
                      <Heart className={`h-4 w-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                    {style.qualityStatus === 'video_tested' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Sampel 15s Sebenar
                      </span>
                    ) : style.qualityStatus === 'disabled' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">Tidak tersedia</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-200 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Prompt Disediakan
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{metadata.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {metadata.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{metadata.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{tag}</span>)}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {hasVoice ? '10 Kredit' : 'Coming Soon'}
                  </span>
                  {hasVoice && <Link
                      href={`/factory?styleId=${style.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-xs font-semibold transition"
                    >
                      <span>Guna Gaya Ini</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {previewStyle && (() => {
        const metadata = getStyleMarketingMetadata(previewStyle.id);
        if (!metadata) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Preview ${metadata.title}`}>
            <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
                <div><h3 className="font-bold text-slate-900">{metadata.title}</h3><p className="mt-1 text-xs text-slate-500">{metadata.tagline}</p></div>
                <button type="button" onClick={() => setPreviewStyle(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="Tutup preview"><X className="h-5 w-5" /></button>
              </div>
              <div className="aspect-[9/16] max-h-[70vh] bg-black"><video src={metadata.previewPath} controls autoPlay playsInline preload="metadata" className="h-full w-full object-contain" /></div>
              <div className="flex items-center justify-between gap-3 p-4"><button type="button" onClick={() => setPreviewStyle(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700">Tutup</button><Link href={`/factory?styleId=${previewStyle.id}`} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white">Guna Gaya Ini</Link></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
