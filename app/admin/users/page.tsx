"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { UserProfile, UserRole } from "../../../types";
import ConfirmationModal from "../../components/ConfirmationModal";
import toast from "react-hot-toast";
import { Search, Shield, User, Wrench, GraduationCap, ChevronDown, LayoutGrid, List } from "lucide-react";

export default function UsersPage() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [isRoleConfirmOpen, setIsRoleConfirmOpen] = useState(false);
    const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{ userId: string, newRole: UserRole } | null>(null);

    useEffect(() => {
        if (!loading) {
            if (!user || role !== 'admin') {
                router.push("/");
            } else {
                fetchUsers();
            }
        }
    }, [user, role, loading, router]);

    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersList: UserProfile[] = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                let finalDisplayName = userData.displayName;
                if (!finalDisplayName && userData.email) {
                    finalDisplayName = userData.email.split('@')[0];
                }

                usersList.push({
                    uid: doc.id,
                    email: userData.email || "",
                    displayName: finalDisplayName || "Unknown User",
                    photoURL: userData.photoURL || null,
                    role: userData.role || "user",
                    ...userData
                } as UserProfile);
            });
            setUsers(usersList);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleRoleChange = (targetUserId: string, newRole: UserRole) => {
        if (targetUserId === user?.uid) {
            toast.error("You cannot change your own role to prevent lockout.");
            return;
        }
        setPendingRoleUpdate({ userId: targetUserId, newRole });
        setIsRoleConfirmOpen(true);
    };

    const handleResponsibilityChange = async (targetUserId: string, newResponsibility: 'junior_high' | 'senior_high' | 'all') => {
        setUpdatingUserId(targetUserId);
        try {
            const userRef = doc(db, "users", targetUserId);
            await updateDoc(userRef, {
                responsibility: newResponsibility,
                updatedAt: serverTimestamp()
            });

            setUsers(prev => prev.map(u =>
                u.uid === targetUserId ? { ...u, responsibility: newResponsibility } : u
            ));
            toast.success(`Responsibility updated`);
        } catch (error) {
            console.error("Error updating responsibility:", error);
            toast.error("Failed to update responsibility.");
        } finally {
            setUpdatingUserId(null);
        }
    };

    const confirmRoleChange = async () => {
        if (!pendingRoleUpdate) return;
        const { userId, newRole } = pendingRoleUpdate;

        setUpdatingUserId(userId);
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                role: newRole,
                updatedAt: serverTimestamp()
            });

            setUsers(prev => prev.map(u =>
                u.uid === userId ? { ...u, role: newRole } : u
            ));
            toast.success(`User role updated to ${newRole}`);

        } catch (error) {
            console.error("Error updating role:", error);
            toast.error("Failed to update role.");
        } finally {
            setUpdatingUserId(null);
            setPendingRoleUpdate(null);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.displayName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin': return <Shield className="w-4 h-4" />;
            case 'technician': return <Wrench className="w-4 h-4" />;
            case 'moderator': return <GraduationCap className="w-4 h-4" />;
            default: return <User className="w-4 h-4" />;
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20';
            case 'technician': return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/20';
            case 'moderator': return 'bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/20';
            default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20';
        }
    };

    if (loading || !user || role !== 'admin') return null;

    return (
        <div className="animate-fade-in pb-20">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold text-text">User Management</h1>
                    <p className="text-text-secondary">Manage user roles and permissions</p>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border text-text placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all shadow-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5" />
                    </div>
                </div>

                {/* Content */}
                <div className="bg-transparent space-y-4">

                    {isLoadingUsers ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-40 bg-card rounded-2xl animate-pulse border border-border"></div>
                            ))}
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-20 bg-card rounded-2xl border border-border">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                <Search className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-medium text-text">No users found</h3>
                            <p className="text-text-secondary">Try adjusting your search terms</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Grid View */}
                            <div className="grid grid-cols-1 gap-3 md:hidden">
                                {filteredUsers.map((u) => (
                                    <div key={u.uid} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg overflow-hidden shadow-sm">
                                                    {u.photoURL ? (
                                                        <img src={u.photoURL} alt={u.displayName || "User"} className="w-full h-full object-cover" />
                                                    ) : (
                                                        (u.displayName || "U").charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-text">{u.displayName}</h3>
                                                    <p className="text-xs text-text-secondary">{u.email}</p>
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(u.role || 'user')}`}>
                                                {getRoleIcon(u.role || 'user')}
                                                <span className="capitalize">{u.role || 'user'}</span>
                                            </span>
                                        </div>

                                        <div className="space-y-3 pt-3 border-t border-border">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-text-secondary uppercase font-bold block mb-1.5">Role</label>
                                                    <div className="relative">
                                                        <select
                                                            value={u.role || "user"}
                                                            onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                            disabled={u.uid === user.uid || updatingUserId === u.uid}
                                                            className="w-full pl-2 pr-8 py-2 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50 appearance-none capitalize"
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="moderator">Moderator</option>
                                                            <option value="technician">Technician</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                                                    </div>
                                                </div>

                                                {u.role === 'technician' && (
                                                    <div>
                                                        <label className="text-xs text-text-secondary uppercase font-bold block mb-1.5">Zone</label>
                                                        <div className="relative">
                                                            <select
                                                                value={u.responsibility || "all"}
                                                                onChange={(e) => handleResponsibilityChange(u.uid, e.target.value as any)}
                                                                disabled={updatingUserId === u.uid}
                                                                className="w-full pl-2 pr-8 py-2 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50 appearance-none"
                                                            >
                                                                <option value="all">All</option>
                                                                <option value="junior_high">M.3</option>
                                                                <option value="senior_high">M.6</option>
                                                            </select>
                                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border bg-background/50">
                                            <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">User</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Email</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Current Role</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Settings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filteredUsers.map((u) => (
                                            <tr key={u.uid} className="hover:bg-background/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                                                            {u.photoURL ? (
                                                                <img src={u.photoURL} alt={u.displayName || "User"} className="w-full h-full object-cover" />
                                                            ) : (
                                                                (u.displayName || "U").charAt(0).toUpperCase()
                                                            )}
                                                        </div>
                                                        <span className="text-text font-bold">{u.displayName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-text-secondary text-sm">{u.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor(u.role || 'user')}`}>
                                                        {getRoleIcon(u.role || 'user')}
                                                        <span className="capitalize">{u.role || 'user'}</span>
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative w-40">
                                                            <select
                                                                value={u.role || "user"}
                                                                onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                                disabled={u.uid === user.uid || updatingUserId === u.uid}
                                                                className="w-full pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 cursor-pointer appearance-none capitalize transition-colors hover:border-cyan-500/30"
                                                            >
                                                                <option value="user">User</option>
                                                                <option value="moderator">Moderator</option>
                                                                <option value="technician">Technician</option>
                                                                <option value="admin">Admin</option>
                                                            </select>
                                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                                                        </div>

                                                        {u.role === 'technician' && (
                                                            <div className="relative w-40 animate-fade-in-right">
                                                                <select
                                                                    value={u.responsibility || "all"}
                                                                    onChange={(e) => handleResponsibilityChange(u.uid, e.target.value as any)}
                                                                    disabled={updatingUserId === u.uid}
                                                                    className="w-full pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 cursor-pointer appearance-none transition-colors hover:border-cyan-500/30"
                                                                >
                                                                    <option value="all">All Zones</option>
                                                                    <option value="junior_high">Junior High</option>
                                                                    <option value="senior_high">Senior High</option>
                                                                </select>
                                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={isRoleConfirmOpen}
                onClose={() => setIsRoleConfirmOpen(false)}
                onConfirm={confirmRoleChange}
                title="Change User Role"
                message={`Are you sure you want to change this user's role to ${pendingRoleUpdate?.newRole}?`}
                confirmText="Change Role"
                isDangerous={true}
            />
        </div>
    );
}