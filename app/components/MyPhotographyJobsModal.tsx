import React, { useState, useEffect } from "react";
import { X, Calendar, MapPin, ExternalLink, Save, CheckCircle2, UploadCloud, Image as ImageIcon, Facebook } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, storage, auth } from "../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import { PhotographyJob } from "../../types";
import { compressImage, compressImageToSize } from "@/utils/imageCompression";
import { getBangkokDateString } from "@/lib/dateUtils";

interface MyPhotographyJobsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    selectedJobId?: string | null; // When provided, show only this job (Single Job Mode)
}

export default function MyPhotographyJobsModal({ isOpen, onClose, userId, selectedJobId }: MyPhotographyJobsModalProps) {
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
    const [facebookDraftMode, setFacebookDraftMode] = useState<Record<string, boolean>>({}); // true = save as draft, false = publish immediately
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

    const processCoverFile = (jobId: string, file: File) => {
        if (file && file.type.startsWith('image/')) {
            setCoverFiles(prev => ({ ...prev, [jobId]: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreviews(prev => ({ ...prev, [jobId]: reader.result as string }));
            };
            reader.readAsDataURL(file);
        } else {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
        }
    };

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
        if (file) processCoverFile(jobId, file);
    };

    const handleJobFilesChange = (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) processJobFiles(jobId, files);
    };

    // --- Drag & Drop Handlers (ย่อรูปเพื่อความกระชับ) ---
    const handleCoverDragOver = (jobId: string, e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!isDraggingCover[jobId]) setIsDraggingCover(prev => ({ ...prev, [jobId]: true })); };
    const handleCoverDragLeave = (jobId: string, e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); const relatedTarget = e.relatedTarget as Node; if (!e.currentTarget.contains(relatedTarget)) setIsDraggingCover(prev => ({ ...prev, [jobId]: false })); };
    const handleCoverDrop = (jobId: string, e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingCover(prev => ({ ...prev, [jobId]: false })); const file = e.dataTransfer.files?.[0]; if (file) processCoverFile(jobId, file); };
    const handleJobFilesDragOver = (jobId: string, e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!isDraggingFiles[jobId]) setIsDraggingFiles(prev => ({ ...prev, [jobId]: true })); };
    const handleJobFilesDragLeave = (jobId: string, e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); const relatedTarget = e.relatedTarget as Node; if (!e.currentTarget.contains(relatedTarget)) setIsDraggingFiles(prev => ({ ...prev, [jobId]: false })); };
    const handleJobFilesDrop = (jobId: string, e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFiles(prev => ({ ...prev, [jobId]: false })); const files = Array.from(e.dataTransfer.files || []); if (files.length > 0) processJobFiles(jobId, files); };

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
        setFacebookSelectedOrder(prev => {
            const current = prev[jobId] || [];
            // Remove the index and shift others
            return { ...prev, [jobId]: current.filter(i => i !== index).map(i => i > index ? i - 1 : i) };
        });
        setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
    };

    // --- Facebook Logic ---
    const handleFacebookToggle = (jobId: string) => {
        setFacebookEnabled(prev => ({ ...prev, [jobId]: !prev[jobId] }));
    };

    const handleFacebookPhotoClick = (jobId: string, index: number, shiftKey: boolean) => {
        setFacebookSelectedOrder(prev => {
            const current = [...(prev[jobId] || [])];
            if (shiftKey && lastClickedIndex[jobId] !== undefined) {
                const start = Math.min(lastClickedIndex[jobId], index);
                const end = Math.max(lastClickedIndex[jobId], index);
                for (let i = start; i <= end; i++) {
                    if (!current.includes(i)) current.push(i);
                }
            } else {
                const existingIdx = current.indexOf(index);
                if (existingIdx !== -1) current.splice(existingIdx, 1);
                else current.push(index);
            }
            return { ...prev, [jobId]: current };
        });
        setLastClickedIndex(prev => ({ ...prev, [jobId]: index }));
    };

    const selectFirstN = (jobId: string, n: number) => {
        const totalPhotos = previews[jobId]?.length || 0;
        const indices = Array.from({ length: Math.min(n, totalPhotos) }, (_, i) => i);
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: indices }));
    };

    const selectAll = (jobId: string) => {
        const totalPhotos = previews[jobId]?.length || 0;
        const indices = Array.from({ length: totalPhotos }, (_, i) => i);
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: indices }));
    };

    const selectNone = (jobId: string) => {
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: [] }));
    };

    // --- Core Logic: Internal Drive Upload Function (PARALLEL with Pre-created Folder) ---
    // คืนค่า list ของ fileIds ที่อัปโหลดเสร็จแล้ว
    const performDriveUpload = async (jobId: string, jobTitle: string, jobDate: any): Promise<{ ids: string[], folderLink: string }> => {
        const files = jobFiles[jobId] || [];
        if (files.length === 0) return { ids: [], folderLink: "" };

        // Get Firebase Auth Token for API authentication
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('User not authenticated');
        const idToken = await currentUser.getIdToken();

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        };

        // STEP 1: Pre-create folder hierarchy (ONCE, prevents race condition)
        const prepareResponse = await fetch('/api/drive/prepare-folder', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                eventName: jobTitle,
                jobDate: jobDate
            }),
        });

        if (!prepareResponse.ok) {
            const error = await prepareResponse.json();
            throw new Error(error.error || 'Failed to prepare folder');
        }
        const { folderId, folderLink } = await prepareResponse.json();

        // STEP 2: Upload files in PARALLEL (safe because folder already exists)
        const BATCH_SIZE = 5;
        const uploadedIds: string[] = [];
        let completedCount = 0;
        const totalFiles = files.length;

        // Process files in batches
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (file) => {
                // Get upload URL from our API
                const initResponse = await fetch('/api/drive/upload-to-folder', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        fileName: file.name,
                        mimeType: file.type,
                        folderId: folderId
                    }),
                });

                if (!initResponse.ok) {
                    let errorMessage;
                    try {
                        const error = await initResponse.json();
                        errorMessage = error.error;
                    } catch (e) {
                        const text = await initResponse.text();
                        errorMessage = `Server Error (${initResponse.status}): ${text.slice(0, 50)}`;
                    }
                    throw new Error(errorMessage || `Failed to initiate upload for ${file.name}`);
                }
                const { uploadUrl } = await initResponse.json();

                // Upload file content directly to Google Drive
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': file.type },
                });

                if (!uploadResponse.ok) throw new Error(`Failed to upload ${file.name} to Google Drive`);
                const uploadResult = await uploadResponse.json();

                return uploadResult.id || null;
            }));

            // Collect successful uploads
            batchResults.forEach(id => {
                if (id) uploadedIds.push(id);
                completedCount++;
                setUploadProgress(prev => ({ ...prev, [jobId]: Math.round((completedCount / totalFiles) * 100) }));
            });
        }

        return { ids: uploadedIds, folderLink: folderLink };
    };

    // Helper: Convert File to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:image/...;base64, prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const performFacebookPost = async (jobId: string, _fileIds: string[]) => {
        const selectedOrder = facebookSelectedOrder[jobId];
        if (!selectedOrder || selectedOrder.length === 0) return;

        const files = jobFiles[jobId];
        if (!files || files.length === 0) throw new Error('ไม่พบไฟล์สำหรับ Facebook');

        const asDraft = facebookDraftMode[jobId] || false;
        const caption = facebookCaption[jobId] || '';

        // Upload photos one by one to avoid 413 Payload Too Large
        const photoIds: string[] = [];

        for (let i = 0; i < selectedOrder.length; i++) {
            const idx = selectedOrder[i];
            const file = files[idx];
            if (!file) continue;

            // Always compress for Facebook to stay under Vercel 4.5MB limit
            // (3MB file → ~4MB after base64 → under 4.5MB limit)
            let fileToUpload = file;
            // Use compressImageToSize to GUARANTEE file size is small enough
            // Vercel Serverless Function Limit: 4.5MB (Body)
            // Base64 overhead is ~33%. So max safe file size is ~3.3MB.
            // We set target to 2.5MB to be safe and leave room for JSON overhead.
            fileToUpload = await compressImageToSize(file, 2.5, 0.7);

            const base64 = await fileToBase64(fileToUpload);

            // Upload single photo
            const res = await fetch('/api/facebook/upload-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photo: { base64, mimeType: fileToUpload.type },
                    published: false // Always unpublished first
                })
            });

            if (!res.ok) {
                let errorMessage;
                try {
                    const error = await res.json();
                    errorMessage = error.error;
                } catch (e) {
                    const text = await res.text();
                    if (res.status === 413 || text.includes('PAYLOAD_TOO_LARGE')) {
                        errorMessage = "รูปภาพมีขนาดใหญ่เกินไป (413 Payload Too Large) - กรุณาลดขนาดไฟล์";
                    } else if (res.status === 504) {
                        errorMessage = "การเชื่อมต่อหมดเวลา (504 Gateway Timeout) - กรุณาลองใหม่";
                    } else {
                        errorMessage = `Upload Error (${res.status}): ${text.substring(0, 100)}`;
                    }
                }
                throw new Error(errorMessage || `Failed to upload photo ${i + 1}`);
            }

            const data = await res.json();
            if (data.photoId) photoIds.push(data.photoId);
        }

        if (photoIds.length === 0) throw new Error('ไม่สามารถอัปโหลดภาพไป Facebook ได้');

        // Create post with all uploaded photos
        const postRes = await fetch('/api/facebook/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                caption,
                photoIds, // Send photo IDs instead of base64
                asDraft
            })
        });

        if (!postRes.ok) {
            let errorMessage;
            try {
                const error = await postRes.json();
                errorMessage = error.error;
            } catch (e) {
                const text = await postRes.text();
                errorMessage = `Post Error (${postRes.status}): ${text.substring(0, 100)}`;
            }
            throw new Error(errorMessage || 'Failed to create Facebook post');
        }
    };

    // --- Main Submit Handler (One-Click) ---
    const handleSubmit = async (jobId: string) => {
        // Validation: ต้องมีไฟล์ หรือมี Link อย่างใดอย่างหนึ่ง
        if ((!jobFiles[jobId] || jobFiles[jobId].length === 0) && !driveLinks[jobId]) {
            toast.error("กรุณาเลือกรูปกิจกรรม หรือแนบลิงก์ Google Drive");
            return;
        }

        // ถ้าเลือกจะโพสต์เฟส ต้องเลือกรูปด้วย
        if (facebookEnabled[jobId] && (!facebookSelectedOrder[jobId] || facebookSelectedOrder[jobId].length === 0)) {
            toast.error("กรุณาเลือกรูปที่จะโพสต์ลง Facebook อย่างน้อย 1 รูป");
            return;
        }

        setSubmittingId(jobId);

        const submitPromise = new Promise(async (resolve, reject) => {
            try {
                const job = jobs.find(j => j.id === jobId);
                if (!job) throw new Error("Job not found");

                // --- STEP 1: DRIVE UPLOAD (ถ้ายังไม่ได้อัปโหลด) ---
                let finalDriveLink = driveLinks[jobId];
                let currentFileIds = uploadedFileIds[jobId] || [];

                // ถ้ามีไฟล์รออยู่ และยังไม่ได้กดอัปโหลด -> อัปให้เลยอัตโนมัติ
                if (jobFiles[jobId]?.length > 0 && !isUploadComplete[jobId]) {
                    setIsUploading(prev => ({ ...prev, [jobId]: true }));
                    const { ids, folderLink } = await performDriveUpload(
                        jobId,
                        job.title,
                        job.startTime ? getBangkokDateString(job.startTime.toDate()) : getBangkokDateString()
                    );
                    currentFileIds = ids; // เก็บ IDs ไว้ใช้กับ Facebook
                    finalDriveLink = folderLink; // เก็บ Link ไว้บันทึก

                    setUploadedFileIds(prev => ({ ...prev, [jobId]: ids }));
                    setDriveLinks(prev => ({ ...prev, [jobId]: folderLink }));
                    setIsUploadComplete(prev => ({ ...prev, [jobId]: true }));
                    setIsUploading(prev => ({ ...prev, [jobId]: false }));
                }

                // --- STEP 2: PARALLEL TASKS (Cover & Facebook) ---
                const tasks: Promise<any>[] = [];
                let coverUrl = job.coverImage || ""; // ใช้รูปเดิมถ้าไม่ได้เปลี่ยน

                // Task A: Cover Image Upload
                if (coverFiles[jobId]) {
                    const coverTask = async () => {
                        const compressedFile = await compressImage(coverFiles[jobId], {
                            maxWidth: 1200, maxHeight: 800, quality: 0.8, maxSizeMB: 0.3
                        });
                        const storageRef = ref(storage, `covers/${jobId}_${Date.now()}.jpg`);
                        await uploadBytes(storageRef, compressedFile);
                        return await getDownloadURL(storageRef);
                    };
                    tasks.push(coverTask().then(url => coverUrl = url));
                }

                // Task B: Facebook Post (ต้องใช้ ID จาก Step 1)
                if (facebookEnabled[jobId] && !facebookSent[jobId]) {
                    // เช็คว่ามี IDs จาก Drive ไหม
                    if (currentFileIds.length === 0) {
                        throw new Error("ไม่สามารถโพสต์ Facebook ได้เนื่องจากไม่พบไฟล์ใน Drive");
                    }
                    tasks.push(performFacebookPost(jobId, currentFileIds));
                }

                // รอให้ Cover และ FB เสร็จพร้อมกัน
                await Promise.all(tasks);

                // --- STEP 3: UPDATE DATABASE ---
                await updateDoc(doc(db, "photography_jobs", jobId), {
                    driveLink: finalDriveLink || "https://drive.google.com/drive/folders/MOCK_ID",
                    coverImage: coverUrl,
                    status: 'completed',
                    completedBy: userId,
                    completedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    facebookCaption: facebookCaption[jobId] || null // Save the caption!
                });

                // Clear State
                setCoverFiles(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setJobFiles(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setIsUploadComplete(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setFacebookEnabled(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setFacebookSent(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setFacebookSelectedOrder(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setUploadedFileIds(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setPreviews(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                setCoverPreviews(prev => { const n = { ...prev }; delete n[jobId]; return n; });

                resolve("ส่งงานเรียบร้อยแล้ว!");
            } catch (error: any) {
                console.error("Error submitting job:", error);
                reject(error);
            } finally {
                setSubmittingId(null);
                setIsUploading(prev => ({ ...prev, [jobId]: false }));
                setUploadProgress(prev => ({ ...prev, [jobId]: 0 }));
            }
        });

        toast.promise(submitPromise, {
            loading: 'กำลังประมวลผล... (Google Drive -> Facebook -> Save)',
            success: 'ส่งงานเรียบร้อยแล้ว! 🎉',
            error: (err) => `เกิดข้อผิดพลาด: ${err.message}`
        });
    };

    // === Computed Values ===
    // Filter jobs based on selectedJobId (Single Job Mode)
    const displayJobs = selectedJobId
        ? jobs.filter(j => j.id === selectedJobId)
        : jobs;

    const isSingleJobMode = !!selectedJobId;
    const singleJob = isSingleJobMode && displayJobs.length > 0 ? displayJobs[0] : null;

    // === Stepper State (for Single Job Mode) ===
    const [currentStep, setCurrentStep] = useState(1);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Stepper steps config
    const steps = [
        { id: 1, label: 'รูปปก', icon: ImageIcon },
        { id: 2, label: 'รูปกิจกรรม', icon: UploadCloud },
        { id: 3, label: 'Facebook', icon: Facebook },
        { id: 4, label: 'ยืนยัน', icon: CheckCircle2 },
    ];

    // Get current step validation
    const canProceedFromStep = (step: number, jobId: string) => {
        switch (step) {
            case 1: return true; // Cover is optional
            case 2: return (jobFiles[jobId]?.length > 0) || !!driveLinks[jobId];
            case 3: return !facebookEnabled[jobId] || (facebookSelectedOrder[jobId]?.length > 0);
            case 4: return true;
            default: return true;
        }
    };

    // Handle step navigation
    const goToStep = (step: number) => {
        setCurrentStep(step);
    };

    const nextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    // === Confirmation Dialog ===
    const handleConfirmSubmit = async (jobId: string) => {
        setShowConfirmation(false);
        await handleSubmit(jobId);
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
                            {/* Header - Dynamic based on mode */}
                            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                    <span className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">📸</span>
                                    {isSingleJobMode && singleJob ? (
                                        <div>
                                            <span className="text-sm font-medium text-purple-600 dark:text-purple-400 block">ส่งงาน</span>
                                            <span className="text-base">{singleJob.title}</span>
                                        </div>
                                    ) : (
                                        <>งานถ่ายภาพของฉัน</>
                                    )}
                                </h2>
                                <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <X size={22} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                                </button>
                            </div>

                            {/* Stepper - Only in Single Job Mode */}
                            {isSingleJobMode && singleJob && (
                                <div className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        {steps.map((step, index) => {
                                            const StepIcon = step.icon;
                                            const isActive = currentStep === step.id;
                                            const isCompleted = currentStep > step.id;
                                            const canGo = step.id <= currentStep || canProceedFromStep(step.id - 1, singleJob.id!);

                                            return (
                                                <React.Fragment key={step.id}>
                                                    <button
                                                        onClick={() => canGo && goToStep(step.id)}
                                                        disabled={!canGo}
                                                        className={`flex flex-col items-center gap-1 transition-all ${isActive
                                                            ? 'text-purple-600 dark:text-purple-400'
                                                            : isCompleted
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-gray-300 dark:text-gray-600'
                                                            } ${canGo ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive
                                                            ? 'bg-purple-100 dark:bg-purple-900/50 ring-2 ring-purple-500'
                                                            : isCompleted
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/50'
                                                                : 'bg-gray-100 dark:bg-gray-700'
                                                            }`}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 size={20} />
                                                            ) : (
                                                                <StepIcon size={20} />
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-medium">{step.label}</span>
                                                    </button>
                                                    {index < steps.length - 1 && (
                                                        <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${currentStep > step.id ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'
                                                            }`} />
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Confirmation Dialog Overlay */}
                            <AnimatePresence>
                                {showConfirmation && singleJob && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                                        onClick={() => setShowConfirmation(false)}
                                    >
                                        <motion.div
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.9, opacity: 0 }}
                                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-center mb-6">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg">
                                                    ✓
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ยืนยันส่งงาน?</h3>
                                                <p className="text-gray-500 dark:text-gray-400 text-sm">{singleJob.title}</p>
                                            </div>

                                            <div className="space-y-3 mb-6 text-sm">
                                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                    <span className="text-gray-600 dark:text-gray-400">รูปปก</span>
                                                    <span className={`font-medium ${coverFiles[singleJob.id!] ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                        {coverFiles[singleJob.id!] ? '✓ เลือกแล้ว' : 'ไม่มี'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                    <span className="text-gray-600 dark:text-gray-400">รูปกิจกรรม</span>
                                                    <span className="font-medium text-emerald-600">
                                                        {jobFiles[singleJob.id!]?.length || 0} รูป
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                    <span className="text-gray-600 dark:text-gray-400">โพส Facebook</span>
                                                    <span className={`font-medium ${facebookEnabled[singleJob.id!] ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {facebookEnabled[singleJob.id!]
                                                            ? `✓ ${facebookSelectedOrder[singleJob.id!]?.length || 0} รูป ${facebookDraftMode[singleJob.id!] ? '(Draft)' : ''}`
                                                            : 'ไม่โพส'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setShowConfirmation(false)}
                                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    ยกเลิก
                                                </button>
                                                <button
                                                    onClick={() => handleConfirmSubmit(singleJob.id!)}
                                                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium shadow-lg hover:shadow-xl transition-all"
                                                >
                                                    ยืนยันส่งงาน
                                                </button>
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="p-6 overflow-y-auto flex-1">
                                {loading ? (
                                    <div className="text-center py-8 text-gray-400">Loading...</div>
                                ) : displayJobs.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 flex flex-col items-center">
                                        <CheckCircle2 size={48} className="mb-4 opacity-20" />
                                        <p>{isSingleJobMode ? 'ไม่พบงานที่เลือก' : 'ไม่มีงานที่ได้รับมอบหมายในขณะนี้'}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {displayJobs.map((job) => (
                                            <div key={job.id} className={`rounded-2xl border border-gray-100 dark:border-gray-700 ${isSingleJobMode ? '' : 'p-4 bg-gray-50 dark:bg-gray-700/30'}`}>
                                                {/* Job Header - Hide in single job mode (shown in main header) */}
                                                {!isSingleJobMode && (
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
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-4 w-full">
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
                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleCoverChange(job.id!, e)} />
                                                        </label>
                                                    </div>

                                                    {/* 2. Job Images Section */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                            <UploadCloud size={16} className="text-blue-500" />
                                                            2. รูปภาพกิจกรรม (Google Drive)
                                                            <span className="text-xs text-gray-400 font-normal">*ระบบจะอัปให้อัตโนมัติเมื่อกดส่ง</span>
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
                                                            <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleJobFilesChange(job.id!, e)} />
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

                                                    {/* Upload Progress Bar (Show when submitting) */}
                                                    {(submittingId === job.id || isUploading[job.id!]) && (
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span>กำลังอัปโหลดขึ้น Google Drive...</span>
                                                                <span>{uploadProgress[job.id!] || 0}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                                                                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress[job.id!] || 0}%` }}></div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Optional Link Fallback */}
                                                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                                        <button
                                                            onClick={() => { const el = document.getElementById(`link-input-${job.id}`); if (el) el.classList.toggle('hidden'); }}
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
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Caption</label>
                                                                    <textarea
                                                                        value={facebookCaption[job.id!] || ''}
                                                                        onChange={(e) => setFacebookCaption(prev => ({ ...prev, [job.id!]: e.target.value }))}
                                                                        rows={4}
                                                                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                                                                        placeholder="เขียนข้อความสำหรับโพส..."
                                                                    />
                                                                </div>

                                                                {/* Draft Mode Toggle */}
                                                                <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={facebookDraftMode[job.id!] || false}
                                                                            onChange={() => setFacebookDraftMode(prev => ({ ...prev, [job.id!]: !prev[job.id!] }))}
                                                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                                                        />
                                                                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                                                            บันทึกเป็น Draft (ไม่เผยแพร่ทันที)
                                                                        </span>
                                                                    </label>
                                                                    {facebookDraftMode[job.id!] && (
                                                                        <span className="text-xs text-amber-600 dark:text-amber-500">
                                                                            • Admin สามารถตรวจสอบและกด Publish ในหน้า Facebook Page ได้
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                                                            เลือกรูปสำหรับโพส ({facebookSelectedOrder[job.id!]?.length || 0} รูป)
                                                                        </label>
                                                                        <div className="flex gap-1">
                                                                            <button type="button" onClick={() => selectFirstN(job.id!, 50)} className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">50 รูปแรก</button>
                                                                            <button type="button" onClick={() => selectAll(job.id!)} className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">ทั้งหมด</button>
                                                                            <button type="button" onClick={() => selectNone(job.id!)} className="px-2 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400">ยกเลิก</button>
                                                                        </div>
                                                                    </div>

                                                                    {/* [MODIFIED] แสดงรูปให้เลือกได้ทันที แม้ยังไม่อัปโหลด */}
                                                                    {previews[job.id!]?.length > 0 ? (
                                                                        <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                                            {previews[job.id!]?.map((src: string, index: number) => {
                                                                                const orderIndex = facebookSelectedOrder[job.id!]?.indexOf(index);
                                                                                const isSelected = orderIndex !== undefined && orderIndex !== -1;
                                                                                const orderNumber = isSelected ? orderIndex + 1 : null;
                                                                                return (
                                                                                    <div
                                                                                        key={index}
                                                                                        onClick={(e) => handleFacebookPhotoClick(job.id!, index, e.shiftKey)}
                                                                                        className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:border-gray-300'}`}
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
                                                                        <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">กรุณาเลือกรูปภาพกิจกรรมในข้อ 2 ก่อน</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            if (isSingleJobMode) {
                                                                setShowConfirmation(true);
                                                            } else {
                                                                handleSubmit(job.id!);
                                                            }
                                                        }}
                                                        disabled={submittingId === job.id}
                                                        className={`w-full sm:w-auto self-end px-6 py-2.5 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all
                                                            ${(facebookEnabled[job.id!] && !facebookSent[job.id!])
                                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-purple-500/30 hover:shadow-xl'
                                                                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:shadow-blue-500/30 hover:shadow-xl'}
                                                        `}
                                                    >
                                                        {submittingId === job.id ? 'กำลังประมวลผล...' : (facebookEnabled[job.id!] ? 'ส่งงาน + อัปโหลด + โพสต์ Facebook' : 'ส่งงาน + อัปโหลด')}
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