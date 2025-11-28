import { Timestamp } from 'firebase/firestore';

export interface Product {
    id?: string; // Document ID
    name: string;
    brand: string;
    price: number;
    purchaseDate: Timestamp;
    warrantyInfo: string;
    location: string;
    imageUrl: string;
    stockId: string; // Unique Asset ID for QR
    status: 'available' | 'borrowed' | 'requisitioned';
    createdAt: Timestamp;
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
