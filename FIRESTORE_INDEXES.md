# Firestore Indexes - รายการที่ต้องเพิ่ม

## ⚠️ Indexes ที่ยังขาด (ต้องสร้างเพิ่ม)

ไปที่ **Firebase Console → Firestore → Indexes → Add Index**

### 1. repair_tickets - getRepairsForTechnician (zone specific)
| Field | Order |
|-------|-------|
| zone | Ascending |
| status | Ascending |
| createdAt | Descending |

### 2. repair_tickets - getRepairsForTechnician (all zones)
| Field | Order |
|-------|-------|
| status | Ascending |
| createdAt | Descending |

### 3. bookings - getBookingsByEmail
| Field | Order |
|-------|-------|
| requesterEmail | Ascending |
| startTime | Descending |

### 4. bookings - getPendingBookings
| Field | Order |
|-------|-------|
| status | Ascending |
| startTime | Ascending |

---

## ✅ Indexes ที่มีแล้ว (ไม่ต้องทำอะไร)

- repair_tickets: requesterEmail + createdAt ✅
- repair_tickets: requesterEmail + status + createdAt ✅
- bookings: roomId + status + startTime ✅
- photography_jobs: assigneeIds + startTime ✅
- photography_jobs: status + startTime ✅
- และอื่นๆ อีก 10 รายการ

---

## วิธีสร้าง Index

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. เลือก Project → Firestore Database → Indexes
3. คลิก **"Add Index"**
4. กรอกข้อมูลตามตารางด้านบน
5. Query scope: **Collection**
6. รอ ~2-5 นาทีให้ Index build เสร็จ
