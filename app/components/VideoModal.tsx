"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Video, Link2, Tag, Calendar, Loader2, Save, Sparkles, Plus, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { VideoItem, VideoPlatform, VideoLink } from "../../types";
import { detectPlatform, autoGenerateThumbnail } from "../../hooks/useVideoGallery";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

interface VideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    video?: VideoItem | null;
    categories: string[];
}

// Platform icons mapping
const platformIcons: Record<VideoPlatform, string> = {
    youtube: "/youtube_icon.png",
    tiktok: "/tiktok_icon.png",
    gdrive: "/Google_Drive_icon.png",
    facebook: "/facebook-logo.png",
    other: "/Google_Drive_icon.png"
};

// Compress image before upload - HIGH QUALITY settings
// maxWidth: 1280px for high quality thumbnails (HD ready)
// quality: 0.92 for excellent quality with reasonable file size
// Skip compression for files under 200KB
async function compressImage(file: File, maxWidth = 1280, quality = 0.92): Promise<Blob> {
    // If file is small enough, don't compress (for screenshots/small images)
    if (file.size < 200 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                // Only scale down if larger than maxWidth, keep aspect ratio
                const scale = img.width > maxWidth ? maxWidth / img.width : 1;
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }

                // Use best quality image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Use WebP if supported for better quality/size ratio, fallback to JPEG
                const mimeType = "image/webp";
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            // Fallback to JPEG
                            canvas.toBlob(
                                (jpegBlob) => {
                                    if (jpegBlob) resolve(jpegBlob);
                                    else reject(new Error("Failed to compress image"));
                                },
                                "image/jpeg",
                                quality
                            );
                        }
                    },
                    mimeType,
                    quality
                );
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

