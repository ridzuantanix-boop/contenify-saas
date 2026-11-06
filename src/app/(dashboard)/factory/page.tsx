'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
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
  Play,
  Download,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { VIDEO_STYLES_REGISTRY, getVideoStyle, filterVideoStyles } from '@/lib/styles/registry';
import { VideoStyle, StyleCategory } from '@/lib/styles/types';

interface UploadedFilePreview {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  assetId: string;
}

interface ActiveJobDisplay {
  jobId: string;
  providerTaskId?: string;
  provider: 'nexabot' | 'runninghub' | 'mock';
  styleName: string;
  durationSeconds: number;
  status: 'QUEUED' | 'SUBMITTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  requiredCredits: number;
  videoUrl?: string;
  errorMessage?: string;
  rawStatus?: string;
  createdAt: string;
}

function VideoFactoryContent() {
  const searchParams = useSearchParams();
  const initialStyleId = searchParams.get('styleId') || 'NX01';

  // Mode: Quick (default for affiliate creators) vs Advanced
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick');

  // Step 1: Product reference asset (the provider owns interpretation)
  const [productName, setProductName] = useState('');
  const [images, setImages] = useState<UploadedFilePreview[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Step 2: Engine Selector & Selected Video Style
  const [selectedEngine, setSelectedEngine] = useState<'all' | 'nexabot' | 'runninghub'>('all');
  const [selectedStyleId, setSelectedStyleId] = useState<string>(initialStyleId);
  const [styleCategoryFilter, setStyleCategoryFilter] = useState<StyleCategory>('all');
  const [styleSearch, setStyleSearch] = useState('');
  const [hoveredStyleId, setHoveredStyleId] = useState<string | null>(null);
  const [unmutedCardStyleId, setUnmutedCardStyleId] = useState<string | null>(null);
  const [mobilePlayingStyleId, setMobilePlayingStyleId] = useState<string | null>(null);
  const [modalPreviewStyle, setModalPreviewStyle] = useState<VideoStyle | null>(null);

  // Step 3: Optional provider direction & safety controls
  const [isMuslimahModest, setIsMuslimahModest] = useState(true);
  const [creativeInstruction, setCreativeInstruction] = useState('');

  // Status, Wallet & Durable Database Jobs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJobDisplay | null>(null);
  const [recentJobs, setRecentJobs] = useState<ActiveJobDisplay[]>([]);
  const [pollElapsedTime, setPollElapsedTime] = useState<number>(0);

  // Selected Style Reference
  const selectedStyle = useMemo(() => {
    return getVideoStyle(selectedStyleId) || VIDEO_STYLES_REGISTRY[0];
  }, [selectedStyleId]);

  useEffect(() => {
    const selectedAssetId = searchParams.get('imageAssetId');
    if (!selectedAssetId) return;
    fetch('/api/products', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Imej produk tidak dapat dimuatkan.');
      const data = await response.json();
      const asset = data.assets?.find((item: { id: string }) => item.id === selectedAssetId);
      if (!asset) throw new Error('Imej produk tidak ditemui.');
      setImages([{ id: asset.id, assetId: asset.id, name: asset.filename, size: 0, dataUrl: asset.imageUrl }]);
      if (asset.name !== 'Produk tanpa nama') setProductName(asset.name);
    }).catch((err) => setSubmitError(err.message));
  }, [searchParams]);

  const requiredCredits = selectedStyle.engine === 'nexabot' ? 10 : 15;

  // Load account balance from server session
  const refreshAccountBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        if (data.wallet) {
          setUserBalance(data.wallet.balance);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Restore and list persistent jobs directly from database
  const refreshJobsFromDatabase = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?list=true');
      if (res.ok) {
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          setRecentJobs(data.jobs);
          // If there is an incomplete job in the queue, track it
          const pending = data.jobs.find(
            (j: ActiveJobDisplay) => j.status === 'PROCESSING' || j.status === 'SUBMITTING' || j.status === 'QUEUED'
          );
          if (pending) setActiveJob((current) => current || pending);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshAccountBalance();
    refreshJobsFromDatabase();
  }, [refreshAccountBalance, refreshJobsFromDatabase]);

  // Polling for active job with honest elapsed time (No fake percentage increments)
  const activeJobId = activeJob?.jobId;
  const activeJobStatus = activeJob?.status;
  useEffect(() => {
    if (!activeJobId || activeJobStatus === 'COMPLETED' || activeJobStatus === 'FAILED') {
      return;
    }

    setPollElapsedTime(0);
    const timerInterval = setInterval(() => {
      setPollElapsedTime((prev) => prev + 1);
    }, 1000);

    const pollInterval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/jobs?jobId=${activeJobId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'COMPLETED') {
          setActiveJob((prev) => prev ? {
            ...prev,
            status: 'COMPLETED',
            videoUrl: data.output?.videoUrl || data.videoUrl,
          } : null);
          refreshAccountBalance();
          refreshJobsFromDatabase();
          clearInterval(pollInterval);
        } else if (data.status === 'FAILED') {
          setActiveJob((prev) => prev ? {
            ...prev,
            status: 'FAILED',
            errorMessage: data.errorMessage || data.rawStatus || 'Penjanaan video gagal di pelayan AI.',
          } : null);
          refreshAccountBalance();
          refreshJobsFromDatabase();
          clearInterval(pollInterval);
        } else if (data.status === 'RUNNING' || data.status === 'PROCESSING') {
          setActiveJob((prev) => prev ? { ...prev, status: 'PROCESSING', rawStatus: data.rawStatus } : null);
        }
      } catch {
        // Keep job alive; network glitch does not fail the job
      }
    }, 10000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
    };
  }, [activeJobId, activeJobStatus, refreshAccountBalance, refreshJobsFromDatabase]);

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 15 * 1024 * 1024) {
      setSubmitError('Saiz imej melebihi had 15MB.');
      return;
    }

    const reader = new FileReader();
    setIsUploadingImage(true);
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const form = new FormData();
        form.append('image', file);
        if (productName.trim()) form.append('name', productName.trim());
        const response = await fetch('/api/products', { method: 'POST', body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Imej tidak dapat disimpan.');
        setImages([{ id: crypto.randomUUID(), name: file.name, size: file.size, dataUrl, assetId: result.assetId }]);
        setSubmitError(null);
      } catch (err) {
        setImages([]);
        setSubmitError(err instanceof Error ? err.message : 'Imej tidak dapat disimpan.');
      } finally { setIsUploadingImage(false); }
    };
    reader.onerror = () => { setIsUploadingImage(false); setSubmitError('Imej tidak dapat dibaca.'); };
    reader.readAsDataURL(file);
  };

  // Filtered styles catalogue
  const displayedStyles = useMemo(() => {
    return filterVideoStyles({
      engine: selectedEngine === 'all' ? undefined : selectedEngine,
      category: styleCategoryFilter === 'all' ? undefined : styleCategoryFilter,
      searchQuery: styleSearch,
    });
  }, [selectedEngine, styleCategoryFilter, styleSearch]);

  // Primary Action: Submit Generation Task
  const handleGenerateVideo = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (images.length === 0 || isUploadingImage) {
      setSubmitError('Sila muat naik sekurang-kurangnya satu gambar produk untuk menjana video.');
      return;
    }

    const requiredCredits = selectedStyle.engine === 'nexabot' ? 10 : 15;
    if (userBalance !== null && userBalance < requiredCredits) {
      if (userBalance < 10) {
        setSubmitError('Alamak, kredit FREE dah habis! 😂 Harap korang dah sempat hasilkan video padu. Pelan berbayar akan dibuka tak lama lagi.');
      } else {
        setSubmitError(`Baki kredit anda (${userBalance} kredit) tidak mencukupi untuk gaya ${selectedStyle.name} (${requiredCredits} kredit). Anda masih boleh memilih gaya 10 kredit AffiMatik Voice.`);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const clientRequestId = `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const payload: Record<string, unknown> = {
        clientRequestId,
        styleId: selectedStyle.id,
        productName: productName.trim() || undefined,
        creativeInstruction: creativeInstruction.trim() || undefined,
        isMuslimahModest,
        imageAssetId: images[0].assetId,
      };

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghantar tugasan penjanaan video.');
      }

      setSubmitSuccess('Tugasan penjanaan video berjaya didaftarkan. Sistem sedang memproses babak.');
      const newJobDisplay: ActiveJobDisplay = {
        jobId: data.jobId,
        providerTaskId: data.providerTaskId,
        provider: data.provider || selectedStyle.engine,
        styleName: selectedStyle.name,
        durationSeconds: selectedStyle.durationSeconds,
        status: 'PROCESSING',
        requiredCredits,
        createdAt: new Date().toISOString(),
      };

      setActiveJob(newJobDisplay);
      setRecentJobs((prev) => [newJobDisplay, ...prev.filter((j) => j.jobId !== newJobDisplay.jobId)]);
      refreshAccountBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reuse finished job configuration
  const handleReuseJobSettings = (job: ActiveJobDisplay) => {
    const style = VIDEO_STYLES_REGISTRY.find((s) => s.name === job.styleName);
    if (style) {
      setSelectedStyleId(style.id);
    }
    setActiveJob(null);
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              AffiMatik Video Factory
            </h1>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full border border-primary/20">
              V1 Creative
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Upload produk, pilih gaya, terus jana video affiliate berkualiti tinggi.
          </p>
        </div>

        {/* Quick vs Advanced Switch & Balance */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('quick')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                mode === 'quick' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Quick Mode
            </button>
            <button
              type="button"
              onClick={() => setMode('advanced')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                mode === 'advanced' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Advanced Mode
            </button>
          </div>

          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Baki: {userBalance !== null ? `${userBalance} Kredit` : 'Memuatkan...'}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Creation Studio vs Right Live Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CREATION STUDIO (7 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: UPLOAD PRODUCT */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-900">Gambar & Maklumat Produk</h3>
              </div>
              <span className="text-[11px] text-slate-500">Imej Rujukan Visual (Bukan Wajib Frame Pertama)</span>
            </div>

            {images.length === 0 ? (
              <label className="border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-slate-50/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800">Pilih atau Seret Gambar Produk</span>
                <span className="text-[11px] text-slate-400 mt-0.5">JPG, PNG atau WebP (Maksimum 15MB)</span>
              </label>
            ) : (
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[0].dataUrl}
                  alt="Product preview"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{productName || images[0].name}</div>
                  <div className="text-[11px] text-slate-500">
                    Nama fail aset: {images[0].name}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Identiti produk dikunci untuk kesinambungan visual</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImages([])}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-all"
                  title="Tukar gambar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Optional context only; the uploaded image remains authoritative. */}
            <div className="grid grid-cols-1 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nama Produk <span className="text-slate-400 font-normal">(Pilihan)</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Contoh: Serum Rawatan Wajah"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

            </div>

            {mode === 'advanced' && (
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Interpretasi produk, dialog dan babak dibuat oleh AI video provider berdasarkan imej rujukan.</span>
                <span>Tiada Gemini Vision atau skrip dalaman dipanggil.</span>
              </div>
            )}
          </div>

          {/* STEP 2: CHOOSE ENGINE & VIDEO STYLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900">Pilih Jenis Video & Gaya</h3>
              </div>
              <span className="text-xs font-bold text-primary">
                {selectedStyle.name} ({selectedStyle.durationSeconds}s • {selectedStyle.engine === 'nexabot' ? '10' : '15'} Kredit)
              </span>
            </div>

            {/* Engine Tabs (AffiMatik Voice 10s vs AffiMatik Motion 15s) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedEngine('nexabot');
                  if (selectedStyle.engine !== 'nexabot') setSelectedStyleId('NX01');
                }}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                  selectedStyle.engine === 'nexabot'
                    ? 'border-primary bg-primary/5 text-slate-900 shadow-sm ring-1 ring-primary'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Volume2 className="w-3.5 h-3.5 text-primary" />
                    <span>AffiMatik Voice (10s)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pertuturan BM Asli Malaysia (10 Kredit)</p>
                </div>
                {selectedStyle.engine === 'nexabot' && <Check className="w-4 h-4 text-primary" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedEngine('runninghub');
                  if (selectedStyle.engine !== 'runninghub') setSelectedStyleId('RH01');
                }}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                  selectedStyle.engine === 'runninghub'
                    ? 'border-primary bg-primary/5 text-slate-900 shadow-sm ring-1 ring-primary'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <VolumeX className="w-3.5 h-3.5 text-slate-700" />
                    <span>AffiMatik Motion (15s)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Visual Realistik & ASMR (15 Kredit)</p>
                </div>
                {selectedStyle.engine === 'runninghub' && <Check className="w-4 h-4 text-primary" />}
              </button>
            </div>

            {/* Style Cards Grid (Hover-to-Play Video Gallery with Audio Control) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Pilih daripada 13 Gaya Video Rasmi (Hover untuk main, klik pembesar suara untuk audio):</span>
                <span className="text-[11px] text-slate-400">{displayedStyles.length} gaya tersedia</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedStyles.map((style) => {
                  const isSelected = style.id === selectedStyle.id;
                  const isHovered = hoveredStyleId === style.id || mobilePlayingStyleId === style.id;
                  const isUnmuted = unmutedCardStyleId === style.id;
                  const hasVerifiedSample = Boolean(style.previewVideoUrl);

                  return (
                    <div
                      key={style.id}
                      onMouseEnter={() => setHoveredStyleId(style.id)}
                      onMouseLeave={() => {
                        setHoveredStyleId(null);
                        if (unmutedCardStyleId === style.id) setUnmutedCardStyleId(null);
                      }}
                      onClick={() => {
                        setSelectedStyleId(style.id);
                        // For touch devices, tap toggles play state
                        setMobilePlayingStyleId(mobilePlayingStyleId === style.id ? null : style.id);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all relative group flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {/* Video Preview Box (9:16 vertical ratio) */}
                      {hasVerifiedSample && (
                        <div className="relative w-full aspect-[9/16] max-h-36 rounded-lg overflow-hidden bg-slate-950 mb-2">
                          <video
                            src={style.previewVideoUrl || undefined}
                            muted={!isUnmuted}
                            playsInline
                            loop
                            preload="none"
                            ref={(el) => {
                              if (el) {
                                el.muted = !isUnmuted;
                                if (isHovered) {
                                  el.play().catch(() => {});
                                } else {
                                  el.pause();
                                  el.currentTime = 0;
                                }
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider">
                            {style.durationSeconds}s • {style.engine === 'nexabot' ? 'Voice' : 'Motion'}
                          </div>

                          {/* Sound Unmute / Mute Toggle Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnmutedCardStyleId(isUnmuted ? null : style.id);
                            }}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white transition-all z-10"
                            title={isUnmuted ? 'Senyapkan suara' : 'Dengar suara sampel'}
                          >
                            {isUnmuted ? (
                              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <VolumeX className="w-3.5 h-3.5 text-white/80" />
                            )}
                          </button>

                          {/* Center Play Button for Modal Expanded View */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalPreviewStyle(style);
                            }}
                            className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                            title="Tonton pratonton penuh bersuara"
                          >
                            <div className="p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all">
                              <Play className="w-4 h-4 fill-white" />
                            </div>
                          </button>
                        </div>
                      )}

                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold text-xs text-slate-900">{style.name}</div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                            {style.durationSeconds}s
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {style.benefit}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px]">
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          ✓ Kualiti Sah ({style.engine === 'nexabot' ? '10' : '15'} Kr)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStyleId(style.id);
                          }}
                          className={`px-2 py-0.5 rounded font-bold text-[10px] transition-all ${
                            isSelected
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? 'Dipilih' : 'Pilih Gaya'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ADVANCED STUDIO CONTROLS (Only visible in Advanced Mode) */}
          {mode === 'advanced' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Kawalan Studio Lanjutan</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Kawalan Kesopanan Shariah</label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={isMuslimahModest}
                      onChange={(e) => setIsMuslimahModest(e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>Kunci Pematuhan Muslimah (Tudung labuh, aurat terjaga)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Arahan Kreatif Tambahan <span className="text-slate-400 font-normal">(Pilihan)</span>
                </label>
                <input
                  type="text"
                  value={creativeInstruction}
                  onChange={(e) => setCreativeInstruction(e.target.value)}
                  placeholder="Contoh: Model pegang produk sambil senyum ke arah cahaya tingkap"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* GENERATE ACTION BUTTON */}
          <div className="space-y-2">
            {submitError && (
              <div className={`p-4 border rounded-xl text-xs space-y-2 ${
                submitError.includes('kredit FREE dah habis')
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                    submitError.includes('kredit FREE dah habis') ? 'text-amber-600' : 'text-rose-600'
                  }`} />
                  <div className="flex-1">
                    <div className="font-bold">
                      {submitError.includes('kredit FREE dah habis') ? 'Kredit Percuma Habis' : 'Penjanaan Tidak Dapat Diteruskan'}
                    </div>
                    <div className="mt-0.5 leading-relaxed">{submitError}</div>
                  </div>
                </div>
                {submitError.includes('kredit FREE dah habis') && (
                  <div className="pt-2 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-800">Pelan berbayar akan dibuka tidak lama lagi.</span>
                    <a
                      href="mailto:support@affimatik.online?subject=Pertanyaan%20Akses%20Awal%20AffiMatik"
                      className="text-[11px] font-bold text-amber-950 underline decoration-amber-500 hover:text-amber-800 transition"
                    >
                      Dah tak sabar nak upgrade? Hubungi team AffiMatik untuk akses awal.
                    </a>
                  </div>
                )}
              </div>
            )}

            {submitSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateVideo}
              disabled={Boolean(isSubmitting || (activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING')))}
              className={`w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                isSubmitting || (activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING'))
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/95 active:scale-[0.99]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mendaftarkan Tugasan Video...</span>
                </>
              ) : activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING') ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Memproses Video Di Pelayan AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Jana Video Sekarang ({selectedStyle.engine === 'nexabot' ? '10' : '15'} Kredit)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: LIVE STATUS, PREVIEW & PERSISTENT OUTPUT (5 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* ACTIVE GENERATION STATUS / COMPLETED WORKSPACE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-800">Ruang Status & Hasil Video</span>
              {activeJob && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  activeJob.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeJob.status === 'FAILED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {activeJob.status === 'COMPLETED' ? 'Video Siap' : activeJob.status === 'FAILED' ? 'Gagal' : 'Sedang Menjana'}
                </span>
              )}
            </div>

            <div className="p-5 space-y-4">
              {activeJob ? (
                <div className="space-y-4">
                  {/* Active Processing State */}
                  {(activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING' || activeJob.status === 'QUEUED') && (
                    <div className="text-center py-6 space-y-3">
                      <div className="w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                        <Loader2 className="w-7 h-7 animate-spin" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Sedang Menjana Video AI</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Gaya: {activeJob.styleName} ({activeJob.durationSeconds}s)
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-mono text-slate-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Masa berlalu: {pollElapsedTime}s</span>
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Tugasan selamat disimpan di pangkalan data. Anda boleh muat semula atau tinggalkan halaman ini tanpa kehilangan kerja.
                      </p>
                    </div>
                  )}

                  {/* Completed State (Interactive MP4 Video Player) */}
                  {activeJob.status === 'COMPLETED' && (
                    <div className="space-y-3">
                      <div className="relative aspect-[9/16] max-h-96 w-full rounded-xl overflow-hidden bg-black mx-auto shadow-inner">
                        {activeJob.videoUrl ? (
                          <video
                            src={activeJob.videoUrl}
                            controls
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                            Pautan video sedang disediakan...
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        {activeJob.videoUrl && (
                          <a
                            href={activeJob.videoUrl}
                            download={`affimatik-${selectedStyle.slug}-${activeJob.jobId.slice(0, 8)}.mp4`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Muat Turun MP4</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleReuseJobSettings(activeJob)}
                          className="px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                          title="Guna semula gaya dan tetapan ini"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Guna Semula</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Failed State */}
                  {activeJob.status === 'FAILED' && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Penjanaan Terhenti</span>
                      </div>
                      <p>{activeJob.errorMessage || 'Tugasan tidak dapat diselesaikan oleh pelayan video AI.'}</p>
                      <button
                        type="button"
                        onClick={() => setActiveJob(null)}
                        className="mt-2 px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-rose-700 font-bold hover:bg-rose-100 transition-all text-xs"
                      >
                        Ubah Prompt & Cuba Semula
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty / Ready State with Selected Style Specifications */
                <div className="text-center py-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 mx-auto flex items-center justify-center">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Sedia Untuk Menjana</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Pilih produk dan gaya di sebelah kiri, kemudian tekan butang jana untuk memulakan video anda.
                    </p>
                  </div>

                  {/* Style Specification Snapshot */}
                  <div className="text-left bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px] space-y-1.5 text-slate-600">
                    <div className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-200">
                      Spesifikasi Gaya: {selectedStyle.name}
                    </div>
                    <div>• Format: 9:16 Menegak (UGC Smartphone)</div>
                    <div>• Enjin: {selectedStyle.engine === 'nexabot' ? 'AffiMatik Voice (10s)' : 'AffiMatik Motion (15s)'}</div>
                    <div>• Durasi: {selectedStyle.durationSeconds} Saat ({selectedStyle.engine === 'nexabot' ? '10' : '15'} Kredit)</div>
                    <div>• Audio: {selectedStyle.engine === 'nexabot' ? 'Pertuturan BM Malaysia Santai' : 'Visual Realistik & Audio Persekitaran / ASMR'}</div>
                    <div>• Kesopanan: {isMuslimahModest ? 'Pematuhan Muslimah Aktif' : 'Moden Santai'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RECENT PERSISTENT JOBS LIST (Durable restoration) */}
          {recentJobs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Senarai Tugasan Terkini</span>
                <span className="text-[11px] text-slate-400 font-medium">Auto-pulih dari pangkalan data</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {recentJobs.slice(0, 5).map((job) => (
                  <div key={job.jobId} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">{job.styleName}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {job.durationSeconds}s
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : job.status === 'FAILED'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {job.status === 'COMPLETED' ? 'Siap' : job.status === 'FAILED' ? 'Gagal' : 'Memproses'}
                      </span>
                      {job.videoUrl && (
                        <button
                          type="button"
                          onClick={() => setActiveJob(job)}
                          className="text-[11px] text-primary font-bold hover:underline"
                        >
                          Lihat
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ENLARGED STYLE PREVIEW MODAL */}
      {modalPreviewStyle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>{modalPreviewStyle.name}</span>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold">
                    {modalPreviewStyle.durationSeconds}s
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{modalPreviewStyle.benefit}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalPreviewStyle(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-[9/16] bg-slate-950 max-h-[460px] flex items-center justify-center">
              {modalPreviewStyle.previewVideoUrl ? (
                <video
                  src={modalPreviewStyle.previewVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-slate-400">Pratonton video sedang dimuatkan...</div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <span className="font-bold">{modalPreviewStyle.engine === 'nexabot' ? 'AffiMatik Voice (10 Kredit)' : 'AffiMatik Motion (15 Kredit)'}</span>
                <div className="text-[11px] text-slate-500">
                  {modalPreviewStyle.engine === 'nexabot' ? 'Pertuturan Bahasa Melayu Malaysia (10s)' : 'Visual Realistik & Audio Persekitaran / ASMR (15s)'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedStyleId(modalPreviewStyle.id);
                  setModalPreviewStyle(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs shadow-sm transition-all"
              >
                Pilih Gaya Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERSISTENT MOBILE BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-900 truncate">{selectedStyle.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 shrink-0">
                {selectedStyle.durationSeconds}s
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <span>Kos: <strong className="text-slate-800">{requiredCredits} kr</strong></span>
              <span>•</span>
              <span>Baki: <strong className="text-indigo-600">{userBalance !== null ? userBalance : '...'}</strong></span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateVideo}
            disabled={Boolean(isSubmitting || (activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING')))}
            className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0 ${
              isSubmitting || (activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING'))
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/95 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menjana...</span>
              </>
            ) : activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING') ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Jana Video</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VideoFactoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuatkan AffiMatik Video Factory...</div>}>
      <VideoFactoryContent />
    </Suspense>
  );
}
