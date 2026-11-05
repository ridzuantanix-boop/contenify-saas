'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  Volume2,
  VolumeX,
  Clock,
  Layers,
  ArrowRight,
  Code,
} from 'lucide-react';
import { VIDEO_STYLES_REGISTRY, getVideoStyle } from '@/lib/styles/registry';
import { AICreativeDirector } from '@/lib/engine/creative-director';
import { DynamicPromptCompiler } from '@/lib/engine/compiler';

export default function StyleTestingLabPage() {
  const [selectedStyleId, setSelectedStyleId] = useState('NX01');
  const [testProductType, setTestProductType] = useState<'sambal' | 'serum' | 'tudung' | 'gadget'>('sambal');
  const [isMuslimah, setIsMuslimah] = useState(true);

  const selectedStyle = getVideoStyle(selectedStyleId) || VIDEO_STYLES_REGISTRY[0];

  // Test product fixtures
  const PRODUCT_FIXTURES = {
    sambal: {
      productName: 'Sambal Hijau Padu Tok Wan',
      productCategory: 'Makanan & Masakan',
      productFacts: ['Resepi Tradisi', 'Ikan Bilis Rangup', 'Tanpa Pengawet'],
    },
    serum: {
      productName: 'Glow Radiance Vitamin C Serum',
      productCategory: 'Kecantikan & Skincare',
      productFacts: ['Ekstrak Bunga Raya Asli', 'Vitamin C 10%', 'Melembap 24 Jam'],
    },
    tudung: {
      productName: 'Bawal Cotton Voile Premium',
      productCategory: 'Pakaian & Fesyen Muslimah',
      productFacts: ['Material Sejuk', 'Mudah Bentuk', 'Jahitan Tepi Kemas'],
    },
    gadget: {
      productName: 'Magnetic Fast Charge Powerbank',
      productCategory: 'Elektronik & Aksesori Telefon',
      productFacts: ['Kapasiti 10000mAh', 'Wireless 15W', 'Saiz Kompak Poket'],
    },
  };

  const currentFixture = PRODUCT_FIXTURES[testProductType];
  const profile = AICreativeDirector.extractProductProfile(currentFixture);
  const scenePlan = AICreativeDirector.createScenePlan(profile, selectedStyle, { modestyLock: isMuslimah });
  const compiled = DynamicPromptCompiler.compile(profile, selectedStyle, scenePlan, {
    isMuslimahModest: isMuslimah,
    providerCreatesDialogue: true,
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Style Testing Lab</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold border border-purple-200">
              Admin & QA Sandbox
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Uji dan sahkan pelan aksi, prompt compiler dan integriti gaya video sebelum pelancaran produksi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Style & Test Config */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              1. Pilih Gaya untuk Diuji
            </h3>

            <select
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
            >
              {VIDEO_STYLES_REGISTRY.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name} ({s.durationSeconds}s • {s.engine.toUpperCase()})
                </option>
              ))}
            </select>

            {/* Selected Style Info Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Enjin:</span>
                <span className="font-bold uppercase text-indigo-700">{selectedStyle.engine}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Durasi:</span>
                <span className="font-semibold text-slate-900">{selectedStyle.durationSeconds} Saat</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mod Audio:</span>
                <span className="font-semibold text-slate-900">{selectedStyle.audioMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Kualiti:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {selectedStyle.qualityStatus.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              2. Pilih Produk Ujian (Fixture)
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'sambal', label: 'Sambal (Jar)' },
                { id: 'serum', label: 'Serum (Bottle)' },
                { id: 'tudung', label: 'Tudung (Fashion)' },
                { id: 'gadget', label: 'Powerbank (Gadget)' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTestProductType(f.id as any)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition ${
                    testProductType === f.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
              <div><strong>Nama:</strong> {currentFixture.productName}</div>
              <div><strong>Format:</strong> {profile.packagingFormat}</div>
              <div><strong>Kategori:</strong> {currentFixture.productCategory}</div>
            </div>
          </div>
        </div>

        {/* Right Column: Scene Plan & Compiled Prompt Inspector (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preflight Verification Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
              compiled.preflightValid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {compiled.preflightValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              )}
              <span>
                {compiled.preflightValid
                  ? 'Preflight Lulus 100%: Kekangan enjin, audio policy dan identity lock disahkan.'
                  : `Preflight Gagal: ${compiled.validationErrors.join(', ')}`}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs font-mono">
              v{selectedStyle.promptTemplateVersion}
            </span>
          </div>

          {/* Visual Scene Planner Inspection */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Pelan Aksi Fizikal (Visual Scene Planner)
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Realism Engine</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Subjek & Modesti</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{scenePlan.mainSubject}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lokasi Domestik</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{scenePlan.location}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pergerakan Aksi</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{scenePlan.actionProgression}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Kamera & Sudut</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{scenePlan.cameraMovement}</span>
              </div>
            </div>
          </div>

          {/* Compiled Prompt Inspector */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-600" />
                Compiled Provider Payload ({selectedStyle.engine.toUpperCase()})
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-semibold">
                {selectedStyle.durationSeconds}s
              </span>
            </div>

            <div className="relative">
              <textarea
                readOnly
                rows={12}
                value={compiled.providerPrompt}
                className="w-full p-4 rounded-xl font-mono text-xs text-slate-800 bg-slate-900 text-slate-100 border border-slate-800 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
              <strong>Dialog:</strong> Dicipta terus oleh provider video daripada imej rujukan; AffiMatik tidak menjana atau mempratonton skrip.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
