# Expansion V1 — RunningHub research and implementation notes

Date reviewed: 2026-11-16 (MYT)

## Access boundary

The requested Runow template index was not directly readable through the non-interactive web fetcher. Publicly indexed RunningHub pages and official RunningHub guidance were accessible. No private prompt, paid template payload or hidden input was recovered or copied.

Sources inspected:

- RunningHub official guide, **Best AI Video Prompts for Outfit Changes, Product Ads, and Dance Videos**: https://www.runninghub.ai/blog/ai-applications/best-ai-video-prompts
- RunningHub workflow, **E-commerce men's/women's clothing one-click product display video**: https://www.runninghub.ai/post/2035988897074778114
- RunningHub app, **E-commerce main image to video**: https://www.runninghub.ai/ai-detail/1913484332965789697
- RunningHub app, **Video Edit Clothing**: https://www.runninghub.ai/ai-detail/2067856093753200642
- RunningHub workflow, **Fashion TVC Movie Multi-Grid Storyboard & Video Generation Workflow V2.0**: https://www.runninghub.ai/post/2068294767087276033/aiDetail

## Techniques retained as original AffiMatik direction

1. Assign one explicit role to every reference. Product/garment images preserve identity; they are not automatically the first frame or a motion reference.
2. Describe observable actions, not vague mood labels. Small garment adjustments, one weighted step and a complete occlusion rule are more testable than “premium cinematic”.
3. Keep movement modest. RunningHub's public clothing example notes that simple action descriptions reduce excessive movement; NX21–NX26 therefore use one primary motion each.
4. Preserve continuity: garment identity, appliance controls, camera viewpoint, physical scale and human anatomy stay stable during visible action.
5. Separate interface settings from prompt instructions. Duration, aspect ratio and supported reference count remain provider parameters.
6. Keep each 15-second concept narrow. Fashion styles show one silhouette/detail purpose; kitchen styles show one ordinary task rather than a multi-step recipe.

## Techniques deliberately rejected

- Revealing, body-hugging or aurat-exposing fashion presentation.
- Guaranteed virtual try-on, exact fit or multi-outfit transformations from a single garment screenshot.
- Invented clothing variants, appliance controls, accessories, recipes or cooking outcomes.
- Copying third-party prompts verbatim.
- Treating a template preview as proof that Nexabot Omni Flash supports the same workflow.

## Nexabot compatibility assessment

All ten styles use the current simple AffiMatik contract: one product image, optional existing avatar/background references, 15 seconds, 9:16 and Nexabot-owned dialogue. Static compatibility is PASS. Actual garment consistency, mirror geometry, fabric motion, heat/food physics and appliance-control preservation remain provider-dependent and require bounded real generation before production publication.

Development preview cards are explicitly labelled as placeholders. No fake MP4 or poster is presented as a verified result.

