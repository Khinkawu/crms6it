"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";

export default function RepairPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        position: "ครู",
        phone: "",
        room: "",
        description: "",
    });
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const totalImages = images.length + newFiles.length;

            if (totalImages > 5) {
                setError("You can upload a maximum of 5 images.");
                return;
            }

            setImages(prev => [...prev, ...newFiles]);

            // Create previews
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
            setError(null);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => {
            // Revoke URL to prevent memory leaks
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        // Validation
        if (!formData.phone || !formData.room || !formData.description) {
            setError("Please fill in all required fields.");
            return;
        }

        if (images.length === 0) {
            setError("Please upload at least 1 image of the problem.");
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Upload Images
            const imageUrls: string[] = [];
            for (const image of images) {
                const storageRef = ref(storage, `repair_images/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                const url = await getDownloadURL(snapshot.ref);
                imageUrls.push(url);
            }

            // 2. Save to Firestore
            await addDoc(collection(db, "repair_tickets"), {
                requesterName: user?.displayName || "Unknown",
                requesterEmail: user?.email || "Unknown",
                position: formData.position,
                phone: formData.phone,
                room: formData.room,
                description: formData.description,
                images: imageUrls,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 3. Notify Technician (Non-blocking)
            fetch('/api/notify-repair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requesterName: user?.displayName || "Unknown",
                    room: formData.room,
                    description: formData.description,
                    imageOneUrl: imageUrls.length > 0 ? imageUrls[0] : null
                })
            }).catch(err => console.error("Failed to send LINE notification:", err));

            setSuccess(true);
            setFormData({
                position: "ครู",
                phone: "",
                room: "",
                description: "",
            });
            setImages([]);
            setPreviews([]);
            if (fileInputRef.current) fileInputRef.current.value = "";

            // Auto-hide success message after 5 seconds
            setTimeout(() => setSuccess(false), 5000);

        } catch (err: any) {
            console.error("Error submitting repair ticket:", err);
            setError("Failed to submit ticket. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading || !user) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-2xl">
                <div className="glass-panel p-8 relative overflow-hidden">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none"></div>

                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold text-white mb-2">Repair Request</h1>
                        <p className="text-white/60 mb-8">Report an issue with equipment or facilities.</p>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm flex items-center gap-2">
                                <span>✅</span> Ticket submitted successfully! We will review it shortly.
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Reporter Info (Read-only) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/80">Reporter Name</label>
                                    <input
                                        type="text"
                                        value={user.displayName || user.email || ""}
                                        disabled
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/80">Position</label>
                                    <div className="relative">
                                        <select
                                            name="position"
                                            value={formData.position}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 appearance-none"
                                        >
                                            <option value="ผู้บริหาร" className="bg-slate-900 text-white">ผู้บริหาร</option>
                                            <option value="ครู" className="bg-slate-900 text-white">ครู</option>
                                            <option value="ครู LS" className="bg-slate-900 text-white">ครู LS</option>
                                            <option value="บุคลากร" className="bg-slate-900 text-white">บุคลากร</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                                            ▼
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/80">Phone Number <span className="text-red-400">*</span></label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="08x-xxx-xxxx"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/80">Room / Location <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        name="room"
                                        value={formData.room}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Room 304, Library"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">Problem Description <span className="text-red-400">*</span></label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={4}
                                    placeholder="Describe the issue in detail..."
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none"
                                    required
                                />
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-white/80">
                                    Upload Images (1-5) <span className="text-red-400">*</span>
                                </label>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {previews.map((src, index) => (
                                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                                            <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}

                                    {images.length < 5 && (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square rounded-lg bg-white/5 border border-white/10 border-dashed flex flex-col items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                        >
                                            <span className="text-2xl mb-1">+</span>
                                            <span className="text-xs">Add Photo</span>
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                />
                                <p className="text-xs text-white/40">
                                    Supported: JPG, PNG. Max 5 images.
                                </p>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Submitting...
                                        </span>
                                    ) : (
                                        "Submit Ticket"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
