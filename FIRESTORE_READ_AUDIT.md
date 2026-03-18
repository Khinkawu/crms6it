# Firestore Read Audit Report — crms6it

**วันที่**: 18 มีนาคม 2569
**สแกน**: 68 onSnapshot · 69 getDocs · 21 getDoc
**บริบท**: ปัจจุบัน 20k reads/day ด้วย 6 users → เตรียมเปิดให้ครู 200–300 คน/วัน

---

## Executive Summary

| ระดับ | จำนวน | ความเสี่ยง |
|-------|-------|-----------|
| 🔴 HIGH | 6 จุด | unbounded reads — ไม่มี limit/where |
| 🟡 MEDIUM | 15 จุด | missing limit — ควรแก้ก่อนเปิด |
| ✅ GOOD | 48 จุด | มี limit + where ครบ |

### Projection ก่อน vs หลังแก้ (300 users)

| | ก่อนแก้ | หลังแก้ |
|--|---------|--------|
| Reads/day (ประมาณ) | 1.5M–3M | 300k–600k |
| ค่าใช้จ่าย/เดือน | 800–1,800 บาท | ฟรี–170 บาท |

---

## 🔴 HIGH — แก้ก่อนเปิดสัปดาห์หน้า

### 1. `hooks/useInventory.ts:36`
**ปัญหา**: subscribe products ทั้งหมด realtime ไม่มี limit/where

```ts
// ❌ ปัจจุบัน
query(collection(db, "products"), orderBy("updatedAt", "desc"))

// ✅ แก้เป็น
query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(200))
```

**ผลกระทบ**: ทุก user ที่เปิดหน้า inventory = subscribe products ทั้งหมด realtime

---

### 2. `hooks/useFacilityInventory.ts:36`
**ปัญหา**: subscribe facility_inventory ทั้งหมด realtime ไม่มี limit/where

```ts
// ❌ ปัจจุบัน
query(collection(db, "facility_inventory"), orderBy("updatedAt", "desc"))

// ✅ แก้เป็น
query(collection(db, "facility_inventory"), orderBy("updatedAt", "desc"), limit(200))
```

---

### 3. `hooks/useStaffStatus.ts:20`
**ปัญหา**: subscribe staff_status ทั้งหมด ไม่มีทั้ง where และ limit

```ts
// ❌ ปัจจุบัน
query(collection(db, 'staff_status'))

// ✅ แก้เป็น
query(collection(db, 'staff_status'), limit(500))
```

**ผลกระทบ**: hook นี้อาจถูกใช้ใน layout หรือหลาย component — ถ้า re-mount บ่อยจะพุ่งมาก

---

### 4. `app/admin/knowledge-base/page.tsx:54`
**ปัญหา**: subscribe it_knowledge_base ทั้งหมด realtime ไม่มี limit

```ts
// ❌ ปัจจุบัน
query(collection(db, "it_knowledge_base"), orderBy("createdAt", "desc"))

// ✅ แก้เป็น
query(collection(db, "it_knowledge_base"), orderBy("createdAt", "desc"), limit(100))
```

---

### 5. `app/admin/facility/inventory/page.tsx:72`
**ปัญหา**: subscribe facility_inventory realtime ในหน้า admin ไม่มี limit

```ts
// ❌ ปัจจุบัน
query(collection(db, "facility_inventory"), orderBy("updatedAt", "desc"))

// ✅ แก้เป็น
query(collection(db, "facility_inventory"), orderBy("updatedAt", "desc"), limit(200))
```

---

### 6. `app/admin/users/page.tsx:434`
**ปัญหา**: getDocs users ทั้งหมดในครั้งเดียว ไม่มี limit

```ts
// ❌ ปัจจุบัน
getDocs(collection(db, "users"))

// ✅ แก้เป็น — pagination หรือ admin-only action
getDocs(query(collection(db, "users"), limit(100)))
// ถ้าต้องการ export ทั้งหมด → แยก admin action เฉพาะ + confirm dialog
```

---

## 🟡 MEDIUM — แก้ภายใน 1 สัปดาห์หลังเปิด

