# CONTENIFY — Staging Deployment Plan

This plan outlines the isolated deployment of CONTENIFY Milestone 0 with **zero disruption** to existing setups or prototypes.

---

## 1. Isolation Strategy
- **Independent Git Repository**: A clean, isolated GitHub repository with automated CI/CD (`.github/workflows/ci.yml`).
- **Separate Secret Storage**: Secrets are injected strictly via Cloudflare Pages / Workers or Vercel environment variables, completely isolated from any developer machines or client-facing bundles.
- **Isolated Database Instance**: Supabase staging project with distinct project ID and separate database URL.
- **Dedicated Private Storage**: Separate Cloudflare R2 bucket (`contenify-staging-assets`), partitioned by tenant workspace ID.

---

## 2. CI/CD Gateways
All pull requests must pass:
1. `npm test` (All Vitest unit tests: provider adapters, gems prompt compiler, state machine, credit ledger).
2. `npx tsc --noEmit` (Strict TypeScript verification).
3. Secret scanning check (Pre-commit / CI gate preventing API key commits).

---

## 3. Provider Smoke Testing Gate (Milestone 0 Release Criteria)
1. **Safety First**: Run all test suites in Mock mode (`USE_MOCK_PROVIDERS=true`).
2. **Controlled Smoke Test**:
   - Provide rotated staging keys via server environment.
   - Run single 10s Nexabot generation smoke test with 1 product image.
   - Run single 15s RunningHub generation smoke test with 1 product image.
   - Validate output file is a playable MP4 with correct duration and aspect ratio.
   - Save output to private R2 bucket and verify short-lived signed download URL.
3. **Rollback Plan**:
   - If an adapter fails, toggle feature flag `USE_MOCK_PROVIDERS=true` or disable the affected provider route in `src/lib/providers/router.ts`.
