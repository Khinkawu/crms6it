"use client";

import React, { useState, useMemo } from "react";
import { Video, Search, Filter, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useVideoGallery } from "@/hooks/useVideoGallery";
import { useAuth } from "@/context/AuthContext";
import VideoGalleryCard from "@/components/VideoGalleryCard";
import VideoModal from "@/components/VideoModal";
import { VideoItem } from "@/types";

export default function VideoGalleryPage() {
    const { user, role, isPhotographer } = useAuth();
    const { videos, categories, loading, error } = useVideoGallery({ publishedOnly: false });

    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [showFilters, setShowFilters] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;

    // Check if user can add/edit videos
    const canEdit = role === "admin" || role === "moderator" || role === "technician" || isPhotographer;

    // Filter videos
    const filteredVideos = useMemo(() => {
        return videos.filter((video) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchTitle = video.title.toLowerCase().includes(query);
                const matchDesc = (video.description || "").toLowerCase().includes(query);
                if (!matchTitle && !matchDesc) return false;
            }

            // Category filter
            if (selectedCategory !== "all" && video.category !== selectedCategory) {
                return false;
            }

            // Show unpublished only to users who can edit
            if (!video.isPublished && !canEdit) {
                return false;
            }

            return true;
        });
    }, [videos, searchQuery, selectedCategory, canEdit]);

    // Pagination
    const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
    const paginatedVideos = filteredVideos.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Reset page when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory]);

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedCategory("all");
    };

    const hasActiveFilters = searchQuery || selectedCategory !== "all";

    const handleEdit = (video: VideoItem) => {
        setEditingVideo(video);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingVideo(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingVideo(null);
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">คลังวิดีโอกิจกรรม</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{filteredVideos.length} วิดีโอ</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${hasActiveFilters
                            ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                            }`}
                    >
                        <Filter size={14} />
                        ตัวกรอง
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-all"
                        >
                            <Plus size={14} />
                            เพิ่มวิดีโอ
                        </button>
                    )}
                </div>
            </div>

            {/* Search + Filters */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาวิดีโอ..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600"
                    />
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedCategory("all")}
                            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${selectedCategory === "all"
                                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                                }`}
                        >
                            ทั้งหมด
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat
                                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                    : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1.5">
                                <X size={14} />
                                ล้างตัวกรอง
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div>
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="mt-4 text-gray-500">กำลังโหลด...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-20">
                        <Video size={64} className="mx-auto text-red-300 dark:text-red-600 mb-4" />
                        <h3 className="text-lg font-medium text-red-600 dark:text-red-400">เกิดข้อผิดพลาด</h3>
                        <p className="text-sm text-gray-400 mt-1">{error}</p>
                    </div>
                ) : filteredVideos.length === 0 ? (
                    <div className="text-center py-20">
                        <Video size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">ไม่พบวีดีโอ</h3>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                            {hasActiveFilters ? "ลองปรับตัวกรองใหม่" : "ยังไม่มีวีดีโอในระบบ"}
                        </p>
                        {canEdit && !hasActiveFilters && (
                            <button
                                onClick={handleAdd}
                                className="mt-4 px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-all inline-flex items-center gap-2"
                            >
                                <Plus size={18} />
                                เพิ่มวีดีโอแรก
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {paginatedVideos.map((video) => (
                                <VideoGalleryCard
                                    key={video.id}
                                    video={video}
                                    onEdit={handleEdit}
                                    canEdit={canEdit}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {(() => {
                                        const pages: (number | string)[] = [];
                                        if (totalPages <= 7) {
                                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                                        } else {
                                            if (currentPage <= 4) {
                                                pages.push(1, 2, 3, 4, 5, '...', totalPages);
                                            } else if (currentPage >= totalPages - 3) {
                                                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                                            } else {
                                                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                                            }
                                        }
                                        return pages.map((page, idx) => (
                                            page === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="w-10 h-10 flex items-center justify-center text-gray-500">...</span>
                                            ) : (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page as number)}
                                                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${page === currentPage
                                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        ));
                                    })()}
                                </div>

                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Video Modal */}
            <VideoModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                video={editingVideo}
                categories={categories}
            />
        </div>
    );
}
