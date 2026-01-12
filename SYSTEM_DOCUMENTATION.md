# 📚 CRMS6-IT System Documentation

> **Computer Room Management System - Tessaban 6 IT Department**  
> **เอกสารระบบฉบับสมบูรณ์ สำหรับนักพัฒนา**  
> **Last Updated:** 12 มกราคม 2569 (เวลา 11:38) | **Version:** 1.8.0

---

## 📋 สารบัญ

1. [ภาพรวมระบบ](#-ภาพรวมระบบ)
2. [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
3. [โครงสร้างโปรเจค](#-โครงสร้างโปรเจค)
4. [ฟีเจอร์ทั้งหมด](#-ฟีเจอร์ทั้งหมด)
5. [AI Agent (LINE Bot)](#-ai-agent-line-bot)
6. [ระบบ Authentication](#-ระบบ-authentication)
7. [API Routes](#-api-routes)
8. [Database Schema](#-database-schema-firestore)
9. [Utility Libraries](#-utility-libraries)
10. [Environment Variables](#-environment-variables)
11. [การพัฒนาต่อ](#-การพัฒนาต่อ)
12. [Known Issues & TODOs](#-known-issues--todos)

---

## 🎯 ภาพรวมระบบ

CRMS6-IT เป็นระบบบริหารจัดการห้องคอมพิวเตอร์ ประกอบด้วย:

| โมดูล | คำอธิบาย |
|-------|---------|
| **ระบบแจ้งซ่อม** | แจ้งปัญหาอุปกรณ์, ติดตามสถานะ, ช่างรับงาน |
| **ระบบจองห้อง** | จองห้องประชุม/ห้องเรียน, ปฏิทิน, อนุมัติ |
| **ระบบถ่ายภาพกิจกรรม** | มอบหมายงานถ่ายภาพ, อัปโหลด Google Drive |
| **ระบบอุปกรณ์** | ยืม-คืนอุปกรณ์, QR Code, Stock Management |
| **Gallery** | แสดงผลงานถ่ายภาพกิจกรรม |
| **LINE Integration** | แจ้งเตือนผ่าน LINE, LIFF Apps |
| **AI Agent** | ผู้ช่วย AI ใน LINE Bot (Gemini 2.5 Flash) |

---

## 🛠 เทคโนโลยีที่ใช้

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.1.0 | React Framework (App Router) |
| React | 18.x | UI Library |
| TypeScript | 5.x | Type Safety |
| TailwindCSS | 3.3.0 | Styling |
| Framer Motion | 12.x | Animations |
| Lucide React | 0.555 | Icons |

### Backend
| Technology | Purpose |
|------------|---------|
| Next.js API Routes | Server-side APIs |
| Firebase Admin SDK | Server-side Firestore (AI Agent, OTP) |
| Nodemailer | Email OTP Service |

### Database & Storage
| Service | Purpose |
|---------|---------|
| Firebase Firestore | NoSQL Database |
| Firebase Storage | Image Storage |
| Google Drive API | Photo Upload |

### Authentication
| Service | Purpose |
|---------|---------|
| Firebase Auth | Google Sign-In |
| LINE LIFF | LINE Login |

### Notifications
| Service | Purpose |
|---------|---------|
| LINE Messaging API | Push Messages |
| LINE Bot SDK | Webhook Handling |

### Other Libraries
```json
{
  "react-big-calendar": "Calendar Component",
  "moment": "Date Handling (Calendar only)",
  "date-fns": "Date Formatting (Main)",
  "react-hot-toast": "Toast Notifications",
  "html2canvas + jspdf": "PDF Generation",
  "xlsx": "Excel Export",
  "jszip": "File Compression",
  "react-signature-canvas": "Digital Signature"
}
```

---

## 📁 โครงสร้างโปรเจค

```
crms6it/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # LINE Custom Token
│   │   ├── cron/                 # Cron Jobs (Repair Reminder)
│   │   ├── drive/upload/         # Google Drive Upload
│   │   ├── facebook/             # Facebook Integration
│   │   │   ├── post/             # Post to Facebook Page
│   │   │   └── upload-photo/     # Upload Photo to Facebook
│   │   ├── fcm/send/             # FCM Push Notifications
│   │   ├── line/                 # LINE Login/Callback/Push
│   │   ├── line-webhook/         # LINE Bot Webhook + AI Agent
│   │   ├── notify-repair/        # Notify Technicians
│   │   ├── notify-user/          # Notify Users
│   │   ├── send-otp/             # Send OTP for Account Binding
│   │   └── verify-otp/           # Verify OTP
│   ├── admin/                    # Admin Pages
│   │   ├── add-product/          # เพิ่มอุปกรณ์
│   │   ├── bookings/             # จัดการการจอง
│   │   ├── dashboard/            # Admin Dashboard
│   │   ├── inventory/            # จัดการอุปกรณ์
│   │   ├── photography/          # จัดการงานถ่ายภาพ
│   │   ├── repairs/              # จัดการงานซ่อม
│   │   └── users/                # จัดการผู้ใช้
│   ├── booking/                  # หน้าจองห้อง
│   ├── gallery/                  # หน้าประมวลภาพกิจกรรม
│   ├── liff/                     # LINE LIFF Pages
│   │   ├── booking/              # LIFF จองห้อง
│   │   ├── entry/                # LIFF Entry Point
│   │   └── repair/               # LIFF แจ้งซ่อม
│   ├── login/                    # หน้า Login
│   ├── my-work/                  # หน้างานของฉัน (ซ่อม/ถ่ายภาพ)
│   ├── product/[id]/             # รายละเอียดอุปกรณ์
│   ├── profile/                  # หน้าโปรไฟล์
│   ├── repair/                   # หน้าแจ้งซ่อม
│   ├── components/               # React Components
│   │   ├── admin/                # Admin Components
│   │   │   ├── ActivityFeed.tsx  # Admin Activity Feed
│   │   │   └── StatsCard.tsx     # Admin Stats Card
│   │   ├── dashboard/            # Dashboard Components
│   │   │   ├── widgets/          # Widget, QuickAction, StatCard
│   │   │   ├── ActivityFeed.tsx  # Dashboard Activity Feed
│   │   │   ├── CalendarSection.tsx
│   │   │   ├── HeroSection.tsx
│   │   │   ├── PhotoGalleryList.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── RecentActivityList.tsx
│   │   │   └── StatsWidgetContent.tsx
│   │   ├── liff/                 # LIFF Components
│   │   │   ├── LiffComponents.tsx
│   │   │   └── LiffGuard.tsx
│   │   ├── navigation/           # Navigation Components
│   │   │   ├── BottomNavigation.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── SideQuickAccess.tsx
│   │   │   └── TopHeader.tsx
│   │   ├── repairs/              # Repair Components
│   │   │   ├── RepairModal.tsx
│   │   │   └── RepairTicketCard.tsx
│   │   ├── shared/               # Shared Components
│   │   │   ├── FilterBar.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   └── StatsCard.tsx
│   │   └── ui/                   # UI Components
│   │       ├── EmptyState.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── OptimizedImage.tsx
│   │       ├── Pagination.tsx
│   │       └── Skeleton.tsx
│   ├── globals.css               # Global Styles
│   ├── layout.tsx                # Root Layout
│   ├── manifest.ts               # PWA Manifest
│   └── page.tsx                  # Dashboard (Home)
├── components/                   # Legacy Components
│   ├── admin/                    # Legacy Admin Components
│   └── repair/                   # Legacy Repair Components
├── context/                      # React Contexts
│   ├── AuthContext.tsx           # Authentication Context
│   └── ThemeContext.tsx          # Dark/Light Mode
├── hooks/                        # Custom React Hooks
│   ├── useActivityLogs.ts        # Activity Logs
│   ├── useBookings.ts            # Bookings CRUD
│   ├── useInventory.ts           # Inventory CRUD
│   ├── useLiff.ts                # LINE LIFF
│   ├── useMyPhotographyJobs.ts   # My Photography Jobs
│   ├── useMyRepairs.ts           # My Repair Jobs
│   ├── usePagination.ts          # Pagination Helper
│   ├── usePushNotifications.ts   # FCM Push Notifications
│   ├── useRepairActions.ts       # Repair Update/Parts Actions
│   ├── useRepairAdmin.ts         # Repair Admin (Composite Hook)
│   ├── useRepairFilter.ts        # Repair Filtering & Stats
│   ├── useRepairModal.ts         # Repair Modal State
│   ├── useRepairTickets.ts       # Repair Tickets
│   └── useSessionTimeout.ts      # Auto Logout
├── lib/                          # Utility Libraries
│   ├── academicYear.ts           # Thai Academic Year Helper
│   ├── agentFunctions.ts         # AI Agent Database Functions
│   ├── aiAgent.ts                # AI Agent Main Processor
│   ├── dateUtils.ts              # Bangkok Timezone Utilities
│   ├── emailService.ts           # Email OTP Service (Nodemailer)
│   ├── fcm.ts                    # FCM Push Notification Service
│   ├── firebase.ts               # Firebase Client Init
│   ├── firebaseAdmin.ts          # Firebase Admin Init
│   ├── gemini.ts                 # Gemini AI Configuration
│   ├── generateReport.ts         # PDF Report Generator
│   └── googleDrive.ts            # Google Drive Upload
├── scripts/                      # Utility Scripts
│   ├── get-fb-token.js           # Get Facebook Token
│   └── refresh-facebook-token.js # Refresh Facebook Token
├── types/                        # TypeScript Types
│   └── index.ts                  # All Type Definitions
├── utils/                        # Utility Functions
│   ├── aggregation.ts            # Inventory Stats (/stats/inventory)
│   ├── excelExport.ts            # Excel Export (Repair Reports)
│   ├── flexMessageTemplates.ts   # LINE Flex Message Templates
│   ├── imageCompression.ts       # Client-side Image Compression
│   ├── logger.ts                 # Activity Logging
│   └── photographyExport.ts      # Photography Jobs Export
├── public/                       # Static Assets
│   ├── font/                     # Custom Fonts
│   ├── firebase-messaging-sw.js  # FCM Service Worker
│   └── *.png                     # Icons & Logos
└── SYSTEM_DOCUMENTATION.md       # This File
```

---

## 🔗 Dependency Map (Function → Used In)

แสดงความสัมพันธ์ของ function/hook กับไฟล์ที่เรียกใช้

### Contexts

| Context | Function | Used In |
|---------|----------|---------|
| `AuthContext.tsx` | `useAuth()` | `page.tsx`, `profile/page.tsx`, `login/page.tsx`, `repair/page.tsx`, `gallery/page.tsx`, `my-work/page.tsx` |
| | | `admin/repairs/page.tsx`, `admin/bookings/page.tsx`, `admin/inventory/page.tsx`, `admin/users/page.tsx`, `admin/photography/page.tsx`, `admin/dashboard/page.tsx`, `admin/add-product/page.tsx` |
| | | `BorrowModal.tsx`, `ReturnModal.tsx`, `RequisitionModal.tsx`, `BookingModal.tsx`, `BookingForm.tsx`, `CreateJobModal.tsx`, `UserHistoryModal.tsx` |
| | | `TopHeader.tsx`, `BottomNavigation.tsx`, `SideQuickAccess.tsx`, `CommandPalette.tsx` |
| | | `product/[id]/page.tsx` |

---

### Custom Hooks

| Hook | Exported Functions | Used In |
|------|-------------------|---------|
| `useBookings.ts` | `useBookings()`, `BookingEvent` | `page.tsx`, `PhotographyJobModal.tsx`, `CalendarSection.tsx` |
| `useRepairTickets.ts` | `useRepairTickets()` | `page.tsx` |
| `useRepairAdmin.ts` | `useRepairAdmin()`, `getThaiStatus()`, `getStatusColor()` | `admin/repairs/page.tsx`, `my-work/page.tsx`, `RepairTicketCard.tsx`, `RepairModal.tsx` |
| `useRepairFilter.ts` | `useRepairFilter()` | `useRepairAdmin.ts` (composite) |
| `useRepairModal.ts` | `useRepairModal()` | `useRepairAdmin.ts` (composite) |
| `useRepairActions.ts` | `handleUpdateTicket()`, `handleUsePart()` | `useRepairAdmin.ts` (composite) |
| `useActivityLogs.ts` | `useActivityLogs()` | `page.tsx` |
| `useLiff.ts` | `useLiff()` | `liff/booking/page.tsx`, `liff/repair/page.tsx`, `liff/entry/page.tsx` |
| `useMyRepairs.ts` | `useMyRepairs()` | `my-work/page.tsx` |
| `useMyPhotographyJobs.ts` | `useMyPhotographyJobs()` | `my-work/page.tsx` |
| `usePushNotifications.ts` | `usePushNotifications()` | `NotificationToggle.tsx`, `profile/page.tsx` |

---

### Utility Functions

| File | Function | Used In |
|------|----------|---------|
| `utils/logger.ts` | `logActivity()` | `useRepairActions.ts`, `RepairForm.tsx`, `BorrowModal.tsx`, `ReturnModal.tsx`, `RequisitionModal.tsx`, `admin/inventory/page.tsx`, `admin/add-product/page.tsx`, `EditProductModal.tsx` |
| `utils/excelExport.ts` | `exportToExcel()` | `RepairActionsBar.tsx`, `my-work/page.tsx` |
| `utils/imageCompression.ts` | `compressImage()` | `useRepairActions.ts`, `RepairForm.tsx`, `admin/photography/page.tsx`, `MyPhotographyJobsModal.tsx` |
| `utils/flexMessageTemplates.ts` | `createRepairNewFlexMessage()` | `api/notify-repair/route.ts`, `lib/agentFunctions.ts` |
| | `createRepairCompleteFlexMessage()` | `api/notify-user/route.ts` |
| | `createRepairReminderFlexMessage()` | `api/cron/repair-reminder/route.ts` |
| | `createPhotographyFlexMessage()` | `PhotographyJobModal.tsx` |

---

### Library Functions

| File | Export | Used In |
|------|--------|---------|
| `lib/firebase.ts` | `db`, `auth`, `storage` | **ทุก Client Component** (ผ่าน hooks และ modals) |
| `lib/firebaseAdmin.ts` | `adminDb`, `adminAuth` | **ทุก API Route** (server-side) |
| | | `api/notify-repair`, `api/notify-user`, `api/send-otp`, `api/verify-otp`, `api/fcm/send`, `api/facebook/post`, `api/line-webhook`, `api/cron/repair-reminder` |
| | | `lib/aiAgent.ts`, `lib/agentFunctions.ts` |
| `lib/generateReport.ts` | `generateStockReport()` | `RepairActionsBar.tsx`, `my-work/page.tsx` |
| `lib/googleDrive.ts` | `initiateResumableUpload()` | `api/drive/upload/route.ts` |
| `lib/aiAgent.ts` | `processMessage()` | `api/line-webhook/route.ts` |
| `lib/agentFunctions.ts` | (all AI functions) | `lib/aiAgent.ts` |
| `lib/dateUtils.ts` | `toBangkokTime()`, `formatDateThai()` | `BookingForm.tsx`, `PhotographyJobModal.tsx`, `api/drive/upload/route.ts` |

---

### Dashboard Components (New in v1.7.0)

| Component | Used In |
|-----------|---------|
| `dashboard/widgets/Widget.tsx` | `page.tsx` |
| `dashboard/widgets/QuickAction.tsx` | `page.tsx` |
| `dashboard/widgets/StatCard.tsx` | `page.tsx` |
| `dashboard/HeroSection.tsx` | `page.tsx` |
| `dashboard/RecentActivityList.tsx` | `page.tsx` |
| `dashboard/StatsWidgetContent.tsx` | `page.tsx` |
| `dashboard/PhotoGalleryList.tsx` | `page.tsx` |
| `dashboard/CalendarSection.tsx` | `page.tsx` (via LazyComponents) |

---

## ✨ ฟีเจอร์ทั้งหมด

### 1. 🔧 ระบบแจ้งซ่อม (Repair System)

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| แจ้งซ่อม | ผู้ใช้แจ้งปัญหาพร้อมรูปภาพ |
| เลือกโซน | มัธยมต้น / มัธยมปลาย |
| แจ้งเตือน LINE | ช่างที่รับผิดชอบโซนได้รับแจ้งเตือน |
| รับงาน | ช่างรับงานและอัปเดตสถานะ |
| บันทึกอะไหล่ | บันทึกอะไหล่ที่ใช้ซ่อม |
| ติดตามสถานะ | ผู้แจ้งเห็นความคืบหน้า |
| สถานะ | pending, in_progress, waiting_parts, completed, cancelled |

### 2. 📅 ระบบจองห้อง (Booking System)

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| เลือกห้อง | เลือกจากรายการห้องที่มี |
| เลือกวันเวลา | Calendar + Time Picker |
| ตรวจสอบซ้อน | ป้องกันการจองซ้ำ |
| อนุมัติ | Admin/Moderator อนุมัติการจอง |
| ปฏิทิน | แสดงการจองทั้งหมดในปฏิทิน |
| LIFF | จองผ่าน LINE ได้ |

### 3. 📸 ระบบถ่ายภาพกิจกรรม (Photography Job System)

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| มอบหมายงาน | Admin สร้างงานและมอบหมายให้ช่างภาพ (รองรับหลายคน) |
| แจ้งเตือน | ช่างภาพได้รับแจ้งเตือนผ่าน LINE พร้อม Flex Message สวยงาม |
| อัปโหลดภาพ | อัปโหลดไป Google Drive |
| โครงสร้างโฟลเดอร์ | ปีการศึกษา > ภาคเรียน > เดือน > กิจกรรม |
| ภาพปก | เลือกภาพปกสำหรับ Gallery |
| Compress | บีบอัดภาพปกก่อนอัปโหลด Firebase |
| My Jobs Modal | ช่างภาพดูรายการงานของตัวเอง + อัปโหลดภาพได้ |
| Manual Entry | รองรับการเพิ่มกิจกรรมย้อนหลัง |
| Booking Integration | เชื่อมต่อกับระบบจองห้อง (บันทึก `bookingId`) |
| **Facebook Auto Post** | โพสภาพอัตโนมัติไป Facebook Page ผ่าน URL-based upload |
| **ลำดับภาพ Facebook** | เลือกลำดับภาพที่จะโพส (1, 2, 3...) |
| **Shift+Click Selection** | เลือกภาพเป็นช่วงด้วย Shift+Click |

### 4. 🖼️ Gallery (หน้าประมวลภาพกิจกรรม)

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| แสดงงานที่เสร็จ | แสดงเฉพาะงานที่ status = completed |
| ค้นหา | ค้นหาชื่อกิจกรรม, ช่างภาพ, สถานที่ |
| กรอง | วัน, เดือน, ปี (พ.ศ.) |
| Pagination | 10 รายการต่อหน้า |
| **Drive Icon** | กดไอคอน Google Drive เพื่อเปิดโฟลเดอร์ภาพ |
| **Facebook Icon** | กดไอคอน Facebook เพื่อเปิดโพสต์ (ถ้ามี) |

### 5. 📦 ระบบอุปกรณ์ (Inventory System)

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| เพิ่มอุปกรณ์ | เพิ่มพร้อม QR Code อัตโนมัติ |
| ยืม-คืน | บันทึกการยืม พร้อมลายเซ็น |
| คืนอุปกรณ์ | Modal สำหรับคืนอุปกรณ์พร้อมลายเซ็น + บันทึกหมายเหตุ |
| เบิก | เบิกอุปกรณ์ถาวร |
| สแกน QR | สแกนเพื่อดูรายละเอียด |
| ประวัติ | ดูประวัติการใช้งานอุปกรณ์ |
| User History | ผู้ใช้ดูประวัติของตัวเอง (ซ่อม, จอง, ยืม, เบิก) |
| Stats Aggregation | ติดตามสถิติอุปกรณ์แบบ Realtime (available, borrowed, maintenance) |

### 6. 👥 ระบบผู้ใช้ (User Management)

| Role | สิทธิ์ |
|------|-------|
| `user` | แจ้งซ่อม, จองห้อง, ดู Gallery |
| `technician` | + รับงานซ่อม |
| `moderator` | + อนุมัติการจอง, มอบหมายงานถ่ายภาพ |
| `admin` | + ทุกอย่าง, จัดการผู้ใช้ |
| `isPhotographer` | Flag พิเศษสำหรับช่างภาพ (ไม่ขึ้นกับ role) |

### 7. 🔔 LINE Integration

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| LINE Login | เชื่อมบัญชี LINE กับระบบ |
| LIFF Apps | แจ้งซ่อม/จองผ่าน LINE |
| Push Notification | แจ้งเตือนผ่าน LINE |
| Rich Menu | Track Status, ติดตามสถานะงานซ่อม |
| Flex Message Templates | ระบบ Template สวยงามสำหรับ: งานซ่อมใหม่, งานซ่อมเสร็จ, งานถ่ายภาพ, Status Carousel |

#### Flex Message Templates (`utils/flexMessageTemplates.ts`)
| Template | Purpose |
|----------|---------|
| `createRepairNewFlexMessage` | แจ้งเตือนช่างเมื่อมีงานซ่อมใหม่ |
| `createRepairCompleteFlexMessage` | แจ้งผู้แจ้งเมื่องานซ่อมเสร็จ |
| `createPhotographyFlexMessage` | แจ้งช่างภาพเมื่อได้รับมอบหมายงาน |
| `createStatusBubble` | สร้าง Status Card สำหรับ Carousel |

### 8. 🎛️ Admin Dashboard

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| Overview | ภาพรวมระบบทั้งหมด (งานซ่อม, จอง, ถ่ายภาพ, อุปกรณ์) |
| Quick Stats | สถิติแบบ Realtime พร้อม Link ไปหน้าจัดการ |
| Activity Feed | แสดง Activity Logs ล่าสุด |
| Quick Links | ลิงก์ลัดไปยังหน้าจัดการต่างๆ |
| Admin Navigation | เมนูเฉพาะสำหรับ Admin/Moderator |

### 9. ⚙️ ระบบ Feedback / Report Issue

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| Report Issue Modal | ผู้ใช้แจ้งปัญหาการใช้งานระบบ (ไม่ระบุตัวตน) |
| Feedback Collection | บันทึกลง `feedbacks` collection |
| Success Animation | แสดง Animation เมื่อส่งสำเร็จ |

### 10. 🧭 Navigation & UI Components

#### Navigation Components (`app/components/navigation/`)
| Component | คำอธิบาย |
|-----------|---------|
| `TopHeader` | Header ด้านบน พร้อมโลโก้, Search, User Profile |
| `BottomNavigation` | Navigation ด้านล่าง สำหรับ Mobile + Quick Actions Menu |
| `CommandPalette` | ค้นหาเมนูด้วย Keyboard Shortcut (⌘K / Ctrl+K) |
| `SideQuickAccess` | Floating Quick Actions ด้านข้าง |

#### Dashboard Components (`app/components/dashboard/`)
| Component | คำอธิบาย |
|-----------|---------|
| `CalendarSection` | ปฏิทินแสดงการจองและกิจกรรม |
| `ActivityFeed` | แสดง Activity Logs ล่าสุด |
| `QuickActions` | ปุ่มลัดสำหรับ Actions ที่ใช้บ่อย |

#### Modal Components (`app/components/`)
| Component | คำอธิบาย |
|-----------|---------|
| `ReportIssueModal` | แจ้งปัญหาการใช้งาน |
| `ReturnModal` | คืนอุปกรณ์พร้อมลายเซ็น |
| `UserHistoryModal` | ดูประวัติ (ซ่อม, จอง, ยืม, เบิก) |
| `MyPhotographyJobsModal` | ช่างภาพดูและอัปโหลดงาน |
| `BookingDetailsModal` | รายละเอียดการจอง |
| `ConfirmationModal` | Modal ยืนยันการกระทำ |

### 11. 🛠️ Utility Functions

#### Image Compression (`utils/imageCompression.ts`)
| Function | คำอธิบาย |
|----------|---------|
| `compressImage` | บีบอัดภาพด้วย Canvas API |
| `compressImageToSize` | บีบอัดจนถึงขนาดเป้าหมาย |

**Options:**
- `maxWidth`: ความกว้างสูงสุด (default: 1920)
- `maxHeight`: ความสูงสูงสุด (default: 1080)
- `quality`: คุณภาพ 0-1 (default: 0.8)
- `maxSizeMB`: ขนาดสูงสุด MB (default: 1)

#### Stats Aggregation (`utils/aggregation.ts`)
| Function | คำอธิบาย |
|----------|---------|
| `incrementStats` | เพิ่มจำนวนสถิติ |
| `decrementStats` | ลดจำนวนสถิติ |
| `updateStatsOnStatusChange` | อัปเดตเมื่อเปลี่ยนสถานะ |

**Collection:** `stats/inventory`

#### Activity Logger (`utils/logger.ts`)
| Parameter | Type | คำอธิบาย |
|-----------|------|---------|
| `action` | LogAction | borrow, return, requisition, add, update, repair, etc. |
| `productName` | string | ชื่อรายการ |
| `userName` | string | ชื่อผู้ใช้ |
| `details` | string? | รายละเอียดเพิ่มเติม |
| `signatureUrl` | string? | URL ลายเซ็น |

#### Excel Export (`utils/excelExport.ts`)
| Function | คำอธิบาย |
|----------|---------|
| `exportToExcel` | Export ข้อมูลงานซ่อมเป็น Excel (.xlsx) |

**Columns:** ลำดับ, วัน/เวลาแจ้ง, ผู้แจ้ง, ปัญหา/อาการ, สถานที่, สถานะ

---

## 🤖 AI Agent (LINE Bot)

ระบบ AI ผู้ช่วยฝ่ายโสตทัศนศึกษาใน LINE Bot ใช้ **Google Gemini 2.5 Flash** สำหรับประมวลผลภาษาธรรมชาติ

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LINE Bot      │────▶│   aiAgent.ts     │────▶│  agentFunctions │
│   Webhook       │    │  (Main Processor) │    │    .ts          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                       ┌──────▼──────┐
                       │  gemini.ts  │
                       │ (AI Config) │
                       └─────────────┘
```

### Files Overview

| File | Lines | คำอธิบาย |
|------|-------|----------|
| `lib/gemini.ts` | 178 | AI configuration, system prompt, safety settings |
| `lib/aiAgent.ts` | 700+ | Main processor, context management, intent handlers (Admin SDK) |
| `lib/agentFunctions.ts` | 628 | Database functions via Admin SDK, mappings, data formatting |
| `lib/emailService.ts` | 85 | Email OTP service using Nodemailer |

---

### 📁 `lib/gemini.ts` - AI Configuration

**Model:** `gemini-2.5-flash`

**Settings:**
| Setting | Value |
|---------|-------|
| Temperature | 0.4 (text) / 0.5 (vision) |
| Max Tokens | 2048 (text) / 1024 (vision) |
| Safety | Block Medium and Above |

**Main Exports:**
- `geminiModel` - Text chat model
- `geminiVisionModel` - Image analysis model
- `AI_SYSTEM_PROMPT` - ระบบ prompt หลักของ AI
- `startAIChat()` - สร้าง chat session พร้อม system prompt
- `imageToGenerativePart()` - แปลง image buffer เป็น Gemini format

**System Prompt Features:**
1. ห้ามใช้ Markdown (ห้าม **bold**, -, bullet)
2. ตอบเป็น JSON Minified บรรทัดเดียว (function calling)
3. ลงท้ายด้วย "ค่ะ" / "นะคะ"
4. แปลงชื่อห้องเป็น Room ID อัตโนมัติ
5. รองรับ "วันนี้", "พรุ่งนี้" → "today", "tomorrow"

---

### 📁 `lib/aiAgent.ts` - Main Processor

#### Configuration Constants
```typescript
CONTEXT_EXPIRY_MINUTES = 30  // หมดอายุ 30 นาที
MAX_CONTEXT_MESSAGES = 10    // เก็บสูงสุด 10 ข้อความ
```

#### Types & Interfaces

```typescript
interface ConversationContext {
    messages: { role: 'user' | 'model'; content: string; timestamp: Date }[];
    pendingAction?: {
        intent: string;
        params: Record<string, any>;
        repairStep?: 'awaiting_symptom' | 'awaiting_image' | 'awaiting_intent_confirm' 
                   | 'awaiting_room' | 'awaiting_side' | 'awaiting_final_confirm'
                   | 'awaiting_link_email' | 'awaiting_otp';  // OTP Account Binding
        galleryResults?: any[];
    };
    lastActivity: any;
}

interface AIResponse {
    intent?: string;
    params?: Record<string, unknown>;
    execute?: boolean;
    message?: string;
}
```

#### Context Management Functions
| Function | คำอธิบาย |
|----------|----------|
| `getConversationContext(lineUserId)` | ดึง context จาก Firestore (หมดอายุ 30 นาที) |
| `saveConversationContext(lineUserId, context)` | บันทึก context (trim เหลือ 10 ข้อความ) |
| `clearPendingAction(lineUserId)` | ล้าง pending action |

#### User Profile Functions
| Function | คำอธิบาย |
|----------|----------|
| `getUserProfileFromLineBinding(lineUserId)` | ค้นหา user จาก `line_bindings` หรือ `users.lineUserId` |

Returns: `UserProfile { uid, displayName, email, role, isPhotographer, responsibility }`

#### Intent Handlers

| Function | Intent | คำอธิบาย |
|----------|--------|----------|
| `handleCheckRepair()` | CHECK_REPAIR | ดึงงานซ่อมของ user หรือ ticketId |
| `handleCheckAvailability()` | CHECK_AVAILABILITY | เช็คห้องว่างช่วงเวลาเจาะจง |
| `handleRoomSchedule()` | CHECK_ROOM_SCHEDULE | ดูตารางห้องทั้งวัน |
| `handleMyWork()` | MY_WORK | งานของฉัน (แบ่งตาม role) |
| `handleGallerySearchWithResults()` | GALLERY_SEARCH | ค้นหารูปกิจกรรม + เลือกดูลิงก์ |
| `handleDailySummary()` | DAILY_SUMMARY | สรุปงานประจำวัน |
| `handleBookRoom()` | BOOK_ROOM | [RESERVED] จองห้อง (ปัจจุบัน intercept ไปเว็บ) |

#### MY_WORK Logic (ตาม Role)
```
┌─────────────┐
│ MY_WORK     │
└─────────────┘
      │
      ├── technician → getRepairsForTechnician(zone)
      │
      ├── isPhotographer → getPhotoJobsByPhotographer(uid)
      │
      ├── moderator/admin → getPendingBookings()
      │
      └── user → getBookingsByEmail(email)
```

#### Room Schedule Format
```
📅 ตาราง ห้องลีลาวดี (วันนี้)

(วันนี้) 09:00 - 12:00
ประชุมครูกลุ่มสาระ
ผู้จอง อ.สมชาย ใจดี
```

#### Multi-Step Repair Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ User: "แจ้งซ่อมคอม"                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Step 1: awaiting_symptom → "อาการเป็นอย่างไรคะ?"                      │
├─────────────────────────────────────────────────────────────────────┤
│ User: "เปิดไม่ติด"                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Step 2: awaiting_image → "ส่งรูปมาได้ไหมคะ? (หรือตอบ 'ไม่มี')"          │
├─────────────────────────────────────────────────────────────────────┤
│ User: [ส่งรูป] → analyzeRepairImage()                               │
├─────────────────────────────────────────────────────────────────────┤
│ Step 3: awaiting_intent_confirm → "[AI วิเคราะห์รูป] แจ้งซ่อมไหมคะ?"  │
├─────────────────────────────────────────────────────────────────────┤
│ User: "ยืนยัน"                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Step 4: awaiting_room → "สถานที่/ห้องที่อุปกรณ์มีปัญหาคะ?"            │
├─────────────────────────────────────────────────────────────────────┤
│ User: "ห้อง 401"                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Step 5: awaiting_side → "อยู่ฝั่ง ม.ต้น หรือ ม.ปลาย คะ?"              │
├─────────────────────────────────────────────────────────────────────┤
│ User: "ม.ปลาย"                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Step 6: Final Confirm → "ข้อมูล: ... ยืนยันแจ้งซ่อมไหมคะ?"            │
├─────────────────────────────────────────────────────────────────────┤
│ User: "ยืนยัน" → createRepairFromAI() → ✅ แจ้งซ่อมสำเร็จ!            │
└─────────────────────────────────────────────────────────────────────┘
```

#### Main Entry Point

```typescript
processAIMessage(lineUserId, userMessage, imageBuffer?, imageMimeType?)
```

**Flow:**
1. ตรวจสอบ "ผูกบัญชี" keyword → เริ่ม OTP Flow
2. Intercept "จองห้อง" → redirect ไปเว็บ
3. รับรูปภาพ → analyzeRepairImage() หรือ process repair step
4. จัดการ pending actions (multi-step) รวมถึง OTP verification
5. ส่งไป Gemini AI → parse JSON response
6. Execute intent handler ตาม response

#### OTP Account Binding Flow (NEW)
```
┌─────────────────────────────────────────────────────────────────────┐
│ User: "ผูกบัญชี"                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ AI: กรุณาพิมพ์ email @tesaban6.ac.th ของคุณค่ะ                       │
├─────────────────────────────────────────────────────────────────────┤
│ Step: awaiting_link_email                                           │
├─────────────────────────────────────────────────────────────────────┤
│ User: kawin@tesaban6.ac.th                                          │
├─────────────────────────────────────────────────────────────────────┤
│ AI: ✉️ ส่งรหัส OTP 6 หลักไปที่ email แล้วค่ะ                          │
├─────────────────────────────────────────────────────────────────────┤
│ Step: awaiting_otp                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ User: 482719                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ AI: ✅ ผูกบัญชีสำเร็จค่ะ! ยินดีต้อนรับ คุณกวิน                         │
└─────────────────────────────────────────────────────────────────────┘
```

**OTP Constraints:**
- Email ต้องลงท้ายด้วย `@tesaban6.ac.th` เท่านั้น
- OTP หมดอายุใน 5 นาที
- พิมพ์ผิดได้สูงสุด 3 ครั้ง

---

### 📁 `lib/agentFunctions.ts` - Database Functions (Admin SDK)

> ⚠️ **การเปลี่ยนแปลงสำคัญ:** ไฟล์นี้ใช้ Firebase Admin SDK (`adminDb`) แทน Client SDK เพื่อความปลอดภัยและประสิทธิภาพ

#### Mappings

**ROOM_MAPPING (ชื่อไทย → Room ID):**
```typescript
'ห้องลีลาวดี': 'sh_leelawadee'
'ลีลาวดี': 'sh_leelawadee'
'ลีลา': 'sh_leelawadee'
'ห้องพญาสัตบรรณ': 'jh_phaya'
'พญาสัตบรรณ': 'jh_phaya'
'พญา': 'jh_phaya'
'หอประชุม': 'sh_auditorium'
'ห้องจามจุรี': 'jh_chamchuri'
// ... และอื่นๆ
```

**ROOM_NAME_DISPLAY (Room ID → ชื่อไทยสวย):**
```typescript
'jh_phaya': 'ห้องพญาสัตบรรณ (ม.ต้น)'
'sh_leelawadee': 'ห้องลีลาวดี (ม.ปลาย)'
// ... และอื่นๆ
```

**SIDE_MAPPING (โซน):**
```typescript
'ม.ต้น': 'junior_high'
'ม.ปลาย': 'senior_high'
'ส่วนกลาง': 'common'
```

#### Helper Functions
| Function | คำอธิบาย |
|----------|----------|
| `getRoomDisplayName(id)` | แปลง Room ID → ชื่อไทย |
| `formatToThaiTime(date)` | แปลง Timestamp → "22 ธ.ค. 2568 เวลา 14:30 น." |
| `getThaiDateRange(dateStr)` | สร้าง Firestore Timestamp range (UTC+7) |

#### Database Functions

**Gallery & Photography:**
| Function | Output | คำอธิบาย |
|----------|--------|----------|
| `searchGallery(keyword?, date?)` | Formatted[] | ค้นหา completed jobs |
| `getPhotoJobsByPhotographer(userId, date?)` | Formatted[] | งานถ่ายภาพของช่างภาพ |

**Repair:**
| Function | Output | คำอธิบาย |
|----------|--------|----------|
| `createRepairFromAI(...)` | CreateRepairResult | สร้างใบแจ้งซ่อม + notify ช่าง |
| `getRepairsByEmail(email)` | Formatted[] | งานซ่อมของ user (5 ล่าสุด) |
| `getRepairsForTechnician(zone, date?)` | RepairTicket[] | งานซ่อมสำหรับช่าง (raw data) |
| `getRepairByTicketId(ticketId)` | RepairTicket | ดึงงานตาม ID |

**Booking:**
| Function | Output | คำอธิบาย |
|----------|--------|----------|
| `checkRoomAvailability(room, date, start, end)` | CheckAvailabilityResult | เช็คห้องว่าง |
| `getRoomSchedule(room, date)` | Formatted[] | ตารางห้องประชุม (เวลา HH:mm) |
| `createBookingFromAI(...)` | BookingResult | สร้างการจอง |
| `getBookingsByEmail(email)` | Formatted[] | การจองของ user |
| `getPendingBookings(date?)` | Formatted[] | รายการรออนุมัติ |

**Summary:**
| Function | Output | คำอธิบาย |
|----------|--------|----------|
| `getDailySummary()` | SummaryObject | สรุปงานประจำวัน |

---

### Image Analysis (Vision)

```typescript
analyzeRepairImage(imageBuffer, mimeType, symptomDescription)
```

**Prompt Features:**
1. วิเคราะห์อุปกรณ์ IT/โสตฯ
2. แนะนำวิธีแก้ไขเบื้องต้น 2-3 ข้อ
3. ถาม "ต้องการเปิดใบแจ้งซ่อมไหมคะ?"
4. กรณีไม่ใช่อุปกรณ์ → แจ้งอย่างสุภาพ

---

### Database Collections (AI-related)

**`ai_conversations`** - Context Storage
```typescript
{
  messages: [{ role, content, timestamp }],
  pendingAction: { intent, params, repairStep?, galleryResults? },
  lastActivity: Timestamp
}
```

**Document ID:** LINE User ID
**Expiry:** 30 นาทีหลังจาก lastActivity

---

## 🔐 ระบบ Authentication

### Flow
```
1. User clicks "Login with Google"
2. Firebase Auth (signInWithPopup)
3. Check email domain (@tesaban6.ac.th only)
4. Fetch/Create user doc in Firestore
5. Setup realtime listener for role & isPhotographer
6. Role-based UI rendering
```

### AuthContext (`context/AuthContext.tsx`)
```typescript
interface AuthContextType {
    user: User | null;           // Firebase User
    role: UserRole | null;       // user | technician | moderator | admin
    isPhotographer: boolean;     // Photographer flag
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}
```

### Realtime Updates
- ใช้ `onSnapshot()` ติดตาม user document
- Admin เปลี่ยน role/isPhotographer → User เห็นทันที
- ไม่ต้อง logout/login ใหม่

---

## 🌐 API Routes

---

### 📁 `/api/drive/upload` (POST) - Google Drive Upload

**วิธีการทำงาน:** ใช้ **Resumable Upload** - API คืน URL ให้ client อัปโหลดไฟล์โดยตรงไปยัง Google Drive

**🔐 Security:** ต้องส่ง Firebase Auth Token ใน Header

**Headers:**
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

**Request:**
```json
{
  "fileName": "IMG_001.jpg",
  "mimeType": "image/jpeg",
  "eventName": "กีฬาสี 2567",
  "jobDate": "2024-12-22"
}
```

> ⚠️ **หมายเหตุ:** `jobDate` ต้องเป็น format `YYYY-MM-DD` (Bangkok timezone)

**Response:**
```json
{
  "success": true,
  "uploadUrl": "https://www.googleapis.com/upload/drive/v3/...",
  "folderLink": "https://drive.google.com/drive/folders/..."
}
```

**Error Responses:**
| Status | Error |
|--------|-------|
| 401 | Missing or invalid Authorization header |
| 400 | Missing required fields |
| 500 | Internal Server Error |

**Google Drive Folder Structure:**
```
📂 GOOGLE_DRIVE_PARENT_FOLDER_ID
└── 📂 ปีการศึกษา 2567
    └── 📂 ภาคเรียนที่ 2
        └── 📂 ธันวาคม
            └── 📂 67-12-22 กีฬาสี 2567
                └── 🖼 IMG_001.jpg
```

**lib/googleDrive.ts Functions:**
| Function | คำอธิบาย |
|----------|----------|
| `getDriveClient()` | สร้าง OAuth2 client จาก refresh token |
| `getOrCreateFolder(drive, parentId, folderName)` | สร้างโฟลเดอร์ (ถ้ายังไม่มี) |
| `initiateResumableUpload(params)` | เริ่ม resumable upload และคืน session URL |

**lib/academicYear.ts Functions:**
| Function | คำอธิบาย |
|----------|----------|
| `getThaiAcademicYear(date)` | คำนวณปีการศึกษาและภาคเรียน |
| `getThaiMonthName(date)` | แปลงเป็นชื่อเดือนไทย |

---

### 📘 Facebook Integration (2-Step Upload)

ระบบใช้ **2-Step Upload Flow** เพื่อโพสภาพไป Facebook Page:

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Upload Photos (ทีละรูป)                                 │
│  POST /api/facebook/upload-photo                                │
│  ────────────────────────────────────────────────────────────── │
│  Input: { photo: { base64, mimeType }, published: false }       │
│  Output: { photoId: "12345678" }                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Create Post (รวมทุกรูป)                                 │
│  POST /api/facebook/post                                        │
│  ────────────────────────────────────────────────────────────── │
│  Input: { jobId, caption, photoIds: [...], asDraft? }           │
│  Output: { postId, permalinkUrl }                               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 📷 `/api/facebook/upload-photo` (POST) - Upload Photo

**วิธีการทำงาน:** อัปโหลดรูปไป Facebook Page แบบ unpublished ก่อน

**Request:**
```json
{
  "photo": {
    "base64": "<BASE64_ENCODED_IMAGE>",
    "mimeType": "image/jpeg"
  },
  "published": false
}
```

**Response:**
```json
{
  "success": true,
  "photoId": "1234567890123456"
}
```

**หมายเหตุ:**
- `maxDuration`: 60 วินาที (รองรับไฟล์ใหญ่)
- ส่ง `published: false` เพื่ออัปโหลดแบบ unpublished ก่อน

---

### 📬 `/api/facebook/post` (POST) - Create Post

**วิธีการทำงาน:** สร้างโพสจาก Photo IDs ที่อัปโหลดไว้แล้ว

**Request:**
```json
{
  "jobId": "photography_job_id",
  "caption": "ภาพกิจกรรมกีฬาสี 2567 🏃‍♂️",
  "photoIds": ["1234567890", "0987654321"],
  "asDraft": false
}
```

**Response:**
```json
{
  "success": true,
  "postId": "PAGE_ID_POST_ID",
  "permalinkUrl": "https://www.facebook.com/permalink.php?story_fbid=...&id=PAGE_ID"
}
```

**การทำงานภายใน:**

| จำนวนรูป | การทำงาน |
|----------|----------|
| 1 รูป | POST to `/PAGE_ID/feed` with `attached_media` |
| หลายรูป | POST to `/PAGE_ID/feed` with `attached_media` array |

**Firestore Update:**
```typescript
{
  facebookPostId: "PAGE_ID_POST_ID",
  facebookPermalink: "https://www.facebook.com/permalink.php?...",
  facebookPostedAt: Timestamp
}
```

**หมายเหตุ:**
- `asDraft: true` = สร้างเป็น Draft (ไม่เผยแพร่)
- Token หมดอายุ 60 วัน (ใช้ `scripts/refresh-facebook-token.js`)

---

### `/api/line-webhook` (POST)
รับ Webhook จาก LINE

**Handles:**
- "Track Status" / "ติดตามสถานะ" → แสดง Flex Carousel งานซ่อม

---

### `/api/notify-repair` (POST)
แจ้งเตือนช่างเมื่อมีงานซ่อมใหม่

**Request:**
```json
{
  "requesterName": "...",
  "room": "...",
  "description": "...",
  "imageOneUrl": "...",
  "zone": "junior_high | senior_high",
  "ticketId": "..."
}
```

**Security:**
- ต้องส่ง `x-api-key` header (สำหรับ server-to-server) หรือ
- Request ต้องมาจาก same origin (สำหรับ client)

---

### `/api/notify-user` (POST)
แจ้งเตือนผู้ใช้ (เช่น งานซ่อมเสร็จ)

**Request:**
```json
{
  "email": "user@tesaban6.ac.th",
  "message": "..."
}
```

---

### `/api/line/push` (POST)
ส่ง Push Message ไปยัง LINE User

**Request:**
```json
{
  "to": "LINE_USER_ID",
  "messages": [{ "type": "text", "text": "..." }]
}
```

---

### `/api/line/login` (GET)
Redirect ไป LINE Login

---

### `/api/line/callback` (GET)
Handle LINE Login Callback

---

### `/api/send-otp` (POST) - NEW
ส่ง OTP 6 หลักไปยัง email เพื่อผูกบัญชี LINE

**Request:**
```json
{
  "email": "user@tesaban6.ac.th",
  "lineUserId": "U..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "ส่ง OTP ไปที่ email แล้ว"
}
```

**Validation:**
- Email ต้องลงท้ายด้วย `@tesaban6.ac.th`
- ตรวจสอบว่า LINE ID ยังไม่ผูกบัญชี

---

### `/api/verify-otp` (POST) - NEW
ตรวจสอบ OTP และสร้าง account binding

**Request:**
```json
{
  "otp": "482719",
  "lineUserId": "U..."
}
```

**Response:**
```json
{
  "success": true,
  "displayName": "ชื่อผู้ใช้",
  "email": "user@tesaban6.ac.th"
}
```

**Constraints:**
- OTP หมดอายุ 5 นาที
- พิมพ์ผิดได้สูงสุด 3 ครั้ง
- สร้าง `line_bindings` doc และอัปเดต `users` collection

---

### `/api/auth/line-custom-token` (POST)
สร้าง Firebase Custom Token จาก LINE Token


---

## 💾 Database Schema (Firestore)

### Collection: `users`
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'user' | 'technician' | 'moderator' | 'admin';
  isPhotographer?: boolean;
  responsibility?: 'junior_high' | 'senior_high' | 'all';
  lineUserId?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### Collection: `repair_tickets`
```typescript
{
  requesterName: string;
  requesterEmail: string;
  position: string;
  phone: string;
  room: string;
  zone: 'junior_high' | 'senior_high' | 'common';
  description: string;
  images: string[];
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';
  technicianName?: string;
  technicianNote?: string;
  completionImage?: string;
  partsUsed?: { name: string; quantity: number; date: Timestamp; }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `bookings`
```typescript
{
  title: string;
  room: string;
  roomId?: string;
  roomName?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  requesterName: string;
  requesterEmail?: string;
  department: string;
  position?: string;
  phoneNumber?: string;
  attendees?: number | string;
  description?: string;
  layout?: string;
  equipment?: string[];          // อุปกรณ์ที่ต้องการ
  ownEquipment?: string;         // อุปกรณ์ที่นำมาเอง
  attachments?: string[];        // ไฟล์แนบ
  micCount?: string;             // จำนวนไมค์
  needsPhotographer?: boolean;   // ต้องการช่างภาพหรือไม่
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Timestamp;
}
```

### Collection: `photography_jobs`
```typescript
{
  title: string;
  description?: string;
  location: string;
  startTime: Timestamp;
  endTime: Timestamp;
  assigneeIds: string[];        // Array of Photographer UIDs (รองรับหลายคน)
  assigneeNames?: string[];     // Array of Photographer names
  requesterId: string;
  requestName?: string;
  status: 'assigned' | 'completed' | 'cancelled';
  driveLink?: string;
  coverImage?: string;
  createdAt: Timestamp;
  isManualEntry?: boolean;      // Flag สำหรับกิจกรรมที่เพิ่มย้อนหลัง
  bookingId?: string;           // Link ไปยัง booking (ถ้ามี)
  facebookPostId?: string;      // Facebook Post ID (NEW)
  facebookPostedAt?: Timestamp; // เวลาที่โพส Facebook (NEW)
}
```

### Collection: `products`
```typescript
{
  name: string;
  brand: string;
  model?: string;
  price: number;
  purchaseDate: Timestamp;
  warrantyInfo: string;
  location: string;
  imageUrl: string;
  stockId: string;
  status: 'available' | 'borrowed' | 'requisitioned' | 'maintenance';
  type?: 'unique' | 'bulk';
  quantity?: number;
  borrowedCount?: number;
  createdAt: Timestamp;
}
```

### Collection: `transactions`
```typescript
{
  productId: string;
  type: 'borrow' | 'requisition';
  transactionDate: Timestamp;
  returnDate?: Timestamp;
  actualReturnDate?: Timestamp;
  status: 'active' | 'completed';
  signatureUrl: string;
  userName: string;
  userRoom: string;
  userPhone?: string;
  userPosition?: string;
}
```

### Collection: `line_bindings`
```typescript
{
  // Document ID = LINE User ID
  uid: string;              // Firebase User ID
  email: string;
  displayName: string;
  linkedAt: Timestamp;
}
```

### Collection: `otp_codes` (NEW)
```typescript
{
  // Document ID = LINE User ID
  email: string;
  otp: string;              // 6-digit OTP
  createdAt: Timestamp;
  expiresAt: Timestamp;     // +5 minutes
  attempts: number;         // Max 3 attempts
}
```

### Collection: `feedbacks` (NEW)
```typescript
{
  details: string;               // รายละเอียดปัญหา/ข้อเสนอแนะ
  timestamp: Timestamp;
  status: 'new' | 'reviewed';
  userAgent: string;             // Browser info (ไม่ระบุตัวตนผู้ใช้)
}
```

### Collection: `activities`
```typescript
{
  action: LogAction;             // borrow, return, requisition, add, update, repair, etc.
  productName: string;
  userName: string;
  imageUrl?: string;
  details?: string;
  zone?: string;
  status?: string;
  signatureUrl?: string;
  timestamp: Timestamp;
}
```

### Collection: `stats` > Document: `inventory`
```typescript
{
  total: number;
  available: number;
  borrowed: number;
  maintenance: number;
}
```

---

## 🔑 Environment Variables

สร้างไฟล์ `.env.local` ที่ root:

```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=

# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_TECHNICIAN_ID=           # Fallback technician LINE ID
NEXT_PUBLIC_LINE_LIFF_ID_REPAIR=
NEXT_PUBLIC_LINE_LIFF_ID_BOOKING=

# Google Drive (OAuth 2.0)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_PARENT_FOLDER_ID=

# Facebook (NEW)
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=     # 60-day token, ใช้ script refresh

# Email OTP (NEW)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@tesaban6.ac.th
SMTP_PASS=                      # Gmail App Password (16 characters)

# App
NEXT_PUBLIC_APP_URL=https://crms6it.vercel.app

# API Security (NEW)
CRMS_API_SECRET_KEY=your_random_secret_key_here
```

---

## 🚀 การพัฒนาต่อ

### Run Development
```bash
npm run dev
# เปิดที่ http://localhost:3000
```

### Build Production
```bash
npm run build
npm run start
```

### Deploy to Vercel
```bash
git push origin main
# Vercel จะ Auto Deploy
```

### สร้าง Google Refresh Token ใหม่
ถ้า Refresh Token หมดอายุ:
1. ไปที่ Google Cloud Console
2. สร้าง OAuth 2.0 Client ID
3. ใช้ OAuth Playground หรือ Script เพื่อ Generate Refresh Token
4. อัปเดต `GOOGLE_REFRESH_TOKEN` ใน Vercel

---

## ⚠️ Known Issues & TODOs

### Known Issues
- [ ] Refresh Token อาจหมดอายุถ้าไม่ใช้งานนาน (แนะนำให้ใช้ Service Account ในอนาคต)
- [x] ~~ยังไม่มี Rate Limiting บน API Routes~~ → เพิ่ม API Key check แล้ว
- [ ] ยังไม่มี Server-side Auth Check บน `/api/drive/upload`

### Completed ✅
- [x] เพิ่มการ Export รายงานเป็น Excel (`utils/excelExport.ts`)
- [x] เพิ่ม Admin Dashboard พร้อม Activity Feed
- [x] รองรับช่างภาพหลายคนใน Photography Jobs
- [x] เพิ่ม Image Compression ก่อนอัปโหลด
- [x] เพิ่ม User History Modal (ซ่อม, จอง, ยืม, เบิก)
- [x] เพิ่ม Report Issue Modal สำหรับ Feedback
- [x] เพิ่ม Equipment Return Modal พร้อมลายเซ็น
- [x] เพิ่ม Inventory Stats Aggregation
- [x] **Facebook Auto Post** - โพสภาพอัตโนมัติไป Facebook Page
- [x] **ลำดับภาพ Facebook** - เลือกลำดับภาพที่จะโพส (1, 2, 3...)
- [x] **Drive/Facebook Icons** - ไอคอนลิงก์บนหน้า Dashboard และ Gallery
- [x] **Token Refresh Script** - Script สำหรับ Refresh Facebook Token
- [x] **AI Agent (LINE Bot)** - ผู้ช่วย AI ใน LINE Bot ใช้ Gemini 2.5 Flash
- [x] **AI Room Availability Check** - ตรวจสอบห้องว่างผ่าน AI (แก้ไข field name `roomId`)
- [x] **Date Utilities (`lib/dateUtils.ts`)** - Bangkok Timezone handling สำหรับทุกฟอร์ม
- [x] **FCM Push Notifications** - แจ้งเตือนผ่าน Firebase Cloud Messaging
- [x] **Thai Date Format** - AI ตอบวันที่ในรูปแบบไทย (เช่น "21 ธ.ค. 2568")
- [x] **AI Context Management** - จำการสนทนาได้ 30 นาที
- [x] **Gallery Search Fix** - แก้ไข AI ค้นหารูปกิจกรรม (ลบ duplicate SYSTEM_PROMPT)
- [x] **Code Cleanup** - ลบ unused imports และ interface fields
- [x] **API Security** - เพิ่ม API key check ใน `/api/notify-repair`
- [x] **Firestore Indexes** - เพิ่มเอกสาร `FIRESTORE_INDEXES.md`
- [x] **Room Schedule Format** - แก้ไขรูปแบบการตอบตารางห้องประชุม
- [x] **Firebase Admin SDK Migration** - ย้าย AI Agent ไปใช้ Admin SDK ทั้งหมด
- [x] **OTP Account Binding** - ผูกบัญชี LINE ผ่าน AI + Email OTP
- [x] **Zone Display** - แสดงโซน (ม.ต้น/ม.ปลาย) ใน Repair Tickets และ Flex Messages
- [x] **Signature Capture** - เพิ่มลายเซ็นในการเบิกอะไหล่
- [x] **Timezone Bug Fix (v1.6.0)** - แก้ไขปัญหา Google Drive สร้างโฟลเดอร์ผิดวัน (68-12-31 → 69-01-01)
- [x] **Security: Admin SDK Migration (v1.7.0)** - `/api/notify-repair` ใช้ Admin SDK แทน Client SDK
- [x] **Security: Drive API Auth (v1.7.0)** - `/api/drive/upload` เพิ่ม Firebase Auth Token Verification
- [x] **Performance: moment.js → date-fns (v1.7.0)** - ลด bundle size (267KB → 13KB) ใน 4 ไฟล์
- [x] **Code Splitting: Dashboard (v1.7.0)** - แยก `page.tsx` (752 → 200 lines) เป็น 7 components
- [x] **Code Splitting: useRepairAdmin (v1.7.0)** - แยก hook (371 → 140 lines) เป็น 3 composable hooks

### TODOs
- [ ] เพิ่ม PWA Support เต็มรูปแบบ
- [ ] เพิ่ม Report การใช้งานอุปกรณ์รายเดือน
- [ ] เพิ่มระบบ Notification สำหรับอุปกรณ์เกินกำหนดคืน
- [ ] Voice-to-Repair (ส่ง voice message แจ้งซ่อม)
- [ ] Proactive AI Notification (แจ้งเมื่องานเสร็จ)

---

## 📞 ติดต่อ

**ผู้พัฒนา:** IT Department, CRMS6 School  
**Repository:** https://github.com/Khinkawu/crms6it

---

*เอกสารนี้อัปเดตโดย Antigravity AI เมื่อ 12 ม.ค. 2569 เวลา 11:38 น.*