// Helper to extract storage path from Firebase Storage URL
function getStoragePathFromUrl(url: string): string | null {
    if (!url.includes("firebasestorage.googleapis.com")) return null;
    try {
        const decodedUrl = decodeURIComponent(url);
        const match = decodedUrl.match(/\/o\/([^?]+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

export default function VideoModal({ isOpen, onClose, video, categories }: VideoModalProps) {
    const { user } = useAuth();
    const isEditMode = !!video;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState(""); // Track for cleanup
    const [category, setCategory] = useState("");
    const [customCategory, setCustomCategory] = useState("");
    const [eventDate, setEventDate] = useState("");
    const [isPublished, setIsPublished] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingThumb, setIsUploadingThumb] = useState(false);

    // Multiple links support (max 3)
    const [videoLinks, setVideoLinks] = useState<{ url: string; platform: VideoPlatform }[]>([
        { url: "", platform: "youtube" }
    ]);

    // Reset form when opening/closing
    useEffect(() => {
        if (isOpen && video) {
            setTitle(video.title || "");
            setDescription(video.description || "");
            setThumbnailUrl(video.thumbnailUrl || "");
            setOriginalThumbnailUrl(video.thumbnailUrl || ""); // Track original for cleanup
            setCategory(video.category || "");
            setIsPublished(video.isPublished ?? true);

            // Load existing links
            const links: { url: string; platform: VideoPlatform }[] = [];
            if (video.videoUrl) {
                links.push({ url: video.videoUrl, platform: video.platform || "youtube" });
            }
            if (video.videoLinks) {
                video.videoLinks.forEach(link => {
                    links.push({ url: link.url, platform: link.platform });
                });
            }
            setVideoLinks(links.length > 0 ? links : [{ url: "", platform: "youtube" }]);

            if (video.eventDate) {
                const date = video.eventDate.toDate ? video.eventDate.toDate() : new Date();
                setEventDate(date.toISOString().split("T")[0]);
            }
        } else if (isOpen) {
            setTitle("");
            setDescription("");
            setThumbnailUrl("");
            setOriginalThumbnailUrl(""); // Reset
            setCategory("");
            setCustomCategory("");
            setEventDate("");
            setIsPublished(true);
            setVideoLinks([{ url: "", platform: "youtube" }]);
        }
    }, [isOpen, video]);

    // Auto-detect platform when URL changes
    const handleLinkChange = (index: number, url: string) => {
        const newLinks = [...videoLinks];
        newLinks[index].url = url;
        if (url) {
            newLinks[index].platform = detectPlatform(url);
        }
        setVideoLinks(newLinks);

        // Auto-generate thumbnail from first link if empty
        if (index === 0 && url && !thumbnailUrl) {
            const autoThumb = autoGenerateThumbnail(url);
            if (autoThumb) {
                setThumbnailUrl(autoThumb);
            }
        }
    };

    const addLink = () => {
        if (videoLinks.length < 3) {
            setVideoLinks([...videoLinks, { url: "", platform: "youtube" }]);
        }
    };

    const removeLink = (index: number) => {
        if (videoLinks.length > 1) {
            setVideoLinks(videoLinks.filter((_, i) => i !== index));
        }
    };

    const handleGenerateThumbnail = () => {
        const firstUrl = videoLinks[0]?.url;
        if (!firstUrl) {
            toast.error("กรุณากรอก URL วีดีโอก่อน");
            return;
        }

        const autoThumb = autoGenerateThumbnail(firstUrl);
        if (autoThumb) {
            setThumbnailUrl(autoThumb);
            toast.success("สร้าง Thumbnail อัตโนมัติแล้ว");
        } else {
            toast.error("ไม่สามารถสร้าง Thumbnail อัตโนมัติได้");
        }
    };

    // Handle thumbnail upload
    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("กรุณาเลือกไฟล์รูปภาพ");
            return;
        }

        setIsUploadingThumb(true);
        try {
            // Compress image
            const compressedBlob = await compressImage(file, 400, 0.7);

            // Upload to Firebase Storage
            const fileName = `video_thumbnails/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, compressedBlob);
            const downloadUrl = await getDownloadURL(storageRef);

            setThumbnailUrl(downloadUrl);
            toast.success("อัปโหลด Thumbnail สำเร็จ");
        } catch (error) {
            console.error("Error uploading thumbnail:", error);
            toast.error("เกิดข้อผิดพลาดในการอัปโหลด");
        } finally {
            setIsUploadingThumb(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("กรุณากรอกชื่อวีดีโอ");
            return;
        }

        const validLinks = videoLinks.filter(link => link.url.trim());
        if (validLinks.length === 0) {
            toast.error("กรุณากรอก URL วีดีโอ อย่างน้อย 1 ลิงก์");
            return;
        }

        if (!category && !customCategory) {
            toast.error("กรุณาเลือกหรือกรอกหมวดหมู่");
            return;
        }

        setIsSaving(true);
        try {
            const finalCategory = category === "__custom__" ? customCategory : category;
            const primaryLink = validLinks[0];
            const additionalLinks = validLinks.slice(1).map(link => ({
                platform: link.platform,
                url: link.url.trim()
            }));

            const videoData: Record<string, any> = {
                title: title.trim(),
                description: description.trim() || "",
                videoUrl: primaryLink.url.trim(),
                platform: primaryLink.platform,
                thumbnailUrl: thumbnailUrl.trim() || "",
                category: finalCategory,
                isPublished,
                // Always include videoLinks (empty array if no additional links)
                videoLinks: additionalLinks,
            };

            if (eventDate) {
                videoData.eventDate = new Date(eventDate);
            }

            if (isEditMode && video?.id) {
                // Cleanup old thumbnail if changed or removed
                if (originalThumbnailUrl && originalThumbnailUrl !== thumbnailUrl.trim()) {
                    const oldPath = getStoragePathFromUrl(originalThumbnailUrl);
                    if (oldPath) {
                        try {
                            await deleteObject(ref(storage, oldPath));
                            console.log("Deleted old thumbnail:", oldPath);
                        } catch (err) {
                            console.warn("Could not delete old thumbnail:", err);
                        }
                    }
                }

                await updateDoc(doc(db, "video_gallery", video.id), videoData);
                toast.success("บันทึกการแก้ไขแล้ว");
            } else {
                await addDoc(collection(db, "video_gallery"), {
                    ...videoData,
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid || "",
                    createdByName: user?.displayName || user?.email || "",
                });
                toast.success("เพิ่มวีดีโอสำเร็จ");
            }

            onClose();
        } catch (error) {
            console.error("Error saving video:", error);
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Video size={20} className="text-purple-500" />
                        {isEditMode ? "แก้ไขวีดีโอ" : "เพิ่มวีดีโอใหม่"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="ปิด"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ชื่อวีดีโอ *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="กีฬาสี ปีการศึกษา 2567"
                        />
                    </div>

                    {/* Video Links (Multiple) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Link2 size={16} />
                                ลิงก์วีดีโอ * (สูงสุด 3)
                            </label>
                            {videoLinks.length < 3 && (
                                <button
                                    type="button"
                                    onClick={addLink}
                                    className="text-xs px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/50 flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    เพิ่มลิงก์
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {videoLinks.map((link, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                        <img
                                            src={platformIcons[link.platform]}
                                            alt={link.platform}
                                            className="w-5 h-5 object-contain"
                                        />
                                    </div>
                                    <input
                                        type="url"
                                        value={link.url}
                                        onChange={(e) => handleLinkChange(index, e.target.value)}
                                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                        placeholder={index === 0 ? "https://youtube.com/watch?v=..." : "URL เพิ่มเติม..."}
                                    />
                                    {videoLinks.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeLink(index)}
                                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Thumbnail */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                            <ImageIcon size={16} />
                            รูป Thumbnail
                        </label>

                        {/* Thumbnail Preview */}
                        {thumbnailUrl && (
                            <div className="mb-2 relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                                <img src={thumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setThumbnailUrl("")}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={thumbnailUrl}
                                onChange={(e) => setThumbnailUrl(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                placeholder="URL รูป หรืออัปโหลด"
                            />
                            <button
                                type="button"
                                onClick={handleGenerateThumbnail}
                                className="px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition-colors"
                                title="สร้างอัตโนมัติ"
                            >
                                <Sparkles size={16} />
                            </button>
                            <label className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1">
                                {isUploadingThumb ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Upload size={16} />
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleThumbnailUpload}
                                    className="hidden"
                                    disabled={isUploadingThumb}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                            <Tag size={16} />
                            หมวดหมู่ *
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="">-- เลือกหมวดหมู่ --</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="__custom__">➕ เพิ่มหมวดหมู่ใหม่...</option>
                        </select>
                        {category === "__custom__" && (
                            <input
                                type="text"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                className="w-full mt-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="พิมพ์ชื่อหมวดหมู่ใหม่"
                            />
                        )}
                    </div>

                    {/* Event Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                            <Calendar size={16} />
                            วันที่กิจกรรม
                        </label>
                        <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            รายละเอียด (ไม่บังคับ)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            placeholder="รายละเอียดเพิ่มเติม..."
                        />
                    </div>

                    {/* Published toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <span className="text-sm text-gray-700 dark:text-gray-300">เผยแพร่ทันที</span>
                        <button
                            type="button"
                            onClick={() => setIsPublished(!isPublished)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${isPublished ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                        >
                            <span
                                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                                style={{ left: isPublished ? "22px" : "2px" }}
                            />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                {isEditMode ? "บันทึก" : "เพิ่มวีดีโอ"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