| ไฟล์ | บรรทัด | Collection | ปัญหา | แก้ |
|------|--------|-----------|-------|-----|
| `hooks/useMyRepairs.ts` | 66 | repair_tickets | มี `where` ไม่มี `limit` | `limit(100)` |
| `hooks/useMyPhotographyJobs.ts` | 45 | photography_jobs | มี `where` ไม่มี `limit` | `limit(50)` |
| `hooks/useDailyReports.ts` | 36 | daily_reports | มี `where` ไม่มี `limit` | `limit(100)` |
| `hooks/useBookings.ts` | 160 | photography_jobs | มี `where` ไม่มี `limit` | `limit(100)` |
| `app/admin/photography/page.tsx` | 143 | photography_jobs (active) | มี `where` ไม่มี `limit` | `limit(100)` |
| `app/admin/photography/page.tsx` | 182 | users (photographers) | มี `where` ไม่มี `limit` | `limit(200)` |
| `app/admin/photography/page.tsx` | 214 | photography_jobs (dashboard) | ไม่มี `limit` | `limit(500)` |
| `components/BorrowedStatusModal.tsx` | 53 | transactions | มี `where` ไม่มี `limit` | `limit(200)` |
| `components/ReturnModal.tsx` | 62 | transactions | มี `where` ไม่มี `limit` | `limit(200)` |
| `components/MyPhotographyJobsModal.tsx` | 46 | photography_jobs | มี `where` ไม่มี `limit` | `limit(50)` |
| `components/FacilityBorrowedStatusModal.tsx` | 56 | transactions | มี `where` ไม่มี `limit` | `limit(200)` |
| `hooks/useCommandCenter.ts` | 141–153 | หลาย collections | date range ไม่มี `limit` | `limit(500)` ต่อ collection |

---

## ✅ GOOD — Pattern อ้างอิงได้

จุดที่ทำถูกต้องแล้ว ใช้เป็น template สำหรับจุดอื่น:

| ไฟล์ | Pattern ดี |
|------|-----------|
| `hooks/useRepairAdmin.ts` | `limit(100)` + `where` ครบ |
| `hooks/useRepairTickets.ts` | `limit(100)` + `where(userId)` |
| `hooks/useFacilityTickets.ts` | `limit(100)` + `where` ครบ |
| `hooks/useFacilityAdmin.ts` | `limit(100)` + `where` ครบ |
| `hooks/useFacilityInventoryAdmin.ts` | `limit(100)` + `where` ครบ |
| `hooks/useNotifications.ts` | `limit(50)` + `where(userId)` |
| `hooks/useActivityLogs.ts` | `limit(100)` + `where` ครบ |
| `app/admin/bookings/page.tsx` | `limit(50)` + `where(status)` |
| `components/repair/RepairHistory.tsx` | `limit(100)` + `where` ครบ |

---

## onSnapshot Full Map

| ไฟล์ | บรรทัด | Collection | Limit | Where | สถานะ |
|------|--------|-----------|-------|-------|--------|
| `hooks/useStaffStatus.ts` | 20 | staff_status | ❌ | ❌ | 🔴 HIGH |
| `hooks/useInventory.ts` | 36 | products | ❌ | ❌ | 🔴 HIGH |
| `hooks/useFacilityInventory.ts` | 36 | facility_inventory | ❌ | ❌ | 🔴 HIGH |
| `app/admin/facility/inventory/page.tsx` | 72 | facility_inventory | ❌ | ❌ | 🔴 HIGH |
| `app/admin/knowledge-base/page.tsx` | 54 | it_knowledge_base | ❌ | ❌ | 🔴 HIGH |
| `app/admin/photography/page.tsx` | 143 | photography_jobs | ❌ | ✅ | 🟡 MEDIUM |
| `hooks/useMyRepairs.ts` | 66 | repair_tickets | ❌ | ✅ | 🟡 MEDIUM |
| `hooks/useMyPhotographyJobs.ts` | 45 | photography_jobs | ❌ | ✅ | 🟡 MEDIUM |
| `hooks/useDailyReports.ts` | 36 | daily_reports | ❌ | ✅ | 🟡 MEDIUM |
| `hooks/useBookings.ts` | 160 | photography_jobs | ❌ | ✅ | 🟡 MEDIUM |
| `app/admin/photography/page.tsx` | 182 | users | ❌ | ✅ | 🟡 MEDIUM |
| `components/BorrowedStatusModal.tsx` | 53 | transactions | ❌ | ✅ | 🟡 MEDIUM |
| `components/ReturnModal.tsx` | 62 | transactions | ❌ | ✅ | 🟡 MEDIUM |
| `hooks/useRepairAdmin.ts` | 50 | repair_tickets | ✅ limit(100) | ✅ | ✅ GOOD |
| `hooks/useRepairAdmin.ts` | 65 | products | ✅ limit(200) | ✅ | ✅ GOOD |
| `hooks/useRepairTickets.ts` | 59 | repair_tickets | ✅ limit(100) | ✅ | ✅ GOOD |
| `hooks/useRepairTickets.ts` | 76 | products | ✅ limit(200) | ✅ | ✅ GOOD |
| `hooks/useFacilityTickets.ts` | 77 | facility_tickets | ✅ limit(100) | ✅ | ✅ GOOD |
| `hooks/useFacilityTickets.ts` | 94 | facility_tickets | ✅ limit(100) | ✅ | ✅ GOOD |
| `hooks/useFacilityAdmin.ts` | 49 | facility_tickets | ✅ limit(100) | ✅ | ✅ GOOD |
| `hooks/useFacilityAdmin.ts` | 64 | products | ✅ limit(200) | ✅ | ✅ GOOD |
| `hooks/useFacilityInventoryAdmin.ts` | 24 | facility_inventory | ✅ limit(100) | ✅ | ✅ GOOD |
| `hooks/useNotifications.ts` | 48 | notifications | ✅ limit(50) | ✅ | ✅ GOOD |
| `hooks/useActivityLogs.ts` | 70 | activities | ✅ limit(100) | ✅ | ✅ GOOD |
| `hooks/useBookings.ts` | 101 | bookings | ✅ limit(50) | ✅ | ✅ GOOD |
| `app/admin/bookings/page.tsx` | 275 | bookings | ✅ limit(50) | ✅ | ✅ GOOD |
| `app/admin/photography/page.tsx` | 157 | photography_jobs | ✅ limit(100) | ✅ | ✅ GOOD |
| `components/repair/RepairHistory.tsx` | 29 | repair_tickets | ✅ limit(100) | ✅ | ✅ GOOD |

