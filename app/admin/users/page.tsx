"use client";

import React, {
    useEffect, useState, useMemo, useCallback,
    useDeferredValue, memo
} from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import {
    collection, getDocs, doc, updateDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { UserProfile, UserRole } from "../../../types";
import ConfirmationModal from "@/components/ConfirmationModal";
import toast from "react-hot-toast";
import {
    Search, Shield, User, Wrench, GraduationCap, ChevronDown,
    Camera, Building2, RefreshCw, ChevronUp, ChevronsUpDown,
    Filter, ChevronLeft, ChevronRight
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

const AVATAR_COLORS = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];
function getAvatarColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type SortField = "displayName" | "email" | "role";
type SortDir   = "asc" | "desc";
type RoleFilter = "all" | UserRole;

const ROLE_CONFIG: Record<string, {
    label: string; icon: React.ReactNode; badge: string; stat: string;
}> = {
    admin: {
        label: "Admin", icon: <Shield className="w-3.5 h-3.5" />,
        badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700",
        stat:  "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
    },
    moderator: {
        label: "Mod", icon: <GraduationCap className="w-3.5 h-3.5" />,
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700",
        stat:  "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
    },
    technician: {
        label: "Tech IT", icon: <Wrench className="w-3.5 h-3.5" />,
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700",
        stat:  "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
    },
    facility_technician: {
        label: "Facility", icon: <Building2 className="w-3.5 h-3.5" />,
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
        stat:  "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
    },
    user: {
        label: "User", icon: <User className="w-3.5 h-3.5" />,
        badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
        stat:  "bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300",
    },
};
function getRoleConfig(role?: string) {
    return ROLE_CONFIG[role || "user"] ?? ROLE_CONFIG.user;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
    return (
        <div className="hidden md:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                <div className="grid grid-cols-4 gap-4">
                    {["w-16","w-20","w-14","w-24"].map((w,i) => (
                        <div key={i} className={`h-3 ${w} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`} />
                    ))}
                </div>
            </div>
            {[...Array(8)].map((_,i) => (
                <div key={i} className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            <div className="h-2.5 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </div>
                        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                        <div className="h-7 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}
function MobileSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-3 md:hidden">
            {[...Array(4)].map((_,i) => (
                <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            <div className="h-2.5 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </div>
                    </div>
                    <div className="h-px bg-gray-100 dark:bg-gray-800" />
                    <div className="flex gap-2">
                        <div className="h-9 flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                        <div className="h-9 w-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Sort header ───────────────────────────────────────────────────────────────
const SortTh = memo(function SortTh({ label, field, sort, onSort }: {
    label: string; field: SortField;
    sort: { field: SortField; dir: SortDir };
    onSort: (f: SortField) => void;
}) {
    const active = sort.field === field;
    return (
        <th
            className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none group hover:text-gray-900 dark:hover:text-white transition-colors"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1.5">
                {label}
                <span className={`transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
                    {active && sort.dir === "asc"  ? <ChevronUp className="w-3.5 h-3.5" />    :
                     active && sort.dir === "desc" ? <ChevronDown className="w-3.5 h-3.5" />  :
                     <ChevronsUpDown className="w-3.5 h-3.5" />}
                </span>
            </div>
        </th>
    );
});

// ─── Memoized row components ───────────────────────────────────────────────────
type RowHandlers = {
    onRoleChange: (uid: string, role: UserRole) => void;
    onZoneChange:  (uid: string, zone: "junior_high" | "senior_high" | "all") => void;
    onPhotoToggle: (uid: string, current: boolean) => void;
};

const DesktopRow = memo(function DesktopRow({
    u, selfUid, isUpdating, handlers,
}: { u: UserProfile; selfUid: string; isUpdating: boolean; handlers: RowHandlers }) {
    const cfg         = getRoleConfig(u.role);
    const avatarColor = getAvatarColor(u.uid);
    const isSelf      = u.uid === selfUid;

    return (
        <tr className={`group transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/10 ${isUpdating ? "opacity-60" : ""}`}>
            {/* User */}
            <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm ${u.photoURL ? "" : avatarColor}`}>
                        {u.photoURL
                            ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                            : (u.displayName || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.displayName}</span>
                            {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium leading-none flex-shrink-0">you</span>}
                            {u.isPhotographer && <Camera className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />}
                        </div>
                    </div>
                </div>
            </td>

            {/* Email */}
            <td className="px-5 py-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate block max-w-[220px]">{u.email}</span>
            </td>

            {/* Role badge */}
            <td className="px-5 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                    {cfg.icon}{cfg.label}
                </span>
            </td>

            {/* Settings */}
            <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                    {/* Role select */}
                    <div className="relative">
                        <select
                            value={u.role || "user"}
                            onChange={e => handlers.onRoleChange(u.uid, e.target.value as UserRole)}
                            disabled={isSelf || isUpdating}
                            className="pl-3 pr-7 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium focus:outline-none focus:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer appearance-none transition-all hover:border-gray-300 dark:hover:border-gray-600"
                        >
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="technician">Tech (IT)</option>
                            <option value="facility_technician">Tech (Facility)</option>
                            <option value="admin">Admin</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Zone select */}
                    {(u.role === "technician" || u.role === "facility_technician") && (
                        <div className="relative">
                            <select
                                value={u.responsibility || "all"}
                                onChange={e => handlers.onZoneChange(u.uid, e.target.value as any)}
                                disabled={isUpdating}
                                className="pl-3 pr-7 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium focus:outline-none focus:border-blue-400 disabled:opacity-40 cursor-pointer appearance-none transition-all hover:border-gray-300 dark:hover:border-gray-600"
                            >
                                <option value="all">All Zones</option>
                                <option value="junior_high">M.3</option>
                                <option value="senior_high">M.6</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Photographer toggle */}
                    <button
                        onClick={() => handlers.onPhotoToggle(u.uid, u.isPhotographer || false)}
                        disabled={isUpdating}
                        title={u.isPhotographer ? "ถอด Photographer" : "เพิ่ม Photographer"}
                        className={`p-1.5 rounded-lg border transition-all disabled:opacity-40 cursor-pointer ${
                            u.isPhotographer
                                ? "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:border-gray-300"
                        }`}
                    >
                        <Camera size={14} />
                    </button>
                </div>
            </td>
        </tr>
    );
});

const MobileCard = memo(function MobileCard({
    u, selfUid, isUpdating, handlers,
}: { u: UserProfile; selfUid: string; isUpdating: boolean; handlers: RowHandlers }) {
    const cfg         = getRoleConfig(u.role);
    const avatarColor = getAvatarColor(u.uid);
    const isSelf      = u.uid === selfUid;

    return (
        <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm transition-opacity ${isUpdating ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${u.photoURL ? "" : avatarColor}`}>
                    {u.photoURL
                        ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                        : (u.displayName || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{u.displayName}</span>
                        {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">you</span>}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{u.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
                        {cfg.icon}{cfg.label}
                    </span>
                    {u.isPhotographer && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700">
                            <Camera className="w-3 h-3" />Photo
                        </span>
                    )}
                </div>
            </div>
            <div className="h-px bg-gray-100 dark:bg-gray-800 mb-3" />
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[120px]">
                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Role</label>
                    <div className="relative">
                        <select
                            value={u.role || "user"}
                            onChange={e => handlers.onRoleChange(u.uid, e.target.value as UserRole)}
                            disabled={isSelf || isUpdating}
                            className="w-full pl-3 pr-7 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed appearance-none cursor-pointer"
                        >
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="technician">Tech (IT)</option>
                            <option value="facility_technician">Tech (Facility)</option>
                            <option value="admin">Admin</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                {(u.role === "technician" || u.role === "facility_technician") && (
                    <div className="flex-1 min-w-[90px]">
                        <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Zone</label>
                        <div className="relative">
                            <select
                                value={u.responsibility || "all"}
                                onChange={e => handlers.onZoneChange(u.uid, e.target.value as any)}
                                disabled={isUpdating}
                                className="w-full pl-3 pr-7 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium focus:outline-none disabled:opacity-40 appearance-none cursor-pointer"
                            >
                                <option value="all">All</option>
                                <option value="junior_high">M.3</option>
                                <option value="senior_high">M.6</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                )}
                <div>
                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Photo</label>
                    <button
                        onClick={() => handlers.onPhotoToggle(u.uid, u.isPhotographer || false)}
                        disabled={isUpdating}
                        className={`px-3 py-2 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-all disabled:opacity-40 cursor-pointer ${
                            u.isPhotographer
                                ? "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                        }`}
                    >
                        <Camera size={13} />
                        {u.isPhotographer ? "Active" : "Off"}
                    </button>
                </div>
            </div>
        </div>
    );
});

// ─── Pagination controls ───────────────────────────────────────────────────────
const Pagination = memo(function Pagination({
    page, totalPages, total, shown, onPage,
}: { page: number; totalPages: number; total: number; shown: number; onPage: (p: number) => void }) {
    if (totalPages <= 1) return (
        <p className="text-xs text-gray-400 dark:text-gray-600 px-1">แสดง {shown} จาก {total} คน</p>
    );

    // window of pages: show at most 5 page buttons
    const start = Math.max(1, page - 2);
    const end   = Math.min(totalPages, start + 4);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return (
        <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-400 dark:text-gray-600">
                แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} จาก {total} คน
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPage(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={14} />
                </button>
                {start > 1 && (
                    <>
                        <button onClick={() => onPage(1)} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">1</button>
                        {start > 2 && <span className="text-xs text-gray-400 px-1">…</span>}
                    </>
                )}
                {pages.map(p => (
                    <button
                        key={p}
                        onClick={() => onPage(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            p === page
                                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                    >
                        {p}
                    </button>
                ))}
                {end < totalPages && (
                    <>
                        {end < totalPages - 1 && <span className="text-xs text-gray-400 px-1">…</span>}
                        <button onClick={() => onPage(totalPages)} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">{totalPages}</button>
                    </>
                )}
                <button
                    onClick={() => onPage(page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
});

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
    const { user, role, loading } = useAuth();
    const router = useRouter();

    const [users,        setUsers]        = useState<UserProfile[]>([]);
    const [isLoading,    setIsLoading]    = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm,   setSearchTerm]   = useState("");
    const [roleFilter,   setRoleFilter]   = useState<RoleFilter>("all");
    const [sort,         setSort]         = useState<{ field: SortField; dir: SortDir }>({ field: "displayName", dir: "asc" });
    const [page,         setPage]         = useState(1);
    const [updatingId,   setUpdatingId]   = useState<string | null>(null);
    const [confirmOpen,  setConfirmOpen]  = useState(false);
    const [pending,      setPending]      = useState<{ userId: string; newRole: UserRole } | null>(null);

    // useDeferredValue: React 18 non-blocking search
    // while user types, old list stays visible, new list computes in background
    const deferredSearch = useDeferredValue(searchTerm);
    const isStale        = searchTerm !== deferredSearch;

    useEffect(() => {
        if (!loading) {
            if (!user || role !== "admin") router.push("/");
            else fetchUsers();
        }
    }, [user, role, loading, router]);

    const fetchUsers = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);
        try {
            const snap = await getDocs(collection(db, "users"));
            const list: UserProfile[] = [];
            snap.forEach(docSnap => {
                const d = docSnap.data();
                list.push({
                    ...d,
                    uid:         docSnap.id,
                    email:       d.email       || "",
                    displayName: d.displayName || (d.email ? d.email.split("@")[0] : "Unknown"),
                    photoURL:    d.photoURL    || null,
                    role:        d.role        || "user",
                } as UserProfile);
            });
            setUsers(list);
        } catch (err) {
            console.error("fetchUsers error:", err);
            toast.error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // ─── Stats (never deferred — always shows real total) ─────────────────────
    const stats = useMemo(() => {
        const c: Record<string, number> = { admin: 0, moderator: 0, technician: 0, facility_technician: 0, user: 0 };
        users.forEach(u => { const r = u.role || "user"; c[r] = (c[r] || 0) + 1; });
        return c;
    }, [users]);

    // ─── Filtered list (uses deferred search → non-blocking) ─────────────────
    const filtered = useMemo(() => {
        const q = deferredSearch.toLowerCase();
        return users
            .filter(u => roleFilter === "all" || u.role === roleFilter)
            .filter(u =>
                !q ||
                (u.displayName || "").toLowerCase().includes(q) ||
                (u.email       || "").toLowerCase().includes(q)
            )
            .sort((a, b) => {
                const va = (a[sort.field] || "").toString().toLowerCase();
                const vb = (b[sort.field] || "").toString().toLowerCase();
                return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            });
    }, [users, deferredSearch, roleFilter, sort]);

    // ─── Pagination ───────────────────────────────────────────────────────────
    const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated   = useMemo(
        () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
        [filtered, currentPage]
    );

    // Reset to page 1 when filter/search changes
    useEffect(() => { setPage(1); }, [deferredSearch, roleFilter, sort]);

    // ─── Handlers (stable refs via useCallback) ───────────────────────────────
    const handleSort = useCallback((field: SortField) => {
        setSort(prev => prev.field === field
            ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
            : { field, dir: "asc" }
        );
    }, []);

    const handleRoleChange = useCallback((targetId: string, newRole: UserRole) => {
        if (targetId === user?.uid) { toast.error("ไม่สามารถเปลี่ยน role ของตัวเองได้"); return; }
        setPending({ userId: targetId, newRole });
        setConfirmOpen(true);
    }, [user?.uid]);

    const confirmRoleChange = useCallback(async () => {
        if (!pending) return;
        const { userId, newRole } = pending;
        setUpdatingId(userId);
        try {
            await updateDoc(doc(db, "users", userId), { role: newRole, updatedAt: serverTimestamp() });
            setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));
            toast.success(`เปลี่ยน role เป็น ${newRole} แล้ว`);
        } catch { toast.error("เปลี่ยน role ไม่สำเร็จ"); }
        finally { setUpdatingId(null); setPending(null); }
    }, [pending]);

    const handleZoneChange = useCallback(async (targetId: string, zone: "junior_high" | "senior_high" | "all") => {
        setUpdatingId(targetId);
        try {
            await updateDoc(doc(db, "users", targetId), { responsibility: zone, updatedAt: serverTimestamp() });
            setUsers(prev => prev.map(u => u.uid === targetId ? { ...u, responsibility: zone } : u));
            toast.success("อัปเดต Zone แล้ว");
        } catch { toast.error("อัปเดต Zone ไม่สำเร็จ"); }
        finally { setUpdatingId(null); }
    }, []);

    const handlePhotoToggle = useCallback(async (targetId: string, current: boolean) => {
        setUpdatingId(targetId);
        try {
            await updateDoc(doc(db, "users", targetId), { isPhotographer: !current, updatedAt: serverTimestamp() });
            setUsers(prev => prev.map(u => u.uid === targetId ? { ...u, isPhotographer: !current } : u));
            toast.success(current ? "ถอด Photographer แล้ว" : "เพิ่ม Photographer แล้ว");
        } catch { toast.error("อัปเดต Photographer ไม่สำเร็จ"); }
        finally { setUpdatingId(null); }
    }, []);

    // Stable handlers object — won't cause row re-renders
    const handlers = useMemo<RowHandlers>(() => ({
        onRoleChange:  handleRoleChange,
        onZoneChange:  handleZoneChange,
        onPhotoToggle: handlePhotoToggle,
    }), [handleRoleChange, handleZoneChange, handlePhotoToggle]);

    const clearFilters = useCallback(() => { setSearchTerm(""); setRoleFilter("all"); }, []);

    if (loading || !user || role !== "admin") return null;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="pb-20 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ผู้ใช้งาน</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        จัดการสิทธิ์และบทบาทผู้ใช้
                        {users.length > 0 && ` • ${users.length} คน`}
                    </p>
                </div>
                <button
                    onClick={() => fetchUsers(true)}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-700 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                    <span className="hidden sm:inline">รีเฟรช</span>
                </button>
            </div>

            {/* Stats bar */}
            {!isLoading && users.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(["admin","moderator","technician","facility_technician","user"] as const).map(r => {
                        const cfg = getRoleConfig(r);
                        const count = stats[r] || 0;
                        const active = roleFilter === r;
                        return (
                            <button
                                key={r}
                                onClick={() => setRoleFilter(active ? "all" : r)}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                                    active
                                        ? `${cfg.stat} border-current ring-1 ring-current ring-offset-1`
                                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                                }`}
                            >
                                <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-current" : "text-gray-500 dark:text-gray-400"}`}>
                                    {cfg.icon}
                                    <span className="hidden sm:inline">{cfg.label}</span>
                                </div>
                                <span className={`text-base font-bold tabular-nums ${active ? "text-current" : "text-gray-900 dark:text-white"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อ หรืออีเมล..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-600 transition-all ${isStale ? "opacity-60" : ""}`}
                    />
                    {isStale && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                </div>
                <div className="relative sm:w-44">
                    <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value as RoleFilter)}
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none cursor-pointer transition-all"
                    >
                        <option value="all">ทุก Role</option>
                        <option value="admin">Admin</option>
                        <option value="moderator">Moderator</option>
                        <option value="technician">Tech (IT)</option>
                        <option value="facility_technician">Tech (Facility)</option>
                        <option value="user">User</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <>
                    <TableSkeleton />
                    <MobileSkeleton />
                </>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Search className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">ไม่พบผู้ใช้</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {(searchTerm || roleFilter !== "all") ? "ลองเปลี่ยน filter หรือคำค้นหา" : "ยังไม่มีผู้ใช้ในระบบ"}
                    </p>
                    {(searchTerm || roleFilter !== "all") && (
                        <button onClick={clearFilters} className="mt-4 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                            ล้าง filter
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* ── Desktop Table ── */}
                    <div className="hidden md:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50">
                                    <SortTh label="ผู้ใช้"   field="displayName" sort={sort} onSort={handleSort} />
                                    <SortTh label="อีเมล"   field="email"       sort={sort} onSort={handleSort} />
                                    <SortTh label="Role"    field="role"        sort={sort} onSort={handleSort} />
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        การตั้งค่า
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {paginated.map(u => (
                                    <DesktopRow
                                        key={u.uid}
                                        u={u}
                                        selfUid={user.uid}
                                        isUpdating={updatingId === u.uid}
                                        handlers={handlers}
                                    />
                                ))}
                            </tbody>
                        </table>
                        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                            <Pagination
                                page={currentPage}
                                totalPages={totalPages}
                                total={filtered.length}
                                shown={paginated.length}
                                onPage={setPage}
                            />
                        </div>
                    </div>

                    {/* ── Mobile Cards ── */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {paginated.map(u => (
                            <MobileCard
                                key={u.uid}
                                u={u}
                                selfUid={user.uid}
                                isUpdating={updatingId === u.uid}
                                handlers={handlers}
                            />
                        ))}
                        <div className="pt-1">
                            <Pagination
                                page={currentPage}
                                totalPages={totalPages}
                                total={filtered.length}
                                shown={paginated.length}
                                onPage={setPage}
                            />
                        </div>
                    </div>
                </>
            )}

            <ConfirmationModal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={confirmRoleChange}
                title="เปลี่ยน Role ผู้ใช้"
                message={`ยืนยันเปลี่ยน role เป็น "${pending?.newRole}"?`}
                confirmText="เปลี่ยน Role"
                isDangerous
            />
        </div>
    );
}
