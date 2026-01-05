"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface HeroSectionProps {
    displayName: string;
}

export default function HeroSection({ displayName }: HeroSectionProps) {
    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "สวัสดีตอนเช้า";
        if (hour < 17) return "สวัสดีตอนบ่าย";
        return "สวัสดีตอนเย็น";
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-300/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

            <div className="relative z-10 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                            <Sparkles size={14} />
                            <span>{today}</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">
                            {getGreeting()}, {displayName.split(' ')[0] || "User"}! 👋
                        </h1>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
