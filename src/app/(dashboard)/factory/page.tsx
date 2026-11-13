'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
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
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  UserRound,
  ImageIcon,
  BookmarkPlus,
} from 'lucide-react';
import { VIDEO_STYLES_REGISTRY, getVideoStyle, filterVideoStyles, STYLE_CATEGORIES_V6 } from '@/lib/styles/registry';
import { VideoStyle, StyleCategory } from '@/lib/styles/types';
import { getStyleMarketingMetadata } from '@/lib/styles/marketing-metadata';
import { StylePosterMedia } from '@/components/styles/style-poster-media';
import { downloadPrivateMp4 } from '@/lib/download/client-download';

interface UploadedFilePreview {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  assetId: string;
  productId?: string;
  category?: string;
  notes?: string;
}

interface ActiveJobDisplay {
  jobId: string;
  providerTaskId?: string;
  provider: 'nexabot' | 'runninghub' | 'mock';
  styleName: string;
  durationSeconds: number;
  status: 'QUEUED' | 'SUBMITTING' | 'PROCESSING' | 'QA_PENDING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  requiredCredits: number;
  videoUrl?: string;
  errorMessage?: string;
  rawStatus?: string;
  creditRestored?: boolean;
  failureHeadline?: string;
  failureGuidance?: string;
  retryScheduled?: boolean;
  retryCount?: number;
  maxRetries?: number;
  nextRetryAt?: string;
  createdAt: string;
}

interface AvatarOption { id: string; name: string; imageUrl: string; thumbnailUrl?: string; consentConfirmed: boolean; official?: boolean; ageGroup?: string; gender?: string; personality?: string }
interface BackgroundOption { id: string; name: string; imageUrl: string; thumbnailUrl?: string; official?: boolean; category?: string }
interface BuiltInSceneOption { id: string; name: string; directive: string }
interface CreatorPreset {
  id: string; name: string; isDefault: boolean;
  settings: { styleId: string; avatarId: string | null; backgroundId: string | null; builtInSceneId: string | null; niche: string; voicePersonality: string; storyboard: string; callToAction: string; audioTreatment?: string; customCta: string; isMuslimahModest: boolean; creativeInstruction: string };
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
  const [selectedStyleId, setSelectedStyleId] = useState<string>(initialStyleId);
  const [styleCategoryFilter, setStyleCategoryFilter] = useState<StyleCategory>('all');
  const [styleSearch, setStyleSearch] = useState('');
  const [modalPreviewStyle, setModalPreviewStyle] = useState<VideoStyle | null>(null);

