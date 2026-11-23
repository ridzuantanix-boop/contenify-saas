# Owner creative freedom restoration — staging only

## Active path and gates

The active single-video path is Factory form → `/api/jobs` → `DynamicPromptCompiler.compile` → `compileCompactNexabotPrompt` → stored compiled prompt → Nexabot adapter. Auto Factory also calls the same compiler. Neither active path calls the legacy scriptwriter, voiceover director, Product Brain or image-analysis AI. The live production site was not changed; its private compiled prompt is not exposed by its public API. This audit covers the current repository path and the staging build.

| Gate found | Scope before | Decision |
| --- | --- | --- |
| `validateCustomerFact` word blacklist | Rejected customer/label notes containing `merawat`, `sembuh`, `dijamin` and similar text before Nexabot saw them. | Removed content blacklist. Kept the 180-character-per-fact and no-URL format checks; label wording is context, not independently proven performance. |
| Factory payload omission | Saved product category and notes were available in the selected asset but absent from `/api/jobs` payload. | Factory now sends both; the job route passes category and notes as customer context. |
| Compact prompt omission | Category, buyer context, customer purpose and supplied benefits were omitted; the selling instruction was limited to “supported use or ordinary function”. | The compiler now includes supplied context and asks Nexabot to create the buyer need, relevant benefit and selling angle from label/category context. |
| Auto Factory omission | Product description was fetched but not passed to the shared compiler. | Product description now enters customer context. |
| Silent fact truncation | `productFact` was cut at 180 characters and the job route dropped facts after the tenth. | No silent cut: the fact remains whole, and more than 10 facts produce a clear 400 response. Prompt length still fails before credit reservation if over 1,000. |
| Broad legacy claim lists | `prohibitedClaims`, `unknownFields` and old style-director hard failures exist in structures. | Their long prose is not part of the active compact provider prompt. They were not deleted. No category blacklist or separate claim-rewriter was added. |

Technical input validation, provider settings, authenticated asset ownership, the 1,000-character hard boundary and selected CTA validation remain. The compact provider prompt retains product/avatar identity, realistic scale, Shariah/niqab coverage, natural BM Malaysia delivery, one complete CTA and focused prohibitions on fake self-use, reviews, sales, cures, guarantees and false facts. It says that label claims are not proof. Nexabot still chooses every hook, buyer problem, story, benefit wording and spoken sentence.

## Assembled provider prompt comparison

The previous V2.1 exact prompts and sanitized payloads remain in [`output/nexabot-prompt-recovery-v2-1`](../../output/nexabot-prompt-recovery-v2-1). The revised exact prompts and matching reference hashes/payloads are in [`output/owner-creative-freedom-v2-1`](../../output/owner-creative-freedom-v2-1). The four original images and avatar references are unchanged.

| Configuration | V2.1 candidate A | Revised candidate A | Revised candidate B |
| --- | ---: | ---: | ---: |
| NX01 herbal oil | 794 | 816 | 827 |
| NX07 capsules | 784 | 806 | 817 |
| NX03 perfume | 874 | 891 | 902 |
| NX02 vitamins | 781 | 803 | 814 |

The revised prompt replaces the instruction to “sell supported use or ordinary function, not packaging” with an explicit instruction to use label-stated purpose, ingredients/use and ordinary category context for a buyer need, supported benefit and selling angle. It also explicitly distinguishes label claims from proof. The four historical configurations supplied only the image and product name, so this comparison does **not** pretend that AffiMatik transcribed their labels. A separate offline regression passes synthetic customer label facts and verifies that they arrive in the final provider prompt unchanged. No effectiveness claim was invented by AffiMatik.

All 30 styles passed the static audit for both candidates. The largest revised prompt in the fixed audit context is 960 UTF-8 bytes for A and 971 for B. Product notes can make a request exceed the limit; that request fails clearly before credit reservation rather than losing context. The precise per-style component budget and SHA-256 values are in `style-budget.tsv` beside the revised prompt evidence.

## Release status

Focused regression: 41/41 passed. Full regression: 340 passed and one unrelated payment-page copy assertion failed (`tests/payment-first-conversion-phase2.test.ts` expects wording absent from the existing sales flow). TypeScript passed. Build and staging results are recorded in the release handoff.

No Nexabot generation, automatic retry, wallet change or production deployment is part of this correction. Prompt construction is not proof of MP4 quality. A bounded real-video A/B should compare selling relevance, claims, scale, CTA and speech ending before any production release.
