"use client";

import React, { useState, useRef, useEffect } from "react";

export interface SelectOption {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    options: (string | SelectOption)[];
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
}

/**
 * Custom scrollable select component with iOS PWA support
 * Handles touch events properly to distinguish scroll from tap
 */
export default function CustomSelect({
    value,
    options,
    onChange,
    placeholder = "เลือกรายการ",
    className = ""
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Touch tracking to distinguish scroll from tap
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const isScrollingRef = useRef(false);

    // Helper to get label
    const getLabel = (opt: string | SelectOption) => typeof opt === 'string' ? opt : opt.label;
    const getValue = (opt: string | SelectOption) => typeof opt === 'string' ? opt : opt.value;

    const selectedLabel = options.find(opt => getValue(opt) === value)
        ? getLabel(options.find(opt => getValue(opt) === value)!)
        : placeholder;

    // Close on click/touch outside - iOS PWA compatible
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            // Use both touch and mouse events for iOS PWA compatibility
            document.addEventListener("touchstart", handleClickOutside, { passive: true });
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("touchstart", handleClickOutside);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Scroll to selected item when opening
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const selectedEl = dropdownRef.current.querySelector(`[data-value="${value}"]`);
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: "center" });
            }
        }
    }, [isOpen, value]);

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    // Track touch start for scroll detection
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        isScrollingRef.current = false;
    };

    // Detect if user is scrolling
    const handleTouchMove = () => {
        isScrollingRef.current = true;
    };

    // Handle selection only if not scrolling
    const handleOptionTouchEnd = (optValue: string) => (e: React.TouchEvent) => {
        e.preventDefault();

        // If user was scrolling, don't select
        if (isScrollingRef.current) {
            isScrollingRef.current = false;
            return;
        }

        // Check if touch moved significantly (threshold: 10px)
        if (touchStartRef.current) {
            const touch = e.changedTouches[0];
            const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
            if (deltaY > 10) {
                return; // Was a scroll, not a tap
            }
        }

        onChange(optValue);
        setIsOpen(false);
    };

    const handleOptionClick = (optValue: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(optValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            <div
                onClick={handleToggle}
                className={`w-full h-[46px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center cursor-pointer hover:border-blue-500 transition-colors select-none flex items-center justify-center ${!value ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                {selectedLabel}
            </div>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 no-scrollbar"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                >
                    {options.map((opt) => {
                        const optValue = getValue(opt);
                        const optLabel = getLabel(opt);
                        return (
                            <div
                                key={optValue}
                                data-value={optValue}
                                onClick={handleOptionClick(optValue)}
                                onTouchEnd={handleOptionTouchEnd(optValue)}
                                className={`
                                    py-3 px-3 text-sm text-center cursor-pointer transition-colors
                                    ${optValue === value
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600'}
                                `}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                                {optLabel}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
