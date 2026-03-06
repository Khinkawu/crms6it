"use client";

import React from "react";

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
    animate?: boolean;
}

/**
 * Skeleton loading placeholder component
 */
export function Skeleton({
    className = "",
    width,
    height,
    rounded = "md",
    animate = true
}: SkeletonProps) {
    const roundedClasses = {
        none: "",
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
        "2xl": "rounded-2xl",
        full: "rounded-full"
    };

    return (
        <div
            className={`
                bg-gray-200 dark:bg-gray-700
                ${animate ? "animate-pulse" : ""}
                ${roundedClasses[rounded]}
                ${className}
            `}
            style={{
                width: width,
                height: height
            }}
        />
    );
}

/**
 * Skeleton for card layouts
 */
export function CardSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12" rounded="full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-24 w-full" rounded="xl" />
            <div className="flex gap-2">
                <Skeleton className="h-8 w-20" rounded="lg" />
                <Skeleton className="h-8 w-20" rounded="lg" />
            </div>
        </div>
    );
}

/**
 * Skeleton for table rows
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <tr className="border-b border-border">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                </td>
            ))}
        </tr>
    );
}

/**
 * Skeleton for stats cards
 */
export function StatsSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
            <Skeleton className="w-14 h-14" rounded="2xl" />
            <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-12" />
            </div>
        </div>
    );
}

/**
 * Skeleton for the calendar
 */
export function CalendarSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" rounded="lg" />
                    <Skeleton className="h-8 w-8" rounded="lg" />
                    <Skeleton className="h-8 w-8" rounded="lg" />
                </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-6" />
                ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" rounded="lg" />
                ))}
            </div>
        </div>
    );
}

/**
 * Skeleton for list items
 */
export function ListItemSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-border">
            <Skeleton className="w-10 h-10" rounded="lg" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16" rounded="full" />
        </div>
    );
}

/**
 * Full page loading skeleton
 */
export function PageSkeleton() {
    return (
        <div className="animate-fade-in space-y-8 p-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-10 w-32" rounded="xl" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <StatsSkeleton key={i} />
                ))}
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
