"use client";

import React from "react";
import { User, ChevronDown } from "lucide-react";
import { PersonStat } from "@/hooks/useDashboardStats";

interface PersonFilterProps {
    persons: PersonStat[];
    selectedId: string | null;
    onChange: (id: string | null) => void;
    label?: string;
}

export default function PersonFilter({ persons, selectedId, onChange, label = "กรองรายบุคคล" }: PersonFilterProps) {
    if (persons.length === 0) return null;

    return (
        <div className="flex items-center gap-2">
            <User size={16} className="text-gray-400" />
            <div className="relative">
                <select
                    value={selectedId || ""}
                    onChange={(e) => onChange(e.target.value || null)}
                    className="pl-3 pr-8 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer transition-all hover:border-blue-300"
                >
                    <option value="">{label} (ทั้งหมด)</option>
                    {persons.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.name} ({p.total} งาน)
                        </option>
                    ))}
                </select>
                <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
            </div>
        </div>
    );
}
