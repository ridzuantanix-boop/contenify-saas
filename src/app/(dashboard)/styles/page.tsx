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
} from 'lucide-react';
import { VIDEO_STYLES_REGISTRY, filterVideoStyles } from '@/lib/styles/registry';
import { VideoStyle, StyleCategory } from '@/lib/styles/types';

export default function VideoStylesPage() {
  const [selectedCategory, setSelectedCategory] = useState<StyleCategory>('all');
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'with_voice' | 'no_voice'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | '10' | '15'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['NX01', 'RH01']);

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
  const verifiedCount = VIDEO_STYLES_REGISTRY.filter((s) => s.qualityStatus === 'quality_verified').length;
  const validatedCount = VIDEO_STYLES_REGISTRY.filter((s) => s.qualityStatus === 'prompt_validated').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Video Style Library</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              {totalStylesCount} Gaya Rasmi ({verifiedCount} Quality Verified, {validatedCount} Prompt Validated)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Koleksi gaya video AI yang terbukti berkesan untuk affiliate TikTok & Shopee Malaysia. Tanpa perlu prompt manual.
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
              <option value="with_voice">Dengan Suara (Nexabot 10s)</option>
              <option value="no_voice">Tanpa Suara (RunningHub 15s)</option>
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
          {[
            { id: 'all', label: 'Semua Gaya' },
            { id: 'creator_review', label: 'Creator & Review' },
            { id: 'hand_demo', label: 'Hand Demo' },
            { id: 'problem_solution', label: 'Problem & Solution' },
            { id: 'lifestyle', label: 'Lifestyle & Harian' },
          ].map((cat) => (
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
          const hasVoice = style.audioMode === 'spoken_bm';

          return (
            <div
              key={style.id}
              className="group bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden hover:border-indigo-300"
            >
              {/* Card Media Preview Header */}
              <div className="relative aspect-[9/12] bg-slate-900 overflow-hidden flex items-center justify-center">
                {style.previewVideoUrl ? (
                  <video
                    src={style.previewVideoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mb-2 text-indigo-400">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{style.name}</span>
                    <span className="text-[10px] text-slate-500 mt-1">Ujian QA Disahkan</span>
                  </div>
                )}

                {/* Badges on preview */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                  <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    {style.durationSeconds}s
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md backdrop-blur-md text-[10px] font-bold flex items-center gap-1 ${
                      hasVoice ? 'bg-indigo-600/80 text-white' : 'bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    {hasVoice ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    {hasVoice ? 'Spoken BM' : 'No Voice'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => toggleFavorite(style.id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md transition z-10"
                >
                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
                </button>

                <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] text-slate-200 truncate">
                  Enjin: <strong className="text-white uppercase">{style.engine}</strong> • {style.actionType.replace(/_/g, ' ')}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                      {style.id}
                    </span>
                    {style.qualityStatus === 'quality_verified' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Quality Verified
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-200 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Prompt Validated
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{style.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {style.benefit}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {style.durationSeconds === 10 ? '10 Kredit' : '15 Kredit'}
                  </span>
                  <Link
                    href={`/factory?styleId=${style.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-xs font-semibold transition"
                  >
                    <span>Guna Gaya Ini</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
