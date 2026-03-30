# crms6it — Security Remediation Plan

**Audit Date:** 2026-03-30
**Auditor:** Khai (ข่าย) Oracle
**Status:** In Progress

---

## Phase 1 — Critical (ต้องแก้ก่อน deploy ทุกครั้ง)

> ช่องโหว่ที่ทำให้ระบบถูก compromise ได้จากภายนอกโดยตรง

- [x] **CRIT-1** `app/api/auth/line-custom-token/route.ts`
  ปัญหา: ส่ง `lineUserId` อะไรก็ได้ → ได้ Firebase custom token → login เป็น user นั้นเลย
  แก้: verify LINE LIFF ID token กับ `api.line.me/oauth2/v2.1/verify` ก่อน issue token

- [x] **CRIT-2** `app/api/notify-repair/route.ts`
  ปัญหา: `Origin` header ปลอมได้ + `x-internal-request: true` bypass auth ได้
  แก้: ลบ origin/`x-internal-request` check → เปลี่ยนเป็น Firebase Bearer (any authenticated user)

- [x] **CRIT-2** `app/api/notify-booking-result/route.ts`
  ปัญหา: เหมือนกัน — origin spoof bypass
  แก้: เปลี่ยนเป็น Firebase Bearer + admin/moderator role check

- [x] **CRIT-2** `app/api/notify-facility/route.ts`
  ปัญหา: เหมือนกัน — origin spoof bypass
  แก้: เปลี่ยนเป็น Firebase Bearer (any authenticated user)

---

## Phase 2 — High (แก้ภายในสัปดาห์นี้)

> ช่องโหว่ที่ authenticated user ใช้โจมตีระบบได้

- [x] **HIGH-1** `app/api/admin/repair-inventory/route.ts` (PATCH)
  ปัญหา: `item.fields` จาก request body เขียน Firestore ตรงๆ ไม่มี allowlist
  แก้: allowlist products (`name`,`quantity`,`unit`,`price`,`status`,`borrowedCount`,`activeBorrowId`) + transactions (`status`,`returnedAt`,`returnerName`,`repairNote`,`repairedAt`)

- [x] **HIGH-2** `app/api/admin/repair-inventory/route.ts`
  ปัญหา: return `error.message` ใน response → leak internal details
  แก้: return `{ error: 'Internal Server Error' }` ใน catch ทุก block (GET/PATCH/POST)

- [x] **HIGH-3** `app/api/line/login/route.ts` + `app/api/line/callback/route.ts`
  ปัญหา: OAuth ไม่มี CSRF protection + `lineUserId` ปรากฏใน redirect URL
  แก้: (a) nonce (crypto.randomUUID) เก็บใน `line_auth_nonces/{nonce}` ใช้เป็น state
       (b) callback เขียน lineUserId ใน Firestore โดยตรง → redirect `/profile?action=link_line_success` (ไม่มี data ใน URL)
       profile/page.tsx: handle `link_line_success` โดย re-fetch Firestore แทน

- [x] **HIGH-4** `app/api/send-otp/route.ts`
  ปัญหา: rate limit ผูกกับ `lineUserId` ที่ caller ส่งมา → bypass ง่าย → email bomb
  แก้: IP-based rate limit 5 req/60s เพิ่มเติมจาก lineUserId check

- [x] **HIGH-5** `app/api/facebook/generate-caption` — ~~ลบแล้ว~~ ✅

- [x] **HIGH-6** `app/api/admin/proxy-image/route.ts`
  ปัญหา: ตรวจแค่ auth ไม่ตรวจ role → ทุก user เข้าได้
  แก้: จำกัด `photographer`, `moderator`, `admin` (photographer ใช้ generateReport จาก my-work)

- [x] **HIGH-7** `app/api/drive/prepare-folder/route.ts`
  ปัญหา: ไม่มี role check → ทุก user สร้าง Drive folder ได้
  แก้: จำกัด `photographer`, `moderator`, `admin` + validate `eventName`

- [x] **HIGH-7** `app/api/drive/prepare-daily-report/route.ts`
  ปัญหา: ไม่มี role check
  แก้: จำกัด `photographer`, `moderator`, `admin`

- [x] **HIGH-7** `app/api/drive/upload/route.ts`
  ปัญหา: ไม่มี role check + ส่ง origin header จาก request
  แก้: จำกัด `photographer`, `moderator`, `admin` + hardcode origin จาก env

- [x] **HIGH-7** `app/api/drive/upload-to-folder/route.ts`
  ปัญหา: ไม่มี role check + ส่ง `origin` header ต่อไปยัง Google Drive
  แก้: จำกัด `photographer`, `moderator`, `admin` + hardcode origin จาก env

