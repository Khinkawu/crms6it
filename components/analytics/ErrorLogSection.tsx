"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Filter } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorLog {
    id: string;
    source: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    path?: string;
    userId?: string;
    stack?: string;
    resolved: boolean;
    ts: string | null;
}

interface ErrorLogsResponse {
    logs: ErrorLog[];
    unresolvedCount?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    critical: { label: 'Critical', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
    high:     { label: 'High',     bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    medium:   { label: 'Medium',   bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
    low:      { label: 'Low',      bg: 'bg-slate-50',  text: 'text-slate-500',  dot: 'bg-slate-300' },
};

const SOURCE_LABELS: Record<string, string> = {
    client:    'Client',
    server:    'Server',
    firestore: 'Firestore',
    fcm:       'FCM',
    line:      'LINE',
    batch:     'Batch',
    auth:      'Auth',
};

function formatTs(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('th-TH', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
    const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ErrorLogSection() {
    const { user } = useAuth();
    const [data, setData] = useState<ErrorLogsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const resolvedParam = filter === 'all' ? '' : filter === 'unresolved' ? '&resolved=false' : '&resolved=true';
            const res = await fetch(`/api/admin/error-logs?limit=50${resolvedParam}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e) {
            console.error('[ErrorLogSection]', e);
        } finally {
            setLoading(false);
        }
    }, [user, filter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleResolve = useCallback(async (id: string, resolved: boolean) => {
        if (!user) return;
        setResolvingId(id);
        try {
            const token = await user.getIdToken();
            await fetch('/api/admin/error-logs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id, resolved }),
            });
            setData(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    logs: prev.logs.map(l => l.id === id ? { ...l, resolved } : l),
                    unresolvedCount: prev.unresolvedCount !== undefined
                        ? resolved ? Math.max(0, prev.unresolvedCount - 1) : prev.unresolvedCount + 1
                        : undefined,
                };
            });
        } catch (e) {
            console.error('[ErrorLogSection resolve]', e);
        } finally {
            setResolvingId(null);
        }
    }, [user]);

    const unresolvedCount = data?.unresolvedCount ?? 0;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-red-50">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-slate-800">Error Monitor</h2>
                            {unresolvedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                                    {unresolvedCount} รอแก้ไข
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400">Error log จากทุกส่วนของระบบ — มี alert เข้า LINE แล้ว</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Filter */}
                    <div className="inline-flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
                        {(['unresolved', 'all', 'resolved'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all duration-150 cursor-pointer ${
                                    filter === f
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {f === 'unresolved' ? 'รอแก้' : f === 'resolved' ? 'แก้แล้ว' : 'ทั้งหมด'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Body */}
            {loading ? (
                <div className="p-8 flex justify-center">
                    <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
                </div>
            ) : !data || data.logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-200" />
                    <p className="text-sm">
                        {filter === 'unresolved' ? 'ไม่มี error ที่รอแก้ไข 🎉' : 'ไม่มีข้อมูล'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/70">
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-28">เวลา</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-24">Severity</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-20">Source</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Message</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-24">Path</th>
                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-24">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.logs.map(log => (
                                <tr
                                    key={log.id}
                                    className={`transition-colors duration-150 ${
                                        log.resolved
                                            ? 'opacity-50 hover:opacity-70'
                                            : log.severity === 'critical'
                                                ? 'hover:bg-red-50/30'
                                                : 'hover:bg-orange-50/20'
                                    }`}
                                >
                                    <td className="px-4 py-3 text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                                        {formatTs(log.ts)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <SeverityBadge severity={log.severity} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                                            {SOURCE_LABELS[log.source] ?? log.source}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 max-w-sm">
                                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed font-mono">
                                            {log.message}
                                        </p>
                                        {log.userId && (
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{log.userId}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.path ? (
                                            <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[120px]">
                                                {log.path}
                                            </span>
                                        ) : (
                                            <span className="text-slate-200 text-xs">--</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleResolve(log.id, !log.resolved)}
                                            disabled={resolvingId === log.id}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50 ${
                                                log.resolved
                                                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            }`}
                                        >
                                            {resolvingId === log.id ? (
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : log.resolved ? (
                                                <>
                                                    <AlertTriangle className="w-3 h-3" />
                                                    เปิดใหม่
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    แก้แล้ว
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data && data.logs.length > 0 && (
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400 tabular-nums">
                        แสดง {data.logs.length} รายการ
                    </p>
                    <p className="text-[11px] text-slate-300">สูงสุด 50 รายการล่าสุด</p>
                </div>
            )}
        </div>
    );
}