---

## Checklist ก่อนเปิดสัปดาห์หน้า

### Priority 1 — แก้ทันที (HIGH)

- [ ] `hooks/useInventory.ts:36` → เพิ่ม `limit(200)`
- [ ] `hooks/useFacilityInventory.ts:36` → เพิ่ม `limit(200)`
- [ ] `hooks/useStaffStatus.ts:20` → เพิ่ม `limit(500)`
- [ ] `app/admin/knowledge-base/page.tsx:54` → เพิ่ม `limit(100)`
- [ ] `app/admin/facility/inventory/page.tsx:72` → เพิ่ม `limit(200)`
- [ ] `app/admin/users/page.tsx:434` → เพิ่ม `limit(100)` + pagination

### Priority 2 — แก้หลังเปิด 1 สัปดาห์ (MEDIUM)

- [ ] `hooks/useMyRepairs.ts:66` → เพิ่ม `limit(100)`
- [ ] `hooks/useMyPhotographyJobs.ts:45` → เพิ่ม `limit(50)`
- [ ] `hooks/useDailyReports.ts:36` → เพิ่ม `limit(100)`
- [ ] `hooks/useBookings.ts:160` → เพิ่ม `limit(100)`
- [ ] `app/admin/photography/page.tsx:143` → เพิ่ม `limit(100)`
- [ ] `app/admin/photography/page.tsx:182` → เพิ่ม `limit(200)`
- [ ] `app/admin/photography/page.tsx:214` → เพิ่ม `limit(500)`
- [ ] `components/BorrowedStatusModal.tsx:53` → เพิ่ม `limit(200)`
- [ ] `components/ReturnModal.tsx:62` → เพิ่ม `limit(200)`
- [ ] `components/MyPhotographyJobsModal.tsx:46` → เพิ่ม `limit(50)`
- [ ] `components/FacilityBorrowedStatusModal.tsx:56` → เพิ่ม `limit(200)`
- [ ] `hooks/useCommandCenter.ts:141` → เพิ่ม `limit(500)` ต่อ collection

### Priority 3 — Monitoring

- [ ] ตั้ง Firebase Budget Alert: $5 / $10 / $20
  - Firebase Console → Billing → Budgets & Alerts
- [ ] Monitor Firebase Console → Firestore → Usage tab ทุกวันช่วงสัปดาห์แรก
- [ ] ตรวจ reads/day หลังเปิดวันแรก เทียบกับ projection

---

## วิธีตรวจสอบ reads ใน Firebase Console

