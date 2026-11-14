# AFFIMATIK — INDIVIDUAL OPERATOR LEGAL RELEASE CHECKLIST

> **OWNER-ONLY WORKING DOCUMENT — NOT FOR PUBLICATION.** This is operational preparation, not a legal opinion. Obtain Malaysian legal advice before publishing the final Privacy Notice or Terms.

## A. Owner identity and seller-information checklist

- [x] Full legal name: **Muhammad Ridzuan bin Ramli**
- [x] Owner-supplied business address: **TTGU, Tasek Gelugor, Pulau Pinang, Malaysia**
- [x] Support telephone: **019-521 6867**
- [x] Support email: `support@affimatik.online`
- [x] Brand: `Pawarna Studio / AffiMatik`
- [x] Current status: individual operator; no registered SSM entity or registration number
- [x] Principal operating state: **Pulau Pinang, Peninsular Malaysia**
- [ ] Business commencement date: **[OWNER TO COMPLETE]**
- [x] Requested effective date: **immediately**; use **14 November 2026** only if published on that date, otherwise use the actual publication date
- [x] Minimum account age: **12**; ages 12–17 require parent/legal-guardian permission and purchase authorization
- [x] Refund request window approved: **7 calendar days** for a verified payment where credits remain unused and no provider cost occurred
- [x] Public disclosure model selected: display the legal name as individual operator together with the Pawarna Studio/AffiMatik brand, without implying a registered entity

Do not publish a MyKad number, passport number, personal banking credential or identity-document image.

## B. Business registration review and next action

AffiMatik charges for an online service and therefore appears to be an activity carried on for gain. The exact registration route depends on the principal place of business:

- **Peninsular Malaysia or Federal Territory of Labuan:** SSM guidance states that a business within the Registration of Businesses Act 1956 must be registered no later than 30 days after commencement. EzBiz supports sole-proprietor registration under a personal name or approved trade name. The owner should obtain SSM/legal confirmation and begin the appropriate registration promptly; this checklist does not claim an exemption.
- **Sabah or Sarawak:** SSM states that the Registration of Businesses Act 1956 does not apply there. The owner must check the applicable state/local registration and trading-licence regime for the actual address and online-service activity. Do not assume that “SSM does not apply” means no registration or licence is required.

Sources:

- SSM registration guideline: https://ssm.com.my/Documents/Ezbiz%20Online%20User%20Guideline/GUIDELINE-FOR-REGISTRATION-OF-NEW-BUSINESS.pdf
- SSM EzBiz: https://www.ssm.com.my/Pages/Services/Registration-of-Business-%28ROB%29/EzBiz-Online.aspx
- Registration of Businesses Act 1956, section 5: https://www.ssm.com.my/acts/fscommand/a0197s0005.htm
- SSM confirmation that the Act is not applicable to Sabah/Sarawak: https://annualreport.ssm.com.my/AR2024/index.html

**Registration next action:** Pulau Pinang falls within Peninsular Malaysia. The owner should register the sole proprietorship/trade name through SSM EzBiz promptly and obtain advice on any local-authority licence that applies. Until registration is completed, public materials must continue to say that Pawarna Studio is an unregistered brand and must not display a fabricated registration number.

## C. Proposed seller disclosure for sales page and checkout

> **Penyedia perkhidmatan**<br>
> AffiMatik dikendalikan oleh **Muhammad Ridzuan bin Ramli** secara individu di bawah jenama **Pawarna Studio**. Pawarna Studio bukan syarikat atau enterprise berdaftar pada tarikh ini dan tiada nombor pendaftaran SSM untuk dipaparkan.<br>
> Alamat perniagaan: **TTGU, Tasek Gelugor, Pulau Pinang, Malaysia**<br>
> E-mel: **support@affimatik.online**<br>
> Telefon: **019-521 6867**<br>
> Perkhidmatan: platform cloud untuk menghasilkan video affiliate menggunakan provider AI.<br>
> Launch Pack: **RM19, 150 kredit, sehingga 15 generation pada kadar semasa, sah 180 hari, bayaran sekali dan tiada pembaharuan automatik.**<br>
> Bayaran: QR manual kepada penerima yang dipaparkan semasa checkout. Bukti pembayaran yang dimuat naik belum bermaksud bayaran telah disahkan oleh bank.<br>
> Penghantaran: kredit boleh diaktifkan secara provisional selepas bukti dihantar; video tertakluk kepada queue, provider dan baki kredit.<br>
> Terma, Notis Privasi dan polisi pembatalan/refund: **[PUBLIC LINKS AFTER FINAL APPROVAL]**

Do not publish this block until the name, address, telephone and effective legal documents are complete.

## D. Owner-selected cancellation/refund policy pending legal review

The proposal is incorporated in section 8 of `TERMS_OF_SERVICE_DRAFT_MS.md`. Owner decisions still required:

1. **Approved:** seven-calendar-day request window for a verified payment where no credits were used and no provider cost occurred.
2. **Selected:** after partial use, any approved refund for unused credits is calculated pro-rata using the original package unit value.
3. **Selected:** confirmed duplicate/overpayments are returned or reallocated with customer agreement. No invented administration fee; only an actual irreversible transaction cost may be considered if lawful and disclosed.
4. Owner will initially review requests through `support@affimatik.online`; no support-hours promise is made.
5. Account closure, pending jobs and payment holds remain subject to an operational runbook and mandatory record retention.

