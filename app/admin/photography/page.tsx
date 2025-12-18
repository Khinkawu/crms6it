"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Camera,
    Calendar,
    MapPin,
    User,
    Clock,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Edit2,
    ExternalLink,
    Search,
    Filter,
    Plus,
    X,
    Save,
    Trash2,
    Image as ImageIcon
} from "lucide-react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PhotographyJob, UserProfile } from "@/types";
import toast from "react-hot-toast";
import PhotographyJobModal from "@/app/components/PhotographyJobModal";
import { compressImage } from "@/utils/imageCompression";

export default function PhotographyManagement() {
    const { user, role, loading } = useAuth();
    const router = useRouter();

    const [jobs, setJobs] = useState<PhotographyJob[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'completed' | 'cancelled'>('all');
    const [filterSource, setFilterSource] = useState<'all' | 'direct' | 'booking'>('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<PhotographyJob | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const photographers = allUsers.filter(u => u.isPhotographer);

    // Redirect non-admin users
    useEffect(() => {
        if (!loading && (!user || (role !== 'admin' && role !== 'moderator'))) {
            router.push("/");
        }
    }, [user, role, loading, router]);

    // Fetch photography jobs
    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, "photography_jobs"), orderBy("startTime", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobsData: PhotographyJob[] = [];
            snapshot.forEach((doc) => {
                jobsData.push({ id: doc.id, ...doc.data() } as PhotographyJob);
            });
            setJobs(jobsData);
            setLoadingJobs(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Fetch photographers
    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, "users"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const users: UserProfile[] = [];
            snapshot.forEach((doc) => {
                users.push({ ...doc.data(), uid: doc.id } as UserProfile);
            });
            setAllUsers(users);
        });

        return () => unsubscribe();
    }, [user]);

    // Helper to resolve assignee names
    const resolveAssigneeNames = (job: PhotographyJob) => {
        if (job.assigneeIds && job.assigneeIds.length > 0) {
            const names = job.assigneeIds.map(id => {
                const user = allUsers.find(p => p.uid === id);
                return user ? user.displayName : null;
            }).filter(Boolean);

            if (names.length > 0) return names as string[];
        }
        // Fallback to stored names -> legacy singular name -> empty
        if (job.assigneeNames && job.assigneeNames.length > 0) return job.assigneeNames;
        if ((job as any).assigneeName) return [(job as any).assigneeName];
        return [];
    };

    // Filter jobs
    const filteredJobs = jobs
        .filter(job => filterStatus === 'all' || job.status === filterStatus)
        .filter(job => {
            if (filterSource === 'all') return true;
            if (filterSource === 'booking') return !!job.bookingId;
            if (filterSource === 'direct') return !job.bookingId;
            return true;
        })
        .filter(job => {
            const assigneeNames = resolveAssigneeNames(job);
            return (
                job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                assigneeNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        });

    // Format date
    const formatDate = (ts: Timestamp) => {
        if (!ts) return "";
        return ts.toDate().toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    const formatTime = (ts: Timestamp) => {
        if (!ts) return "";
        return ts.toDate().toLocaleTimeString('th-TH', {
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Status badge
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'assigned':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 whitespace-nowrap flex-shrink-0">
                        <AlertCircle size={12} /> รอส่งงาน
                    </span>
                );
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 whitespace-nowrap flex-shrink-0">
                        <CheckCircle2 size={12} /> ส่งงานแล้ว
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
                        <XCircle size={12} /> ยกเลิก
                    </span>
                );
            default:
                return null;
        }
    };

    // Handle delete
    const handleDelete = async (jobId: string) => {
        if (!confirm("ต้องการลบงานนี้หรือไม่?")) return;

        try {
            await deleteDoc(doc(db, "photography_jobs", jobId));
            toast.success("ลบงานสำเร็จ");
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" />
            </div>
        );
    }

    // Stats
    const statsData = {
        assigned: jobs.filter(j => j.status === 'assigned').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
                            <Camera size={24} className="text-white" />
                        </div>
                        จัดการงานตากล้อง
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        ดูและจัดการงานถ่ายภาพทั้งหมด
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus size={18} />
                    มอบหมายงานใหม่
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsData.assigned}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">รอส่งงาน</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsData.completed}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">ส่งงานแล้ว</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700">
                            <XCircle size={20} className="text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsData.cancelled}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">ยกเลิก</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่องาน, สถานที่, หรือช่างภาพ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {/* Source Filter */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                            <button
                                onClick={() => setFilterSource('all')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterSource === 'all'
                                    ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                ทั้งหมด
                            </button>
                            <button
                                onClick={() => setFilterSource('direct')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterSource === 'direct'
                                    ? 'bg-white dark:bg-gray-600 shadow-sm text-purple-600 dark:text-purple-300'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                งานตรง
                            </button>
                            <button
                                onClick={() => setFilterSource('booking')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterSource === 'booking'
                                    ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-300'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                จากการจอง
                            </button>
                        </div>

                        {(['all', 'assigned', 'completed', 'cancelled'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-1 sm:flex-none whitespace-nowrap ${filterStatus === status
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {status === 'all' ? 'ทุกสถานะ' :
                                    status === 'assigned' ? 'รอส่งงาน' :
                                        status === 'completed' ? 'เสร็จแล้ว' : 'ยกเลิก'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Jobs List */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                {loadingJobs ? (
                    <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
                ) : filteredJobs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Camera size={48} className="mx-auto mb-3 opacity-30" />
                        <p>ไม่พบงานตากล้อง</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredJobs.map((job) => (
                            <div
                                key={job.id}
                                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row gap-4">
                                    {/* Cover Image */}
                                    <div className="w-full sm:w-48 h-48 sm:h-32 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden relative group">
                                        {job.coverImage ? (
                                            <img
                                                src={job.coverImage}
                                                alt={job.title}
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400">
                                                <ImageIcon size={32} />
                                            </div>
                                        )}
                                        {/* Mobile Badge Overlay */}
                                        <div className="absolute top-2 right-2 sm:hidden flex flex-col items-end gap-1 shadow-sm">
                                            {job.bookingId ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300 backdrop-blur-sm">
                                                    จากการจอง
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 backdrop-blur-sm">
                                                    งานตรง
                                                </span>
                                            )}
                                            {getStatusBadge(job.status)}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-y-3">
                                        <div>
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-snug break-words line-clamp-2">
                                                    {job.title}
                                                </h3>
                                                {/* Desktop Badge */}
                                                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                                                    {job.bookingId ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                                            จากการจอง
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 whitespace-nowrap">
                                                            งานตรง
                                                        </span>
                                                    )}
                                                    {getStatusBadge(job.status)}
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-500 dark:text-gray-400">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Calendar size={14} className="flex-shrink-0 text-blue-500" />
                                                    <span className="truncate">{formatDate(job.startTime)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Clock size={14} className="flex-shrink-0 text-orange-500" />
                                                    <span className="truncate">{formatTime(job.startTime)} - {formatTime(job.endTime)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 min-w-0 sm:col-span-2">
                                                    <MapPin size={14} className="flex-shrink-0 text-red-500" />
                                                    <span className="truncate">{job.location}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            {/* Assignees */}
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 flex-shrink-0">
                                                    <User size={12} />
                                                </div>
                                                <span className="text-sm text-gray-600 dark:text-gray-300 truncate font-medium">
                                                    {(() => {
                                                        const names = resolveAssigneeNames(job);
                                                        return names.length > 0 ? names.join(', ') : 'ยังไม่ระบุช่างภาพ';
                                                    })()}
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => {
                                                        setEditingJob(job);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                                                >
                                                    <Edit2 size={14} />
                                                    <span className="hidden sm:inline">แก้ไข</span>
                                                </button>
                                                {job.driveLink && (
                                                    <a
                                                        href={job.driveLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                                                    >
                                                        <ExternalLink size={14} />
                                                        <span className="hidden sm:inline">ดูภาพ</span>
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(job.id!)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <PhotographyJobModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                requesterId={user?.uid || ''}
                photographers={photographers}
            />

            {/* Edit Modal */}
            <EditPhotographyJobModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingJob(null);
                }}
                job={editingJob}
                photographers={photographers}
            />
        </div>
    );
}

// Edit Modal Component
interface EditPhotographyJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: PhotographyJob | null;
    photographers: UserProfile[];
}

function EditPhotographyJobModal({ isOpen, onClose, job, photographers }: EditPhotographyJobModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        location: '',
        startTime: '',
        endTime: '',
        assigneeIds: [] as string[],
        driveLink: '',
        status: 'assigned' as 'assigned' | 'completed' | 'cancelled',
        coverImage: ''
    });
    const [saving, setSaving] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (job) {
            const startDate = job.startTime?.toDate?.() || new Date();
            const endDate = job.endTime?.toDate?.() || new Date();

            // Format date to local timezone for datetime-local input
            const formatLocalDateTime = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            setFormData({
                title: job.title || '',
                description: job.description || '',
                location: job.location || '',
                startTime: formatLocalDateTime(startDate),
                endTime: formatLocalDateTime(endDate),
                assigneeIds: job.assigneeIds || [],
                driveLink: job.driveLink || '',
                status: job.status || 'assigned',
                coverImage: job.coverImage || ''
            });
            setImagePreview(job.coverImage || '');
            setImageFile(null);
        }
    }, [job]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview('');
        setFormData(prev => ({ ...prev, coverImage: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!job?.id) return;

        setSaving(true);
        try {
            let coverImageUrl = formData.coverImage;

            // Upload new image if selected
            if (imageFile) {
                setUploadingImage(true);
                toast.loading('กำลังบีบอัดและอัปโหลดรูปภาพ...', { id: 'upload-image' });

                // Compress image before upload
                const compressedFile = await compressImage(imageFile, {
                    maxWidth: 1920,
                    maxHeight: 1080,
                    quality: 0.8,
                    maxSizeMB: 0.5
                });

                const fileName = `photography_jobs/${job.id}/cover_${Date.now()}.jpg`;
                const storageRef = ref(storage, fileName);

                await uploadBytes(storageRef, compressedFile);
                coverImageUrl = await getDownloadURL(storageRef);

                toast.success(`อัปโหลดสำเร็จ (${(compressedFile.size / 1024).toFixed(0)} KB)`, { id: 'upload-image' });
                setUploadingImage(false);
            }

            const assigneeNames = formData.assigneeIds.map(id => {
                const p = photographers.find(ph => ph.uid === id);
                return p?.displayName || '';
            }).filter(Boolean);

            await updateDoc(doc(db, "photography_jobs", job.id), {
                title: formData.title,
                description: formData.description,
                location: formData.location,
                startTime: Timestamp.fromDate(new Date(formData.startTime)),
                endTime: Timestamp.fromDate(new Date(formData.endTime)),
                assigneeIds: formData.assigneeIds,
                assigneeNames,
                driveLink: formData.driveLink,
                status: formData.status,
                coverImage: coverImageUrl
            });

            toast.success("บันทึกสำเร็จ");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setSaving(false);
            setUploadingImage(false);
        }
    };

    const toggleAssignee = (uid: string) => {
        setFormData(prev => ({
            ...prev,
            assigneeIds: prev.assigneeIds.includes(uid)
                ? prev.assigneeIds.filter(id => id !== uid)
                : [...prev.assigneeIds, uid]
        }));
    };

    if (!isOpen || !job) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            แก้ไขงานตากล้อง
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ชื่องาน
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Cover Image */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                ภาพปก
                            </label>
                            <div className="space-y-3">
                                {/* Image Preview */}
                                {imagePreview ? (
                                    <div className="relative group">
                                        <img
                                            src={imagePreview}
                                            alt="Cover preview"
                                            className="w-full h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                                            <label className="p-2 bg-white/90 rounded-lg cursor-pointer hover:bg-white transition-colors">
                                                <Edit2 size={18} className="text-gray-700" />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="p-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                                            >
                                                <X size={18} className="text-white" />
                                            </button>
                                        </div>
                                        {uploadingImage && (
                                            <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                                <div className="animate-spin h-8 w-8 border-3 border-white rounded-full border-t-transparent" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                                        <ImageIcon size={32} className="text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">คลิกเพื่อเลือกภาพปก</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG สูงสุด 5MB</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                รายละเอียด
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                สถานที่
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Date/Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    เริ่มต้น
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    สิ้นสุด
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>

                        {/* Assignees */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                ช่างภาพ
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {photographers.map((p) => (
                                    <button
                                        key={p.uid}
                                        type="button"
                                        onClick={() => toggleAssignee(p.uid)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${formData.assigneeIds.includes(p.uid)
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                            }`}
                                    >
                                        {p.displayName}
                                    </button>
                                ))}
                                {photographers.length === 0 && (
                                    <p className="text-sm text-gray-500">ไม่พบช่างภาพในระบบ</p>
                                )}
                            </div>
                        </div>

                        {/* Drive Link */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ลิงก์ Google Drive
                            </label>
                            <input
                                type="url"
                                value={formData.driveLink}
                                onChange={(e) => setFormData(prev => ({ ...prev, driveLink: e.target.value }))}
                                placeholder="https://drive.google.com/..."
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                สถานะ
                            </label>
                            <div className="flex gap-2">
                                {(['assigned', 'completed', 'cancelled'] as const).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${formData.status === s
                                            ? s === 'assigned' ? 'bg-amber-500 text-white' :
                                                s === 'completed' ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}
                                    >
                                        {s === 'assigned' ? 'รอส่งงาน' : s === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    บันทึก
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
