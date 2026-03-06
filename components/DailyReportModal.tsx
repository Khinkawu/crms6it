import React, { useState, useEffect } from "react";
import { X, Calendar, FileText, UploadCloud, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

        if (upload.reportFiles.length === 0 && upload.links.length === 0) {
            toast.error("กรุณาเลือกไฟล์ หรือแนบลิงก์ผลงานอย่างน้อย 1 อย่าง");
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
                    driveLink: finalDriveLink || "", // Keep for backward compatibility if needed, or we can use it for the uploaded folder
                    links: upload.links,
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
                            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                    <span className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">📝</span>
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
                                            แนบไฟล์ประกอบรายงาน
                                        </label>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            เลือกแล้ว {upload.reportFiles.length} ไฟล์
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
                                                <span className="font-semibold">เพิ่มไฟล์ผลงาน (ลากวางได้)</span>
                                            </p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            multiple
                                            onChange={upload.handleReportFilesChange}
                                            disabled={submitting}
                                        />
                                    </label>

                                    {/* Preview Grid */}
                                    {upload.previews.length > 0 && (
                                        <div className="mt-4 grid grid-cols-5 gap-2">
                                            {upload.previews.map((src, index) => {
                                                const file = upload.reportFiles[index];
                                                const isImage = file?.type.startsWith('image/');
                                                return (
                                                    <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center p-2">
                                                        {isImage && src ? (
                                                            <img src={src} className="absolute inset-0 w-full h-full object-cover" alt={`preview-${index}`} loading="lazy" />
                                                        ) : (
                                                            <>
                                                                <FileText size={24} className="text-gray-400 mb-1" />
                                                                <span className="text-[10px] text-gray-500 text-center line-clamp-2 break-all w-full">{file?.name}</span>
                                                            </>
                                                        )}
                                                        {!submitting && (
                                                            <button
                                                                type="button"
                                                                onClick={() => upload.removeFile(index)}
                                                                className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Upload Progress Bar */}
                                {upload.isUploading && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                                        <div className="flex justify-between items-center text-xs mb-1 text-amber-900 dark:text-amber-100">
                                            <span>กำลังอัปโหลดไฟล์...</span>
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

                                {/* Links Section */}
                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                            <ExternalLink size={16} className="text-blue-500" />
                                            แนบลิงก์ผลงาน (เช่น Facebook, YouTube, เว็บไซต์)
                                        </label>
                                    </div>

                                    <div className="space-y-3">
                                        {/* Added Links List */}
                                        {upload.links.length > 0 && (
                                            <div className="space-y-2 mb-3">
                                                {upload.links.map((link, index) => (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl group/link">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                                                                <ExternalLink size={14} />
                                                            </div>
                                                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                                                                {link}
                                                            </a>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => upload.removeLink(index)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover/link:opacity-100 shrink-0"
                                                            disabled={submitting}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add Link Input */}
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <ExternalLink size={16} className="text-gray-400" />
                                                </div>
                                                <input
                                                    type="url"
                                                    value={upload.currentLinkInput}
                                                    onChange={(e) => upload.setCurrentLinkInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            upload.addLink();
                                                        }
                                                    }}
                                                    placeholder="วางลิงก์ที่นี่ (https://...)"
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                                                    disabled={submitting}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={upload.addLink}
                                                disabled={!upload.currentLinkInput.trim() || submitting}
                                                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200 dark:border-blue-800/50"
                                            >
                                                เพิ่ม
                                            </button>
                                        </div>
                                    </div>
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
                                    disabled={submitting || (upload.reportFiles.length === 0 && upload.links.length === 0)}
                                    className="px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium flex items-center gap-2 hover:bg-gray-700 dark:hover:bg-gray-100 transition-all disabled:opacity-50"
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
