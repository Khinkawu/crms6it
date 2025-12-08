# Stock Management System Project Summary

## 1. Project Overview
**Project Name:** Stock Management System (Webapp)
**Description:** A comprehensive web application for managing school/organization resources. It includes modules for stock/inventory management, repair requests, and room bookings.
**Target Audience:** School staff (Teachers, Administrators, Technicians).

## 2. Technology Stack
### Frontend
- **Framework:** [Next.js 14.1.0](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Custom "Liquid Glass Blue" theme)
- **Icons:** `lucide-react`
- **UI Components:** `react-big-calendar`, `react-hot-toast`

### Backend & Database
- **Platform:** [Firebase](https://firebase.google.com/)
- **Authentication:** Firebase Auth
- **Database:** Cloud Firestore
- **Storage:** Firebase Storage (for images)

### Key Libraries
- **PDF Generation:** `jspdf`, `jspdf-autotable`, `html2canvas`
- **QR Code:** `react-qr-code`, `@blackbox-vision/react-qr-reader`
- **Signatures:** `react-signature-canvas`
- **Date Handling:** `moment` (Thai locale support)

## 3. Folder Structure
```
d:\Antigravity\stock-management-system\Webapp
├── app/                        # Main application logic (App Router)
│   ├── admin/                  # Admin modules
│   │   ├── add-product/        # Add new inventory items
│   │   ├── inventory/          # Manage existing inventory
│   │   ├── repairs/            # Admin view for repair tickets
│   │   └── users/              # User management
│   ├── api/                    # Backend API routes
│   │   ├── line-webhook/       # LINE Bot integration
│   │   ├── notify-repair/      # Notifications for repairs
│   │   └── notify-user/        # General user notifications
│   ├── booking/                # Room booking system
│   ├── components/             # Reusable UI components
│   ├── context/                # React Context (AuthContext)
│   ├── login/                  # Authentication page
│   ├── repair/                 # Repair request form
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main Dashboard
├── lib/                        # Configuration files
│   └── firebase.ts             # Firebase initialization
├── public/                     # Static assets
└── types/                      # TypeScript type definitions
```

## 4. Key Features & Modules

### 4.1 Dashboard (`app/page.tsx`)
- **Overview:** Displays a welcome message, calendar of bookings, quick action buttons, and recent activity logs.
- **Calendar:** Interactive calendar showing room bookings (Month/Week/Day/Agenda views).
- **Recent Activity:** Real-time feed of repair requests and stock movements.

### 4.2 Repair System (`app/repair`)
- **User Side:** Form to submit repair requests including:
    -   Requester details (auto-filled)
    -   Location (Room, Zone: Junior High/Senior High/Common)
    -   Problem description
    -   Image upload (up to 5 images)
- **Admin Side:** View, update status, and manage repair tickets.
- **PDF Reports:** Generate printable repair reports with signatures.

### 4.3 Booking System (`app/booking`)
- **Functionality:** Users can book meeting rooms or resources.
- **Integration:** Bookings appear on the main dashboard calendar.

### 4.4 Inventory Management (`app/admin/inventory`)
- **Features:** Add, edit, delete, and track stock items.
- **QR Code:** Support for scanning items (implied by libraries).

### 4.5 LINE Integration
- **Webhook:** `app/api/line-webhook` handles incoming messages.
- **Notifications:** System sends notifications to users/technicians via LINE for updates (e.g., new repair request).

## 5. Database Schema (Firestore)

### `activities` (Collection)
Logs all system actions for the dashboard feed.
- `id`: string
- `action`: 'repair' | 'borrow' | 'return' | etc.
- `productName`: string
- `userName`: string
- `details`: string
- `zone`: string
- `timestamp`: Timestamp

### `bookings` (Collection)
Stores room/resource reservations.
- `title`: string
- `roomName`: string
- `requesterName`: string
- `startTime`: Timestamp
- `endTime`: Timestamp
- `status`: 'pending' | 'approved' | 'cancelled'

### `repair_tickets` (Collection)
Stores repair requests.
- `requesterName`: string
- `requesterEmail`: string
- `position`: string
- `phone`: string
- `room`: string
- `zone`: 'junior_high' | 'senior_high' | 'common'
- `description`: string
- `images`: string[] (URLs)
- `status`: 'pending' | 'in_progress' | 'completed'
- `createdAt`: Timestamp

## 6. Environment Variables
The project requires a `.env.local` file with the following keys:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# LINE Integration
LINE_CHANNEL_ACCESS_TOKEN=...
```

## 7. Development Commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
