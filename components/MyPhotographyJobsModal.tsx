import React, { useState, useEffect } from "react";
import { X, Calendar, MapPin, ExternalLink, Save, CheckCircle2, UploadCloud, Image as ImageIcon, Facebook, XCircle, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db, storage, auth } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import { PhotographyJob } from "@/types";
import { compressImage } from "@/utils/imageCompression";
import { getBangkokDateString } from "@/lib/dateUtils";
import { usePhotographyJobUpload } from "@/hooks/usePhotographyJobUpload";
import { usePhotographyFacebook, removeFromFacebookSelection } from "@/hooks/usePhotographyFacebook";

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

    // === Use extracted hooks ===
    const upload = usePhotographyJobUpload();
    const fb = usePhotographyFacebook();

    // Wrap removeFile to also clean Facebook selection
    const handleRemoveFile = (jobId: string, index: number) => {
        upload.removeFile(jobId, index);
        removeFromFacebookSelection(fb.setFacebookSelectedOrder, jobId, index);
    };

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

    // Auto-close modal when selected job is completed
    useEffect(() => {
        if (selectedJobId && isOpen && jobs.length > 0) {
            const currentJob = jobs.find(j => j.id === selectedJobId);
            if (!currentJob) {
                toast.success('งานส่งเสร็จเรียบร้อยแล้ว! 🎉');
                onClose();
            }
        }
    }, [jobs, selectedJobId, isOpen, onClose]);

    // --- Main Submit Handler (One-Click) ---
    const handleSubmit = async (jobId: string) => {
        // IDEMPOTENCY CHECK 1: Prevent double submission
        if (submittingId === jobId) {
            console.warn('Submission already in progress for job:', jobId);
            return;
        }

        // IDEMPOTENCY CHECK 2: Check if job is already completed
        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            toast.error("ไม่พบงานที่ต้องการส่ง");
            return;
        }
        if (job.status === 'completed') {
            toast.success("งานนี้ส่งเสร็จแล้ว");
            return;
        }

        // Validation: ต้องมีไฟล์ หรือมี Link อย่างใดอย่างหนึ่ง
        if ((!upload.jobFiles[jobId] || upload.jobFiles[jobId].length === 0) && !upload.driveLinks[jobId]) {
            toast.error("กรุณาเลือกรูปกิจกรรม หรือแนบลิงก์ Google Drive");
            return;
        }

        // ถ้าเลือกจะโพสต์เฟส ต้องเลือกรูปด้วย
        if (fb.facebookEnabled[jobId] && (!fb.facebookSelectedOrder[jobId] || fb.facebookSelectedOrder[jobId].length === 0)) {
            toast.error("กรุณาเลือกรูปที่จะโพสต์ลง Facebook อย่างน้อย 1 รูป");
            return;
        }

        setSubmittingId(jobId);

        const submitPromise = new Promise(async (resolve, reject) => {
            try {
                // Re-check job status one more time before processing (race condition protection)
                const jobDocRef = doc(db, "photography_jobs", jobId);
                const jobSnapshot = await getDoc(jobDocRef);
                if (!jobSnapshot.exists()) throw new Error("Job not found");

                const currentJobData = jobSnapshot.data();
                if (currentJobData.status === 'completed') {
                    throw new Error("งานนี้ถูกส่งไปแล้ว");
                }

                // --- STEP 1: DRIVE UPLOAD (ถ้ายังไม่ได้อัปโหลด) ---
                let finalDriveLink = upload.driveLinks[jobId];
                let currentFileIds = upload.uploadedFileIds[jobId] || [];

                // ถ้ามีไฟล์รออยู่ และยังไม่ได้กดอัปโหลด -> อัปให้เลยอัตโนมัติ
                if (upload.jobFiles[jobId]?.length > 0 && !upload.isUploadComplete[jobId]) {
                    upload.setIsUploading(prev => ({ ...prev, [jobId]: true }));
                    const { ids, folderLink } = await upload.performDriveUpload(
                        jobId,
                        job.title,
                        job.startTime ? getBangkokDateString(job.startTime.toDate()) : getBangkokDateString()
                    );
                    currentFileIds = ids;
                    finalDriveLink = folderLink;

                    upload.setUploadedFileIds(prev => ({ ...prev, [jobId]: ids }));
                    upload.setDriveLinks(prev => ({ ...prev, [jobId]: folderLink }));
                    // Only mark complete if at least one file made it — prevents locking out retry
                    upload.setIsUploadComplete(prev => ({ ...prev, [jobId]: ids.length > 0 }));
                    upload.setIsUploading(prev => ({ ...prev, [jobId]: false }));

                    // Guard: ถ้ามีไฟล์แต่ upload ไม่สำเร็จแม้แต่ไฟล์เดียว → ห้าม mark complete
                    if (ids.length === 0) {
                        throw new Error("ไม่สามารถอัปโหลดรูปภาพไป Google Drive ได้ — กรุณาลองใหม่อีกครั้ง");
                    }
                }

                // --- STEP 2: PARALLEL TASKS (Cover & Facebook) ---
                const tasks: Promise<any>[] = [];
                let coverUrl = job.coverImage || ""; // ใช้รูปเดิมถ้าไม่ได้เปลี่ยน

                // Task A: Cover Image Upload
                if (upload.coverFiles[jobId]) {
                    const coverTask = async () => {
                        const compressedFile = await compressImage(upload.coverFiles[jobId], {
                            maxWidth: 1200, maxHeight: 800, quality: 0.8, maxSizeMB: 0.3
                        });
                        const storageRef = ref(storage, `covers/${jobId}_${Date.now()}.jpg`);
                        await uploadBytes(storageRef, compressedFile);
                        return await getDownloadURL(storageRef);
                    };
                    tasks.push(coverTask().then(url => coverUrl = url));
                }

                // Task B: Facebook Post (ต้องใช้ ID จาก Step 1)
                // Facebook failure ไม่ควร block job completion — wrap ใน catch
                let facebookError: string | null = null;
                if (fb.facebookEnabled[jobId] && !fb.facebookSent[jobId]) {
                    if (currentFileIds.length === 0) {
                        facebookError = "ไม่มีรูปสำหรับโพส Facebook (Google Drive upload ไม่สำเร็จ)";
                    } else {
                        tasks.push(
                            fb.performFacebookPost(
                                jobId,
                                upload.jobFiles[jobId] || [],
                                upload.fileToBase64
                            ).catch((err: Error) => {
                                console.error('Facebook post failed (non-blocking):', err);
                                facebookError = err.message;
                            })
                        );
                    }
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
                    facebookCaption: fb.facebookCaption[jobId] || null,
                    ...(facebookError ? { facebookError } : {})
                });

                // แจ้ง user ถ้า Facebook fail แต่งานส่งสำเร็จแล้ว
                if (facebookError) {
                    toast.error(`โพส Facebook ไม่สำเร็จ: ${facebookError}\n(งานส่งเรียบร้อยแล้ว — สามารถโพส Facebook ทีหลังได้)`, { duration: 6000 });
                }

                // Notify admin/mod that photographer submitted work
                const currentUser = auth.currentUser;
                if (currentUser) {
                    currentUser.getIdToken().then(idToken => {
                        fetch('/api/notify-photo-submitted', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                            body: JSON.stringify({
                                jobId,
                                title: job.title,
                                photographerName: currentUser.displayName || 'ช่างภาพ',
                                photographerUid: currentUser.uid,
                            }),
                        }).catch(() => {});
                    }).catch(() => {});
                }

                // Clear ALL State using hook cleanup
                upload.clearJobState(jobId);
                fb.clearFacebookState(jobId);
                // Also clear extra state not in hook cleanups
                upload.setDriveLinks(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                upload.setUploadProgress(prev => { const n = { ...prev }; delete n[jobId]; return n; });
                upload.setIsUploading(prev => { const n = { ...prev }; delete n[jobId]; return n; });

                resolve("ส่งงานเรียบร้อยแล้ว!");
            } catch (error: any) {
                console.error("Error submitting job:", error);
                reject(error);
            } finally {
                setSubmittingId(null);
                upload.setIsUploading(prev => ({ ...prev, [jobId]: false }));
                upload.setUploadProgress(prev => ({ ...prev, [jobId]: 0 }));
            }
        });

        toast.promise(submitPromise, {
            loading: 'กำลังประมวลผล... (Google Drive -> Facebook -> Save)',
            success: 'ส่งงานเรียบร้อยแล้ว! 🎉',
            error: (err) => `เกิดข้อผิดพลาด: ${err.message}`
        });
    };

    // === Computed Values ===
    const displayJobs = selectedJobId
        ? jobs.filter(j => j.id === selectedJobId)
        : jobs;

    const isSingleJobMode = !!selectedJobId;
    const singleJob = isSingleJobMode && displayJobs.length > 0 ? displayJobs[0] : null;

    // === Stepper State (for Single Job Mode) ===
    const [currentStep, setCurrentStep] = useState(1);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const steps = [
        { id: 1, label: 'รูปปก', icon: ImageIcon },
        { id: 2, label: 'รูปกิจกรรม', icon: UploadCloud },
        { id: 3, label: 'Facebook', icon: Facebook },
        { id: 4, label: 'ยืนยัน', icon: CheckCircle2 },
    ];

    const canProceedFromStep = (step: number, jobId: string) => {
        switch (step) {
            case 1: return true;
            case 2: return (upload.jobFiles[jobId]?.length > 0) || !!upload.driveLinks[jobId];
            case 3: return !fb.facebookEnabled[jobId] || (fb.facebookSelectedOrder[jobId]?.length > 0);
            case 4: return true;
            default: return true;
        }
    };

    const goToStep = (step: number) => setCurrentStep(step);
    const nextStep = () => { if (currentStep < 4) setCurrentStep(currentStep + 1); };
    const prevStep = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

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
                            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                    <span className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">📸</span>
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
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-2xl">
                                                    ✓
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ยืนยันส่งงาน?</h3>
                                                <p className="text-gray-500 dark:text-gray-400 text-sm">{singleJob.title}</p>
                                            </div>

                                            <div className="space-y-3 mb-6 text-sm">
                                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                    <span className="text-gray-600 dark:text-gray-400">รูปปก</span>
                                                    <span className={`font-medium ${upload.coverFiles[singleJob.id!] ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                        {upload.coverFiles[singleJob.id!] ? '✓ เลือกแล้ว' : 'ไม่มี'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                    <span className="text-gray-600 dark:text-gray-400">รูปกิจกรรม</span>
                                                    <span className="font-medium text-emerald-600">
                                                        {upload.jobFiles[singleJob.id!]?.length || 0} รูป
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                    <span className="text-gray-600 dark:text-gray-400">โพส Facebook</span>
                                                    <span className={`font-medium ${fb.facebookEnabled[singleJob.id!] ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {fb.facebookEnabled[singleJob.id!]
                                                            ? `✓ ${fb.facebookSelectedOrder[singleJob.id!]?.length || 0} รูป ${fb.facebookDraftMode[singleJob.id!] ? '(Draft)' : ''}`
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
                                                    className="flex-1 px-4 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-all"
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
                                                            onDragOver={(e) => upload.handleCoverDragOver(job.id!, e)}
                                                            onDragLeave={(e) => upload.handleCoverDragLeave(job.id!, e)}
                                                            onDrop={(e) => upload.handleCoverDrop(job.id!, e)}
                                                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 relative overflow-hidden ${upload.isDraggingCover[job.id!]
                                                                ? "border-pink-500 bg-pink-50 dark:bg-pink-900/30 ring-2 ring-pink-500 ring-offset-2 scale-[1.02]"
                                                                : "border-pink-200 dark:border-pink-900 hover:bg-pink-50 dark:hover:bg-pink-900/20 bg-white dark:bg-gray-800"
                                                                }`}>
                                                            {upload.coverPreviews[job.id!] ? (
                                                                <img src={upload.coverPreviews[job.id!]} className="w-full h-full object-cover" alt="Cover Preview" loading="lazy" />
                                                            ) : (
                                                                <div className="flex flex-col items-center text-pink-400">
                                                                    <ImageIcon size={24} className="mb-1" />
                                                                    <span className="text-xs">เลือกรูปปก (ลากวางได้)</span>
                                                                </div>
                                                            )}
                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => upload.handleCoverChange(job.id!, e)} />
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
                                                            onDragOver={(e) => upload.handleJobFilesDragOver(job.id!, e)}
                                                            onDragLeave={(e) => upload.handleJobFilesDragLeave(job.id!, e)}
                                                            onDrop={(e) => upload.handleJobFilesDrop(job.id!, e)}
                                                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${upload.isDraggingFiles[job.id!]
                                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 ring-offset-2 scale-[1.02]"
                                                                : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800"
                                                                }`}>
                                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                                <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
                                                                <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                                                    <span className="font-semibold">เพิ่มรูปภาพกิจกรรม (ลากวางได้)</span>
                                                                </p>
                                                            </div>
                                                            <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => upload.handleJobFilesChange(job.id!, e)} />
                                                        </label>

                                                        {/* Selected Files Preview Grid */}
                                                        {(upload.previews[job.id!]?.length > 0) && (
                                                            <div className="mt-4 grid grid-cols-4 gap-2">
                                                                {upload.previews[job.id!]?.map((src, index) => (
                                                                    <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                                                        <img src={src} className="w-full h-full object-cover" alt={`preview-${index}`} loading="lazy" />
                                                                        <button
                                                                            onClick={() => handleRemoveFile(job.id!, index)}
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
                                                    {(submittingId === job.id || upload.isUploading[job.id!]) && (
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                                            <div className="flex justify-between items-center text-xs mb-1">
                                                                <span>กำลังอัปโหลดขึ้น Google Drive...</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span>{upload.uploadProgress[job.id!] || 0}%</span>
                                                                    {/* F. Cancel button */}
                                                                    <button
                                                                        onClick={() => upload.cancelUpload(job.id!)}
                                                                        className="text-red-500 hover:text-red-700 transition-colors"
                                                                        title="ยกเลิกการอัปโหลด"
                                                                    >
                                                                        <XCircle size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                                                                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${upload.uploadProgress[job.id!] || 0}%` }}></div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* G. Facebook Upload Progress Bar */}
                                                    {submittingId === job.id && fb.facebookEnabled[job.id!] && fb.facebookProgress[job.id!] !== undefined && !fb.facebookSent[job.id!] && (
                                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="flex items-center gap-1"><Facebook size={12} /> กำลังโพสขึ้น Facebook...</span>
                                                                <span>{fb.facebookProgress[job.id!]}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                                                                <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${fb.facebookProgress[job.id!]}%` }}></div>
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
                                                            value={upload.driveLinks[job.id!] || ''}
                                                            onChange={(e) => upload.handleLinkChange(job.id!, e.target.value)}
                                                            placeholder="https://drive.google.com/..."
                                                            className="hidden mt-2 w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>

                                                    {/* 4. Facebook Integration Section */}
                                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                                        <label className="flex items-center gap-2 cursor-pointer mb-3 select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={fb.facebookEnabled[job.id!] || false}
                                                                onChange={() => fb.handleFacebookToggle(job.id!)}
                                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                            />
                                                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                                                                <Facebook size={18} />
                                                                โพสลงเพจ Facebook โรงเรียน
                                                            </div>
                                                        </label>

                                                        {fb.facebookEnabled[job.id!] && (
                                                            <div className="space-y-4 pl-6 border-l-2 border-blue-100 dark:border-blue-900/50 ml-2">
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Caption</label>
                                                                    <textarea
                                                                        value={fb.facebookCaption[job.id!] || ''}
                                                                        onChange={(e) => fb.setFacebookCaption(prev => ({ ...prev, [job.id!]: e.target.value }))}
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
                                                                            checked={fb.facebookDraftMode[job.id!] || false}
                                                                            onChange={() => fb.setFacebookDraftMode(prev => ({ ...prev, [job.id!]: !prev[job.id!] }))}
                                                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                                                        />
                                                                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                                                            บันทึกเป็น Draft (ไม่เผยแพร่ทันที)
                                                                        </span>
                                                                    </label>
                                                                    {fb.facebookDraftMode[job.id!] && (
                                                                        <span className="text-xs text-amber-600 dark:text-amber-500">
                                                                            • Admin สามารถตรวจสอบและกด Publish ในหน้า Facebook Page ได้
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                                                            เลือกรูปสำหรับโพส ({fb.facebookSelectedOrder[job.id!]?.length || 0} รูป)
                                                                        </label>
                                                                        <div className="flex gap-1">
                                                                            <button type="button" onClick={() => fb.selectFirstN(job.id!, 50, upload.previews[job.id!]?.length || 0)} className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">50 รูปแรก</button>
                                                                            <button type="button" onClick={() => fb.selectAll(job.id!, upload.previews[job.id!]?.length || 0)} className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">ทั้งหมด</button>
                                                                            <button type="button" onClick={() => fb.selectNone(job.id!)} className="px-2 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400">ยกเลิก</button>
                                                                        </div>
                                                                    </div>

                                                                    {upload.previews[job.id!]?.length > 0 ? (
                                                                        <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                                            {upload.previews[job.id!]?.map((src: string, index: number) => {
                                                                                const orderIndex = fb.facebookSelectedOrder[job.id!]?.indexOf(index);
                                                                                const isSelected = orderIndex !== undefined && orderIndex !== -1;
                                                                                const orderNumber = isSelected ? orderIndex + 1 : null;
                                                                                return (
                                                                                    <div
                                                                                        key={index}
                                                                                        onClick={(e) => fb.handleFacebookPhotoClick(job.id!, index, e.shiftKey)}
                                                                                        className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:border-gray-300'}`}
                                                                                    >
                                                                                        <img src={src} className="w-full h-full object-cover" alt={`select-${index}`} loading="lazy" />
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

                                                        {/* H. Facebook Preview Mock-up */}
                                                        {fb.facebookEnabled[job.id!] && (fb.facebookSelectedOrder[job.id!]?.length > 0 || fb.facebookCaption[job.id!]) && (
                                                            <details className="mt-3">
                                                                <summary className="text-xs text-gray-500 cursor-pointer flex items-center gap-1 hover:text-blue-500 transition-colors">
                                                                    <Eye size={12} /> Preview โพส Facebook
                                                                </summary>
                                                                <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                                                                    {/* Mock FB Header */}
                                                                    <div className="p-3 flex items-center gap-2">
                                                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                                                                            <Facebook size={16} className="text-white" />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs font-semibold">CRMS6 IT</div>
                                                                            <div className="text-[10px] text-gray-400">ตอนนี้ · 🌐</div>
                                                                        </div>
                                                                    </div>
                                                                    {/* Caption */}
                                                                    {fb.facebookCaption[job.id!] && (
                                                                        <p className="px-3 pb-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{fb.facebookCaption[job.id!]}</p>
                                                                    )}
                                                                    {/* Photo Grid (max 4 preview like FB) */}
                                                                    {fb.facebookSelectedOrder[job.id!]?.length > 0 && (
                                                                        <div className={`grid gap-0.5 ${fb.facebookSelectedOrder[job.id!].length === 1 ? 'grid-cols-1' :
                                                                            fb.facebookSelectedOrder[job.id!].length === 2 ? 'grid-cols-2' :
                                                                                fb.facebookSelectedOrder[job.id!].length === 3 ? 'grid-cols-2' :
                                                                                    'grid-cols-2'
                                                                            }`}>
                                                                            {fb.facebookSelectedOrder[job.id!].slice(0, 4).map((photoIdx, i) => {
                                                                                const src = upload.previews[job.id!]?.[photoIdx];
                                                                                const remaining = fb.facebookSelectedOrder[job.id!].length - 4;
                                                                                return (
                                                                                    <div key={i} className={`relative aspect-square overflow-hidden ${fb.facebookSelectedOrder[job.id!].length === 3 && i === 0 ? 'row-span-2' : ''
                                                                                        }`}>
                                                                                        {src && <img src={src} className="w-full h-full object-cover" alt="" loading="lazy" />}
                                                                                        {i === 3 && remaining > 0 && (
                                                                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                                                                <span className="text-white text-lg font-bold">+{remaining}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                    {/* Mock engagement bar */}
                                                                    <div className="px-3 py-2 flex gap-4 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-700">
                                                                        <span>👍 ถูกใจ</span>
                                                                        <span>💬 แสดงความคิดเห็น</span>
                                                                        <span>↗️ แชร์</span>
                                                                    </div>
                                                                </div>
                                                            </details>
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
                                                        className="w-full sm:w-auto self-end px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-gray-700 dark:hover:bg-gray-100 transition-all"
                                                    >
                                                        {submittingId === job.id ? 'กำลังประมวลผล...' : (fb.facebookEnabled[job.id!] ? 'ส่งงาน + อัปโหลด + โพสต์ Facebook' : 'ส่งงาน + อัปโหลด')}
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