Mandatory consumer rights remain unaffected regardless of the selected commercial policy.

## E. Proposed data-retention schedule

> **OWNER-SELECTED POLICY, NOT YET TECHNICALLY IMPLEMENTED.** These periods are now the intended retention policy. They must not be promised publicly until deletion/anonymisation jobs, backup rotation and exception holds are implemented and tested.

| Data category | Current technical state | Proposed normal retention | Exceptions / required implementation |
| --- | --- | --- | --- |
| Unconfirmed registration/auth attempt | Supabase Auth controls; no AffiMatik purge job identified | 30 days after last attempt | Confirm Supabase Auth settings and implement cleanup if appropriate |
| Active account/profile/workspace | Retained with no self-service account deletion | Life of account | Build documented closure workflow; preserve required transaction records |
| Product images, avatars, backgrounds | Private Storage; avatar/background delete exists, general product deletion not found | Life of account or until user deletion | Add product deletion/export workflow and handle references safely |
| Completed customer MP4 | Private Storage; no automatic expiry | Life of account or user deletion | Define customer expectation, backup handling and job-record preservation |
| Failed/abandoned uploads without DB record | Error paths attempt immediate deletion | Immediate or within 24 hours | Add orphan-storage audit/cleanup |
| Job records, prompts and generation snapshots | Persistent; required for queue, disputes and duplicate prevention | 24 months after completion/final failure | Confirm whether prompts contain personal data; anonymise where possible |
| Orders, wallet ledger, credit buckets, refunds and affiliate financial records | Persistent immutable/auditable records | 7 years after end of relevant financial year | Confirm Malaysian tax/accounting advice; retain longer only for active dispute/legal hold |
| Payment evidence image/PDF | Private Storage; no purge | 24 months after payment confirmation/rejection | Legal review whether shorter period is sufficient; keep hash/order/audit record longer without image where possible |
| Payment hash/idempotency keys | Persistent duplicate-replay control | 7 years with order record | Hash is not bank verification; restrict access |
| Security/admin audit logs and rate-limit records | Persistent or provider-managed; no unified expiry | 12–24 months | Define severity tiers; keep incident/legal-hold records as needed |
| Conversion events | Persistent service-role-only table; visitor cookie 180 days | Raw events 13 months, aggregated anonymous metrics longer | Implement scheduled deletion/anonymisation; document aggregation |
| Support emails/tickets | Provider inbox; retention not configured in code | 24 months after closure | Confirm email-provider settings and delete unnecessary attachments |
| Affiliate attribution cookie | Implemented for 30 days | 30 days | Existing behavior |
| Customer session cookie | Implemented for 7 days | 7 days | Existing behavior; logout clears it |
| Admin session cookie | Implemented for 12 hours | 12 hours | Existing behavior |
| Encrypted manual backups | No approved rotation period | 90 days rolling, plus defined release snapshots up to 12 months | Implement secure inventory, deletion log and tested restore policy |

Legal holds, charge/payment disputes, fraud/security investigations and statutory duties may justify a documented exception. Exceptions should be scoped, approved and reviewed rather than indefinite by default.

## F. Provider and cross-border decisions

- [x] Supabase production endpoint maps to `ap-northeast-1` (Tokyo) in official Supabase region documentation.
- [ ] Confirm the exact region in the Supabase dashboard and retain a screenshot/export.
- [ ] Review/accept Supabase DPA and current subprocessors.
- [x] Cloudflare Workers execute on a global network; current Worker is not pinned to Malaysia.
- [ ] Review Cloudflare DPA, log retention and any required Data Localization controls.
- [x] Nexabot receives reference images, prompts/settings and returns task/output data.
- [ ] Obtain Nexabot privacy terms/DPA, processor identity, processing/storage countries, subprocessors, retention/deletion terms and security contact. **Publication blocker.**
- [ ] Confirm whether Supabase Auth SMTP currently uses Resend or another provider.
- [ ] If Resend is used, confirm sender domain, DPA, subprocessors, retention and processing locations.
- [ ] Document the applicable section 129 condition and transfer assessment for every overseas transfer. **Proposed basis for legal review:** transfers to Supabase, Cloudflare and Nexabot that are objectively required to operate the account, store customer content and fulfil a user-requested generation may rely on necessity for performance of the customer contract; optional marketing/email processing and any processing beyond what is necessary need a separately verified condition. Do not treat this proposal as a completed assessment or blanket consent.

## G. Exact legal-release blockers

1. The address supplied as “TTGU, Tasek Gelugor” may not be a complete postal/business address; confirm unit/lot, street/locality and postcode before publication.
2. Business commencement date is still needed for the SSM registration record and compliance assessment.
3. SSM sole-proprietorship/trade-name registration has not been completed; no registration number may be displayed.
4. The selected retention schedule is not yet technically implemented or covered by a deletion/backup-rotation runbook.
5. Nexabot processor identity, locations, subprocessors, safeguards and retention remain unverified.
6. Active Supabase Auth email/SMTP provider and its processing details remain unverified.
7. Cross-border transfer assessment/condition under section 129 has not been documented.
8. The app does not currently collect age or guardian attestation; the selected 12–17 policy is not technically enforced.
9. Liability wording and the under-18 account/payment flow require Malaysian legal review.

Until these items are resolved, keep the drafts internal and do not deploy legal links or Sales Page V2 on the assumption that the disclosures are complete.