  // Step 3: Optional provider direction & safety controls
  const [isMuslimahModest, setIsMuslimahModest] = useState(true);
  const [creativeInstruction, setCreativeInstruction] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [backgroundId, setBackgroundId] = useState('');
  const [builtInSceneId, setBuiltInSceneId] = useState('');
  const [niche, setNiche] = useState('auto');
  const [voicePersonality, setVoicePersonality] = useState('auto');
  const [storyboard, setStoryboard] = useState('auto');
  const [callToAction, setCallToAction] = useState('none');
  const [audioTreatment, setAudioTreatment] = useState('voiceover');
  const [customCta, setCustomCta] = useState('');
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [officialAvatars, setOfficialAvatars] = useState<AvatarOption[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([]);
  const [officialBackgrounds, setOfficialBackgrounds] = useState<BackgroundOption[]>([]);
  const [avatarCollectionFilter, setAvatarCollectionFilter] = useState('all');
  const [backgroundCollectionFilter, setBackgroundCollectionFilter] = useState('all');
  const [builtInScenes, setBuiltInScenes] = useState<BuiltInSceneOption[]>([]);
  const [presets, setPresets] = useState<CreatorPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [assetActionBusy, setAssetActionBusy] = useState(false);
  const defaultPresetApplied = useRef(false);
  const submitLockRef = useRef(false);

  // Status, Wallet & Durable Database Jobs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publicAvailability, setPublicAvailability] = useState({ nexabot: false, runninghub: false });
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJobDisplay | null>(null);
  const [recentJobs, setRecentJobs] = useState<ActiveJobDisplay[]>([]);
  const [pollElapsedTime, setPollElapsedTime] = useState<number>(0);
  const [providerCooldownSeconds, setProviderCooldownSeconds] = useState(0);

  // Selected Style Reference
  const selectedStyle = useMemo(() => {
    return getVideoStyle(selectedStyleId) || VIDEO_STYLES_REGISTRY[0];
  }, [selectedStyleId]);
  const selectedAvailable = publicAvailability[selectedStyle.engine];
  const supportsSoundOnly = ['NX09', 'NX10', 'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19', 'NX11'].includes(selectedStyle.id);
  const filteredOfficialAvatars = useMemo(() => officialAvatars.filter((item) =>
    avatarCollectionFilter === 'all' || item.ageGroup === avatarCollectionFilter || item.gender === avatarCollectionFilter
  ), [officialAvatars, avatarCollectionFilter]);
  const filteredOfficialBackgrounds = useMemo(() => officialBackgrounds.filter((item) =>
    backgroundCollectionFilter === 'all' || item.category === backgroundCollectionFilter
  ), [officialBackgrounds, backgroundCollectionFilter]);

  const openCustomize = () => {
    setMode('advanced');
    window.setTimeout(() => document.getElementById('customize-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  function applyPreset(preset: CreatorPreset) {
    const settings = preset.settings;
    setSelectedPresetId(preset.id); setSelectedStyleId(settings.styleId || 'NX01');
    setAvatarId(settings.avatarId || ''); setBackgroundId(settings.backgroundId || '');
    setBuiltInSceneId(settings.builtInSceneId || ''); setNiche(settings.niche || 'auto');
    setVoicePersonality(settings.voicePersonality || 'auto'); setStoryboard(settings.storyboard || 'auto');
    setCallToAction(settings.callToAction || 'none'); setAudioTreatment(settings.audioTreatment || 'voiceover');
    setCustomCta(settings.customCta || '');
    setIsMuslimahModest(settings.isMuslimahModest !== false);
    setCreativeInstruction(settings.creativeInstruction || '');
    setSubmitSuccess(`Preset “${preset.name}” digunakan. Pilih produk dan jana bila sedia.`);
  }

  const currentPersonalizationSettings = () => ({
    styleId: selectedStyleId, avatarId: avatarId || null, backgroundId: backgroundId || null,
    builtInSceneId: backgroundId ? null : builtInSceneId || null, niche, voicePersonality,
    storyboard, callToAction, audioTreatment, customCta: customCta.trim(),
    isMuslimahModest, creativeInstruction: creativeInstruction.trim(),
  });

  const savePreset = async () => {
    const name = window.prompt('Nama preset ini:')?.trim();
    if (!name) return;
    setAssetActionBusy(true); setSubmitError(null);
    try {
      const response = await fetch('/api/creator-presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, settings: currentPersonalizationSettings(), isDefault: presets.length === 0 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Preset tidak dapat disimpan.');
      setSelectedPresetId(data.id); await loadPersonalization(); setSubmitSuccess(`Preset “${name}” berjaya disimpan.`);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Preset tidak dapat disimpan.'); }
    finally { setAssetActionBusy(false); }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    const name = window.prompt('Nama avatar/presenter:')?.trim();
    if (!name) return;
    if (!window.confirm('Saya mengesahkan saya mempunyai hak dan keizinan individu dewasa dalam imej ini untuk digunakan sebagai avatar video.')) return;
    setAssetActionBusy(true); setSubmitError(null);
    try {
      const form = new FormData(); form.set('name', name); form.set('gender', 'female'); form.set('consent', 'true'); form.set('image', file);
      const response = await fetch('/api/avatars', { method: 'POST', body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Avatar tidak dapat disimpan.');
      setAvatarId(data.id); await loadPersonalization(); setSubmitSuccess(`Avatar “${name}” disimpan dan dipilih.`);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Avatar tidak dapat disimpan.'); }
    finally { setAssetActionBusy(false); }
  };

  const uploadBackground = async (file?: File) => {
    if (!file) return;
    const name = window.prompt('Nama latar ini:')?.trim();
    if (!name) return;
    setAssetActionBusy(true); setSubmitError(null);
    try {
      const form = new FormData(); form.set('name', name); form.set('image', file);
      const response = await fetch('/api/backgrounds', { method: 'POST', body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Latar tidak dapat disimpan.');
      setBackgroundId(data.id); setBuiltInSceneId(''); await loadPersonalization(); setSubmitSuccess(`Latar “${name}” disimpan dan dipilih.`);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Latar tidak dapat disimpan.'); }
    finally { setAssetActionBusy(false); }
  };

  useEffect(() => {
    fetch('/api/styles', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Status pembekal tidak tersedia')))
      .then((data) => setPublicAvailability({ nexabot: data.availability?.nexabot === true, runninghub: data.availability?.runninghub === true }))
      .catch(() => setPublicAvailability({ nexabot: false, runninghub: false }));
  }, []);

  async function loadPersonalization() {
    const [avatarResponse, backgroundResponse, presetResponse] = await Promise.all([
      fetch('/api/avatars', { cache: 'no-store' }),
      fetch('/api/backgrounds', { cache: 'no-store' }),
      fetch('/api/creator-presets', { cache: 'no-store' }),
    ]);
    if (avatarResponse.ok) {
      const data = await avatarResponse.json();
      setOfficialAvatars(data.officialAvatars || []); setAvatars(data.avatars || []);
    }
    if (backgroundResponse.ok) {
      const data = await backgroundResponse.json();
      setOfficialBackgrounds(data.officialBackgrounds || []); setBackgrounds(data.backgrounds || []); setBuiltInScenes(data.builtInScenes || []);
    }
    if (presetResponse.ok) {
      const data = await presetResponse.json();
      const items = (data.presets || []) as CreatorPreset[];
      setPresets(items);
      const requestedPreset = items.find((item) => item.id === searchParams.get('presetId'));
      const defaultPreset = requestedPreset || items.find((item) => item.isDefault);
      if (defaultPreset && !defaultPresetApplied.current && (!searchParams.get('styleId') || requestedPreset)) {
        defaultPresetApplied.current = true;
        applyPreset(defaultPreset);
      }
    }
  }

  // Load workspace-scoped creator assets and the optional default preset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPersonalization().catch(() => {}); }, [searchParams]);

  useEffect(() => {
    const selectedAssetId = searchParams.get('imageAssetId');
    if (!selectedAssetId) return;
    fetch('/api/products', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Imej produk tidak dapat dimuatkan.');
      const data = await response.json();
      const asset = data.assets?.find((item: { id: string }) => item.id === selectedAssetId);
      if (!asset) throw new Error('Imej produk tidak ditemui.');
      setImages([{ id: asset.id, assetId: asset.id, productId: asset.productId, name: asset.filename, size: 0,
        dataUrl: asset.imageUrl, category: asset.category || '', notes: asset.notes || '' }]);
      if (asset.name !== 'Produk tanpa nama') setProductName(asset.name);
    }).catch((err) => setSubmitError(err.message));
  }, [searchParams]);

  const requiredCredits = selectedStyle.engine === 'nexabot' ? 10 : 15;
  const hasActiveSubmission = Boolean(activeJob && (activeJob.status === 'PROCESSING' || activeJob.status === 'SUBMITTING'));
  const generationBlocked = !selectedAvailable || isSubmitting || isUploadingImage || images.length === 0 || hasActiveSubmission || providerCooldownSeconds > 0;

  useEffect(() => {
    if (providerCooldownSeconds <= 0) return;
    const timer = window.setInterval(() => setProviderCooldownSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [providerCooldownSeconds]);

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
          setRecentJobs(data.jobs.map((job: ActiveJobDisplay & { id?: string }) => ({ ...job, jobId: job.jobId || job.id })));
          // If there is an incomplete job in the queue, track it
          const pending = data.jobs.find(
            (j: ActiveJobDisplay) => j.status === 'PROCESSING' || j.status === 'SUBMITTING' || j.status === 'QUEUED' || j.status === 'QA_PENDING'
          );
          if (pending) setActiveJob((current) => current || { ...pending, jobId: pending.jobId || (pending as ActiveJobDisplay & { id: string }).id });
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

  async function cancelQueuedJob() {
    if (!activeJob || activeJob.status !== 'QUEUED') return;
    const response=await fetch(`/api/jobs?jobId=${encodeURIComponent(activeJob.jobId)}`,{method:'DELETE'});
    const data=await response.json();
    if(!response.ok){setSubmitError(data.error||'Tugasan tidak dapat dibatalkan.');return;}
    setSubmitSuccess(data.message);setActiveJob(null);await Promise.all([refreshAccountBalance(),refreshJobsFromDatabase()]);
  }

  const syncActiveJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs?jobId=${jobId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'COMPLETED') {
        setActiveJob((prev) => prev ? { ...prev, status: 'COMPLETED', videoUrl: data.output?.videoUrl || data.videoUrl } : null);
        await Promise.all([refreshAccountBalance(), refreshJobsFromDatabase()]);
      } else if (data.status === 'QA_PENDING') {
        setActiveJob((prev) => prev ? { ...prev, status: 'QA_PENDING' } : null);
        await refreshJobsFromDatabase();
      } else if (data.status === 'FAILED' || data.status === 'REJECTED') {
        if (data.failure?.category === 'provider_unavailable') setProviderCooldownSeconds(300);
        setActiveJob((prev) => prev ? {
          ...prev, status: data.status,
          errorMessage: data.error || data.errorMessage || data.rawStatus || 'Video tidak dapat diselesaikan.',
          creditRestored: data.creditRestored === true,
          failureHeadline: data.failure?.headline,
          failureGuidance: data.failure?.retryGuidance,
        } : null);
        await Promise.all([refreshAccountBalance(), refreshJobsFromDatabase()]);
      } else if (data.status === 'RUNNING' || data.status === 'PROCESSING' || data.status === 'PENDING' || data.status === 'SUBMITTING' || data.status === 'QUEUED') {
        setActiveJob((prev) => prev ? { ...prev, status: data.status === 'QUEUED' ? 'QUEUED' : data.status === 'SUBMITTING' ? 'SUBMITTING' : 'PROCESSING',
          rawStatus: data.rawStatus, retryScheduled: data.retryScheduled === true, retryCount: data.retryCount,
          maxRetries: data.maxRetries, nextRetryAt: data.nextRetryAt } : null);
      }
    } catch {
      // A transient network issue never fails or duplicates a durable job.
    }
  }, [refreshAccountBalance, refreshJobsFromDatabase]);

  // Poll immediately, every ten seconds while visible, and once whenever the
  // customer returns from a provider/background tab.
  const activeJobId = activeJob?.jobId;
  const activeJobStatus = activeJob?.status;
  useEffect(() => {
    if (!activeJobId || ['COMPLETED', 'FAILED', 'REJECTED', 'QA_PENDING'].includes(activeJobStatus || '')) return;
    setPollElapsedTime(0);
    const timerInterval = setInterval(() => setPollElapsedTime((prev) => prev + 1), 1000);
    const poll = () => { if (document.visibilityState === 'visible') void syncActiveJobStatus(activeJobId); };
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void syncActiveJobStatus(activeJobId); };
    void syncActiveJobStatus(activeJobId);
    const pollInterval = setInterval(poll, 10000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeJobId, activeJobStatus, syncActiveJobStatus]);

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
    setSubmitError(null);
    setSubmitSuccess(null);
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
        setImages([{ id: crypto.randomUUID(), name: file.name, size: file.size, dataUrl,
          assetId: result.assetId, productId: result.productId, category: '', notes: '' }]);
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
      engine: 'nexabot',
      category: styleCategoryFilter === 'all' ? undefined : styleCategoryFilter,
      searchQuery: styleSearch,
    });
  }, [styleCategoryFilter, styleSearch]);

  // Primary Action: Submit Generation Task
  const handleGenerateVideo = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!selectedAvailable) {
      setSubmitError(`${selectedStyle.engine === 'nexabot' ? 'AffiMatik Voice' : 'AffiMatik Motion'} belum diaktifkan untuk pelanggan. Tiada kredit ditolak.`);
      return;
    }

    if (images.length === 0 || isUploadingImage) {
      setSubmitError('Sila muat naik sekurang-kurangnya satu gambar produk untuk menjana video.');
      return;
    }

    if (callToAction === 'custom' && !customCta.trim()) {
      setSubmitError('Masukkan ayat Custom CTA.');
      openCustomize();
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

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const image = images[0];
      if (productName.trim() && image.productId) {
        const metadataResponse = await fetch('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: image.productId, name: productName.trim(),
            category: image.category || '', notes: image.notes || '' }),
        });
        if (!metadataResponse.ok) {
          const metadataError = await metadataResponse.json().catch(() => ({}));
          throw new Error(metadataError.error || 'Nama produk tidak dapat disimpan. Sila cuba semula.');
        }
      }
      const clientRequestId = `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const payload: Record<string, unknown> = {
        clientRequestId,
        styleId: selectedStyle.id,
        productName: productName.trim() || undefined,
        creativeInstruction: creativeInstruction.trim() || undefined,
        isMuslimahModest,
        imageAssetId: images[0].assetId,
        avatarId: avatarId || undefined,
        backgroundId: backgroundId || undefined,
        builtInSceneId: backgroundId ? undefined : builtInSceneId || undefined,
        niche,
        voicePersonality,
        storyboard,
        callToAction,
        audioTreatment,
        customCta: callToAction === 'custom' ? customCta.trim() : undefined,
        creatorPresetId: selectedPresetId || undefined,
      };

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.failure?.category === 'provider_unavailable') setProviderCooldownSeconds(300);
        throw new Error(data.error || 'Gagal menghantar tugasan penjanaan video.');
      }

      setSubmitSuccess(data.queued ? data.message || 'Tugasan selamat dalam giliran Nexabot.' : data.retryScheduled
        ? data.message || 'Pelayan Nexabot sedang terganggu. AffiMatik akan mencuba semula secara automatik dan kredit anda kekal selamat.'
        : 'Tugasan penjanaan video berjaya didaftarkan. Sistem sedang memproses babak.');
      const newJobDisplay: ActiveJobDisplay = {
        jobId: data.jobId,
        providerTaskId: data.providerTaskId,
        provider: data.provider || selectedStyle.engine,
        styleName: selectedStyle.name,
        durationSeconds: selectedStyle.durationSeconds,
        status: data.status === 'QUEUED' ? 'QUEUED' : data.status === 'SUBMITTING' ? 'SUBMITTING' : 'PROCESSING',
        requiredCredits,
        retryScheduled: data.retryScheduled === true,
        retryCount: data.retryCount,
        maxRetries: data.maxRetries,
        nextRetryAt: data.nextRetryAt,
        createdAt: new Date().toISOString(),
      };

      setActiveJob(newJobDisplay);
      setRecentJobs((prev) => [newJobDisplay, ...prev.filter((j) => j.jobId !== newJobDisplay.jobId)]);
      refreshAccountBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
    } finally {
      submitLockRef.current = false;
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
              AffiMatik Creator Studio
            </h1>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full border border-primary/20">
              Masterprompt V10.1
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Quick Create untuk hasil pantas, atau Customize avatar, latar dan cara penyampaian.
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
              onClick={openCustomize}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                mode === 'advanced' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Customize
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

          {/* STEP 2: PRESET-FIRST QUICK CREATE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span><div><h3 className="text-sm font-bold text-slate-900">Pilih Preset</h3><p className="text-[11px] text-slate-500">Setup creator boleh guna semula tanpa menukar produk yang baru dipilih.</p></div></div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setSelectedPresetId('')} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-[11px] ${!selectedPresetId ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}><span className="block font-bold">Auto / Tanpa Preset</span><span className="text-[10px]">Ikut pilihan semasa</span></button>
              {presets.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-[11px] ${selectedPresetId === preset.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}><span className="block font-bold">{preset.name}{preset.isDefault ? ' · Default' : ''}</span><span className="text-[10px]">{preset.settings.styleId} · {preset.settings.voicePersonality === 'auto' ? 'Suara ikut gaya' : preset.settings.voicePersonality}</span></button>)}
            </div>
          </div>

          {/* STEP 3: CHOOSE ENGINE & VIDEO STYLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900">Pilih Jenis Video & Gaya</h3>
              </div>
              <span className="text-xs font-bold text-primary">
                {selectedStyle.name} ({selectedStyle.durationSeconds}s • {selectedStyle.engine === 'nexabot' ? '10' : '15'} Kredit)
              </span>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary shrink-0" />
              <span><strong>AffiMatik Voice V10.1 · Nexabot 15s</strong> — 20 personaliti kreatif BM Malaysia, 10 kredit setiap video.</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {STYLE_CATEGORIES_V6.map((item) => <button key={item.id} type="button" onClick={() => setStyleCategoryFilter(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold ${styleCategoryFilter === item.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}>{item.label}</button>)}
            </div>

            {/* Poster-first style gallery; video is requested only on hover/Preview. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Pilih daripada 20 Gaya Video Rasmi:</span>
                <span className="text-[11px] text-slate-400">{displayedStyles.length} gaya dipaparkan</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedStyles.map((style) => {
                  const isSelected = style.id === selectedStyle.id;
                  const metadata = getStyleMarketingMetadata(style.id);
                  if (!metadata) return null;

                  return (
                    <div
                      key={style.id}
                      className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="mb-2 overflow-hidden rounded-xl">
                        <StylePosterMedia metadata={metadata} onPreview={() => setModalPreviewStyle(style)} compact />
                      </div>

                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold text-xs text-slate-900">{metadata.title}</div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                            {style.durationSeconds}s
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {metadata.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {metadata.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">{tag}</span>)}
                        </div>
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

          {/* STEP 4: NEXABOT NATIVE CREATIVE DIRECTION */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">4</span><div><h3 className="text-sm font-bold text-slate-900">Arah Kreatif & CTA</h3><p className="text-[11px] text-slate-500">AffiMatik mengarah gaya dan keselamatan. Nexabot memahami produk lalu mencipta dialog sendiri.</p></div></div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs leading-relaxed text-slate-700"><strong>Tiada skrip automatik:</strong> dialog tidak dijana atau dipratonton oleh AffiMatik. Produk, gaya dan arahan pilihan dihantar terus sebagai masterprompt.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-bold text-slate-700">CTA<select value={callToAction} onChange={(event) => setCallToAction(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="tiktok_shop">TikTok Shop — Beg Kuning</option><option value="click_button">Klik Butang Di Bawah</option><option value="tap_button">Tekan Butang Di Bawah</option><option value="check_bio">Semak Bio</option><option value="dm_info">DM Untuk Info</option><option value="none">Tanpa CTA</option><option value="custom">Custom CTA</option></select></label>
              {supportsSoundOnly && <label className="text-[11px] font-bold text-slate-700">Audio<select value={audioTreatment} onChange={(event) => setAudioTreatment(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="voiceover">Suara Malaysia</option><option value="ambient">Ambient — Eksperimental</option><option value="asmr">ASMR Produk — Eksperimental</option></select></label>}
            </div>
            <div className="flex justify-end"><button type="button" onClick={openCustomize} className="text-[11px] font-bold text-primary">Customize personaliti atau arahan kreatif →</button></div>
          </div>

          {/* OPTIONAL PERSONALIZATION STUDIO */}
          {mode === 'advanced' && (
            <div id="customize-panel" className="scroll-mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Sliders className="w-4 h-4 text-primary" /><span>Customize Video</span></h3>
                <button type="button" onClick={savePreset} disabled={assetActionBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"><BookmarkPlus className="h-3.5 w-3.5" />Simpan sebagai Preset</button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                <div className="font-bold text-slate-900">Status Personalisasi Provider</div>
                <div className="mt-1"><span className="font-semibold text-emerald-700">Disahkan:</span> produk sahaja, latar imej, serta arahan teks untuk niche, personaliti, storyboard, CTA dan latar terbina dalam.</div>
                <div><span className="font-semibold text-amber-700">Beta:</span> avatar imej dan gabungan avatar + latar telah lulus ujian terkawal, tetapi hasil rujukan wajah masih bergantung pada provider.</div>
                <div>Aset tersimpan kekal selamat. Rujukan imej yang dipilih akan dihantar mengikut peranannya dan tidak akan digugurkan secara senyap.</div>
              </div>

              {(avatarId || backgroundId) && (
                <div role="status" className={`rounded-xl border p-3 text-[11px] leading-relaxed ${avatarId ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
                  <strong>{avatarId ? 'Ciri Beta:' : 'Konfigurasi disahkan:'}</strong>{' '}
                  {avatarId && backgroundId ? 'Produk + Avatar + Latar' : avatarId ? 'Produk + Avatar' : 'Produk + Latar'}.
                  {' '}Provider akan menerima semua rujukan dalam urutan produk → avatar → latar; tiada rujukan dipadam secara senyap. Jika provider gagal, tempahan kredit dilepaskan.
                </div>
              )}

              {presets.length > 0 && <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Preset Tersimpan</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {presets.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold ${selectedPresetId === preset.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>{preset.name}{preset.isDefault ? ' · Default' : ''}</button>)}
                </div>
              </div>}

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-700"><UserRound className="h-3.5 w-3.5" />Avatar / Presenter <span className="font-normal text-slate-400">(Pilihan)</span></label>
                <div className="space-y-3">
                  <div><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Auto</div><button type="button" onClick={() => setAvatarId('')} className={`rounded-xl border px-3 py-2 text-[10px] font-semibold ${!avatarId ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}><Sparkles className="mr-1 inline h-3.5 w-3.5" />Auto Presenter</button></div>
                  <div data-testid="official-avatar-collection">
                    <div className="mb-2 flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Koleksi AffiMatik</div><div className="text-[10px] text-slate-500">12 presenter Malaysia · Avatar Beta</div></div><select aria-label="Tapis avatar rasmi" value={avatarCollectionFilter} onChange={(event) => setAvatarCollectionFilter(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px]"><option value="all">Semua</option><option value="female">Wanita</option><option value="male">Lelaki</option><option value="young">Muda</option><option value="mature">Matang</option><option value="senior">Senior</option></select></div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{filteredOfficialAvatars.map((avatar) => <button key={avatar.id} type="button" onClick={() => setAvatarId(avatar.id)} className={`overflow-hidden rounded-xl border p-1.5 text-[10px] font-semibold ${avatarId === avatar.id ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10' : 'border-slate-200'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatar.thumbnailUrl || avatar.imageUrl} alt={avatar.name} className="aspect-[3/4] w-full rounded-lg object-cover object-top" /><span className="mt-1 block truncate">{avatar.name}</span>
                    </button>)}</div>
                  </div>
                  <div><div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Milik Saya</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{avatars.map((avatar) => <button key={avatar.id} type="button" onClick={() => setAvatarId(avatar.id)} className={`rounded-xl border p-1.5 text-[10px] font-semibold ${avatarId === avatar.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar.thumbnailUrl || avatar.imageUrl} alt={avatar.name} className="aspect-[3/4] w-full rounded-lg object-cover object-top" /><span className="mt-1 block truncate">{avatar.name}</span>
                  </button>)}<label className="rounded-xl border border-dashed border-slate-300 p-2 text-center text-[10px] font-semibold text-slate-500 cursor-pointer hover:border-primary"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={assetActionBusy} onChange={(event) => { uploadAvatar(event.target.files?.[0]); event.target.value = ''; }} /><div className="mx-auto mb-1 flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-slate-50"><Upload className="h-4 w-4" /></div>Upload Baru</label></div>{avatars.length === 0 && <div className="mt-1 text-[10px] text-slate-400">Belum ada avatar peribadi.</div>}</div>
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-700"><ImageIcon className="h-3.5 w-3.5" />Latar / Babak <span className="font-normal text-slate-400">(Pilihan)</span></label>
                <div className="space-y-3">
                  <div><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Auto</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><button type="button" onClick={() => { setBackgroundId(''); setBuiltInSceneId(''); }} className={`rounded-xl border p-2 text-[10px] font-semibold ${!backgroundId && !builtInSceneId ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>Auto Sesuai Produk</button>{builtInScenes.map((scene) => <button key={scene.id} type="button" onClick={() => { setBuiltInSceneId(scene.id); setBackgroundId(''); }} title={scene.directive} className={`rounded-xl border p-2 text-[10px] font-semibold ${builtInSceneId === scene.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>{scene.name}</button>)}</div></div>
                  <div data-testid="official-background-collection">
                    <div className="mb-2 flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Koleksi AffiMatik</div><div className="text-[10px] text-slate-500">18 latar rasmi yang dioptimumkan</div></div><select aria-label="Tapis latar rasmi" value={backgroundCollectionFilter} onChange={(event) => setBackgroundCollectionFilter(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px]"><option value="all">Semua</option><option value="living">Ruang Rumah</option><option value="kitchen">Dapur</option><option value="beauty">Beauty</option><option value="workspace">Workspace</option><option value="lifestyle">Lifestyle</option><option value="automotive">Automotif</option><option value="outdoor">Outdoor</option></select></div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">{filteredOfficialBackgrounds.map((background) => <button key={background.id} type="button" onClick={() => { setBackgroundId(background.id); setBuiltInSceneId(''); }} className={`overflow-hidden rounded-xl border p-1.5 text-[10px] font-semibold ${backgroundId === background.id ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10' : 'border-slate-200'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={background.thumbnailUrl || background.imageUrl} alt={background.name} className="aspect-[9/16] w-full rounded-lg object-cover" /><span className="mt-1 block truncate">{background.name}</span>
                    </button>)}</div>
                  </div>
                  <div><div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Milik Saya</div>{backgrounds.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{backgrounds.map((background) => <button key={background.id} type="button" onClick={() => { setBackgroundId(background.id); setBuiltInSceneId(''); }} className={`rounded-xl border p-1.5 text-[10px] font-semibold ${backgroundId === background.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={background.thumbnailUrl || background.imageUrl} alt={background.name} className="aspect-[9/16] w-full rounded-lg object-cover" /><span className="mt-1 block truncate">{background.name}</span>
                  </button>)}</div>}<label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-600"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={assetActionBusy} onChange={(event) => { uploadBackground(event.target.files?.[0]); event.target.value = ''; }} /><Upload className="h-3.5 w-3.5" />Upload Latar Sendiri</label>{backgrounds.length === 0 && <div className="mt-1 text-[10px] text-slate-400">Belum ada latar peribadi.</div>}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-[11px] font-bold text-slate-700">Niche / Kategori<select value={niche} onChange={(e) => setNiche(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="auto">Auto ikut imej</option><option value="wellness">Supplement & Wellness</option><option value="beauty">Beauty & Kosmetik</option><option value="kitchen">Produk Dapur</option><option value="automotive">Aksesori Automotif</option><option value="gadgets">Gajet</option><option value="home">Home Living</option><option value="fashion">Fesyen</option><option value="gardening">Gardening</option></select></label>
                <label className="text-[11px] font-bold text-slate-700">Personaliti Suara<select value={voicePersonality} onChange={(e) => setVoicePersonality(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="auto">Ikut gaya dipilih</option><option value="friendly">Mesra macam kawan</option><option value="confident">Yakin</option><option value="calm">Tenang</option><option value="energetic">Bertenaga</option><option value="helpful">Membantu</option><option value="premium">Premium & kemas</option></select></label>
                <label className="text-[11px] font-bold text-slate-700">Storyboard<select value={storyboard} onChange={(e) => setStoryboard(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="auto">Auto ikut gaya</option><option value="conversation">Sembang presenter</option><option value="problem_demo">Masalah → demo</option><option value="step_by_step">Langkah demi langkah</option><option value="before_after_context">Konteks sebelum/selepas</option><option value="q_and_a">Soalan & jawapan</option><option value="product_showcase">Showcase produk</option></select></label>
                <label className="text-[11px] font-bold text-slate-700">CTA<select value={callToAction} onChange={(e) => setCallToAction(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="tiktok_shop">TikTok Shop — Beg Kuning</option><option value="click_button">Klik Butang Di Bawah</option><option value="tap_button">Tekan Butang Di Bawah</option><option value="check_bio">Semak Bio</option><option value="dm_info">DM Untuk Info</option><option value="none">Tanpa CTA</option><option value="custom">Custom CTA</option></select></label>
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

              <section className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4" aria-labelledby="masterprompt-director-title">
                <div>
                  <div id="masterprompt-director-title" className="text-[11px] font-bold text-slate-800">Pawarna Masterprompt Director™</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-600">Nexabot meneliti imej produk dan mencipta konsep serta dialog Bahasa Melayu Malaysia sendiri. AffiMatik tidak menulis atau menyuntik skrip automatik.</p>
                </div>
                {callToAction === 'custom' && <label className="block text-[11px] font-bold text-slate-700">Ayat Custom CTA<input type="text" maxLength={80} value={customCta} onChange={(event) => setCustomCta(event.target.value)} placeholder="Contoh: DM saya kalau nak info lanjut." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal" /><span className="mt-1 block text-[10px] font-normal text-slate-500">Maksimum 80 aksara. Ayat dihantar seperti ditaip, tertakluk pada semakan keselamatan.</span></label>}
              </section>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Arahan Kreatif Tambahan <span className="text-slate-400 font-normal">(Pilihan)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={creativeInstruction}
                  onChange={(e) => setCreativeInstruction(e.target.value)}
                  placeholder="Contoh: Presenter lelaki, suara santai Utara, lokasi garaj rumah, fokus pengguna kereta. Jika anda mahu ayat tertentu, tulis sendiri di sini."
                  className="w-full resize-y text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <p className="mt-1 text-[10px] text-slate-500">Pilihan. AffiMatik tidak akan menulis semula, melengkapkan atau memparafrasa arahan anda.</p>
              </div>
            </div>
          )}

          {/* GENERATE ACTION BUTTON */}
          <div className="space-y-2">
            {!selectedAvailable && (
              <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                {selectedStyle.engine === 'nexabot' ? 'AffiMatik Voice' : 'AffiMatik Motion'} belum tersedia untuk pelanggan. Semakan kualiti dan pembekal masih berjalan; tiada kredit akan ditolak.
              </div>
            )}

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

            {providerCooldownSeconds > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-bold">Pelayan penjana video AI sedang pulih</div>
                <div className="mt-1">Butang Jana direhatkan sementara untuk mengelakkan cubaan berulang. Cuba lagi dalam {Math.ceil(providerCooldownSeconds / 60)} minit.</div>
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
              disabled={generationBlocked}
              aria-busy={isUploadingImage || isSubmitting || hasActiveSubmission}
              className={`w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                generationBlocked
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/95 active:scale-[0.99]'
              }`}
            >
              {!selectedAvailable ? (
                <span>Penjanaan Belum Tersedia</span>
              ) : isUploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Imej Produk...</span>
                </>
              ) : images.length === 0 ? (
                <span>Muat Naik Gambar Produk Dahulu</span>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mendaftarkan Tugasan Video...</span>
                </>
              ) : providerCooldownSeconds > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Pelayan AI Sedang Pulih ({Math.ceil(providerCooldownSeconds / 60)} min)</span>
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
                  {activeJob.status === 'COMPLETED' ? 'Video Siap' : activeJob.status === 'QA_PENDING' ? 'Menunggu Semakan' : activeJob.status === 'FAILED' || activeJob.status === 'REJECTED' ? 'Gangguan Pelayan' : 'Sedang Menjana'}
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
                        <h4 className="text-sm font-bold text-slate-900">{activeJob.status === 'QUEUED' ? 'Dalam Giliran' : activeJob.retryScheduled ? 'Pelayan Nexabot Sedang Pulih' : 'Sedang Menjana Video AI'}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Gaya: {activeJob.styleName} ({activeJob.durationSeconds}s)
                        </p>
                      </div>
                      {activeJob.retryScheduled && (
                        <div className="mx-auto max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
                          <p className="font-bold">Ini gangguan pelayan Nexabot—bukan semestinya masalah prompt atau gambar anda.</p>
                          <p className="mt-1">AffiMatik akan cuba semula secara automatik ({activeJob.retryCount || 1}/{activeJob.maxRetries || 3}). Kredit masih ditempah dan tidak akan dicaj dua kali.</p>
                          {activeJob.nextRetryAt && <p className="mt-1 text-[11px]">Cubaan seterusnya sekitar {new Date(activeJob.nextRetryAt).toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit'})}.</p>}
                        </div>
                      )}
                      {activeJob.status === 'QUEUED' && <div className="mx-auto max-w-sm rounded-xl border border-blue-200 bg-blue-50 p-3 text-left text-xs text-blue-900"><p className="font-bold">Tugasan anda tersimpan dalam giliran global.</p><p className="mt-1">AffiMatik akan menghantarnya apabila salah satu daripada tiga slot Nexabot tersedia. Kredit ditempah sekali sahaja dan anda boleh keluar atau refresh halaman ini.</p><button type="button" onClick={()=>void cancelQueuedJob()} className="mt-3 rounded-lg border border-blue-300 bg-white px-3 py-2 font-bold text-blue-800">Batalkan & Pulangkan Kredit</button></div>}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-mono text-slate-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Masa berlalu: {pollElapsedTime}s</span>
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Tugasan selamat disimpan di pangkalan data. Anda boleh muat semula atau tinggalkan halaman ini tanpa kehilangan kerja.
                      </p>
                      <button
                        type="button"
                        onClick={() => void syncActiveJobStatus(activeJob.jobId)}
                        className="mx-auto rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        Semak Status Sekarang
                      </button>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                        Status turut diselaraskan apabila anda kembali ke tab ini dan oleh sistem latar belakang.
                      </p>
                    </div>
                  )}

                  {/* Completed State (Interactive MP4 Video Player) */}
                  {activeJob.status === 'QA_PENDING' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Video sudah disimpan dan sedang disemak. Kredit masih ditempah; video akan muncul di Pustaka Video selepas diluluskan. Semak Production Queue untuk status terkini.</div>}
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
                          <button
                            type="button"
                            onClick={() => void downloadPrivateMp4(
                              activeJob.videoUrl!,
                              `affimatik-${selectedStyle.slug}-${activeJob.jobId.slice(0, 8)}.mp4`,
                            ).catch((error) => setSubmitError(error instanceof Error ? error.message : 'Video tidak dapat dimuat turun.'))}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Muat Turun MP4</span>
                          </button>
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
                  {(activeJob.status === 'FAILED' || activeJob.status === 'REJECTED') && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>{activeJob.failureHeadline || 'Penjanaan Terhenti'}</span>
                      </div>
                      <p>{activeJob.errorMessage || 'Tugasan tidak dapat diselesaikan oleh pelayan video AI.'}</p>
                      {activeJob.creditRestored && (
                        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">
                          Kredit untuk tugasan ini telah dipulangkan secara automatik.
                        </p>
                      )}
                      {activeJob.failureGuidance && <p className="text-rose-700">{activeJob.failureGuidance}</p>}
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
                    <div>• Enjin: {selectedStyle.engine === 'nexabot' ? 'AffiMatik Voice (15s)' : 'AffiMatik Motion (tidak tersedia)'}</div>
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
                        {job.status === 'COMPLETED' ? 'Siap' : job.status === 'QA_PENDING' ? 'Menunggu QA' : job.status === 'FAILED' || job.status === 'REJECTED' ? 'Pelayan Gagal · Kredit Selamat' : job.retryScheduled ? 'Cuba Semula Automatik' : 'Memproses'}
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
                  {modalPreviewStyle.engine === 'nexabot' ? 'Sampel 15s sebenar untuk gaya ini' : 'Gaya Motion belum tersedia'}
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
        {submitError && (
          <div role="alert" className="max-w-md mx-auto mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800">
            {submitError}
          </div>
        )}
        {providerCooldownSeconds > 0 && (
          <div className="max-w-md mx-auto mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
            Pelayan AI sedang pulih · cuba lagi dalam {Math.ceil(providerCooldownSeconds / 60)} minit.
          </div>
        )}
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
            disabled={generationBlocked}
            aria-busy={isUploadingImage || isSubmitting || hasActiveSubmission}
            className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0 ${
              generationBlocked
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/95 active:scale-95'
            }`}
          >
            {!selectedAvailable ? (
              <span>Belum Tersedia</span>
            ) : isUploadingImage ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Simpan Imej...</span>
              </>
            ) : images.length === 0 ? (
              <span>Muat Naik Produk</span>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menjana...</span>
              </>
            ) : providerCooldownSeconds > 0 ? (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>AI Pulih {Math.ceil(providerCooldownSeconds / 60)}m</span>
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
