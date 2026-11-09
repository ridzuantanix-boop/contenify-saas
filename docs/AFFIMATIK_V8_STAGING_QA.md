# AffiMatik V8 Staging QA — 9 November 2026

## Scope and deployment

- Branch: `codex/human-realism-v8`
- Access-controlled staging Worker: `affimatik-launch-lite-staging`
- Worker version after pacing refinement: `0b09d161-527d-4050-bf3e-964cae597f89`
- Production domain and production Worker were not changed.
- RunningHub and paid checkout remained off.

## UI and payload evidence

Desktop and mobile staging exposed Smart Script, Custom Script and Provider Auto. The CTA select contained all seven V8 choices. Generation was submitted through the customer-facing Factory button after the product upload became durable.

Every inspected job snapshot contained:

- `scriptMode: smart`
- `callToAction: none`
- `[HUMAN REALISM MASTERPROMPT V8]`
- `[V8 SMART SCRIPT CONTROL]`
- no `before second 11` rule

Preset persistence is covered by automated tests and the existing JSONB preset store. V8 settings require no destructive database migration.

## Controlled provider attempts

| Category | Job | Provider task | Result | Duration | Storage | Wallet |
| --- | --- | --- | --- | --- | --- | --- |
| Beauty, initial | `fcc485ec-99fc-4080-bd74-a5c8117c9b5b` | `807e30f110f067e8` | Completed | 15.04s | Private MP4 present | 1 reserve, 1 settle |
| Supplement, initial | `60cb9349-6949-4c5c-ab8f-8b8470d5b18f` | `5ec7d0e12eb6a3ef` | Provider failed | — | None | 1 reserve, 1 release |
| Kitchen | `64661c8c-bc87-4bc2-b4bd-258b9deb3801` | `0acaf935dc6f1dcf` | Completed | 15.04s | Private MP4 present | 1 reserve, 1 settle |
| Automotive | `7c57f39f-1c39-422f-a840-78809d443063` | `e82d8da7baae3742` | Completed | 15.04s | Private MP4 present | 1 reserve, 1 settle |
| Beauty, pacing retest | `b1ff9291-6a6d-4594-9861-795c13324326` | `159f74553700663f` | Completed | 15.04s | Full 200 + Range 206 | 1 reserve, 1 settle |
| Supplement, bounded retry | `cc96d2bb-f929-4200-b612-824e1e69d63f` | `87711f7a148adfc6` | Completed | 15.04s | Full 200 + Range 206 | 1 reserve, 1 settle |

The isolated QA wallet settled 50 AffiMatik credits across five completed outputs. The failed provider task released its 10-credit reservation. Nexabot's own dashboard charge per attempt was not exposed by the API and is not reported as verified.

## Actual MP4 findings

- All five completed files contain H.264 720×1280 video plus AAC audio and report 15.04 seconds.
- Beauty, kitchen and automotive frame inspection showed stable product identity, readable core branding, realistic covered presenters, believable hand contact and neutral lighting. No fake shopping UI was visible.
- The original V7.1 beauty control repeated an unsupported “nampak segar” claim and repeated the same meaning through 14.79s.
- The initial V8 beauty output followed the neutral script and omitted that unsupported benefit, but ended speech around 7.88s. This finding caused a source refinement to 22+ word style-specific scripts.
- The refined beauty retest followed all three requested clauses and speech ran to approximately 12.91s; the final frame returned to a natural closed-mouth product hold.
- The refined supplement output completed the safe requested wording but the provider compressed it to approximately 8.22s and pronounced the product name imprecisely. It did not add a health efficacy claim. This proves that exact timing, exact pronunciation and perfect lip-sync remain provider-dependent.
- The initial kitchen and automotive outputs followed the safe neutral script but used the shorter pre-refinement version. Their visuals were inspected; the final longer source pattern was not regenerated to avoid uncontrolled provider spend.

Automated transcripts were used only to measure wording and timing. Visual findings were taken from actual MP4 frames at 1s, 5/7s, 10/12s and 14s. Naturalness remains a human judgement and is not represented as perfectly enforced.

## Release boundary

V8 remains staging-only. The provider demonstrated meaningful improvement for unsupported-claim removal, semantic repetition and the refined beauty timing, but it did not demonstrate reliable exact timing or pronunciation across every product. Production replacement still requires separate owner approval.
