# AffiMatik V8.1 Premium Sample Release

Date: 9 November 2026

## Scope

All 20 public `sample-v6.mp4` previews were regenerated with the production V8.1 reference-role lock. Every submission used Nexabot `i2v`, two identical product-reference images, 9:16, 720p and 15 seconds. No customer wallet or job was used.

The fictional premium products were created specifically for AffiMatik preview demonstrations and make no medical outcome, certification, price or testimonial claim:

- LUMÉA Collagen Glow Plus — beauty supplement.
- SERIYA Radiance Serum — skincare serum.
- NURIVA Omega-3 — wellness supplement.
- VEILÉ Sun Fluid SPF 50 — sun-care cosmetic.
- AROMAÉ Home Mist — home fragrance.
- NOVA LUMI Table Lamp — home lighting.
- POTONGGO Manual Chopper — kitchen product.

## Provider receipt

| Style | Product | Nexabot task |
| --- | --- | --- |
| NX01 | LUMÉA Collagen Glow Plus | `6c73eb116b3c820a` |
| NX02 | SERIYA Radiance Serum | `5b751ed28346be99` |
| NX03 | NOVA LUMI Table Lamp | `bd8e8c8e4f913c26` |
| NX05 | AROMAÉ Home Mist | `ea44734780b5bdf5` |
| NX07 | NURIVA Omega-3 | `78f5ad54d2d20c0d` |
| NX09 | VEILÉ Sun Fluid SPF 50 | `d54e87c7382f8026` |
| NX10 | NURIVA Omega-3 | `b4fb3c0ba9872a20` |
| RH01 | AROMAÉ Home Mist | `6a3279e91eec390b` |
| RH02 | SERIYA Radiance Serum | `18771bc8ca883a21` |
| RH03 | NOVA LUMI Table Lamp | `77ad2abbca9b2e44` |
| RH04 | VEILÉ Sun Fluid SPF 50 | `8f99fb09b3779ff7` |
| RH17 | NOVA LUMI Table Lamp | `918cbf6f1dd10621` |
| RH19 | SERIYA Radiance Serum | `ff47d91351546b4e` |
| NX11 | VEILÉ Sun Fluid SPF 50 | `2604c2334f62d77f` |
| NX12 | AROMAÉ Home Mist | `31f57b23ee5dbaaf` |
| NX13 | POTONGGO Manual Chopper | `614b2547255b9ef1` |
| NX14 | NOVA LUMI Table Lamp | `1e0b33ad5cfe0337` |
| NX15 | NURIVA Omega-3 | `cc3c4f291f28662d` |
| NX16 | LUMÉA Collagen Glow Plus | `b81cb20a3f1606ed` |
| NX17 | SERIYA Radiance Serum | `638db4643b23825c` |

Provider balance moved from 65.35 to 62.35: exactly 3.00 provider credits for 20 successful generations. There were zero failed tasks and no retry generation.

## QA

- Visual contact-sheet inspection covered the opening and seven-second frame of all 20 outputs.
- Openings are newly rendered live-action scenes or hand-led product scenes rather than pasted source-image stills.
- Product packaging remains recognizable at the midpoint across all 20 samples.
- The genuine provider watermark is accepted under the Launch-Lite quality policy.
- Automated media checks must confirm all files contain H.264 video, AAC audio, approximately 15-second duration and iPhone-compatible fast-start MP4 structure before deployment.
- Preview URLs use the cache-busting release query `v8.1-premium-20261109` so browsers do not retain the previous sample set.

## Production deployment evidence

- Production Worker: `affimatik-production-v2`.
- Worker version: `b89b00a4-97f3-43d0-94f5-88ca13c355f4`.
- Production URL: `https://affimatik.online`.
- The deployment uploaded all 20 changed MP4 assets plus the new build identifier.
- Post-deployment verification fetched every production MP4 independently: 20/20 returned HTTP 200 and matched its approved local artifact byte-for-byte by SHA-256.
- Nexabot Voice remains enabled. RunningHub, mock providers and public paid checkout remain disabled.

