# CONTENIFY — Malaysian AI Video Automation SaaS

> **Milestone 0: Foundation & Provider Abstraction**  
> Status: **GREEN (Tests Passed: 17/17, Typecheck Clean, Mock Harness Verified)**  
> *Note on Milestone 0 Gate: Real live API smoke tests require owner to inject rotated staging credentials in protected server environment.*

---

## 🌟 Overview

CONTENIFY is a multi-tenant, cloud-native AI video production platform specifically designed for Malaysian e-commerce affiliates, creators, and sellers across TikTok, Shopee, and Instagram Reels.

### Core Capabilities
- **Official Gems Engine**: Automated generation of high-converting prompts adhering to authentic Malaysian Malay linguistic nuances, Muslimah modesty standards, and e-commerce compliance (spoken CTAs, zero synthetic yellow basket UI artifacts).
- **Intelligent Dual-Engine Routing**:
  - **Nexabot Adapter (10s)**: Prioritized for fluent Malaysian Malay spoken creator videos with automatic product research.
  - **RunningHub Adapter (15s)**: Exact OpenAPI webapp schema mapping (`#114`, `#168`–`#171`, `#136`, `#115`, `#135`).
- **Durable Cloud Processing**: Multi-stage state machine (`DRAFT` → `VALIDATING` → `QUEUED` → `RESEARCHING` → `PROMPT_READY` → `SUBMITTING` → `GENERATING` → `PROCESSING` → `QUALITY_CHECK` → `COMPLETED`).
- **Financial Credit Safety**: Append-only ledger with atomic reservation before job dispatch and settlement only on verified playable MP4 arrival.
- **Private R2 Asset Storage**: Secure presigned upload (max 50MB) and short-lived streaming download URLs.

---

## 📁 Project Architecture & File Tree

```
contenify/
├── .github/workflows/ci.yml       # Automated GitHub Actions CI pipeline
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── admin/page.tsx     # Admin Health & Component monitoring
│   │   │   ├── avatars/page.tsx   # Avatar Library (Modesty presets & consent)
│   │   │   ├── billing/page.tsx   # Credit balance, plans & transaction history
│   │   │   ├── dashboard/page.tsx # Core KPIs & Quick Create launchpad
│   │   │   ├── factory/page.tsx   # Video Factory (Quick & Advanced modes)
│   │   │   ├── library/page.tsx   # Verified MP4 Video Library & Player
│   │   │   ├── products/page.tsx  # Product Library & Screenshot manager
│   │   │   ├── prompts/page.tsx   # Official Gems & Custom Prompts
│   │   │   ├── queue/page.tsx     # Production Queue & Durable Job Logs
│   │   │   └── layout.tsx         # Dashboard layout with persistent 240px sidebar
│   │   ├── api/
│   │   │   └── jobs/route.ts      # Multi-tenant generation & preflight API
│   │   ├── globals.css            # Calm neutral styling & Tailwind tokens
│   │   ├── layout.tsx             # Root HTML layout
│   │   └── page.tsx               # Root redirect to /dashboard
│   ├── components/
│   │   └── layout/
│   │       ├── header.tsx         # 64px compact header with credit counter
│   │       └── sidebar.tsx        # Responsive navigation sidebar
│   └── lib/
│       ├── gems/
│       │   ├── presets.ts         # Canonical Official Gems Presets
│       │   └── prompt-builder.ts  # Universal Masterprompt Builder
│       ├── orchestration/
│       │   ├── credit-manager.ts  # Idempotent append-only credit ledger
│       │   └── state-machine.ts   # 10-stage durable job state machine
│       ├── providers/
│       │   ├── mock.ts            # Deterministic mock adapter for CI/CD
│       │   ├── nexabot.ts         # Nexabot 10s Spoken BM adapter
│       │   ├── router.ts          # Duration & capability provider router
│       │   ├── runninghub.ts      # RunningHub 15s webapp adapter
│       │   └── types.ts           # Standardized provider interfaces
│       └── storage/
│           └── r2.ts              # Cloudflare R2 presigned storage adapter
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql # PostgreSQL multi-tenant schema with RLS
├── tests/
│   ├── gems-prompt.test.ts        # Presets & Malaysian prompt tests
│   ├── provider-adapters.test.ts  # RunningHub, Nexabot, Mock & Router tests
│   ├── state-machine.test.ts      # Pipeline transitions & credit ledger tests
│   └── storage.test.ts            # R2 Presigned URLs & 50MB guardrail tests
├── .env.example                   # Sanitized environment template
├── ADR-001-ARCHITECTURE.md        # Architectural Decision Record
├── PROVIDER_CONTRACT_INVENTORY.md # Observed vs assumed provider contracts
├── STAGING_DEPLOY_PLAN.md         # Isolated staging deploy guidelines
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🛠️ Reproduction & Verification Commands

### 1. Run Automated Test Suite (17 Tests)
```bash
npm test
```
*Executes all Vitest test suites: RunningHub webapp mappings, Nexabot duration rules, Mock adapter polling, Official Gems Malaysian Malay compiler, State Machine transitions, and R2 presigned URLs.*

### 2. Run TypeScript Strict Typecheck
```bash
npx tsc --noEmit
```
*Zero type errors across all application and library code.*

### 3. Launch Development Server
```bash
npm run dev
```
*Starts local Next.js server at `http://localhost:3000`.*
