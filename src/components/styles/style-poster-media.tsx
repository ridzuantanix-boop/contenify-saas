'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import { useRef, useState } from 'react';
import type { StyleMarketingMetadata } from '@/lib/styles/marketing-metadata';

interface StylePosterMediaProps {
  metadata: StyleMarketingMetadata;
  onPreview: () => void;
  compact?: boolean;
}

export function StylePosterMedia({ metadata, onPreview, compact = false }: StylePosterMediaProps) {
  const [hoverPreview, setHoverPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startHoverPreview = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setHoverPreview(true);
  };

  const stopHoverPreview = () => {
    setHoverPreview(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="group/media relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-slate-950"
      onMouseEnter={startHoverPreview}
      onMouseLeave={stopHoverPreview}
      data-testid={`style-media-${metadata.id}`}
    >
      <Image
        src={metadata.thumbnailPath}
        alt={`Poster gaya ${metadata.title}: ${metadata.tagline}`}
        fill
        sizes={compact ? '(max-width: 768px) 50vw, 220px' : '(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 280px'}
        className={`object-contain transition-opacity duration-200 ${hoverPreview ? 'opacity-0' : 'opacity-100'}`}
      />
      {hoverPreview && (
        <video
          ref={videoRef}
          src={metadata.previewPath}
          muted
          autoPlay
          loop
          playsInline
          preload="none"
          aria-label={`Pratonton senyap ${metadata.title}`}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onPreview();
        }}
        className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-950/85 px-3 py-2 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
        aria-label={`Preview video ${metadata.title}`}
      >
        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        Preview
      </button>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
        15s · Voice
      </span>
    </div>
  );
}
