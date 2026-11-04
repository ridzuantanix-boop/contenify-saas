# 91 • REAL QUALITY TEST / PROMPT QA — GEMS STANDARD

## Automated assertions (not sufficient alone)
- All 13 exact IDs mapped to their own independent style MD. No fallback to generic packaging script.
- No final NX speech matches `packaging|bungkusan|botol|label|kotak|kemasan` as the main selling proposition; words may occur incidentally for product identity only if meaningful, but generated draft should be rewritten to actual purpose.
- All output claims have source provenance; user claim ≠ external verification.
- Per-style hook strategy and physical action differ; fake variety (synonyms of same sentence) fails.
- No user script overwritten by compiler; no user visual text inserted as spoken script.
- NX 10s has exactly one BM speech plan, timed/tested in real output; no Indonesia words, self-use fake, forbidden CTA; RH 15s has no spoken dialogue.
- Validate exact duration, aspect, MP4 decode, audio presence; store status as factual metadata.

## Human video rubric (score 0–5; actual video only)
| Axis | Description |
|---|---|
| Benefit clarity | NX: user learns a genuine buyer benefit. RH: meaningful context (not empty product dance). |
| Product truth | No unsupported result/spec or misrepresented use. |
| Style adherence | Exact style-specific action and hook. |
| UGC realism | No AI skin, false contact, fake movement, first-frame flash, overly cinematic shots. |
| Product identity | Shape, cap, branding and label stable. |
| Shariah | Full coverage, one hand, modest, correct anatomy throughout. |
| Zero UI | No watermark, fake frame, logo, CTA overlay, subtitles. |
| Audio | NX clear natural spoken BM; RH no dialogue, ambience truthful. |

**Hard FAIL regardless of score:** visible social logo or embedded phone frame, exposed aurat, altered product identity, unsupported medical claim, video showing wrong style, unverified fake review or creator self-use claim.

## Stress tests
1. Image-only, no written product info → safe category function or request one missing purpose; NEVER packaging filler.
2. Very long product name → use accurate short spoken alias, maintain 10s pacing.
3. Tudung → hijab labuh proper, don't casually show hair/neck; real fabric behaviour.
4. Niqab → never animate mouth; use off-screen speech.
5. Food → verbs eat/serve, no false halal claim.
6. Ingestible/health → no cure.
7. Bottle with screenshot overlay in uploaded ref → do not regenerate UI overlay; use authorised clean source where available.
8. RH03 → actual pickup and put-down; not turntable.
9. RH19 → actual window daylight; not stop motion.
10. NX10 → fact/use benefits; no packaging-review spoken filler.
11. Regen script same product 3 times → different hook/angle, facts consistent.
12. Video sample in gallery → only label `quality_verified` after reviewing real MP4.

## Suggested human decision
`PASS` = quality>=4 for applicable axes and no hard fail. `REVISE` = recoverable prompt issue or uncertain fact. `REJECT` = unsafe/misleading/morphed/wrong video; do not publish.

## Version / approval
Store `promptVersion=affimatik-gems-masterprompts-v5.0`, date, styleId, rendered prompt snapshot, review status and human reviewer. Never mutate prompts for jobs already submitted; allow rollback to previous known version when necessary.
