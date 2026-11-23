'use client';

/* eslint-disable @next/next/no-img-element */

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
  ArrowUp,
  LayoutDashboard,
  ListVideo,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import { VIDEO_STYLES_REGISTRY, PUBLISHED_STYLE_COUNT, getVideoStyle, filterVideoStyles, STYLE_CATEGORIES_V6 } from '@/lib/styles/registry';
import { VideoStyle, StyleCategory } from '@/lib/styles/types';
import { getStyleMarketingMetadata } from '@/lib/styles/marketing-metadata';
import { StylePosterMedia } from '@/components/styles/style-poster-media';
import { downloadPrivateMp4 } from '@/lib/download/client-download';
import { CreatorProfileSelector, FactoryCreatorProfile } from '@/components/factory/creator-profile-selector';
import { prepareImageUpload } from '@/lib/client/image-upload';
import Link from 'next/link';

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

interface ProductLibraryAsset {
  id: string;
  productId: string;
  name: string;
  category: string;
  notes: string;
  filename: string;
  createdAt: string;
  imageUrl: string;
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
  const [productAssets, setProductAssets] = useState<ProductLibraryAsset[]>([]);
  const [productLibraryLoading, setProductLibraryLoading] = useState(true);
  const [showProductLibrary, setShowProductLibrary] = useState(false);

  // Step 2: Engine Selector & Selected Video Style
  const [selectedStyleId, setSelectedStyleId] = useState<string>(initialStyleId);
  const [styleCategoryFilter, setStyleCategoryFilter] = useState<StyleCategory>('all');
  const [styleSearch, setStyleSearch] = useState('');
  const [modalPreviewStyle, setModalPreviewStyle] = useState<VideoStyle | null>(null);
  const [styleCollection, setStyleCollection] = useState<'all' | 'favorites' | 'recent'>('all');
  const [favoriteStyleIds, setFavoriteStyleIds] = useState<string[]>([]);
  const [recentStyleIds, setRecentStyleIds] = useState<string[]>([]);
  const [stylePreferencesLoaded, setStylePreferencesLoaded] = useState(false);
  const [stylePickerExpanded, setStylePickerExpanded] = useState(true);
  const [showAllStyles, setShowAllStyles] = useState(false);

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
  const [creatorProfiles, setCreatorProfiles] = useState<FactoryCreatorProfile[]>([]);
  const [selectedCreatorProfileId, setSelectedCreatorProfileId] = useState('');
  const [assetActionBusy, setAssetActionBusy] = useState(false);
  const [personalizationLoaded, setPersonalizationLoaded] = useState(false);
  const defaultPresetApplied = useRef(false);
  const factoryDraftRestored = useRef(false);
  const submitLockRef = useRef(false);
  const statusSectionRef = useRef<HTMLDivElement>(null);

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
  const [showFloatingNavigation, setShowFloatingNavigation] = useState(false);

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
  const allAvatarOptions = useMemo(() => [...officialAvatars, ...avatars], [officialAvatars, avatars]);
  const allBackgroundOptions = useMemo(() => [...officialBackgrounds, ...backgrounds], [officialBackgrounds, backgrounds]);
  const selectedCreatorProfile = useMemo(() => creatorProfiles.find((profile) => profile.id === selectedCreatorProfileId) || null, [creatorProfiles, selectedCreatorProfileId]);
  const selectedAvatar = useMemo(() => allAvatarOptions.find((item) => item.id === avatarId), [allAvatarOptions, avatarId]);
  const selectedBackground = useMemo(() => allBackgroundOptions.find((item) => item.id === backgroundId), [allBackgroundOptions, backgroundId]);
  const styleSupportsAvatar = !['hand_demo', 'product_handling', 'pov'].includes(selectedStyle.category) && !selectedStyle.id.startsWith('RH');
  const personalizationError = avatarId && !styleSupportsAvatar
    ? `Gaya ${selectedStyle.name} tidak menggunakan avatar presenter. Buang avatar atau pilih gaya presenter seperti NX01.`
    : avatarId && !selectedAvatar
      ? 'Avatar profile ini tidak lagi boleh diakses. Pilih avatar lain sebelum menjana.'
      : backgroundId && !selectedBackground
        ? 'Background profile ini tidak lagi boleh diakses. Pilih background lain sebelum menjana.'
        : '';

