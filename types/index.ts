import { Timestamp } from 'firebase/firestore';

export type ProductStatus = 'available' | 'borrowed' | 'requisitioned' | 'unavailable' | 'ไม่ว่าง' | 'maintenance';

export interface Product {
    id?: string; // Document ID
    name: string;
    brand: string;
    model?: string; // Added model
    price: number;
    purchaseDate: Timestamp;
    warrantyInfo: string;
    location: string;
    imageUrl: string;
    stockId: string; // Unique Asset ID for QR
    status: ProductStatus;
    type?: 'unique' | 'bulk'; // Default 'unique'
    quantity?: number; // Total stock for bulk
    borrowedCount?: number; // Currently borrowed count for bulk
    createdAt: Timestamp;
    // Optional details
    category?: string;
    serialNumber?: string;
    description?: string;
    updatedAt?: any;
}

export interface Transaction {
    id?: string; // Document ID
    productId: string;
    type: 'borrow' | 'requisition';
    transactionDate: Timestamp;
    returnDate?: Timestamp; // Expected return (for borrow only)
    actualReturnDate?: Timestamp; // For return logic
    status: 'active' | 'completed';
    signatureUrl: string;

    // User Details
    userName: string;
    userRoom: string;
    userPhone?: string; // for borrow
    userPosition?: string; // for requisition
}

export type UserRole = 'user' | 'technician' | 'admin' | 'moderator';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: UserRole;
    responsibility?: 'junior_high' | 'senior_high' | 'all'; // For technicians
    createdAt?: Timestamp;
    isPhotographer?: boolean;
    lineUserId?: string; // LINE User ID
    lineDisplayName?: string; // LINE Display Name (used for photographers)
}

export type RepairStatus = 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';

export interface RepairTicket {
    id?: string;
    requesterName: string;
    requesterEmail: string;
    position: string;
    phone: string;
    room: string;
    zone: 'junior_high' | 'senior_high'; // Zone (ม.ต้น or ม.ปลาย)
    description: string;
    aiDiagnosis?: string; // AI's analysis of the symptom
    images: string[];
    status: RepairStatus;
    technicianId?: string; // UID of assigned technician
    technicianName?: string; // Display name for report
    technicianNote?: string;
    completionImage?: string;
    partsUsed?: {
        name: string;
        quantity: number;
        date: Timestamp;
    }[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type LogAction = 'borrow' | 'return' | 'requisition' | 'add' | 'update' | 'repair' | 'repair_update' | 'create' | 'delete';

export interface ActivityLog {
    id?: string;
    action: LogAction;
    productName: string;
    userName: string;
    imageUrl?: string;
    details?: string;
    zone?: string;
    status?: string; // Added status for specific updates
    signatureUrl?: string; // Added for borrow signature
    timestamp: Timestamp;
}

export interface PhotographyJob {
    id?: string;
    title: string;
    description?: string;
    location: string;
    startTime: Timestamp;
    endTime: Timestamp;
    assigneeIds: string[]; // Array of Photographer UIDs
    assigneeNames?: string[]; // Array of Photographer names
    requesterId: string;
    requestName?: string;
    status: 'assigned' | 'completed' | 'cancelled';
    driveLink?: string;
    coverImage?: string;
    createdAt: Timestamp;
    isManualEntry?: boolean; // Flag for manually entered activities
    bookingId?: string; // Optional link to a booking
    facebookPostId?: string;
    facebookPermalink?: string;
    facebookPostedAt?: any; // Firestore Timestamp

    // [New] Fields for tracking who completed the job
    completedBy?: string; // UID of the photographer who submitted the work
    completedAt?: any;    // Timestamp when the work was submitted

    // [New] Display in calendar agenda
    showInAgenda?: boolean; // If true, show this job in the main calendar
}

export interface Booking {
    id: string;
    title: string;
    requesterName: string;
    department: string;
    startTime: Timestamp;
    endTime: Timestamp;
    room: string; // Use 'room' to match usage in some places, map from 'roomName' if needed
    roomId?: string; // Optional if derived
    roomName?: string; // Optional if derived, but used in page.tsx
    layout?: string;
    roomLayout?: string; // Alias for layout to catch legacy usage
    attendees?: number | string; // Could be string in form input
    description?: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled'; // Added cancelled
    createdAt: Timestamp;
    phoneNumber?: string;
    position?: string; // Required by page.tsx
    equipment?: string[];
    roomLayoutDetails?: string;
    micCount?: string;
    attachments?: string[];
    ownEquipment?: string;
    needsPhotographer?: boolean; // Integration flag
}

export type InventoryItem = Product; // Alias for Dashboard usage

// Video Gallery Types
export type VideoPlatform = 'youtube' | 'tiktok' | 'gdrive' | 'facebook' | 'other';
export type VideoStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'published';

// Single video link
export interface VideoLink {
    platform: VideoPlatform;
    url: string;
}

export interface VideoItem {
    id?: string;
    title: string;
    description?: string;
    thumbnailUrl: string;           // URL รูป thumbnail
    videoUrl: string;               // Primary link (ลิงก์หลัก)
    platform: VideoPlatform;        // Primary platform
    videoLinks?: VideoLink[];       // Additional links (max 3 total including primary)
    category: string;               // หมวดหมู่ (กีฬาสี, วันสำคัญ, etc.)
    eventDate?: Timestamp;          // วันที่กิจกรรม
    createdAt: Timestamp;
    createdBy: string;              // userId
    createdByName?: string;         // display name
    isPublished: boolean;

    // Future: Video Job Assignment
    assignedTo?: string;            // userId ของ editor
    assignedToName?: string;        // display name ของ editor
    jobStatus?: VideoStatus;
    relatedPhotographyJobId?: string;  // เชื่อมกับงานถ่ายภาพ
    completedAt?: Timestamp;
}