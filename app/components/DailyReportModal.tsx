import React, { useState, useEffect } from "react";
import { X, Calendar, FileText, UploadCloud, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import toast from "react-hot-toast";
import { useDailyReportUpload } from "@/hooks/useDailyReportUpload";
import { getBangkokDateString } from "@/lib/dateUtils";

interface DailyReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
}

export default function DailyReportModal({ isOpen, onClose, userId, userName }: DailyReportModalProps) {
    const upload = useDailyReportUpload();
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [reportDateStr, setReportDateStr] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [description, setDescription] = useState("");

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Reset form when opened
            setReportDateStr(new Date().toISOString().split('T')[0]);
            setDescription("");
            upload.clearUploadState();
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!description.trim()) {
            toast.error("กรุณาระบุรายละเอียดการทำงาน");
            return;
        }

        if (upload.reportFiles.length === 0 && !upload.driveLink) {
            toast.error("กรุณาเลือกรูปภาพ หรือแนบลิงก์ Google Drive");
            return;
        }

        setSubmitting(true);

        const submitPromise = new Promise(async (resolve, reject) => {
            try {
                let finalDriveLink = upload.driveLink;

                // 1. Upload to Drive if files exist
                if (upload.reportFiles.length > 0) {
                    upload.setIsUploading(true);

                    // Folder format is dictated by the API route. Send YYYY-MM-DD format as is.
                    const { folderLink } = await upload.performDriveUpload(
                        userName,
                        reportDateStr
                    );

                    finalDriveLink = folderLink;
                    upload.setDriveLink(folderLink);
                    upload.setIsUploading(false);
                }

                // Parse date for Firestore
                const [year, month, day] = reportDateStr.split('-').map(Number);
                const reportDate = new Date(year, month - 1, day, 12, 0, 0);

                // 2. Save to Firestore
                await addDoc(collection(db, "daily_reports"), {
                    userId,
                    userName,
                    reportDate: Timestamp.fromDate(reportDate),
                    description: description.trim(),
                    driveLink: finalDriveLink || "",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                upload.clearUploadState();
                setDescription("");

                resolve("ส่งรายงานการทำงานเรียบร้อยแล้ว!");
                setTimeout(onClose, 1000);
            } catch (error: any) {
                console.error("Error submitting daily report:", error);
                reject(error);
            } finally {
                setSubmitting(false);
                upload.setIsUploading(false);
                upload.setUploadProgress(0);
            }
        });

        toast.promise(submitPromise, {
            loading: 'กำลังประมวลผลการส่งรายงาน...',
            success: 'ส่งรายงานเรียบร้อยแล้ว! 🎉',
            error: (err) => `เกิดข้อผิดพลาด: ${err.message}`
        });
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
                        onClick={!submitting ? onClose : undefined}
                    />
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-teal-500/10 to-emerald-500/10">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                    <span className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg">📝</span>
                                    รายงานการทำงานรายวัน
                                </h2>
                                <button
                                    onClick={!submitting ? onClose : undefined}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    disabled={submitting}
                                >
                                    <X size={22} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                        <Calendar size={16} className="text-blue-500" />
                                        วันที่ปฏิบัติงาน
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={reportDateStr}
                                        onChange={(e) => setReportDateStr(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500/30 transition-all font-medium text-gray-900 dark:text-white"
                                        disabled={submitting}
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                        <FileText size={16} className="text-purple-500" />
                                        รายละเอียดการทำงาน
                                    </label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="ระบุงานที่ทำในวันนี้..."
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500/30 transition-all text-sm resize-none"
                                        disabled={submitting}
                                    />
                                </div>

                                {/* Images */}
                                <div>
                                    <div className="flex items-end justify-between mb-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                            <UploadCloud size={16} className="text-amber-500" />
                                            รูปถ่ายผลงาน (สูงสุด 10 รูป)
                                        </label>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            เลือกแล้ว {upload.reportFiles.length}/10
                                        </span>
                                    </div>

                                    <label
                                        onDragOver={upload.handleReportFilesDragOver}
                                        onDragLeave={upload.handleReportFilesDragLeave}
                                        onDrop={upload.handleReportFilesDrop}
                                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${upload.isDraggingFiles
                                                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-500 ring-offset-2 scale-[1.02]"
                                                : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800"
                                            } ${submitting ? 'pointer-events-none opacity-50' : ''}`}
                                    >
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
                                            <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                                <span className="font-semibold">เพิ่มรูปภาพผลงาน (ลากวางได้)</span>
                                            </p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            multiple
                                            accept="image/*"
                                            onChange={upload.handleReportFilesChange}
                                            disabled={submitting}
                                        />
                                    </label>

                                    {/* Preview Grid */}
                                    {upload.previews.length > 0 && (
                                        <div className="mt-4 grid grid-cols-5 gap-2">
                                            {upload.previews.map((src, index) => (
                                                <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                                    <img src={src} className="w-full h-full object-cover" alt={`preview-${index}`} loading="lazy" />
                                                    {!submitting && (
                                                        <button
                                                            type="button"
                                                            onClick={() => upload.removeFile(index)}
                                                            className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Upload Progress Bar */}
                                {upload.isUploading && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                                        <div className="flex justify-between items-center text-xs mb-1 text-amber-900 dark:text-amber-100">
                                            <span>กำลังอัปโหลดรูปภาพ...</span>
                                            <div className="flex items-center gap-2">
                                                <span>{upload.uploadProgress}%</span>
                                                <button
                                                    type="button"
                                                    onClick={upload.cancelUpload}
                                                    className="text-red-500 hover:text-red-700 transition-colors"
                                                    title="ยกเลิกการอัปโหลด"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                                            <div
                                                className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                                                style={{ width: `${upload.uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Optional Link Fallback */}
                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => { const el = document.getElementById(`daily-link-input`); if (el) el.classList.toggle('hidden'); }}
                                        className="text-xs text-blue-500 hover:text-blue-600 underline flex items-center gap-1"
                                        disabled={submitting}
                                    >
                                        <ExternalLink size={12} />
                                        หรือแนบลิงก์ Google Drive
                                    </button>
                                    <input
                                        id="daily-link-input"
                                        type="url"
                                        value={upload.driveLink}
                                        onChange={(e) => upload.handleLinkChange(e.target.value)}
                                        placeholder="https://drive.google.com/..."
                                        className="hidden mt-2 w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-teal-500/30"
                                        disabled={submitting}
                                    />
                                </div>
                            </form>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    onClick={handleSubmit} // Trigger form submission
                                    disabled={submitting || (upload.reportFiles.length === 0 && !upload.driveLink)}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-medium flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    {submitting ? 'กำลังบันทึก...' : (
                                        <>
                                            <CheckCircle2 size={18} />
                                            ส่งรายงาน
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
