"use client";

import dynamic from "next/dynamic";
import { ComponentType } from "react";
import { CalendarSkeleton, CardSkeleton, PageSkeleton } from "./ui/Skeleton";
import LoadingSpinner from "./ui/LoadingSpinner";

// =====================================================
// Lazy-loaded heavy components with loading fallbacks
// =====================================================

/**
 * Calendar component - heavy dependency (react-big-calendar + moment)
 * Only loaded when needed on dashboard
 */
export const LazyCalendarSection = dynamic(
    () => import("./dashboard/CalendarSection"),
    {
        loading: () => <CalendarSkeleton />,
        ssr: false // Disable SSR for client-only component
    }
);

/**
 * Activity Feed - only needed on dashboard
 */
export const LazyActivityFeed = dynamic(
    () => import("./dashboard/ActivityFeed"),
    {
        loading: () => (
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="animate-pulse flex gap-4">
                            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700 mt-1.5" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
);

/**
 * Booking Details Modal - only loaded when user opens a booking
 */
export const LazyBookingDetailsModal = dynamic(
    () => import("./BookingDetailsModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" text="กำลังโหลด..." />
            </div>
        )
    }
);

/**
 * Booking Modal - only loaded when user creates booking
 */
export const LazyBookingModal = dynamic(
    () => import("./BookingModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" text="กำลังโหลด..." />
            </div>
        )
    }
);

/**
 * Log Table - heavy table component, only loaded when viewing logs
 */
export const LazyLogTable = dynamic(
    () => import("./LogTable"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" text="กำลังโหลดข้อมูล..." />
            </div>
        )
    }
);

/**
 * Borrow Modal - only loaded when borrowing items
 */
export const LazyBorrowModal = dynamic(
    () => import("./BorrowModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" />
            </div>
        )
    }
);

/**
 * Edit Product Modal - only loaded when editing
 */
export const LazyEditProductModal = dynamic(
    () => import("./EditProductModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" />
            </div>
        )
    }
);

/**
 * Requisition Modal - only loaded when requisitioning
 */
export const LazyRequisitionModal = dynamic(
    () => import("./RequisitionModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" />
            </div>
        )
    }
);

/**
 * Return Modal - only loaded when returning items
 */
export const LazyReturnModal = dynamic(
    () => import("./ReturnModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" />
            </div>
        )
    }
);

/**
 * Booking Form - heavy form with multiple inputs
 */
export const LazyBookingForm = dynamic(
    () => import("./BookingForm"),
    {
        loading: () => <CardSkeleton />
    }
);

/**
 * Confirmation Modal - light but can be lazy loaded
 */
export const LazyConfirmationModal = dynamic(
    () => import("./ConfirmationModal"),
    {
        loading: () => null // Don't show loading for small modals
    }
);

/**
 * My Photography Jobs Modal - heavy modal (63KB) for managing photography jobs
 * Only loaded when photographer views their jobs
 */
export const LazyMyPhotographyJobsModal = dynamic(
    () => import("./MyPhotographyJobsModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" text="กำลังโหลด..." />
            </div>
        ),
        ssr: false
    }
);

/**
 * Photography Job Modal - modal for creating/editing photography jobs
 * Only loaded when admin assigns jobs
 */
export const LazyPhotographyJobModal = dynamic(
    () => import("./PhotographyJobModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" text="กำลังโหลด..." />
            </div>
        ),
        ssr: false
    }
);

/**
 * Edit Booking Modal - heavy form modal (32KB)
 * Only loaded when editing a booking
 */
export const LazyEditBookingModal = dynamic(
    () => import("./EditBookingModal"),
    {
        loading: () => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <LoadingSpinner size="lg" text="กำลังโหลด..." />
            </div>
        ),
        ssr: false
    }
);
