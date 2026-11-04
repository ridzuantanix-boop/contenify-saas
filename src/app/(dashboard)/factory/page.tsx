'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { OFFICIAL_GEMS_PRESETS, PromptPreset } from '@/lib/gems/presets';

interface UploadedFilePreview {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
}

export default function VideoFactoryPage() {
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick');

  // Step 1: Assets
  const [productName, setProductName] = useState('Serum Muka Glow Puteri');
  const [productCategory, setProductCategory] = useState('Skincare & Kecantikan');
  const [productFacts, setProductFacts] = useState('Ekstrak Bunga Raya Asli, Vitamin C 10%, Melembap 24 Jam');
  const [images, setImages] = useState<UploadedFilePreview[]>([]);

  // Step 2: Presets & Controls
  const [selectedPresetId, setSelectedPresetId] = useState<string>(OFFICIAL_GEMS_PRESETS[0].id);
  const [duration, setDuration] = useState<10 | 15>(10);
  const [ctaOption, setCtaOption] = useState<'spoken_button' | 'spoken_bio' | 'none'>('spoken_button');
  const [isMuslimahModest, setIsMuslimahModest] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'auto' | 'nexabot' | 'runninghub'>('auto');

  // Status & Preflight
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<string | null>(null);
  const [activeJobProgress, setActiveJobProgress] = useState<number>(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  const selectedPreset = OFFICIAL_GEMS_PRESETS.find(p => p.id === selectedPresetId) || OFFICIAL_GEMS_PRESETS[0];

  // Duration changes preset compatibility
  const handleSelectPreset = (preset: PromptPreset) => {
    setSelectedPresetId(preset.id);
    setDuration(preset.targetDurationSeconds);
  };

  // Simulated file upload preview
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

  // Preflight calculations
  const resolvedProvider = duration === 10 ? 'nexabot' : 'runninghub';
  const expectedCredits = duration === 10 ? 10 : 15;
  const userBalance = 10;
  const hasEnoughCredits = userBalance >= expectedCredits;
  const canGenerate = (images.length > 0 || productName.length > 0) && hasEnoughCredits;

  const handleGenerate = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setActiveJobStatus('Memulakan penjanaan...');
    setActiveJobProgress(10);
    setGeneratedVideoUrl(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          productCategory,
          productFacts: productFacts.split(',').map((s) => s.trim()),
          presetId: selectedPreset.id,
          durationSeconds: duration,
          provider: selectedProvider === 'auto' ? resolvedProvider : selectedProvider,
          callToAction: ctaOption,
          isMuslimahModest,
          customPrompt: mode === 'advanced' ? customPrompt : undefined,
          imageKeys: images.map((img) => img.dataUrl.startsWith('http') ? img.dataUrl : img.name),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghantar tugasan video');
      }

      setSubmitSuccess(`Tugasan dihantar! ID Task: ${data.providerTaskId}`);
      setActiveJobStatus('Sedang diproses oleh pelayan AI...');
      setActiveJobProgress(30);

      // Mulakan polling status
      const providerTaskId = data.providerTaskId;
      const providerName = data.provider || 'nexabot';
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const pollRes = await fetch(`/api/jobs?providerTaskId=${providerTaskId}&provider=${providerName}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'COMPLETED' && pollData.output?.videoUrl) {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setActiveJobStatus('Selesai!');
            setActiveJobProgress(100);
            setGeneratedVideoUrl(pollData.output.videoUrl);
          } else if (pollData.status === 'FAILED') {
            clearInterval(pollInterval);
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
          setIsSubmitting(false);
        }
      }, 4000);

    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Video Factory</h2>
          <p className="text-sm text-slate-500 mt-1">
            Cipta video affiliate berkualiti tinggi dengan enjin Official Gems dan adapter cloud.
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-200/70 border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setMode('quick')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              mode === 'quick' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quick Factory
          </button>
          <button
            onClick={() => setMode('advanced')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              mode === 'advanced' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Advanced Studio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form & Config (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 1: Product Assets */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Maklumat & Tangkap Layar Produk</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Produk</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Contoh: Sambal Hijau Tok Wan"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                <input
                  type="text"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Contoh: Makanan & Minuman"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Fakta / Kelebihan Produk (Dipelihara oleh AI)
              </label>
              <textarea
                rows={2}
                value={productFacts}
                onChange={(e) => setProductFacts(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Senaraikan kelebihan asli produk..."
              />
            </div>

            {/* Bulk Upload Area */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Muat Naik Tangkap Layar Produk (Drag & Drop)
              </label>
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-indigo-50/20 transition">
                <Upload className="w-6 h-6 text-indigo-500 mb-2" />
                <span className="text-xs font-semibold text-slate-700">Pilih atau seret gambar produk ke sini</span>
                <span className="text-[11px] text-slate-400 mt-1">PNG, JPG sehingga 50MB per fail</span>
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
              <div className="flex flex-wrap gap-3 pt-2">
                {images.map((img) => (
                  <div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STEP 2: Official Gems Preset */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Pilih Official Gems Preset</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OFFICIAL_GEMS_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedPresetId;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                        {preset.targetDurationSeconds}s
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Quick Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Durasi Video</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDuration(10)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      duration === 10
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    10 Saat (Nexabot)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(15)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      duration === 15
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    15 Saat (RunningHub)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ajakan Bertindak (CTA)</label>
                <select
                  value={ctaOption}
                  onChange={(e) => setCtaOption(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="spoken_button">Lisan: "Tekan butang di bawah"</option>
                  <option value="spoken_bio">Lisan: "Link di bio"</option>
                  <option value="none">Tiada CTA Jualan (Branding sahaja)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gaya Model Muslimah</label>
                <button
                  type="button"
                  onClick={() => setIsMuslimahModest(!isMuslimahModest)}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                    isMuslimahModest
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {isMuslimahModest ? '✓ Bertudung Labuh & Sopan' : 'Gaya Moden Standard'}
                </button>
              </div>
            </div>

            {/* Advanced Extra Controls */}
            {mode === 'advanced' && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pilihan Enjin Pemprosesan (Manual Override)
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                  >
                    <option value="auto">Auto Router Pintar (Nexabot 10s / RunningHub 15s)</option>
                    <option value="nexabot">Nexabot (10s Spoken BM)</option>
                    <option value="runninghub">RunningHub (15s Visual WebApp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Custom Prompt Injection (Pilihan Tambahan)
                  </label>
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    placeholder="Masukkan arahan terperinci untuk pencahayaan, gerak kamera atau skrip khusus..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preflight Summary & Generate (1 col) */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm sticky top-24 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Ringkasan Preflight</h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Preset Dipilih:</span>
                <span className="font-medium text-slate-900 text-right">{selectedPreset.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Durasi:</span>
                <span className="font-medium text-slate-900">{duration} Saat</span>
              </div>
              <div className="flex justify-between">
                <span>Enjin Sasaran:</span>
                <span className="font-medium text-indigo-700 uppercase">{resolvedProvider}</span>
              </div>
              <div className="flex justify-between">
                <span>Dialek & Bahasa:</span>
                <span className="font-medium text-slate-900">Bahasa Melayu Standard (ms-MY)</span>
              </div>
              <div className="flex justify-between">
                <span>Format Nisbah:</span>
                <span className="font-medium text-slate-900">9:16 Menegak (TikTok/Reels)</span>
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

            {/* Guardrail warnings */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Peraturan Pasaran Malaysia:</strong> Tiada butang kuning palsu pada visual. Audio lisan asli Bahasa Melayu.
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
                  download="contenify_video.mp4"
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition"
                >
                  <Video className="w-3.5 h-3.5" />
                  Muat Turun MP4 (HD)
                </a>
              </div>
            )}

            {/* Generate Action */}
            <button
              type="button"
              disabled={!canGenerate || isSubmitting}
              onClick={handleGenerate}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm ${
                canGenerate && !isSubmitting
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
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
