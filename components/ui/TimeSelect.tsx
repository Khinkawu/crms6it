"use client";

import React from "react";
import CustomSelect from "./CustomSelect";

interface TimeSelectProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
}

/**
 * Time picker component with split hour/minute selects
 * Uses CustomSelect for iOS PWA compatibility
 */
export default function TimeSelect({ label, value, onChange }: TimeSelectProps) {
    const [hour, minute] = value.split(':');

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

    return (
        <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{label}</label>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <CustomSelect
                        value={hour}
                        options={hours}
                        onChange={(val) => onChange(`${val}:${minute}`)}
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-xs opacity-0">
                        น.
                    </div>
                </div>
                <span className="text-gray-400 font-bold">:</span>
                <div className="relative flex-1">
                    <CustomSelect
                        value={minute}
                        options={minutes}
                        onChange={(val) => onChange(`${hour}:${val}`)}
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-xs opacity-0">
                        น.
                    </div>
                </div>
            </div>
        </div>
    );
}