```
Firebase Console
→ Firestore Database
→ Usage tab
→ ดู "Document reads" graph แยกตามวัน

ถ้า reads spike ผิดปกติ:
→ ดูช่วงเวลาที่ spike
→ เปิดหน้าไหน = อาจเป็น onSnapshot นั้น
→ ปิด listener ที่ไม่จำเป็นก่อน
```

---

## 🔍 Root Cause Analysis — ตัวการหลัก 346k reads (Mar 2–19)

> วิเคราะห์จาก Firebase Usage screenshot + code scan 2026-03-18
> ช่วงเวลา: 6 users จริง, เน้น photography booking + admin workflow

### ตัวการหลัก (RED)

#### 🔴 1. `app/page.tsx:184` — facility_tickets 200 reads ทุก homepage load

```ts
// ❌ ปัจจุบัน — โหลดทุกครั้งที่เปิด homepage แม้ feature ยังไม่ได้ใช้
getDocs(query(collection(db, "facility_tickets"), limit(200)))

// ✅ แก้ — ลบออกหรือ comment จนกว่าจะเปิด feature
// feature_tickets ยังไม่ได้ใช้จริง → ประหยัด ~200 reads × 30 loads/day = 6,000 reads/day
```

**ประมาณการ reads ที่หาย**: 200 reads × ~30 page loads/day = **6,000 reads/day**

---

#### 🔴 2. `app/admin/photography/page.tsx:214` — getDocs photography_jobs ไม่มี limit

```ts
// ❌ ปัจจุบัน — ดึง photography_jobs ทั้งหมดทุกครั้งที่ dashboard toggle เปิด
getDocs(query(collection(db, "photography_jobs"), orderBy("startTime", "desc")))

// ✅ แก้
getDocs(query(collection(db, "photography_jobs"), orderBy("startTime", "desc"), limit(200)))
```

**ประมาณการ**: spike ชัดเจนช่วง Mar 11–12 ตรงกับ admin เปิด dashboard หลายครั้ง
→ ถ้า 100 jobs × 5 opens = **500 reads ต่อ session**

---

#### 🔴 3. `components/PhotographyJobModal.tsx:70` — monthsRange: 6 = 12 เดือน

```ts
// ❌ ปัจจุบัน — ทุกครั้งที่เปิด PhotographyJobModal โหลด bookings 12 เดือน (±6 เดือน)
useBookings({ filterApprovedOnly: true, monthsRange: 6 })

// ✅ แก้ — ลด monthsRange เหลือ 2 (±2 เดือน = 4 เดือน window)
useBookings({ filterApprovedOnly: true, monthsRange: 2 })
```

**ประมาณการ**: ถ้า 50 bookings × 12 เดือน × 5 modal opens/day = **3,000 reads/day**

---

### ตัวการรอง (YELLOW)

| ไฟล์ | ปัญหา | ประมาณ reads ที่หาย |
|------|-------|---------------------|
| `app/page.tsx:147` — `useStaffStatus` | onSnapshot ทุก user ทุก render (ไม่มี limit) | ~500/day |
| `app/page.tsx:144` — `useBookings` homepage | getDocs 2 collections ทุก load | ~300/day |

---

### Summary — reads ที่หายได้ถ้าแก้ 3 จุดหลัก

| จุด | ประมาณ reads/day ที่หาย | ความยาก |
|-----|------------------------|---------|
| `facility_tickets` homepage | ~6,000 | ง่าย (ลบ 1 บรรทัด) |
| `photography_jobs` no limit | ~500–1,000 | ง่าย (เพิ่ม limit) |
| `monthsRange: 6` modal | ~3,000 | ง่าย (เปลี่ยน 1 ตัวเลข) |
| **รวม** | **~9,000–10,000 reads/day** | **~10 นาที** |

ปัจจุบัน ~17,000 reads/day (346k ÷ 20 วัน) → หลังแก้ 3 จุด ≈ **7,000–8,000 reads/day**

---

### Quick Fix Checklist (implement ทีหลัง)

- [ ] `app/page.tsx:184` — ลบหรือ comment `getDocs facility_tickets` (feature ยังไม่ใช้)
- [ ] `app/admin/photography/page.tsx:214` — เพิ่ม `limit(200)` ใน dashboard getDocs
- [ ] `components/PhotographyJobModal.tsx:70` — เปลี่ยน `monthsRange: 6` → `monthsRange: 2`

---

*Audit โดย Khai (ข่าย) — Knowledge Architect*
*อ้างอิง: Firebase Firestore Pricing, crms6it codebase scan 2026-03-18*
