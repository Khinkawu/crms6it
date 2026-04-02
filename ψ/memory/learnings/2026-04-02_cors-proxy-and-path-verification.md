# Lesson: CORS Proxy Pattern + Path Verification

**Date**: 2026-04-02
**Source**: Session แก้ Drive CORS บน it.tesaban6.ac.th

---

## 1. ERR_FAILED 200 = response blocked, not upload failed

เมื่อ browser เห็น `net::ERR_FAILED 200 (OK)`:
- 200 = server (Google) ได้รับและประมวลผลสำเร็จ
- ERR_FAILED = browser ถูก CORS block ไม่ให้อ่าน response

Fix ที่ถูกคือ proxy ทั้ง request ผ่าน server — ไม่ใช่แค่แก้ header ของ session initiation

## 2. Google Drive resumable upload CORS

เมื่อ browser PUT ตรงไป Google Drive upload URL:
- Google จะ lock `Access-Control-Allow-Origin` ตาม origin ที่สร้าง session
- วิธีแก้ที่ถูกต้อง: ให้ server เป็นคน PUT แทน browser (full proxy)
- Proxy endpoint ต้องการ: stream request body (`duplex: 'half'`), forward Content-Type, auth check

## 3. ถาม working directory ก่อนเสมอ

ถ้าไม่รู้ path ชัดเจนจาก memory หรือ context ให้ถาม user ก่อน อย่า spawn agent ค้นเอง — repo เดียวกันอาจมีหลาย copy ในเครื่อง

## 4. git fetch ก่อน commit

```bash
git fetch && git log origin/main --oneline -3
```
เพื่อ detect remote changes ก่อน commit หลีกเลี่ยง merge conflict
