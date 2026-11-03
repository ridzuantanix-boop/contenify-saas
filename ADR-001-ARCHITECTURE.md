# ADR 001: CONTENIFY Core SaaS Architecture & Multi-Tenancy

## Status
Accepted

## Context
CONTENIFY is a cloud-native, multi-tenant AI video production platform specifically tailored for Malaysian e-commerce affiliates, content creators, and sellers (TikTok, Shopee, Reels). The platform must allow users to upload dozens of product screenshots, select official Malaysian-centric Gems presets, and initiate video generation jobs that run durably in the cloud without requiring the user to keep their browser or computer active.

## Key Decisions

1. **Clean Slate Project (No Legacy VidioPro Code Coupling)**
   - The legacy HTML prototype contained unrotated credentials and tightly coupled client-side logic.
   - CONTENIFY is built from scratch as a Next.js (App Router) + TypeScript + Tailwind CSS application with distinct boundaries between UI, API routes, and cloud worker adapters.

2. **Strict Multi-Tenancy & Data Model**
   - Implemented via tenant-scoped PostgreSQL (Supabase) tables with Row Level Security (RLS) policies on all tenant objects (`workspaces`, `products`, `product_images`, `avatars`, `batches`, `video_jobs`, `credit_wallets`, `credit_ledger`).
   - Server-side validation is enforced in every API handler independently of RLS for defense in depth.

3. **Pluggable Provider Adapter Architecture**
   - Standardized interface (`IProviderAdapter`) with uniform contracts:
     - `capabilities()`: Durations, spoken language capabilities, image limits.
     - `validateInput()`: Duration and payload safety checks.
     - `preparePayload()`: Provider-specific parameter mapping.
     - `submit()`: Idempotent job dispatch.
     - `getStatus()` & `getOutputs()`: Polling / callback handling and playable MP4 verification.
     - `normalizeError()`: Error classification (retryable, auth, balance, internal).
   - **Provider Routing Policy**:
     - 10-second videos route to **Nexabot** (native Malaysian Malay conversational speech, automatic product research).
     - 15-second videos route to **RunningHub** (exact node mapping for webapp ID `2103149871766220801`).
     - Automated test and CI environments use **MockProviderAdapter** to eliminate unexpected costs.

4. **Append-Only Financial Credit Ledger**
   - All credit mutations are tracked via immutable ledger events (`GRANT`, `RESERVE`, `SETTLE`, `RELEASE`, `REFUND`).
   - Credits are reserved atomically before submission and settled only upon verified MP4 storage. Failed retryable jobs or upstream errors trigger automated reservation release.

5. **Private R2 Storage Architecture**
   - User assets (product screenshots, cleaned derivatives, generated MP4s) are stored in private Cloudflare R2 buckets.
   - Client uploads use presigned PUT URLs with size (max 50MB) and MIME-type restrictions.
   - Output video streaming and downloads utilize short-lived presigned URLs.

6. **Malaysian Cultural & Modesty Guardrails (Official Gems)**
   - Malaysian Malay dialect enforcement: Eliminates Indonesian phrasing (e.g., enforces "cantik", "berbaloi", "senang" over "banget" / "keren").
   - Muslimah modesty constraints: Enforces proper hijab covering hair, ears, chest, and long sleeves covering wrists.
   - E-commerce CTA compliance: Enforces spoken calls-to-action ("Tekan butang di bawah" / "Link di bio") and explicitly forbids synthetic yellow basket buttons on video visual frames.
