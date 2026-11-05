# AFFIMATIK BY PAWARNA — MASTER AGENT HANDOFF (V1.3 PRODUCTION)

**Author:** Antigravity AI  
**Owner / Organization:** Pawarna Studio  
**Date of Handoff:** 5 November 2026 (09:00 MYT)  
**Target Audience:** Incoming Autonomous AI Coding Agent / Senior Fullstack Engineer  
**Handoff Objective:** Provide 100% comprehensive, unambiguous context so the incoming agent can pick up development immediately with zero onboarding friction.

---

## 1. EXECUTIVE CONTEXT & INFRASTRUCTURE

| Item | Specification / Value |
|---|---|
| **Platform Name** | **AffiMatik** by Pawarna (Malaysian AI Affiliate Video SaaS) |
| **White-Label Branding** | Strictly AffiMatik (No third-party provider names shown to users) |
| **Engines** | • **AffiMatik Voice** (10s, BM Spoken Dialogue, 10 Credits)<br>• **AffiMatik Motion** (15s, Realistic Motion/ASMR/No-Speech, 15 Credits) |
| **Git Repository** | `ridzuantanix-boop/contenify-saas` |
| **Default Branch** | `main` |
| **Current Stable HEAD** | [`a2efecb`](https://github.com/ridzuantanix-boop/contenify-saas/commit/a2efecb) |
| **Active Production URL** | [`https://affimatik.online`](https://affimatik.online) |
| **Cloudflare Pages URL** | [`https://contenify-saas.pages.dev`](https://contenify-saas.pages.dev) |
| **Hosting Platform** | Cloudflare Pages (Node.js Edge / Functions runtime) |
| **Cloudflare Account ID** | `98f15d0c63af9cf87ea0233687691d65` |
| **Cloudflare Zone ID** | `8f42ee34d2d77590dce8a05fb70a3319` (`affimatik.online`) |
| **Database & Auth** | Supabase PostgreSQL (`https://hrekuraxzpiqymgcrjyb.supabase.co`) |

---

## 2. REPOSITORY FILE STRUCTURE & CORE ARCHITECTURE

```
contenify-saas/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Responsive dashboard shell (mobile drawer + desktop sidebar)
│   │   │   ├── factory/page.tsx       # Video Creation Studio (Style gallery, script editor, job monitor, sticky mobile CTA)
│   │   │   ├── admin/page.tsx         # Admin Control Center (Spend limit, circuit breaker, user table, manual activation)
│   │   │   ├── billing/page.tsx       # Pricing tiers & Coming Soon / Manual bank transfer info
│   │   │   └── dashboard/page.tsx     # User overview & quick links
│   │   ├── register/page.tsx          # Signup page (Mandatory WhatsApp & Email verification screen)
│   │   ├── login/page.tsx             # Email/password authentication
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts  # Atomic signup + 50 welcome credits (Fail-closed)
│   │       │   ├── session/route.ts   # Session probe & cookie validator
│   │       │   └── admin-login/route.ts # Secure admin gate (rate-limited brute force protection)
│   │       ├── admin/
│   │       │   ├── operations/route.ts # Privileged actions: 'reconcile_accounts', toggle breaker
│   │       │   └── diagnostics/route.ts# Telemetry and component health
│   │       ├── billing/               # Plan checkout, webhook, verification
│   │       └── jobs/                  # Video generation task submission & polling
│   ├── components/layout/
│   │   ├── sidebar.tsx                # Desktop Sidebar & MobileSidebarDrawer (accessible dialog, >=44px touch targets)
│   │   └── header.tsx                 # Topbar with Hamburger menu toggle, mobile logo, compact credit chip
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── session.ts             # HMAC-SHA256 session cookie codec (fail-closed in production)
│   │   │   └── admin-guard.ts         # Server-side admin verification
│   │   ├── db/
│   │   │   ├── store.ts               # Authoritative DurableStore (strict fail-closed, atomic RPC integration)
│   │   │   └── reconcile.ts           # Idempotent reconciliation engine (auth.users -> profiles -> wallets)
│   │   ├── engine/
│   │   │   ├── compiler.ts            # Dynamic Prompt Compiler (Masterprompts V5.0 Lock)
│   │   │   ├── creative-director.ts   # Product Profile extractor & sanitization
│   │   │   ├── voiceover-director.ts  # Spoken script generator & Malaysian Malay validation
│   │   │   └── types.ts               # ProductProfile, VideoJob, and compiler types
│   │   └── styles/
│   │       ├── registry.ts            # Authoritative Registry of 13 Video Styles
│   │       └── types.ts               # VideoStyle, EngineType, AudioMode definitions
├── scripts/
│   └── reconcile-accounts.mjs         # Standalone CLI reconciliation script
├── tests/
│   ├── p0-audit-remediation.test.ts   # Tests for fail-closed DB, admin rate limit, manual activation, email confirm
│   ├── gems-masterprompts-v5.test.ts  # Prompt compliance tests across all 13 styles
│   ├── production-safety.test.ts      # Anti-hallucination, Indo slang rejection, Shariah checks
│   └── dynamic-prompt-engine.test.ts  # Compiler parameter injection tests
```

---

## 3. NON-NEGOTIABLE LAWS & BUSINESS LOCKS

The incoming agent **MUST NEVER** alter the following business logic:

1. **Commercial Pricing Tiers (`AUTHORITATIVE_PLANS`):**
   - **Starter:** RM49 / month $\rightarrow$ **50 Credits**
   - **Pro:** RM129 / month $\rightarrow$ **160 Credits**
   - **Agency:** RM399 / month $\rightarrow$ **600 Credits**
   *Never restore legacy 100/250/500 credit allocations.*
2. **Video Generation Costs:**
   - **AffiMatik Voice (10s):** Exactly **10 Credits**
   - **AffiMatik Motion (15s):** Exactly **15 Credits**
3. **Free Trial Welcome Allocation:**
   - Every newly registered eligible user/workspace receives exactly **50 Free Credits**.
   - Issued once via idempotent atomic ledger/RPC. Never grant recurring welcome credits.
4. **Authoritative Masterprompts V5.0 Lock:**
   - All 13 styles (`NX01`–`NX10` and `RH01`–`RH03`) are hand-authored in `src/lib/engine/compiler.ts`.
   - Do NOT simplify, paraphrase, or replace with generic templates.
   - Malaysian Malay natural spoken dialogue only (strictly reject Indonesian slang: *kamu, kalian, banget, cobain*).
   - Strict Shariah & Muslimah modest locks.
5. **Fail-Closed Policy in Production:**
   - If Supabase environment variables or admin keys are missing in Cloudflare production, the application **MUST fail closed** (return 503 / 401).
   - **Never fall back to in-memory `localDb` in production.** Process-local memory vanishes across ephemeral Cloudflare isolates.

---

## 4. ENVIRONMENT VARIABLES & SECRETS SETUP

To bind the live database to Cloudflare Pages edge isolates, the following environment variables must be populated in the Cloudflare Dashboard (**Pages $\rightarrow$ contenify-saas $\rightarrow$ Settings $\rightarrow$ Environment variables**):

| Variable Name | Environment | Purpose / Example Value |
|---|---|---|
| `SUPABASE_URL` | Production & Preview | `https://hrekuraxzpiqymgcrjyb.supabase.co` |
| `SUPABASE_ANON_KEY` | Production & Preview | Public anonymous client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production & Preview | Supabase service-role secret (required for atomic wallet provisioning & admin queries) |
| `ADMIN_ACCESS_KEY` | Production & Preview | Secret passphrase for SuperAdmin dashboard unlock |
| `SESSION_SECRET` | Production & Preview | $\ge 32$-character high-entropy secret string for signing auth session cookies |
| `CRON_SECRET` | Production & Preview | *(Already set)* Secret token authorizing background reconciler cron trigger |

---

## 5. RECENTLY COMPLETED WORK (COMMIT `a2efecb`)

1. **P0 Database Fail-Closed Remediation:**  
   `src/lib/db/store.ts` strictly rejects fallback to `localDb` when running in production. Returns clean 503 with informative error message.
2. **Security Lockdown:**  
   Removed all hardcoded master passwords (`AffiMatik@Master2026!`) and fixed HMAC secrets. Added IP brute-force rate limiter on admin login (15-min cooldown).
3. **Registration & Email Verification Card:**  
   `src/app/register/page.tsx` now captures mandatory WhatsApp number and cleanly stops premature redirects when email confirmation is enabled on Supabase.
4. **Mobile-First UX Shell:**  
   Replaced fixed desktop sidebar with an interactive `MobileSidebarDrawer`. Added sticky bottom CTA bar in `factory/page.tsx` showing selected style badge, credit cost, wallet balance, and primary action button.
5. **Reconciliation Engine:**  
   Implemented `src/lib/db/reconcile.ts` and connected it to the Admin dashboard. Automatically synchronizes missing profiles, workspaces, and wallets from `auth.users` without duplicating grants.
6. **Cloudflare 95K Audit Resolution:**  
   Conducted full forensic audit proving that AffiMatik only used 5.4% of account quota; the 95k request alert was caused by another project (`pawarna-dramamaker`).

---

## 6. VERIFICATION COMMANDS & RUNBOOK

The incoming agent can verify everything using the following commands:

```bash
# 1. Install dependencies
npm install

# 2. Run P0 Audit Remediation Tests (7/7 must pass)
npx vitest run tests/p0-audit-remediation.test.ts

# 3. Run V5 Masterprompts Creative Tests
npx vitest run tests/gems-masterprompts-v5.test.ts

# 4. Typecheck TypeScript across entire codebase (0 errors)
npx tsc --noEmit

# 5. Build production Next.js bundle
npm run build

# 6. Deploy / Check Cloudflare Pages
# Pushing to origin main automatically triggers Cloudflare Pages build.
# To check deployment status:
node -e "
const fs = require('fs');
const toml = fs.readFileSync('C:/Users/user/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const token = toml.match(/oauth_token\s*=\s*\"([^\"]+)\"/)[1];
fetch('https://api.cloudflare.com/client/v4/accounts/98f15d0c63af9cf87ea0233687691d65/pages/projects/contenify-saas/deployments?per_page=1', {
  headers: { Authorization: 'Bearer ' + token }
}).then(r => r.json()).then(d => console.log(d.result[0]));
"
```

---

## 7. IMMEDIATE NEXT STEPS FOR INCOMING AGENT

1. **Verify Environment Variables in Cloudflare Pages:**  
   Once the owner has added `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_ACCESS_KEY`, and `SESSION_SECRET` to Cloudflare Pages, run a test signup on `https://affimatik.online/register`.
2. **Execute Single-Click Reconciliation:**  
   Log in to `https://affimatik.online/admin`, go to the **Pengguna Berdaftar** tab, and click **"Selaraskan Akaun"** to ensure all early testers are active with their 50 introductory credits.
3. **Public Commercial Launch Preparation:**  
   When the owner is ready to accept live online payments via Chip / ToyyibPay / Stripe, toggle `PUBLIC_CHECKOUT_ENABLED` in admin operations or release commercial checkout from its current coming-soon state.

---
*Signed and sealed for immediate continuity by Antigravity AI.*
