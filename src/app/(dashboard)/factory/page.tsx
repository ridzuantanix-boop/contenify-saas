'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Video,
  Layers,
  Sliders,
  X,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Clock,
  Volume2,
  VolumeX,
  Heart,
  Search,
  Filter,
  Check,
  Zap,
} from 'lucide-react';
import { VIDEO_STYLES_REGISTRY, getVideoStyle, filterVideoStyles } from '@/lib/styles/registry';
import { VideoStyle, StyleCategory } from '@/lib/styles/types';
import { AICreativeDirector } from '@/lib/engine/creative-director';
import { SmartStyleMatcher } from '@/lib/engine/smart-match';

interface UploadedFilePreview {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
}

function VideoFactoryContent() {
  const searchParams = useSearchParams();
  const initialStyleId = searchParams.get('styleId') || 'NX01';

  const [mode, setMode] = useState<'quick' | 'advanced'>('quick');

  // Step 1: Product Assets (Optional details, Auto-Research)
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productFacts, setProductFacts] = useState('');
  const [images, setImages] = useState<UploadedFilePreview[]>([]);

  // Step 2: Selected Video Style
  const [selectedStyleId, setSelectedStyleId] = useState<string>(initialStyleId);
  const [styleCategoryFilter, setStyleCategoryFilter] = useState<StyleCategory>('all');
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'with_voice' | 'no_voice'>('all');
  const [styleSearch, setStyleSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['NX01', 'RH01']);

  // Step 3: Advanced Studio Controls
  const [ctaOption, setCtaOption] = useState<'spoken_button' | 'spoken_bio' | 'none'>('spoken_button');
  const [isMuslimahModest, setIsMuslimahModest] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [customEnvironment, setCustomEnvironment] = useState('');

  // Status & Polling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<string | null>(null);
  const [activeJobProgress, setActiveJobProgress] = useState<number>(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // Selected Style
  const selectedStyle = useMemo(() => {
    return getVideoStyle(selectedStyleId) || VIDEO_STYLES_REGISTRY[0];
  }, [selectedStyleId]);

  // Restore running job from sessionStorage if user reloaded
  useEffect(() => {
    try {
      const savedJob = sessionStorage.getItem('affimatik_active_job');
      if (savedJob) {
        const parsed = JSON.parse(savedJob);
        if (Date.now() - parsed.startTime < 10 * 60 * 1000) {
          setIsSubmitting(true);
          setActiveJobStatus('Menyambung semula semakan status AI...');
          setActiveJobProgress(50);
          setSubmitSuccess(`Menyambung semakan tugasan: ${parsed.providerTaskId} (${parsed.styleName})`);
          
          let pollCount = 0;
          const pollInterval = setInterval(async () => {
            pollCount++;
            try {
              const pollRes = await fetch(`/api/jobs?providerTaskId=${parsed.providerTaskId}&provider=${parsed.providerName}`);
              const pollData = await pollRes.json();
              if (pollData.status === 'COMPLETED' && pollData.output?.videoUrl) {
                clearInterval(pollInterval);
                sessionStorage.removeItem('affimatik_active_job');
                setIsSubmitting(false);
                setActiveJobStatus('Selesai!');
                setActiveJobProgress(100);
                setGeneratedVideoUrl(pollData.output.videoUrl);
              } else if (pollData.status === 'FAILED') {
                clearInterval(pollInterval);
                sessionStorage.removeItem('affimatik_active_job');
                setIsSubmitting(false);
                setSubmitError(`Penjanaan video gagal: ${pollData.rawStatus || 'Ralat tidak diketahui'}`);
              } else {
                setActiveJobProgress((prev) => Math.min(prev + 5, 90));
                setActiveJobStatus(`Sedang diproses (${pollData.rawStatus || 'rendering'})...`);
              }
            } catch {
              // ignore
            }

            if (pollCount > 60) {
              clearInterval(pollInterval);
              sessionStorage.removeItem('affimatik_active_job');
              setIsSubmitting(false);
            }
          }, 4000);

          return () => clearInterval(pollInterval);
        } else {
          sessionStorage.removeItem('affimatik_active_job');
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Product Profile & Smart Style Match
  const productProfile = useMemo(() => {
    return AICreativeDirector.extractProductProfile({
      productName,
      productCategory,
      productFacts: productFacts ? productFacts.split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
  }, [productName, productCategory, productFacts]);

  const smartRecommendations = useMemo(() => {
    return SmartStyleMatcher.recommend(productProfile, VIDEO_STYLES_REGISTRY);
  }, [productProfile]);

  // Filtered Styles
  const filteredStyles = useMemo(() => {
    return filterVideoStyles({
      category: styleCategoryFilter === 'all' ? undefined : styleCategoryFilter,
      hasVoice: voiceFilter === 'all' ? undefined : voiceFilter === 'with_voice',
      searchQuery: styleSearch.trim() || undefined,
    });
  }, [styleCategoryFilter, voiceFilter, styleSearch]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Image upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages((prev) => [
          ...prev,
          {
            id: `img_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name: file.name,
            size: file.size,
            dataUrl: event.target?.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Preflight calculations (Single image OR product name + sufficient credits)
  const duration = selectedStyle.durationSeconds;
  const expectedCredits = duration === 10 ? 10 : 15;
  const userBalance = 10;
  const hasEnoughCredits = userBalance >= expectedCredits;
  const canGenerate = (images.length > 0 || productName.trim().length > 0) && hasEnoughCredits;

  const handleGenerate = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setActiveJobStatus('Memulakan penjanaan AffiMatik...');
    setActiveJobProgress(10);
    setGeneratedVideoUrl(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleId: selectedStyle.id,
          productName: productName.trim() || undefined,
          productCategory: productCategory.trim() || undefined,
          productFacts: productFacts ? productFacts.split(',').map((s) => s.trim()).filter(Boolean) : [],
          callToAction: ctaOption,
          isMuslimahModest,
          customPrompt: mode === 'advanced' ? customPrompt : undefined,
          imageKeys: images.map((img) => img.dataUrl),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghantar tugasan video');
      }

      setSubmitSuccess(`Tugasan dihantar! ID Task: ${data.providerTaskId} (${selectedStyle.name})`);
      setActiveJobStatus('Sedang diproses oleh pelayan AI...');
      setActiveJobProgress(30);

      // Save to sessionStorage for persistence across page reloads
      const providerTaskId = data.providerTaskId;
      const providerName = data.provider || selectedStyle.engine;
      sessionStorage.setItem('affimatik_active_job', JSON.stringify({
        providerTaskId,
        providerName,
        styleName: selectedStyle.name,
        startTime: Date.now(),
      }));

      // Mulakan polling status
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const pollRes = await fetch(`/api/jobs?providerTaskId=${providerTaskId}&provider=${providerName}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'COMPLETED' && pollData.output?.videoUrl) {
            clearInterval(pollInterval);
            sessionStorage.removeItem('affimatik_active_job');
            setIsSubmitting(false);
            setActiveJobStatus('Selesai!');
            setActiveJobProgress(100);
            setGeneratedVideoUrl(pollData.output.videoUrl);
          } else if (pollData.status === 'FAILED') {
            clearInterval(pollInterval);
            sessionStorage.removeItem('affimatik_active_job');
            setIsSubmitting(false);
            setSubmitError(`Penjanaan video gagal: ${pollData.rawStatus || 'Ralat tidak diketahui'}`);
          } else {
            setActiveJobProgress((prev) => Math.min(prev + 5, 90));
            setActiveJobStatus(`Sedang diproses (${pollData.rawStatus || 'rendering'})...`);
          }
        } catch {
          // ignore transient poll error
        }

        if (pollCount > 60) {
          clearInterval(pollInterval);
          sessionStorage.removeItem('affimatik_active_job');
          setIsSubmitting(false);
        }
      }, 4000);

    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">AffiMatik Video Factory</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              by Pawarna
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700 mt-1">
            Affiliate Jadi Automatik.
          </p>
          <p className="text-xs text-slate-500">
            Satu Produk + Satu Video Style + Satu Klik = Satu Video Realistik.
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-200/70 border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setMode('quick')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              mode === 'quick' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quick Factory
          </button>
          <button
            onClick={() => setMode('advanced')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              mode === 'advanced' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Advanced Studio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Factory Flow (2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          {/* ================================================================= */}
          {/* STEP 1: Select Product (Upload or My Products)                    */}
          {/* ================================================================= */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Pilih atau Muat Naik Foto Produk</h3>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-600" />
                AI Creative Director Aktif
              </span>
            </div>

            {/* Upload Area */}
            <div>
              <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-7 flex flex-col items-center justify-center cursor-pointer bg-indigo-50/20 hover:bg-indigo-50/40 transition">
                <div className="w-12 h-12 rounded-xl bg-white shadow-2xs flex items-center justify-center mb-3 text-indigo-600 border border-indigo-100">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-800">Muat Naik Gambar Produk Anda</span>
                <span className="text-xs text-slate-500 mt-1 text-center max-w-sm">
                  Cukup sekadar muat naik foto produk. AI akan mengesan bungkusan, teks label, dan menyediakan video secara automatik.
                </span>
                <span className="text-[11px] text-indigo-600 font-semibold mt-3 px-3 py-1 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                  Pilih Gambar (PNG, JPG, WEBP)
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Uploaded Previews */}
            {images.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Gambar Produk Dimuat Naik ({images.length} fail):</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-white hover:bg-rose-600 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Metadata Section */}
            <div className="pt-2 border-t border-slate-100">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Maklumat Produk Tambahan (Pilihan / Optional)</h4>
                  <p className="text-[11px] text-slate-500">
                    Biarkan kosong jika mahu AI buat research dan kenalpasti produk terus daripada foto di atas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Nama Produk <span className="text-slate-400 font-normal">(Pilihan)</span>
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Contoh: Sambal Hijau Tok Wan (Auto-detect jika kosong)"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Kategori <span className="text-slate-400 font-normal">(Pilihan)</span>
                    </label>
                    <input
                      type="text"
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Contoh: Makanan & Minuman / Skincare"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Fakta / Kelebihan Khas Produk <span className="text-slate-400 font-normal">(Pilihan)</span>
                  </label>
                  <input
                    type="text"
                    value={productFacts}
                    onChange={(e) => setProductFacts(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Contoh: Rangup, Pedas Manja, Tanpa Pengawet"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* STEP 2: Choose Video Style (Smart Match + Library)                */}
          {/* ================================================================= */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Pilih Video Style (Gaya Video)</h3>
              </div>
              <span className="text-xs text-slate-500">
                Gaya Dipilih: <strong className="text-indigo-600">{selectedStyle.name}</strong>
              </span>
            </div>

            {/* Smart Style Match Recommendations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Cadangan Smart Style Match (AI Match):
                </span>
                <span className="text-[10px] text-slate-400">Padanan berdasar format & kategori produk</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {smartRecommendations.map(({ style, matchReason }) => {
                  const isSelected = style.id === selectedStyle.id;
                  const hasVoice = style.audioMode === 'spoken_bm';

                  return (
                    <div
                      key={style.id}
                      onClick={() => setSelectedStyleId(style.id)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500 shadow-xs'
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase font-mono text-indigo-600">
                            {style.id}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                            {style.durationSeconds}s
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 mt-1">{style.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{style.benefit}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{matchReason}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full Style Library Filter Toolbar */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Semak Semua Video Styles ({filteredStyles.length}):</span>
                <div className="flex items-center gap-2">
                  <select
                    value={voiceFilter}
                    onChange={(e) => setVoiceFilter(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white text-slate-700"
                  >
                    <option value="all">Semua Audio</option>
                    <option value="with_voice">Dengan Suara (10s)</option>
                    <option value="no_voice">Tanpa Suara (15s)</option>
                  </select>
                </div>
              </div>

              {/* Grid of Styles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {filteredStyles.map((style) => {
                  const isSelected = style.id === selectedStyle.id;
                  const hasVoice = style.audioMode === 'spoken_bm';

                  return (
                    <div
                      key={style.id}
                      onClick={() => setSelectedStyleId(style.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase">
                            {style.id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                              {style.durationSeconds}s
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              hasVoice ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {hasVoice ? 'Voice' : 'No Voice'}
                            </span>
                          </div>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 mt-1">{style.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {style.benefit}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Enjin: <strong className="text-slate-700 uppercase">{style.engine}</strong></span>
                        <span className="font-semibold text-indigo-600">
                          {isSelected ? '✓ Dipilih' : 'Pilih'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* ADVANCED STUDIO (Only shown in Advanced Mode)                     */}
          {/* ================================================================= */}
          {mode === 'advanced' && (
            <div className="p-6 rounded-2xl bg-white border border-indigo-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Advanced Studio (Kawalan Tersuai)</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Call To Action (CTA) Pertuturan
                  </label>
                  <select
                    value={ctaOption}
                    onChange={(e) => setCtaOption(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                  >
                    <option value="spoken_button">Lisan: &quot;Tekan butang di bawah&quot;</option>
                    <option value="spoken_bio">Lisan: &quot;Tengok link di bio&quot;</option>
                    <option value="none">Tiada Call To Action (Neutral)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Modesti Muslimah (Shariah Lock)
                  </label>
                  <select
                    value={isMuslimahModest ? 'true' : 'false'}
                    onChange={(e) => setIsMuslimahModest(e.target.value === 'true')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                  >
                    <option value="true">Muslimah Modest (Bertudung & Lengan Panjang)</option>
                    <option value="false">Kasual Moden Sopan Malaysia</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Custom Spoken Script / Prompt Injection (Pilihan)
                </label>
                <textarea
                  rows={2}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Masukkan ayat pertuturan khas dalam Bahasa Melayu (hanya untuk gaya 10s)..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Preflight & Generation (1 col) */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs sticky top-24 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Generation Preflight</h3>
            </div>

            {/* Preflight Details */}
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Gaya Video:</span>
                <span className="font-bold text-slate-900 text-right">[{selectedStyle.id}] {selectedStyle.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Enjin Sasaran:</span>
                <span className="font-bold uppercase text-indigo-600">{selectedStyle.engine}</span>
              </div>
              <div className="flex justify-between">
                <span>Durasi:</span>
                <span className="font-semibold text-slate-900">{selectedStyle.durationSeconds} Saat</span>
              </div>
              <div className="flex justify-between">
                <span>Status Audio:</span>
                <span className="font-semibold text-slate-900">
                  {selectedStyle.audioMode === 'spoken_bm' ? 'Spoken BM Asli' : 'Strictly No Speech'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Nisbah Format:</span>
                <span className="font-semibold text-slate-900">9:16 Menegak (TikTok/Shopee)</span>
              </div>
            </div>

            {/* Credit Cost Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Kredit Diperlukan:</span>
                <span className="font-bold text-slate-900">{expectedCredits} Kredit</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Baki Tersedia Anda:</span>
                <span className={`font-bold ${hasEnoughCredits ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {userBalance} Kredit
                </span>
              </div>
            </div>

            {/* Realism & Modesty Alert */}
            <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 text-[11px] text-indigo-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
              <span>
                <strong>Realism & Product Lock:</strong> Visual UGC iPhone 15 Pro, pencahayaan 5500K neutral, tiada butang kuning palsu atas visual.
              </span>
            </div>

            {submitSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {submitSuccess}
              </div>
            )}

            {submitError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {submitError}
              </div>
            )}

            {/* Realtime Progress Bar */}
            {activeJobStatus && isSubmitting && (
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    {activeJobStatus}
                  </span>
                  <span>{activeJobProgress}%</span>
                </div>
                <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${activeJobProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* In-App Video Player */}
            {generatedVideoUrl && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Video Siap Dijana!
                  </span>
                </div>
                <div className="rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[380px] mx-auto shadow-inner flex items-center justify-center">
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
                <a
                  href={generatedVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  download="affimatik_video.mp4"
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition"
                >
                  <Video className="w-3.5 h-3.5" />
                  Muat Turun MP4 (HD)
                </a>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              disabled={!canGenerate || isSubmitting}
              onClick={handleGenerate}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm ${
                canGenerate && !isSubmitting
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-indigo-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengesahkan & Menghantar...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Jana Video Sekarang ({expectedCredits} Kredit)</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400">
              Pemprosesan awan berterusan di latar belakang. Anda boleh menutup browser dengan selamat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VideoFactoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <VideoFactoryContent />
    </Suspense>
  );
}
