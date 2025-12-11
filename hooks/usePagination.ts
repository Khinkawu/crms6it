"use client";

import { useState, useMemo, useCallback } from "react";

interface UsePaginationOptions<T> {
    data: T[];
    itemsPerPage?: number;
    initialPage?: number;
}

interface UsePaginationReturn<T> {
    currentPage: number;
    totalPages: number;
    paginatedData: T[];
    goToPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    setItemsPerPage: (count: number) => void;
    itemsPerPage: number;
    startIndex: number;
    endIndex: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

/**
 * Hook for client-side pagination
 * @param options Configuration with data array and optional settings
 */
export function usePagination<T>(options: UsePaginationOptions<T>): UsePaginationReturn<T> {
    const { data, itemsPerPage: initialItemsPerPage = 12, initialPage = 1 } = options;

    const [currentPage, setCurrentPage] = useState(initialPage);
    const [itemsPerPage, setItemsPerPageState] = useState(initialItemsPerPage);

    const totalItems = data.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    // Ensure currentPage is valid when data changes
    const validatedCurrentPage = useMemo(() => {
        if (currentPage > totalPages) return totalPages;
        if (currentPage < 1) return 1;
        return currentPage;
    }, [currentPage, totalPages]);

    const startIndex = (validatedCurrentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const paginatedData = useMemo(() => {
        return data.slice(startIndex, endIndex);
    }, [data, startIndex, endIndex]);

    const goToPage = useCallback((page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    }, [totalPages]);

    const nextPage = useCallback(() => {
        if (validatedCurrentPage < totalPages) {
            setCurrentPage(validatedCurrentPage + 1);
        }
    }, [validatedCurrentPage, totalPages]);

    const prevPage = useCallback(() => {
        if (validatedCurrentPage > 1) {
            setCurrentPage(validatedCurrentPage - 1);
        }
    }, [validatedCurrentPage]);

    const setItemsPerPage = useCallback((count: number) => {
        setItemsPerPageState(count);
        setCurrentPage(1); // Reset to first page when changing items per page
    }, []);

    return {
        currentPage: validatedCurrentPage,
        totalPages,
        paginatedData,
        goToPage,
        nextPage,
        prevPage,
        setItemsPerPage,
        itemsPerPage,
        startIndex,
        endIndex,
        totalItems,
        hasNextPage: validatedCurrentPage < totalPages,
        hasPrevPage: validatedCurrentPage > 1
    };
}
