"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    startIndex?: number;
    endIndex?: number;
    showItemCount?: boolean;
    maxVisiblePages?: number;
}

/**
 * Pagination component with page navigation
 */
export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    startIndex,
    endIndex,
    showItemCount = true,
    maxVisiblePages = 5
}: PaginationProps) {
    if (totalPages <= 1) return null;

    // Calculate visible page numbers
    const getPageNumbers = () => {
        const pages: (number | "...")[] = [];

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            const half = Math.floor(maxVisiblePages / 2);
            let start = currentPage - half;
            let end = currentPage + half;

            if (start < 1) {
                start = 1;
                end = maxVisiblePages;
            }
            if (end > totalPages) {
                end = totalPages;
                start = totalPages - maxVisiblePages + 1;
            }

            if (start > 1) {
                pages.push(1);
                if (start > 2) pages.push("...");
            }

            for (let i = start; i <= end; i++) {
                if (i > 0 && i <= totalPages) pages.push(i);
            }

            if (end < totalPages) {
                if (end < totalPages - 1) pages.push("...");
                pages.push(totalPages);
            }
        }

        return pages;
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-card/50">
            {/* Item count */}
            {showItemCount && totalItems !== undefined && startIndex !== undefined && endIndex !== undefined && (
                <p className="text-sm text-text-secondary">
                    แสดง <span className="font-bold text-text">{startIndex + 1}-{endIndex}</span> จาก <span className="font-bold text-text">{totalItems}</span> รายการ
                </p>
            )}

            {/* Pagination controls */}
            <div className="flex items-center gap-1">
                {/* First page */}
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-text-secondary hover:bg-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="First page"
                >
                    <ChevronsLeft size={18} />
                </button>

                {/* Previous page */}
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-text-secondary hover:bg-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Previous page"
                >
                    <ChevronLeft size={18} />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1 mx-2">
                    {getPageNumbers().map((page, idx) =>
                        page === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-text-secondary">
                                ...
                            </span>
                        ) : (
                            <button
                                key={page}
                                onClick={() => onPageChange(page as number)}
                                className={`
                                    min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all
                                    ${currentPage === page
                                        ? "bg-cyan-500 text-white shadow-sm"
                                        : "text-text-secondary hover:bg-border/50"
                                    }
                                `}
                            >
                                {page}
                            </button>
                        )
                    )}
                </div>

                {/* Next page */}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-text-secondary hover:bg-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Next page"
                >
                    <ChevronRight size={18} />
                </button>

                {/* Last page */}
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-text-secondary hover:bg-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Last page"
                >
                    <ChevronsRight size={18} />
                </button>
            </div>
        </div>
    );
}
