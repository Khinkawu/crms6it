"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { UserProfile, UserRole } from "../../../types";
import ConfirmationModal from "../../components/ConfirmationModal";
import toast from "react-hot-toast";

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

    if (loading || !user || role !== 'admin') return null;

    return (
        <div className="animate-fade-in">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-text mb-2">User Management</h1>
                        <p className="text-text-secondary">Manage user roles and access permissions.</p>
                    </div>
                    <div className="relative w-full md:w-96">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-6 py-3 rounded-xl bg-card border border-border text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">🔍</div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-background/50">
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">User</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Email</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Role</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Responsibility</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoadingUsers ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">Loading users...</td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">No users found.</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <tr key={u.uid} className="hover:bg-border/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold overflow-hidden">
                                                        {u.photoURL ? (
                                                            <img src={u.photoURL} alt={u.displayName || "User"} className="w-full h-full object-cover" />
                                                        ) : (
                                                            (u.displayName || "U").charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <span className="text-text font-medium">{u.displayName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-text-secondary">{u.email || "No Email"}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${u.role === 'admin'
                                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-200 border-purple-500/20'
                                                    : u.role === 'technician'
                                                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-200 border-cyan-500/20'
                                                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-200 border-slate-500/20'
                                                    }`}>
                                                    {(u.role || "USER").toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {u.role === 'technician' && (
                                                    <div className="relative inline-block w-40">
                                                        <select
                                                            value={u.responsibility || "all"}
                                                            onChange={(e) => handleResponsibilityChange(u.uid, e.target.value as any)}
                                                            disabled={updatingUserId === u.uid}
                                                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                                                        >
                                                            <option value="all" className="bg-card text-text">All Zones</option>
                                                            <option value="junior_high" className="bg-card text-text">Junior High (ม.ต้น)</option>
                                                            <option value="senior_high" className="bg-card text-text">Senior High (ม.ปลาย)</option>
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary text-xs">▼</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="relative inline-block w-40">
                                                    <select
                                                        value={u.role || "user"}
                                                        onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                        disabled={u.uid === user.uid || updatingUserId === u.uid}
                                                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                                                    >
                                                        <option value="user" className="bg-card text-text">User</option>
                                                        <option value="technician" className="bg-card text-text">Technician</option>
                                                        <option value="admin" className="bg-card text-text">Admin</option>
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary text-xs">▼</div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
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