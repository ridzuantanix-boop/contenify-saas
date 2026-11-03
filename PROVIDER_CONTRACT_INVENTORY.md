# CONTENIFY — Provider Contract Inventory

This document details the observed vs assumed API schemas, endpoint contracts, and sanitized payload fixtures for AI video generation providers integrated into CONTENIFY.

---

## 1. RunningHub (15-Second Visual Engine)

### Contract Status: **VERIFIED (Observed from working legacy code & OpenAPI)**

- **Target Duration**: 15 seconds.
- **Base URL**: `https://www.runninghub.ai`
- **Authentication**: Header `Authorization: Bearer <API_KEY>` and body parameter `apiKey`.
- **Target WebApp ID**: `2103149871766220801`

### Endpoints
1. **Asset Upload**: `POST /task/openapi/upload`
   - Multipart form-data: `apiKey`, `fileType: 'input'`, `file: <Stream>`
   - Response: `{ code: 0, data: { fileName: "..." } }`
2. **Execute App**: `POST /openapi/v2/run/ai-app/2103149871766220801`
   - Request Payload:
     ```json
     {
       "apiKey": "[REDACTED]",
       "webappId": "2103149871766220801",
       "taskType": "ASYNC",
       "instanceType": "plus",
       "usePersonalQueue": "false",
       "nodeInfoList": [
         { "nodeId": "114", "fieldName": "image", "fieldValue": "uploaded_main_char.png", "description": "karakter utama" },
         { "nodeId": "168", "fieldName": "image", "fieldValue": "uploaded_ref_1.png", "description": "gambar 1" },
         { "nodeId": "169", "fieldName": "image", "fieldValue": "uploaded_ref_2.png", "description": "gambar 2" },
         { "nodeId": "170", "fieldName": "image", "fieldValue": "uploaded_ref_3.png", "description": "gambar 3" },
         { "nodeId": "171", "fieldName": "image", "fieldValue": "uploaded_ref_4.png", "description": "gambar 4" },
         { "nodeId": "136", "fieldName": "text", "fieldValue": "[15s Prompt Text]", "description": "teks" },
         { "nodeId": "115", "fieldName": "aspect_ratio", "fieldValue": "9:16 (Portrait Widescreen)", "description": "aspect_ratio" },
         { "nodeId": "135", "fieldName": "value", "fieldValue": "15", "description": "duration" }
       ]
     }
     ```
   - Response: `{ taskId: "rh_task_987213...", status: "SUBMITTED" }`
3. **Query Status / Result**: `POST /openapi/v2/query`
   - Request: `{ "apiKey": "[REDACTED]", "taskId": "..." }`
   - Output Verification: Filters `results[]` for `.mp4` file URL.

---

## 2. Nexabot (10-Second Spoken BM Engine)

### Contract Status: **CONTRACT INVENTORY & STAGING SPECIFICATION**

- **Target Duration**: 10 seconds.
- **Capabilities**: Priority for fluent conversational Malaysian Malay spoken audio, internal product research and dynamic prompt expansion.
- **Base URL**: `https://api.nexabot.ai/v1` (configurable via `NEXABOT_BASE_URL`)
- **Authentication**: Header `Authorization: Bearer <API_KEY>`, `X-Idempotency-Key: <UUID>`

### Expected Specification & Payload Fixture:
```json
{
  "prompt": "[Format]: 10-second high-fidelity video, 9:16 vertical format.\n\n[Scene & Action]: Malaysian creator introducing Sambal Tok Wan.\n\n[Call to Action]: Closing spoken CTA: 'Tekan butang di bawah untuk dapatkan sekarang.'\n\n[Audio Track]: Spoken in natural standard Malaysian Malay...",
  "duration": 10,
  "aspect_ratio": "9:16",
  "language": "ms-MY",
  "dialect": "standard_malaysian_malay",
  "reference_images": [
    "https://storage.contenify.internal/workspaces/ws_01/inputs/product_front.jpg"
  ],
  "idempotency_key": "idem_job_102839128",
  "metadata": {
    "workspace_id": "ws_01",
    "job_id": "job_102839128",
    "voice_style": "standard"
  }
}
```

- **Query / Status**:
  - `GET /videos/{id}`
  - Response: `{ "id": "...", "status": "succeeded", "video_url": "https://...", "progress": 100 }`
- **Cancellation**:
  - `POST /videos/{id}/cancel`

---

## 3. Missing Credentials & Staging Requirements

To execute live smoke tests on paid provider endpoints without compromising security:
1. **Rotate Exposed Keys**: The product owner must confirm that any keys previously exposed in old HTML prototypes have been rotated.
2. **Nexabot Production Credentials**:
   - `NEXABOT_API_KEY`: Required in staging server environment.
   - `NEXABOT_BASE_URL`: Confirmation of actual production/sandbox endpoint.
3. **RunningHub Production Balance**:
   - `RUNNINGHUB_API_KEY`: Configured in staging server secret store.
   - Verify sufficient account points for 15s test run.
4. **Cloudflare R2 Bucket**:
   - Account ID, Access Key ID, Secret Access Key, and private bucket name.