  const openCustomize = () => {
    setMode('advanced');
    window.setTimeout(() => document.getElementById('customize-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  function applyPreset(preset: CreatorPreset) {
    const settings = preset.settings;
    setSelectedCreatorProfileId('');
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

  function applyCreatorProfile(profile: FactoryCreatorProfile | null) {
    if (!profile) {
      setSelectedCreatorProfileId('');
      setAvatarId(''); setBackgroundId(''); setVoicePersonality('auto'); setNiche('auto');
      setSubmitSuccess('Tanpa Creator Profile dipilih. Anda masih boleh jana menggunakan tetapan automatik.');
      return;
    }
    setSelectedCreatorProfileId(profile.id);
    setSelectedPresetId('');
    setAvatarId(profile.settings?.avatarId || '');
    setBackgroundId(profile.settings?.backgroundId || '');
    setBuiltInSceneId('');
    setVoicePersonality(profile.settings?.voicePersonality || 'auto');
    setNiche(profile.settings?.niche || 'auto');
    if (profile.settings?.creativeInstruction) setCreativeInstruction(profile.settings.creativeInstruction);
    setSubmitSuccess(`Creator Profile digunakan: ${profile.name}`);
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
      const prepared = await prepareImageUpload(file, 'avatar');
      const form = new FormData(); form.set('name', name); form.set('gender', 'female'); form.set('consent', 'true'); form.set('image', prepared);
      const response = await fetch('/api/avatars', { method: 'POST', body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Avatar tidak dapat disimpan.');
      setAvatarId(data.id); setSelectedCreatorProfileId(''); await loadPersonalization(); setSubmitSuccess(`Avatar “${name}” disimpan dan dipilih.`);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Avatar tidak dapat disimpan.'); }
    finally { setAssetActionBusy(false); }
  };

  const uploadBackground = async (file?: File) => {
    if (!file) return;
    const name = window.prompt('Nama latar ini:')?.trim();
    if (!name) return;
    setAssetActionBusy(true); setSubmitError(null);
    try {
      const prepared = await prepareImageUpload(file, 'background');
      const form = new FormData(); form.set('name', name); form.set('image', prepared);
      const response = await fetch('/api/backgrounds', { method: 'POST', body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Latar tidak dapat disimpan.');
      setBackgroundId(data.id); setSelectedCreatorProfileId(''); setBuiltInSceneId(''); await loadPersonalization(); setSubmitSuccess(`Latar “${name}” disimpan dan dipilih.`);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Latar tidak dapat disimpan.'); }
    finally { setAssetActionBusy(false); }
  };

  useEffect(() => {
    fetch('/api/styles', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Status pembekal tidak tersedia')))
      .then((data) => setPublicAvailability({ nexabot: data.availability?.nexabot === true, runninghub: data.availability?.runninghub === true }))
      .catch(() => setPublicAvailability({ nexabot: false, runninghub: false }));
  }, []);

  useEffect(() => {
    const validIds = new Set(VIDEO_STYLES_REGISTRY.map((style) => style.id));
    const readStyleIds = (key: string) => {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(stored)
          ? stored.filter((id): id is string => typeof id === 'string' && validIds.has(id)).slice(0, 12)
          : [];
      } catch {
        localStorage.removeItem(key);
        return [];
      }
    };
    setFavoriteStyleIds(readStyleIds('affimatik:style-favorites-v1'));
    setRecentStyleIds(readStyleIds('affimatik:recent-styles-v1'));
    setStylePreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!stylePreferencesLoaded) return;
    localStorage.setItem('affimatik:style-favorites-v1', JSON.stringify(favoriteStyleIds));
  }, [favoriteStyleIds, stylePreferencesLoaded]);

  useEffect(() => {
    if (!stylePreferencesLoaded) return;
    localStorage.setItem('affimatik:recent-styles-v1', JSON.stringify(recentStyleIds));
  }, [recentStyleIds, stylePreferencesLoaded]);

  const loadProductLibrary = useCallback(async () => {
    setProductLibraryLoading(true);
    try {
      const response = await fetch('/api/products', { cache: 'no-store' });
      if (!response.ok) throw new Error('Product Library tidak dapat dimuatkan.');
      const data = await response.json();
      setProductAssets((data.assets || []) as ProductLibraryAsset[]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Product Library tidak dapat dimuatkan.');
    } finally {
      setProductLibraryLoading(false);
    }
  }, []);

  useEffect(() => { void loadProductLibrary(); }, [loadProductLibrary]);

  const selectProductAsset = (asset: ProductLibraryAsset) => {
    setImages([{ id: asset.id, assetId: asset.id, productId: asset.productId, name: asset.filename,
      size: 0, dataUrl: asset.imageUrl, category: asset.category || '', notes: asset.notes || '' }]);
    setProductName(asset.name === 'Produk tanpa nama' ? '' : asset.name);
    setShowProductLibrary(false);
    setSubmitError(null);
    setSubmitSuccess(`Produk “${asset.name}” dipilih daripada Product Library.`);
  };

  async function loadPersonalization() {
    const [avatarResponse, backgroundResponse, presetResponse, profileResponse] = await Promise.all([
      fetch('/api/avatars', { cache: 'no-store' }),
      fetch('/api/backgrounds', { cache: 'no-store' }),
      fetch('/api/creator-presets', { cache: 'no-store' }),
      fetch('/api/creator-profiles', { cache: 'no-store' }),
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
      if (requestedPreset && !defaultPresetApplied.current) {
        defaultPresetApplied.current = true;
        applyPreset(requestedPreset);
      }
    }
    if (profileResponse.ok) {
      const data = await profileResponse.json();
      const items = (data.profiles || []) as FactoryCreatorProfile[];
      setCreatorProfiles(items);
      const requested = items.find((item) => item.id === searchParams.get('profileId'));
      if (requested) applyCreatorProfile(requested);
    }
    setPersonalizationLoaded(true);
  }

  // Load workspace-scoped creator assets and the optional default preset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPersonalization().catch(() => {}); }, [searchParams]);

  useEffect(() => {
    if (!personalizationLoaded || factoryDraftRestored.current) return;
    factoryDraftRestored.current = true;
    try {
      const draft = JSON.parse(localStorage.getItem('affimatik:factory:draft-v1') || 'null');
      if (!draft) return;
      if (!searchParams.get('styleId') && getVideoStyle(draft.styleId)) setSelectedStyleId(draft.styleId);
      const savedProfile = creatorProfiles.find((profile) => profile.id === draft.creatorProfileId);
      if (!searchParams.get('profileId') && savedProfile) applyCreatorProfile(savedProfile);
      else if (!savedProfile) {
        if (allAvatarOptions.some((item) => item.id === draft.avatarId)) setAvatarId(draft.avatarId);
        if (allBackgroundOptions.some((item) => item.id === draft.backgroundId)) setBackgroundId(draft.backgroundId);
        if (typeof draft.voicePersonality === 'string') setVoicePersonality(draft.voicePersonality);
      }
      if (typeof draft.callToAction === 'string') setCallToAction(draft.callToAction);
      if (draft.imageAssetId && !searchParams.get('imageAssetId')) {
        fetch('/api/products',{cache:'no-store'}).then(async(response)=>{if(!response.ok)return;const data=await response.json(),asset=data.assets?.find((item:{id:string})=>item.id===draft.imageAssetId);if(asset)setImages([{id:asset.id,assetId:asset.id,productId:asset.productId,name:asset.filename,size:0,dataUrl:asset.imageUrl,category:asset.category||'',notes:asset.notes||''}])}).catch(()=>undefined);
      }
    } catch { localStorage.removeItem('affimatik:factory:draft-v1'); }
  }, [personalizationLoaded, creatorProfiles, allAvatarOptions, allBackgroundOptions, searchParams]);

  useEffect(() => {
    if (!factoryDraftRestored.current) return;
    localStorage.setItem('affimatik:factory:draft-v1', JSON.stringify({ imageAssetId:images[0]?.assetId||null, styleId:selectedStyleId, creatorProfileId:selectedCreatorProfileId||null, avatarId:avatarId||null, backgroundId:backgroundId||null, voicePersonality, callToAction }));
  }, [images, selectedStyleId, selectedCreatorProfileId, avatarId, backgroundId, voicePersonality, callToAction]);

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
  const hasActiveSubmission = Boolean(activeJob && ['QUEUED', 'SUBMITTING', 'PROCESSING', 'QA_PENDING'].includes(activeJob.status));
  const generationBlocked = !selectedAvailable || isSubmitting || isUploadingImage || images.length === 0 || providerCooldownSeconds > 0 || Boolean(personalizationError);

  useEffect(() => {
    const updateFloatingNavigation = () => setShowFloatingNavigation(window.scrollY > 360);
    updateFloatingNavigation();
    window.addEventListener('scroll', updateFloatingNavigation, { passive: true });
    return () => window.removeEventListener('scroll', updateFloatingNavigation);
  }, []);

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
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 15 * 1024 * 1024) {
      setSubmitError('Saiz imej melebihi had 15MB.');
      return;
    }

    setSubmitError(null);
    setSubmitSuccess(null);
    setIsUploadingImage(true);
    try {
        const prepared = await prepareImageUpload(file, 'product');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Imej tidak dapat dibaca.'));
          reader.readAsDataURL(prepared);
        });
        const form = new FormData();
        form.append('image', prepared);
        if (productName.trim()) form.append('name', productName.trim());
        const response = await fetch('/api/products', { method: 'POST', body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Imej tidak dapat disimpan.');
        setImages([{ id: crypto.randomUUID(), name: prepared.name, size: prepared.size, dataUrl,
          assetId: result.assetId, productId: result.productId, category: '', notes: '' }]);
        void loadProductLibrary();
        setSubmitError(null);
      } catch (err) {
        setImages([]);
        setSubmitError(err instanceof Error ? err.message : 'Imej tidak dapat disimpan.');
      } finally { setIsUploadingImage(false); }
  };

  const selectVideoStyle = useCallback((styleId: string) => {
    setSelectedStyleId(styleId);
    setRecentStyleIds((current) => [styleId, ...current.filter((id) => id !== styleId)].slice(0, 5));
    setStylePickerExpanded(false);
  }, []);

  const toggleFavoriteStyle = useCallback((styleId: string) => {
    setFavoriteStyleIds((current) => current.includes(styleId)
      ? current.filter((id) => id !== styleId)
      : [styleId, ...current]);
  }, []);

  const openStylePicker = useCallback(() => {
    setStylePickerExpanded(true);
    window.setTimeout(() => document.getElementById('style-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, []);

  // Filtered styles catalogue
  const displayedStyles = useMemo(() => {
    const filtered = filterVideoStyles({
      engine: 'nexabot',
      category: styleCategoryFilter === 'all' ? undefined : styleCategoryFilter,
      searchQuery: styleSearch,
    });
    if (styleCollection === 'favorites') return filtered.filter((style) => favoriteStyleIds.includes(style.id));
    if (styleCollection === 'recent') {
      return recentStyleIds
        .map((id) => filtered.find((style) => style.id === id))
        .filter((style): style is VideoStyle => Boolean(style));
    }
    return filtered;
  }, [styleCategoryFilter, styleSearch, styleCollection, favoriteStyleIds, recentStyleIds]);

  const visibleStyles = useMemo(
    () => showAllStyles ? displayedStyles : displayedStyles.slice(0, 6),
    [displayedStyles, showAllStyles],
  );

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
        productCategory: image.category || undefined,
        productNotes: image.notes || undefined,
        creativeInstruction: creativeInstruction.trim() || undefined,
        isMuslimahModest,
        imageAssetId: images[0].assetId,
        avatarId: avatarId || null,
        backgroundId: backgroundId || null,
        builtInSceneId: backgroundId ? undefined : builtInSceneId || undefined,
        niche,
        voicePersonality,
        storyboard,
        callToAction,
        audioTreatment,
        customCta: callToAction === 'custom' ? customCta.trim() : undefined,
        creatorPresetId: selectedPresetId || undefined,
        creatorProfileId: selectedCreatorProfileId || undefined,
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
      window.setTimeout(() => statusSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
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

  const prepareNextVideo = () => {
    setImages([]);
    setProductName('');
    setShowProductLibrary(false);
    setActiveJob(null);
    setSubmitSuccess(null);
    setSubmitError(null);
    setPollElapsedTime(0);
    window.setTimeout(() => document.getElementById('product-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const handlePrimaryAction = () => {
    if (hasActiveSubmission) {
      prepareNextVideo();
      return;
    }
    void handleGenerateVideo();
  };

  return (
    <div id="factory-top" className="max-w-7xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Jana Video
            </h1>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full border border-primary/20">
              4 Langkah Mudah
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pilih Creator Profile, produk dan gaya. Semak arah kreatif, kemudian jana.
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
              Simple
            </button>
            <button
              type="button"
              onClick={openCustomize}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                mode === 'advanced' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Advanced
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
          {/* STEP 1: CREATOR PROFILE */}
          <CreatorProfileSelector
            profiles={creatorProfiles}
            selectedProfileId={selectedCreatorProfileId}
            avatars={allAvatarOptions}
            backgrounds={allBackgroundOptions}
            createStudioHref={`/creator-profiles?new=1&returnTo=factory&styleId=${encodeURIComponent(selectedStyleId)}${images[0]?.assetId ? `&imageAssetId=${encodeURIComponent(images[0].assetId)}` : ''}`}
            compatibilityError={personalizationError || undefined}
            onSelectProfile={applyCreatorProfile}
          />

          {/* STEP 2: UPLOAD OR REUSE PRODUCT */}
          <div id="product-step" className="scroll-mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900">Gambar & Maklumat Produk</h3>
              </div>
              <span className="text-[11px] text-slate-500">Imej Rujukan Visual (Bukan Wajib Frame Pertama)</span>
            </div>

            {images.length === 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="min-h-40 border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-slate-50/50 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Upload Gambar Baharu</span>
                  <span className="text-[11px] text-slate-400 mt-1">JPG, PNG atau WebP · Maksimum 15MB</span>
                </label>
                <button type="button" onClick={() => setShowProductLibrary((current) => !current)} className="min-h-40 rounded-2xl border-2 border-indigo-100 bg-indigo-50/60 p-5 text-center transition hover:border-indigo-300 hover:bg-indigo-50">
                  <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm"><Layers className="h-5 w-5" /></span>
                  <strong className="block text-xs text-slate-900">Pilih dari Product Library</strong>
                  <span className="mt-1 block text-[11px] text-slate-500">{productLibraryLoading ? 'Sedang memuatkan…' : productAssets.length ? `${productAssets.length} gambar tersimpan` : 'Belum ada gambar tersimpan'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
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
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => setShowProductLibrary((current) => !current)} className="min-h-10 rounded-lg border border-indigo-200 bg-white px-2.5 text-[10px] font-bold text-indigo-700">Pilih Lain</button>
                  <button type="button" onClick={() => { setImages([]); setProductName(''); }} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-all" title="Buang pilihan produk"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            {showProductLibrary && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-3" data-testid="factory-product-library">
                <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="text-xs font-black text-slate-900">Product Library Anda</h4><p className="text-[10px] text-slate-500">Pilih gambar yang pernah dimuat naik. Tiada upload semula diperlukan.</p></div><button type="button" onClick={() => setShowProductLibrary(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white" aria-label="Tutup Product Library"><X className="h-4 w-4" /></button></div>
                {productLibraryLoading ? <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuatkan produk…</div>
                  : productAssets.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-xs text-slate-500">Belum ada produk tersimpan. Upload gambar baharu untuk menambahnya ke library.</div>
                  : <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">{productAssets.map((asset) => <button key={asset.id} type="button" onClick={() => selectProductAsset(asset)} aria-pressed={images[0]?.assetId === asset.id} className={`overflow-hidden rounded-xl border bg-white p-1.5 text-left transition ${images[0]?.assetId === asset.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <img src={asset.imageUrl} alt={asset.name} className="aspect-square w-full rounded-lg bg-slate-50 object-contain" />
                    <strong className="mt-1.5 block truncate px-1 text-[10px] text-slate-800">{asset.name}</strong><span className="block truncate px-1 pb-1 text-[9px] text-slate-400">{asset.filename}</span>
                  </button>)}</div>}
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

          {/* STEP 3: CHOOSE ENGINE & VIDEO STYLE */}
          <div id="style-step" className="scroll-mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900">Pilih Jenis Video & Gaya</h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">Tekan mana-mana kad untuk pilih</span>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary shrink-0" />
              <span><strong>AffiMatik Voice · Nexabot 15s</strong> — {PUBLISHED_STYLE_COUNT} gaya video BM Malaysia, 10 kredit setiap video.</span>
            </div>

            {!stylePickerExpanded ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
                <div className="min-w-0">
                  <span className="block text-[9px] font-black uppercase tracking-wide text-primary">Gaya dipilih</span>
                  <strong className="block truncate text-sm text-slate-950">{selectedStyle.name}</strong>
                  <span className="text-[10px] text-slate-600">{selectedStyle.durationSeconds}s · 10 kredit</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleFavoriteStyle(selectedStyle.id)} aria-label={`${favoriteStyleIds.includes(selectedStyle.id) ? 'Buang' : 'Tambah'} ${selectedStyle.name} daripada kegemaran`} className={`grid min-h-10 min-w-10 place-items-center rounded-lg border ${favoriteStyleIds.includes(selectedStyle.id) ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-slate-200 bg-white text-slate-400'}`}><Star className={`h-4 w-4 ${favoriteStyleIds.includes(selectedStyle.id) ? 'fill-current' : ''}`} /></button>
                  <button type="button" onClick={openStylePicker} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 text-[11px] font-black text-indigo-700">Tukar Gaya <ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2" aria-label="Koleksi gaya pantas">
                {[
                  { id: 'all', label: 'Semua', icon: Layers, count: PUBLISHED_STYLE_COUNT },
                  { id: 'favorites', label: 'Kegemaran', icon: Star, count: favoriteStyleIds.length },
                  { id: 'recent', label: 'Baru Digunakan', icon: Clock, count: recentStyleIds.length },
                ].map((item) => { const Icon = item.icon; const active = styleCollection === item.id; return <button key={item.id} type="button" onClick={() => { setStyleCollection(item.id as 'all' | 'favorites' | 'recent'); setStyleCategoryFilter('all'); setShowAllStyles(false); }} className={`min-h-14 rounded-xl border px-2 py-2 text-center transition ${active ? 'border-primary bg-primary text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}><Icon className="mx-auto h-4 w-4" /><span className="mt-1 block text-[10px] font-black leading-tight">{item.label}</span><span className={`text-[9px] ${active ? 'text-white/75' : 'text-slate-400'}`}>{item.count}</span></button>; })}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={styleSearch} onChange={(event) => { setStyleSearch(event.target.value); setShowAllStyles(false); }} placeholder="Cari gaya, contoh: review, tudung, dapur..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Tapis gaya mengikut kategori">
                {STYLE_CATEGORIES_V6.map((item) => <button key={item.id} type="button" onClick={() => { setStyleCollection('all'); setStyleCategoryFilter(item.id); setShowAllStyles(false); }} className={`min-h-9 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold ${styleCollection === 'all' && styleCategoryFilter === item.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}>{item.label}</button>)}
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>{styleCollection === 'favorites' ? 'Gaya kegemaran anda' : styleCollection === 'recent' ? 'Gaya yang baru digunakan' : styleCategoryFilter === 'all' ? 'Pilihan gaya video' : STYLE_CATEGORIES_V6.find((item) => item.id === styleCategoryFilter)?.label}</span>
                <span className="text-[11px] text-slate-400">{Math.min(visibleStyles.length, displayedStyles.length)} daripada {displayedStyles.length}</span>
              </div>

              {displayedStyles.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center"><Star className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-2 text-xs font-bold text-slate-700">{styleCollection === 'favorites' ? 'Belum ada gaya kegemaran.' : styleCollection === 'recent' ? 'Belum ada gaya yang digunakan.' : 'Tiada gaya sepadan.'}</p><p className="mt-1 text-[10px] text-slate-500">{styleCollection === 'favorites' ? 'Tekan ikon bintang pada mana-mana kad untuk simpan di sini.' : 'Pilih kategori lain atau kosongkan carian.'}</p></div> : null}

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Pilih gaya video">
                {visibleStyles.map((style) => {
                  const isSelected = style.id === selectedStyle.id;
                  const isFavorite = favoriteStyleIds.includes(style.id);
                  const metadata = getStyleMarketingMetadata(style.id);
                  if (!metadata) return null;

                  return (
                    <div
                      key={style.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => selectVideoStyle(style.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          selectVideoStyle(style.id);
                        }
                      }}
                      className={`cursor-pointer p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <button type="button" onClick={(event) => { event.stopPropagation(); toggleFavoriteStyle(style.id); }} aria-label={`${isFavorite ? 'Buang' : 'Tambah'} ${metadata.title} daripada kegemaran`} className={`absolute right-5 top-5 z-20 grid h-9 w-9 place-items-center rounded-full border shadow-sm ${isFavorite ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-white/80 bg-white/90 text-slate-500'}`}><Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} /></button>
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
                        <span className={`${style.qualityStatus === 'video_tested' ? 'text-emerald-700' : 'text-sky-700'} font-semibold flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.qualityStatus === 'video_tested' ? 'bg-emerald-500' : 'bg-sky-500'}`}></span>
                          {style.qualityStatus === 'video_tested' ? '✓ Sampel Sebenar' : 'Prompt Staging'} ({style.engine === 'nexabot' ? '10' : '15'} Kr)
                        </span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${isSelected ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                          {isSelected ? '✓ Dipilih' : 'Tekan kad untuk pilih'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {displayedStyles.length > 6 && <button type="button" onClick={() => setShowAllStyles((current) => !current)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-700">{showAllStyles ? 'Tunjuk Lebih Sedikit' : `Lihat Semua ${displayedStyles.length} Gaya`} {showAllStyles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>}
            </div>
            )}
          </div>

          {/* STEP 4: NEXABOT NATIVE CREATIVE DIRECTION */}
          <div id="cta-step" className="scroll-mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">4</span><div><h3 className="text-sm font-bold text-slate-900">Arah Kreatif & CTA</h3><p className="text-[11px] text-slate-500">AffiMatik mengarah gaya dan keselamatan. Nexabot memahami produk lalu mencipta dialog sendiri.</p></div></div>
            <div data-testid="selected-style-confirmation" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <div><span className="block text-[9px] font-black uppercase tracking-wide text-indigo-500">Gaya dipilih</span><strong className="mt-0.5 block text-xs text-indigo-950">{selectedStyle.name}</strong><span className="text-[10px] text-indigo-700">{selectedStyle.durationSeconds}s · {selectedStyle.engine === 'nexabot' ? '10' : '15'} kredit</span></div>
              <button type="button" onClick={openStylePicker} className="min-h-10 rounded-lg border border-indigo-200 bg-white px-3 text-[10px] font-black text-indigo-700">Tukar Gaya</button>
            </div>
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Video Settings Lama <span className="font-normal text-slate-400">(Preset — compatibility)</span></label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {presets.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold ${selectedPresetId === preset.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>{preset.name}{preset.isDefault ? ' · Default' : ''}</button>)}
                </div>
              </div>}

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-700"><UserRound className="h-3.5 w-3.5" />Avatar / Presenter <span className="font-normal text-slate-400">(Pilihan)</span></label>
                <div className="space-y-3">
                  <div><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Auto</div><button type="button" onClick={() => {setAvatarId('');setSelectedCreatorProfileId('')}} className={`rounded-xl border px-3 py-2 text-[10px] font-semibold ${!avatarId ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}><Sparkles className="mr-1 inline h-3.5 w-3.5" />Auto Presenter</button></div>
                  <div data-testid="official-avatar-collection">
                    <div className="mb-2 flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Koleksi AffiMatik</div><div className="text-[10px] text-slate-500">12 presenter Malaysia · Avatar Beta</div></div><select aria-label="Tapis avatar rasmi" value={avatarCollectionFilter} onChange={(event) => setAvatarCollectionFilter(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px]"><option value="all">Semua</option><option value="female">Wanita</option><option value="male">Lelaki</option><option value="young">Muda</option><option value="mature">Matang</option><option value="senior">Senior</option></select></div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{filteredOfficialAvatars.map((avatar) => <button key={avatar.id} type="button" onClick={() => {setAvatarId(avatar.id);setSelectedCreatorProfileId('')}} className={`overflow-hidden rounded-xl border p-1.5 text-[10px] font-semibold ${avatarId === avatar.id ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10' : 'border-slate-200'}`}>
                      <img src={avatar.thumbnailUrl || avatar.imageUrl} alt={avatar.name} className="aspect-[3/4] w-full rounded-lg object-cover object-top" /><span className="mt-1 block truncate">{avatar.name}</span>
                    </button>)}</div>
                  </div>
                  <div><div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Milik Saya</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{avatars.map((avatar) => <button key={avatar.id} type="button" onClick={() => {setAvatarId(avatar.id);setSelectedCreatorProfileId('')}} className={`rounded-xl border p-1.5 text-[10px] font-semibold ${avatarId === avatar.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>
                    <img src={avatar.thumbnailUrl || avatar.imageUrl} alt={avatar.name} className="aspect-[3/4] w-full rounded-lg object-cover object-top" /><span className="mt-1 block truncate">{avatar.name}</span>
                  </button>)}<label className="rounded-xl border border-dashed border-slate-300 p-2 text-center text-[10px] font-semibold text-slate-500 cursor-pointer hover:border-primary"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={assetActionBusy} onChange={(event) => { uploadAvatar(event.target.files?.[0]); event.target.value = ''; }} /><div className="mx-auto mb-1 flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-slate-50"><Upload className="h-4 w-4" /></div>Upload Baru</label></div>{avatars.length === 0 && <div className="mt-1 text-[10px] text-slate-400">Belum ada avatar peribadi.</div>}</div>
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-700"><ImageIcon className="h-3.5 w-3.5" />Latar / Babak <span className="font-normal text-slate-400">(Pilihan)</span></label>
                <div className="space-y-3">
                  <div><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Auto</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><button type="button" onClick={() => { setBackgroundId(''); setBuiltInSceneId(''); setSelectedCreatorProfileId(''); }} className={`rounded-xl border p-2 text-[10px] font-semibold ${!backgroundId && !builtInSceneId ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>Auto Sesuai Produk</button>{builtInScenes.map((scene) => <button key={scene.id} type="button" onClick={() => { setBuiltInSceneId(scene.id); setBackgroundId(''); setSelectedCreatorProfileId(''); }} title={scene.directive} className={`rounded-xl border p-2 text-[10px] font-semibold ${builtInSceneId === scene.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>{scene.name}</button>)}</div></div>
                  <div data-testid="official-background-collection">
                    <div className="mb-2 flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Koleksi AffiMatik</div><div className="text-[10px] text-slate-500">18 latar rasmi yang dioptimumkan</div></div><select aria-label="Tapis latar rasmi" value={backgroundCollectionFilter} onChange={(event) => setBackgroundCollectionFilter(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px]"><option value="all">Semua</option><option value="living">Ruang Rumah</option><option value="kitchen">Dapur</option><option value="beauty">Beauty</option><option value="workspace">Workspace</option><option value="lifestyle">Lifestyle</option><option value="automotive">Automotif</option><option value="outdoor">Outdoor</option></select></div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">{filteredOfficialBackgrounds.map((background) => <button key={background.id} type="button" onClick={() => { setBackgroundId(background.id); setBuiltInSceneId(''); setSelectedCreatorProfileId(''); }} className={`overflow-hidden rounded-xl border p-1.5 text-[10px] font-semibold ${backgroundId === background.id ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10' : 'border-slate-200'}`}>
                      <img src={background.thumbnailUrl || background.imageUrl} alt={background.name} className="aspect-[9/16] w-full rounded-lg object-cover" /><span className="mt-1 block truncate">{background.name}</span>
                    </button>)}</div>
                  </div>
                  <div><div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Milik Saya</div>{backgrounds.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{backgrounds.map((background) => <button key={background.id} type="button" onClick={() => { setBackgroundId(background.id); setBuiltInSceneId(''); setSelectedCreatorProfileId(''); }} className={`rounded-xl border p-1.5 text-[10px] font-semibold ${backgroundId === background.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200'}`}>
                    <img src={background.thumbnailUrl || background.imageUrl} alt={background.name} className="aspect-[9/16] w-full rounded-lg object-cover" /><span className="mt-1 block truncate">{background.name}</span>
                  </button>)}</div>}<label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-600"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={assetActionBusy} onChange={(event) => { uploadBackground(event.target.files?.[0]); event.target.value = ''; }} /><Upload className="h-3.5 w-3.5" />Upload Latar Sendiri</label>{backgrounds.length === 0 && <div className="mt-1 text-[10px] text-slate-400">Belum ada latar peribadi.</div>}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-[11px] font-bold text-slate-700">Niche / Kategori<select value={niche} onChange={(e) => setNiche(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="auto">Auto ikut imej</option><option value="wellness">Supplement & Wellness</option><option value="beauty">Beauty & Kosmetik</option><option value="kitchen">Produk Dapur</option><option value="automotive">Aksesori Automotif</option><option value="gadgets">Gajet</option><option value="home">Home Living</option><option value="fashion">Fesyen</option><option value="gardening">Gardening</option></select></label>
                <label className="text-[11px] font-bold text-slate-700">Personaliti Suara<select value={voicePersonality} onChange={(e) => {setVoicePersonality(e.target.value);setSelectedCreatorProfileId('')}} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"><option value="auto">Ikut gaya dipilih</option><option value="friendly">Mesra macam kawan</option><option value="confident">Yakin</option><option value="calm">Tenang</option><option value="energetic">Bertenaga</option><option value="helpful">Membantu</option><option value="premium">Premium & kemas</option></select></label>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="generation-summary">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-900">Semak Sebelum Jana</h3><p className="text-[11px] text-slate-500">Ini tetapan sebenar yang akan dihantar kepada Nexabot.</p></div><Link href={`/auto-factory?profileId=${encodeURIComponent(selectedCreatorProfileId)}&styleId=${encodeURIComponent(selectedStyleId)}`} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-black text-indigo-700">Jana Banyak Video</Link></div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <SummaryRow label="Produk" value={images[0]?.name || 'Belum dipilih'} image={images[0]?.dataUrl} onEdit={() => document.getElementById('product-step')?.scrollIntoView({behavior:'smooth'})}/>
                <SummaryRow label="Gaya" value={selectedStyle.name} onEdit={openStylePicker}/>
                <SummaryRow label="Creator Profile" value={selectedCreatorProfile?.name || 'Tanpa Profile'} onEdit={() => document.getElementById('creator-step')?.scrollIntoView({behavior:'smooth'})}/>
                <SummaryRow label="Avatar" value={selectedAvatar?.name || 'Tiada / Automatik'} image={selectedAvatar?.thumbnailUrl || selectedAvatar?.imageUrl} onEdit={() => document.getElementById('creator-step')?.scrollIntoView({behavior:'smooth'})}/>
                <SummaryRow label="Background" value={selectedBackground?.name || 'Automatik'} image={selectedBackground?.thumbnailUrl || selectedBackground?.imageUrl} onEdit={() => document.getElementById('creator-step')?.scrollIntoView({behavior:'smooth'})}/>
                <SummaryRow label="CTA" value={callToAction === 'tiktok_shop' ? 'Tekan beg kuning' : callToAction === 'none' ? 'Tanpa CTA' : callToAction.replaceAll('_',' ')} onEdit={() => document.getElementById('cta-step')?.scrollIntoView({behavior:'smooth'})}/>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><span>{selectedStyle.durationSeconds}s · <strong>{requiredCredits} kredit</strong></span><span>Baki tersedia: <strong className="text-indigo-700">{userBalance ?? '—'} kredit</strong></span></div>
            </div>
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
              onClick={handlePrimaryAction}
              disabled={!hasActiveSubmission && generationBlocked}
              aria-busy={isUploadingImage || isSubmitting}
              className={`w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                !hasActiveSubmission && generationBlocked
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/95 active:scale-[0.99]'
              }`}
            >
              {hasActiveSubmission ? (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Jana Video Lain</span>
                </>
              ) : !selectedAvailable ? (
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
          <div id="generation-status" ref={statusSectionRef} className="scroll-mt-20 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-800">Ruang Status & Hasil Video</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => document.getElementById('factory-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-slate-500 hover:bg-white hover:text-indigo-700" aria-label="Kembali ke atas">
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ke Atas</span>
                </button>
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
                          <p className="mt-1">AffiMatik akan cuba semula secara berkala sehingga Nexabot pulih. Kredit masih ditempah sekali sahaja dan tidak akan dicaj dua kali.</p>
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
                      <button
                        type="button"
                        onClick={prepareNextVideo}
                        className="mx-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
                      >
                        <Plus className="h-4 w-4" />
                        Jana Video Lain
                      </button>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Video ini terus diproses di background dan kekal dalam Senarai Tugasan.</p>
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
                  selectVideoStyle(modalPreviewStyle.id);
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

      {/* Contextual quick navigation for long creation pages. */}
      {showFloatingNavigation && (
        <nav aria-label="Navigasi pantas Jana Video" className="fixed bottom-24 right-3 z-40 flex flex-col gap-2 md:bottom-6 md:right-6">
          <Link href="/dashboard" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:border-indigo-300 hover:text-indigo-700" aria-label="Pergi ke Dashboard" title="Dashboard">
            <LayoutDashboard className="h-4 w-4" />
          </Link>
          <button type="button" onClick={() => statusSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-indigo-200 bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700" aria-label="Pergi ke Ruang Status dan Hasil Video" title="Status video">
            <ListVideo className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => document.getElementById('factory-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:border-indigo-300 hover:text-indigo-700" aria-label="Kembali ke atas" title="Ke atas">
            <ArrowUp className="h-4 w-4" />
          </button>
        </nav>
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
            onClick={handlePrimaryAction}
            disabled={!hasActiveSubmission && generationBlocked}
            aria-busy={isUploadingImage || isSubmitting}
            className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0 ${
              !hasActiveSubmission && generationBlocked
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/95 active:scale-95'
            }`}
          >
            {hasActiveSubmission ? (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Video Lain</span>
              </>
            ) : !selectedAvailable ? (
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

function SummaryRow({label,value,image,onEdit}:{label:string;value:string;image?:string;onEdit:()=>void}) {
  return <div className="flex min-h-14 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
    {image ? <img src={image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400"><ImageIcon className="h-4 w-4"/></div>}
    <div className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span><strong className="block truncate text-xs text-slate-800">{value}</strong></div>
    <button type="button" onClick={onEdit} className="min-h-10 rounded-lg px-2 text-[10px] font-black text-indigo-700">Edit</button>
  </div>;
}

export default function VideoFactoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuatkan AffiMatik Video Factory...</div>}>
      <VideoFactoryContent />
    </Suspense>
  );
}
