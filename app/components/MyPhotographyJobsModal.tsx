import React, { useState, useEffect } from "react";
import { X, Calendar, MapPin, ExternalLink, Save, CheckCircle2, UploadCloud, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import { PhotographyJob } from "../../types";

// Utility: Compress and resize image for cover (max 800px width, 0.7 quality)
const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize if wider than maxWidth
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas to Blob failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

interface MyPhotographyJobsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export default function MyPhotographyJobsModal({ isOpen, onClose, userId }: MyPhotographyJobsModalProps) {
    const [jobs, setJobs] = useState<PhotographyJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});

    // File Upload State
    const [coverFiles, setCoverFiles] = useState<Record<string, File>>({});
    const [jobFiles, setJobFiles] = useState<Record<string, File[]>>({});

    const [previews, setPreviews] = useState<Record<string, string[]>>({}); // For job files
    const [coverPreviews, setCoverPreviews] = useState<Record<string, string>>({}); // For cover file

    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isUploadComplete, setIsUploadComplete] = useState<Record<string, boolean>>({});
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!isOpen || !userId) return;

        const q = query(
            collection(db, "photography_jobs"),
            where("assigneeId", "==", userId),
            where("status", "==", "assigned"), // Only show active jobs
            orderBy("startTime", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedJobs: PhotographyJob[] = [];
            snapshot.forEach((doc) => {
                fetchedJobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
            });
            setJobs(fetchedJobs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, userId]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleLinkChange = (jobId: string, value: string) => {
        setDriveLinks(prev => ({ ...prev, [jobId]: value }));
    };

    const handleCoverChange = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFiles(prev => ({ ...prev, [jobId]: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreviews(prev => ({ ...prev, [jobId]: reader.result as string }));
            };
            reader.readAsDataURL(file);
            // Reset upload status if file changes
            setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
        }
    };

    const handleJobFilesChange = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setJobFiles(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...files] }));

            // Create previews
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setPreviews(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...newPreviews] }));

            // Reset upload status if files change
            setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
        }
    };

    const removeFile = (jobId: string, index: number) => {
        setJobFiles(prev => {
            const files = [...(prev[jobId] || [])];
            files.splice(index, 1);
            return { ...prev, [jobId]: files };
        });

        setPreviews(prev => {
            const currentPreviews = [...(prev[jobId] || [])];
            URL.revokeObjectURL(currentPreviews[index]);
            currentPreviews.splice(index, 1);
            return { ...prev, [jobId]: currentPreviews };
        });

        setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
    };

    const handleUpload = async (jobId: string) => {
        const cover = coverFiles[jobId];
        const files = jobFiles[jobId] || [];

        if (!cover && files.length === 0) {
            toast.error("กรุณาเลือกไฟล์ก่อนกดอัปโหลด");
            return;
        }

        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        setIsUploading(prev => ({ ...prev, [jobId]: true }));
        setUploadProgress(prev => ({ ...prev, [jobId]: 0 }));

        try {
            let completedCount = 0;
            const totalFiles = files.length;
            let driveFolderLink = "";

            // Upload Files to Drive API
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('eventName', job.title); // Use job title for folder name
                formData.append('jobDate', job.startTime ? job.startTime.toDate().toISOString() : new Date().toISOString());

                const response = await fetch('/api/drive/upload', {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Upload failed');
                }

                // Capture the folder link from the first successful upload (they all go to same folder)
                if (!driveFolderLink && result.folderLink) {
                    driveFolderLink = result.folderLink;
                }

                completedCount++;
                const progress = Math.round((completedCount / totalFiles) * 100);
                setUploadProgress(prev => ({ ...prev, [jobId]: progress }));
            }

            // Auto-fill the Drive Link field if we got one
            if (driveFolderLink) {
                setDriveLinks(prev => ({ ...prev, [jobId]: driveFolderLink }));
            }

            setIsUploadComplete(prev => ({ ...prev, [jobId]: true }));
            toast.success("อัปโหลดขึ้น Drive เรียบร้อยแล้ว!");

        } catch (error: any) {
            console.error("Upload failed", error);
            toast.error(`อัปโหลดล้มเหลว: ${error.message}`);
        } finally {
            setIsUploading(prev => ({ ...prev, [jobId]: false }));
        }
    };

    const handleSubmit = async (jobId: string) => {
        // Validation: Must upload first unless link is provided
        if ((coverFiles[jobId] || jobFiles[jobId]?.length > 0) && !isUploadComplete[jobId]) {
            toast.error("กรุณากดปุ่ม 'อัปโหลด' ให้เสร็จสิ้นก่อนส่งงาน");
            return;
        }

        if (!driveLinks[jobId] && !isUploadComplete[jobId]) {
            toast.error("กรุณาอัปโหลดไฟล์ หรือแนบลิงก์ Google Drive");
            return;
        }

        setSubmittingId(jobId);
        try {
            let coverUrl = "";
            let finalDriveLink = driveLinks[jobId] || "https://drive.google.com/drive/folders/MOCK_ID";
            // ^ In real app, API returns the link

            // 1. If cover file exists, compress and upload to Firebase Storage
            if (coverFiles[jobId]) {
                const compressedBlob = await compressImage(coverFiles[jobId], 800, 0.7);
                const storageRef = ref(storage, `covers/${jobId}_${Date.now()}.jpg`);
                await uploadBytes(storageRef, compressedBlob);
                coverUrl = await getDownloadURL(storageRef);
            }

            // 2. Update Firestore
            await updateDoc(doc(db, "photography_jobs", jobId), {
                driveLink: finalDriveLink,
                coverImage: coverUrl,
                status: 'completed',
                updatedAt: serverTimestamp()
            });

            toast.success("ส่งงานเรียบร้อยแล้ว!");
            // Reset state
            setCoverFiles(prev => { const n = { ...prev }; delete n[jobId]; return n; });
            setJobFiles(prev => { const n = { ...prev }; delete n[jobId]; return n; });
            setIsUploadComplete(prev => { const n = { ...prev }; delete n[jobId]; return n; });

        } catch (error) {
            console.error("Error submitting job:", error);
            toast.error("เกิดข้อผิดพลาดในการส่งงาน");
        } finally {
            setSubmittingId(null);
            setUploadProgress(prev => ({ ...prev, [jobId]: 0 }));
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">📸</span>
                                    งานถ่ายภาพของฉัน
                                </h2>
                                <button onClick={onClose}>
                                    <X size={24} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                {loading ? (
                                    <div className="text-center py-8 text-gray-400">Loading...</div>
                                ) : jobs.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 flex flex-col items-center">
                                        <CheckCircle2 size={48} className="mb-4 opacity-20" />
                                        <p>ไม่มีงานที่ได้รับมอบหมายในขณะนี้</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {jobs.map((job) => (
                                            <div key={job.id} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{job.title}</h3>
                                                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                            <div className="flex items-center gap-1">
                                                                <Calendar size={14} />
                                                                <span>
                                                                    {job.startTime?.toDate().toLocaleDateString('th-TH')} {job.startTime?.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <MapPin size={14} />
                                                                <span>{job.location}</span>
                                                            </div>
                                                        </div>
                                                        {job.description && (
                                                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 bg-white dark:bg-gray-800 p-2 rounded-lg inline-block">
                                                                {job.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-4 w-full">
                                                    {/* Cover Image Upload */}
                                                    {/* 1. Cover Image Section */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                            <ImageIcon size={16} className="text-pink-500" />
                                                            1. รูปปกงาน (1 รูป)
                                                            <span className="text-xs text-gray-400 font-normal">*แสดงหน้า Feed</span>
                                                        </label>
                                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-pink-200 dark:border-pink-900 rounded-2xl cursor-pointer hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors relative overflow-hidden bg-white dark:bg-gray-800">
                                                            {coverPreviews[job.id!] ? (
                                                                <img src={coverPreviews[job.id!]} className="w-full h-full object-cover" alt="Cover Preview" />
                                                            ) : (
                                                                <div className="flex flex-col items-center text-pink-400">
                                                                    <ImageIcon size={24} className="mb-1" />
                                                                    <span className="text-xs">เลือกรูปปก</span>
                                                                </div>
                                                            )}
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={(e) => handleCoverChange(job.id!, e)}
                                                            />
                                                        </label>
                                                    </div>

                                                    {/* 2. Job Images Section */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                            <UploadCloud size={16} className="text-blue-500" />
                                                            2. รูปภาพกิจกรรม (หลายรูป)
                                                            <span className="text-xs text-gray-400 font-normal">*อัปโหลดเข้า Drive</span>
                                                        </label>

                                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors bg-white dark:bg-gray-800">
                                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                                <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
                                                                <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                                                    <span className="font-semibold">เพิ่มรูปภาพกิจกรรม</span>
                                                                </p>
                                                            </div>
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                multiple
                                                                accept="image/*"
                                                                onChange={(e) => handleJobFilesChange(job.id!, e)}
                                                            />
                                                        </label>

                                                        {/* Selected Files Preview Grid */}
                                                        {(previews[job.id!]?.length > 0) && (
                                                            <div className="mt-4 grid grid-cols-4 gap-2">
                                                                {previews[job.id!]?.map((src, index) => (
                                                                    <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                                                        <img src={src} className="w-full h-full object-cover" alt={`preview-${index}`} />
                                                                        <button
                                                                            onClick={() => removeFile(job.id!, index)}
                                                                            className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 3. Upload Action */}
                                                    {(coverFiles[job.id!] || (jobFiles[job.id!]?.length > 0)) && (
                                                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">ความคืบหน้าการอัปโหลด</span>
                                                                <span className="text-xs text-gray-500">{uploadProgress[job.id!] || 0}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden mb-3">
                                                                <div
                                                                    className={`h-2 rounded-full transition-all duration-300 ${isUploadComplete[job.id!] ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                                                    style={{ width: `${uploadProgress[job.id!] || 0}%` }}
                                                                ></div>
                                                            </div>

                                                            {!isUploadComplete[job.id!] ? (
                                                                <button
                                                                    onClick={() => handleUpload(job.id!)}
                                                                    disabled={isUploading[job.id!]}
                                                                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                                                >
                                                                    <UploadCloud size={14} />
                                                                    {isUploading[job.id!] ? 'กำลังอัปโหลด...' : 'เริ่มอัปโหลดไฟล์'}
                                                                </button>
                                                            ) : (
                                                                <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium py-2">
                                                                    <CheckCircle2 size={16} />
                                                                    อัปโหลดเสร็จสิ้น พร้อมส่งงาน
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Optional Link Fallback */}
                                                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                                        <button
                                                            onClick={() => {
                                                                const el = document.getElementById(`link-input-${job.id}`);
                                                                if (el) el.classList.toggle('hidden');
                                                            }}
                                                            className="text-xs text-blue-500 hover:text-blue-600 underline flex items-center gap-1"
                                                        >
                                                            <ExternalLink size={12} />
                                                            หรือแแนบลิงก์ Google Drive โดยตรง (กรณีอัปโหลดแล้ว)
                                                        </button>
                                                        <input
                                                            id={`link-input-${job.id}`}
                                                            type="url"
                                                            value={driveLinks[job.id!] || ''}
                                                            onChange={(e) => handleLinkChange(job.id!, e.target.value)}
                                                            placeholder="https://drive.google.com/..."
                                                            className="hidden mt-2 w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={() => handleSubmit(job.id!)}
                                                        disabled={submittingId === job.id}
                                                        className="w-full sm:w-auto self-end px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                                                    >
                                                        {submittingId === job.id ? 'กำลังส่ง...' : 'ส่งงาน'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
