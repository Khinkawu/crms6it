"use client";

import React from "react";
import { Search, LayoutGrid, List } from "lucide-react";

interface FilterOption {
    id: string;
    label: string;
}

interface FilterBarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filterOptions: FilterOption[];
    activeFilter: string;
    onFilterChange: (filterId: string) => void;
    viewMode?: 'grid' | 'list';
    onViewModeChange?: (mode: 'grid' | 'list') => void;
    showViewToggle?: boolean;
}

export default function FilterBar({
    searchQuery,
    onSearchChange,
    searchPlaceholder = "ค้นหา...",
    filterOptions,
    activeFilter,
    onFilterChange,
    viewMode = 'grid',
    onViewModeChange,
    showViewToggle = true
}: FilterBarProps) {
    return (
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm">
            {/* Search */}
            <div className="relative w-full lg:w-96">
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                    <Search size={20} />
                </div>
            </div>

            {/* Filters & Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                    {filterOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => onFilterChange(option.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeFilter === option.id
                                    ? 'bg-cyan-500 text-white shadow-md'
                                    : 'bg-background border border-border text-text-secondary hover:bg-border/50'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {showViewToggle && onViewModeChange && (
                    <div className="flex bg-background border border-border rounded-lg p-1">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid'
                                    ? 'bg-card shadow-sm text-cyan-600'
                                    : 'text-text-secondary hover:text-text'
                                }`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list'
                                    ? 'bg-card shadow-sm text-cyan-600'
                                    : 'text-text-secondary hover:text-text'
                                }`}
                        >
                            <List size={20} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
