import React, { useState, useEffect } from "react";
import { X, Calendar, MapPin, ExternalLink, Save, CheckCircle2, UploadCloud, Image as ImageIcon, Facebook } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import { PhotographyJob } from "../../types";
import { compressImage } from "@/utils/imageCompression";

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

    // Facebook State
    const [facebookEnabled, setFacebookEnabled] = useState<Record<string, boolean>>({});
    const [facebookSent, setFacebookSent] = useState<Record<string, boolean>>({});
    const [facebookCaption, setFacebookCaption] = useState<Record<string, string>>({});
    const [facebookSelectedOrder, setFacebookSelectedOrder] = useState<Record<string, number[]>>({}); // Array to preserve order
    const [uploadedFileIds, setUploadedFileIds] = useState<Record<string, string[]>>({});
    const [lastClickedIndex, setLastClickedIndex] = useState<Record<string, number>>({}); // For Shift+Click


    // Drag and Drop State
    const [isDraggingCover, setIsDraggingCover] = useState<Record<string, boolean>>({});
    const [isDraggingFiles, setIsDraggingFiles] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!isOpen || !userId) return;

        const q = query(
            collection(db, "photography_jobs"),
            where("assigneeIds", "array-contains", userId),
            where("status", "==", "assigned"),
            orderBy("startTime", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedJobs: PhotographyJob[] = [];
            snapshot.forEach((doc) => {
                fetchedJobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
            });
            setJobs(fetchedJobs);
            setLoading(false);
        }, (error) => {
            console.error("Firestore query error:", error);
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

    // Helper to process cover file
    const processCoverFile = (jobId: string, file: File) => {
        if (file && file.type.startsWith('image/')) {
            setCoverFiles(prev => ({ ...prev, [jobId]: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreviews(prev => ({ ...prev, [jobId]: reader.result as string }));
            };
            reader.readAsDataURL(file);
            setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
        } else {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
        }
    };

    // Helper to process job files
    const processJobFiles = (jobId: string, newFiles: File[]) => {
        const validFiles = newFiles.filter(file => file.type.startsWith('image/'));

        if (validFiles.length < newFiles.length) {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น (ไฟล์ที่ไม่ใช่รูปภาพถูกข้าม)");
        }

        if (validFiles.length > 0) {
            setJobFiles(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...validFiles] }));

            const newPreviews = validFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...newPreviews] }));

            setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
        }
    };

    const handleCoverChange = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processCoverFile(jobId, file);
        }
    };

    const handleJobFilesChange = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            processJobFiles(jobId, files);
        }
    };

    // Drag Handlers for Cover
    const handleCoverDragOver = (jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingCover[jobId]) {
            setIsDraggingCover(prev => ({ ...prev, [jobId]: true }));
        }
    };

    const handleCoverDragLeave = (jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only trigger if leaving the actual container, not entering a child
        const relatedTarget = e.relatedTarget as Node;
        if (!e.currentTarget.contains(relatedTarget)) {
            setIsDraggingCover(prev => ({ ...prev, [jobId]: false }));
        }
    };

    const handleCoverDrop = (jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingCover(prev => ({ ...prev, [jobId]: false }));

        const file = e.dataTransfer.files?.[0];
        if (file) {
            processCoverFile(jobId, file);
        }
    };

    // Drag Handlers for Job Files
    const handleJobFilesDragOver = (jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingFiles[jobId]) {
            setIsDraggingFiles(prev => ({ ...prev, [jobId]: true }));
        }
    };

    const handleJobFilesDragLeave = (jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only trigger if leaving the actual container, not entering a child
        const relatedTarget = e.relatedTarget as Node;
        if (!e.currentTarget.contains(relatedTarget)) {
            setIsDraggingFiles(prev => ({ ...prev, [jobId]: false }));
        }
    };

    const handleJobFilesDrop = (jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFiles(prev => ({ ...prev, [jobId]: false }));

        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
            processJobFiles(jobId, files);
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

    // Facebook Helpers
    const handleFacebookToggle = (jobId: string) => {
        setFacebookEnabled(prev => ({ ...prev, [jobId]: !prev[jobId] }));
    };

    const handleFacebookPhotoClick = (jobId: string, index: number, shiftKey: boolean) => {
        setFacebookSelectedOrder(prev => {
            const current = [...(prev[jobId] || [])];

            if (shiftKey && lastClickedIndex[jobId] !== undefined) {
                // Shift+Click: select range (append in order)
                const start = Math.min(lastClickedIndex[jobId], index);
                const end = Math.max(lastClickedIndex[jobId], index);
                for (let i = start; i <= end; i++) {
                    if (!current.includes(i)) {
                        current.push(i);
                    }
                }
            } else {
                // Normal click: toggle
                const existingIdx = current.indexOf(index);
                if (existingIdx !== -1) {
                    current.splice(existingIdx, 1); // Remove
                } else {
                    current.push(index); // Add at end
                }
            }

            return { ...prev, [jobId]: current };
        });
        setLastClickedIndex(prev => ({ ...prev, [jobId]: index }));
    };

    const selectFirstN = (jobId: string, n: number) => {
        const totalPhotos = previews[jobId]?.length || 0;
        const indices: number[] = [];
        for (let i = 0; i < Math.min(n, totalPhotos); i++) {
            indices.push(i);
        }
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: indices }));
    };

    const selectAll = (jobId: string) => {
        const totalPhotos = previews[jobId]?.length || 0;
        const indices: number[] = [];
        for (let i = 0; i < totalPhotos; i++) {
            indices.push(i);
        }
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: indices }));
    };

    const selectNone = (jobId: string) => {
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: [] }));
    };

    const postToFacebook = async (jobId: string) => {
        const selectedOrder = facebookSelectedOrder[jobId];
        const fileIds = uploadedFileIds[jobId];

        if (!selectedOrder || selectedOrder.length === 0) {
            toast.error('กรุณาเลือกรูปสำหรับโพส Facebook');
            throw new Error('No photos selected');
        }

        if (!fileIds || fileIds.length === 0) {
            toast.error('กรุณาอัปโหลดรูปขึ้น Drive ก่อนโพส Facebook');
            throw new Error('No uploaded files');
        }

        const loadingId = toast.loading('กำลังโพสลง Facebook...', { id: `fb-${jobId}` });
        try {
            // Convert file IDs to Drive URLs (preserving click order)
            const photoUrls = selectedOrder
                .filter(idx => fileIds[idx]) // Ensure file ID exists
                .map(idx => `https://drive.google.com/file/d/${fileIds[idx]}/view`);

            if (photoUrls.length === 0) {
                throw new Error('ไม่พบ URL ของรูปที่เลือก');
            }

            const res = await fetch('/api/facebook/post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId,
                    caption: facebookCaption[jobId] || '',
                    photoUrls
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to post');
            }

            setFacebookSent(prev => ({ ...prev, [jobId]: true }));
            toast.success('โพสลง Facebook เรียบร้อย!', { id: `fb-${jobId}` });

        } catch (error: any) {
            console.error('Facebook Post Error', error);
            toast.error(`โพส Facebook ไม่สำเร็จ: ${error.message}`, { id: `fb-${jobId}` });
            throw error;
        }
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

            // Upload Files to Drive API (Resumable Flow)
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];

                // 1. Initiate Upload Session (Get URL)
                const initResponse = await fetch('/api/drive/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: file.name,
                        mimeType: file.type,
                        eventName: job.title,
                        jobDate: job.startTime ? job.startTime.toDate().toISOString() : new Date().toISOString()
                    }),
                });

                if (!initResponse.ok) {
                    const error = await initResponse.json();
                    throw new Error(error.error || 'Failed to initiate upload');
                }

                const { uploadUrl, folderLink } = await initResponse.json();

                // 2. Direct Upload to Google Drive
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: {
                        'Content-Type': file.type,
                    },
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload file to Google Drive');
                }

                // Capture file ID from Google's response
                const uploadResult = await uploadResponse.json();
                if (uploadResult.id) {
                    setUploadedFileIds(prev => ({
                        ...prev,
                        [jobId]: [...(prev[jobId] || []), uploadResult.id]
                    }));
                }

                // Capture the folder link from the first successful upload
                if (!driveFolderLink && folderLink) {
                    driveFolderLink = folderLink;
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
                toast.loading('กำลังบีบอัดภาพปก...', { id: 'compress-cover' });
                const compressedFile = await compressImage(coverFiles[jobId], {
                    maxWidth: 1200,
                    maxHeight: 800,
                    quality: 0.8,
                    maxSizeMB: 0.3
                });
                toast.dismiss('compress-cover');

                const storageRef = ref(storage, `covers/${jobId}_${Date.now()}.jpg`);
                await uploadBytes(storageRef, compressedFile);
                coverUrl = await getDownloadURL(storageRef);
            }

            // 2. Facebook Post (if enabled and not already sent)
            if (facebookEnabled[jobId] && !facebookSent[jobId]) {
                await postToFacebook(jobId);
            }

            // 3. Update Firestore (Drive link updated here again to be safe, but main status update)
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
            // Reset Facebook state
            setFacebookEnabled(prev => { const n = { ...prev }; delete n[jobId]; return n; });
            setFacebookSent(prev => { const n = { ...prev }; delete n[jobId]; return n; });
            setFacebookSelectedOrder(prev => { const n = { ...prev }; delete n[jobId]; return n; });
            setUploadedFileIds(prev => { const n = { ...prev }; delete n[jobId]; return n; });



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
                                                        <label
                                                            onDragOver={(e) => handleCoverDragOver(job.id!, e)}
                                                            onDragLeave={(e) => handleCoverDragLeave(job.id!, e)}
                                                            onDrop={(e) => handleCoverDrop(job.id!, e)}
                                                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 relative overflow-hidden ${isDraggingCover[job.id!]
                                                                ? "border-pink-500 bg-pink-50 dark:bg-pink-900/30 ring-2 ring-pink-500 ring-offset-2 scale-[1.02]"
                                                                : "border-pink-200 dark:border-pink-900 hover:bg-pink-50 dark:hover:bg-pink-900/20 bg-white dark:bg-gray-800"
                                                                }`}>
                                                            {coverPreviews[job.id!] ? (
                                                                <img src={coverPreviews[job.id!]} className="w-full h-full object-cover" alt="Cover Preview" />
                                                            ) : (
                                                                <div className="flex flex-col items-center text-pink-400">
                                                                    <ImageIcon size={24} className="mb-1" />
                                                                    <span className="text-xs">เลือกรูปปก (ลากวางได้)</span>
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

                                                        <label
                                                            onDragOver={(e) => handleJobFilesDragOver(job.id!, e)}
                                                            onDragLeave={(e) => handleJobFilesDragLeave(job.id!, e)}
                                                            onDrop={(e) => handleJobFilesDrop(job.id!, e)}
                                                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${isDraggingFiles[job.id!]
                                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 ring-offset-2 scale-[1.02]"
                                                                : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800"
                                                                }`}>
                                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                                <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
                                                                <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                                                    <span className="font-semibold">เพิ่มรูปภาพกิจกรรม (ลากวางได้)</span>
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

                                                    {/* 4. Facebook Integration Section */}
                                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                                        <label className="flex items-center gap-2 cursor-pointer mb-3 select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={facebookEnabled[job.id!] || false}
                                                                onChange={() => handleFacebookToggle(job.id!)}
                                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                            />
                                                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                                                                <Facebook size={18} />
                                                                โพสลงเพจ Facebook โรงเรียน
                                                            </div>
                                                        </label>

                                                        {facebookEnabled[job.id!] && (
                                                            <div className="space-y-4 pl-6 border-l-2 border-blue-100 dark:border-blue-900/50 ml-2">
                                                                {/* Caption Input */}
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                        Caption
                                                                    </label>
                                                                    <textarea
                                                                        value={facebookCaption[job.id!] || ''}
                                                                        onChange={(e) => setFacebookCaption(prev => ({ ...prev, [job.id!]: e.target.value }))}
                                                                        rows={4}
                                                                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                                                                        placeholder="เขียนข้อความสำหรับโพส..."
                                                                    />
                                                                </div>

                                                                {/* Photo Selection from Main Preview */}
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                                                            เลือกรูปสำหรับโพส ({facebookSelectedOrder[job.id!]?.length || 0} รูป)
                                                                        </label>
                                                                        <div className="flex gap-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => selectFirstN(job.id!, 50)}
                                                                                className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                                                                            >
                                                                                50 รูปแรก
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => selectAll(job.id!)}
                                                                                className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                                                                            >
                                                                                ทั้งหมด
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => selectNone(job.id!)}
                                                                                className="px-2 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                                                                            >
                                                                                ยกเลิก
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {isUploadComplete[job.id!] ? (
                                                                        <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                                            {previews[job.id!]?.map((src: string, index: number) => {
                                                                                const orderIndex = facebookSelectedOrder[job.id!]?.indexOf(index);
                                                                                const isSelected = orderIndex !== undefined && orderIndex !== -1;
                                                                                const orderNumber = isSelected ? orderIndex + 1 : null;
                                                                                return (
                                                                                    <div
                                                                                        key={index}
                                                                                        onClick={(e) => handleFacebookPhotoClick(job.id!, index, e.shiftKey)}
                                                                                        className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${isSelected
                                                                                            ? 'border-blue-500 ring-2 ring-blue-300'
                                                                                            : 'border-transparent hover:border-gray-300'
                                                                                            }`}
                                                                                    >
                                                                                        <img src={src} className="w-full h-full object-cover" alt={`select-${index}`} />
                                                                                        {isSelected && (
                                                                                            <div className="absolute inset-0 bg-blue-500/40 flex items-center justify-center">
                                                                                                <span className="text-white font-bold text-lg drop-shadow-lg">{orderNumber}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                                            กรุณาอัปโหลดรูปขึ้น Drive ก่อน<br />
                                                                            <span className="text-[10px]">(Shift+Click เพื่อเลือกเป็นช่วง)</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => handleSubmit(job.id!)}
                                                        disabled={submittingId === job.id}
                                                        className={`w-full sm:w-auto self-end px-6 py-2 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50
                                                            ${(facebookEnabled[job.id!] && !facebookSent[job.id!]) ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}
                                                        `}
                                                    >
                                                        {submittingId === job.id ? 'กำลังส่ง...' : (facebookEnabled[job.id!] ? 'ส่งงาน + โพส Facebook' : 'ส่งงาน')}
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