- [x] **HIGH-8** `app/api/facebook/post/route.ts`
  ปัญหา: ทุก authenticated user โพสต์ Facebook โรงเรียนได้
  แก้: จำกัด `photographer`, `moderator`, `admin`

- [x] **HIGH-8** `app/api/facebook/upload-photo/route.ts`
  ปัญหา: ไม่มี role check + ไม่ validate mimeType + ไม่จำกัดขนาด base64
  แก้: role check + mimeType allowlist (jpeg/png/webp) + cap 20MB

---

## Phase 3 — Medium (แก้ภายใน 2 สัปดาห์)

> ช่องโหว่ที่ส่งผลต่อ data integrity และ privacy (PDPA)

- [x] **MED-1** `app/api/notify-booking/route.ts`
  ปัญหา: ทุก user spam notifications ถึง admin ได้
  แก้: per-UID rate limit 10 req/60s

- [x] **MED-1** `app/api/notify-photo-assigned/route.ts`
  ปัญหา: return `lineUserIds` ใน response + ไม่มี role check
  แก้: ลบ `lineUserIds` จาก response + เพิ่ม admin/moderator role check

- [x] **MED-1** `app/api/notify-photo-submitted/route.ts`
  ปัญหา: ไม่มี role check
  แก้: จำกัด `photographer`, `moderator`, `admin`

- [x] **MED-2** `app/api/line/callback/route.ts`
  ปัญหา: `lineUserId` ใน redirect URL → ปรากฏใน browser history + Vercel logs (PDPA)
  แก้: done in HIGH-3 — callback writes to Firestore server-side, redirects with `?action=link_line_success`

- [x] **MED-3** `app/api/line-webhook/route.ts`
  ปัญหา: ไม่มี body size limit — ส่ง payload ใหญ่ exhaust memory
  แก้: check `Content-Length` + `rawBody.length` reject > 1MB

- [x] **MED-4** `app/api/update-username/route.ts`
  ปัญหา: match activities ด้วย `userName` → ชื่อซ้ำกัน = เขียนทับ activity คนอื่น
  แก้: filter activities ด้วย `userId` field แทน — ต้อง backfill `userId` ใน activities docs ก่อนจะมีผล

- [x] **MED-5** `app/api/external/activities/route.ts`
  ปัญหา: return `error.message` ให้ public internet
  แก้: return `{ success: false, error: 'Internal Server Error' }`

- [x] **MED-6** `app/api/line/login/route.ts`
  ปัญหา: `userId` จาก query string ไม่ validate + ไม่ต้อง auth ก่อน initiate OAuth
  แก้: require Firebase Bearer token + validate userId === token uid + return JSON redirectUrl แทน redirect (เพื่อรับ header ได้)

---

## Phase 4 — Low (แก้ใน backlog)

- [ ] **LOW-1** `app/api/errors/route.ts`
  In-memory rate limit reset ทุก cold start
  แก้: ย้ายไปใช้ Vercel KV หรือ Upstash Redis

- [x] **LOW-2** `app/api/line-webhook/route.ts`
  `console.log` lineUserId + message content ใน production (PDPA)
  แก้: ลบ log ที่ expose user data ออก

- [x] **LOW-3** `app/api/drive/upload-to-folder/route.ts`
  ส่ง `origin` header จาก request ต่อไปยัง Google Drive
  แก้: hardcode `Origin` header

- [x] **LOW-4** `app/api/fcm/send/route.ts`
  Return `messageId` ใน response (ไม่จำเป็น)
  แก้: ลบ `messageId` ออกจาก response

---

## Completed ✅

- [x] `app/api/errors/route.ts` — Rate limit 10/60s per IP + source allowlist validation
- [x] `app/api/admin/error-logs/route.ts` — Firestore doc ID regex validation + doc existence check
- [x] `app/api/facebook/generate-caption` — ลบแล้ว (unused)
- [x] `firestore.indexes.json` — เพิ่ม errorLogs composite index
- [x] **CRIT-1** `app/api/auth/line-custom-token/route.ts` — require LIFF ID token, verify with LINE API before issuing Firebase custom token
- [x] **CRIT-2** `app/api/notify-repair/route.ts` — Firebase Bearer auth (any authenticated user)
- [x] **CRIT-2** `app/api/notify-facility/route.ts` — Firebase Bearer auth (any authenticated user)
- [x] **CRIT-2** `app/api/notify-booking-result/route.ts` — Firebase Bearer + admin/moderator role check

---

## Reference

| Severity | Count | Done |
|----------|-------|------|
| 🔴 Critical | 4 | 4 ✅ |
| 🟠 High | 10 | 10 ✅ |
| 🟡 Medium | 8 | 8 ✅ |
| 🔵 Low | 4 | 3 ✅ |
| **Total** | **26** | **25** |
