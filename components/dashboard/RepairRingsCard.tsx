"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Wrench, Building2 } from "lucide-react";

interface RingStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
}

interface RepairRingsCardProps {
    itStats: RingStats;
    facilityStats: RingStats;
    loading?: boolean;
}

// ── Animated counter ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800) {
    const [count, setCount] = useState(0);
    const frame = useRef<number | null>(null);
    useEffect(() => {
        if (target === 0) { setCount(0); return; }
        const start = performance.now();
        const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setCount(Math.floor(progress * target));
            if (progress < 1) frame.current = requestAnimationFrame(tick);
            else setCount(target);
        };
        frame.current = requestAnimationFrame(tick);
        return () => { if (frame.current) cancelAnimationFrame(frame.current); };
    }, [target, duration]);
    return count;
}

// ── Animated Donut Ring ────────────────────────────────────────────────────────

interface DonutRingProps {
    stats: RingStats;
    label: string;
    icon: React.ElementType;
    colorPending: string;
    colorDone: string;
    colorTrack: string;
    delay?: number;
}

function DonutRing({ stats, label, icon: Icon, colorPending, colorDone, colorTrack, delay = 0 }: DonutRingProps) {
    const r = 38;
    const circ = 2 * Math.PI * r;
    // We use combined percentage for the pending arc so it draws the full length,
    // and the completed arc is drawn on top of it.
    const combinedPct = stats.total > 0 ? ((stats.pending + stats.inProgress + stats.completed) / stats.total) : 0;
    const donePct = stats.total > 0 ? (stats.completed / stats.total) : 0;

    const totalCount = useCountUp(stats.total);
    const pendingCount = useCountUp(stats.pending + stats.inProgress);
    const doneCount = useCountUp(stats.completed);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center gap-3 flex-1"
        >
            {/* Ring */}
            <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    {/* Track */}
                    <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className={colorTrack} />
                    {/* Pending/In-progress arc (draws combined length so done can overlay it) */}
                    <motion.circle
                        cx="50" cy="50" r={r}
                        fill="none" stroke="currentColor" strokeWidth="8"
                        className={colorPending}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: circ - combinedPct * circ }}
                        transition={{ delay: delay + 0.2, duration: 0.9, ease: "easeOut" }}
                    />
                    {/* Completed arc (offset = pending arc length) */}
                    <motion.circle
                        cx="50" cy="50" r={r}
                        fill="none" stroke="currentColor" strokeWidth="8"
                        className={colorDone}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: circ - donePct * circ }}
                        style={{ strokeDashoffset: circ - donePct * circ }}
                        transition={{ delay: delay + 0.4, duration: 0.9, ease: "easeOut" }}
                    />
                </svg>
                {/* Center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{totalCount}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">รายการ</span>
                </div>
            </div>

            {/* Label */}
            <div className="flex items-center gap-1.5">
                <Icon size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</span>
            </div>

            {/* Mini legend */}
            <div className="flex gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${colorPending.replace('text-', 'bg-')}`} />
                    รอ {pendingCount}
                </span>
                <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${colorDone.replace('text-', 'bg-')}`} />
                    เสร็จ {doneCount}
                </span>
            </div>
        </motion.div>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RingSkeleton() {
    return (
        <div className="flex flex-col items-center gap-3 flex-1 animate-pulse">
            <div className="w-28 h-28 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
    );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export default function RepairRingsCard({ itStats, facilityStats, loading }: RepairRingsCardProps) {
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">สรุปงานซ่อม</h3>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">Live</span>
            </div>

            <div className="flex justify-around gap-2">
                {loading ? (
                    <>
                        <RingSkeleton />
                        <div className="w-px bg-gray-100 dark:bg-gray-800" />
                        <RingSkeleton />
                    </>
                ) : (
                    <>
                        <DonutRing
                            stats={itStats}
                            label="โสตทัศนศึกษา"
                            icon={Wrench}
                            colorPending="text-blue-500"
                            colorDone="text-emerald-500"
                            colorTrack="text-gray-100 dark:text-gray-800"
                            delay={0}
                        />
                        <div className="w-px bg-gray-100 dark:bg-gray-800 self-stretch" />
                        <DonutRing
                            stats={facilityStats}
                            label="อาคารสถานที่"
                            icon={Building2}
                            colorPending="text-amber-500"
                            colorDone="text-teal-500"
                            colorTrack="text-gray-100 dark:text-gray-800"
                            delay={0.15}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
