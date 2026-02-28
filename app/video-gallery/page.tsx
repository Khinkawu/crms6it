"use client";

import React, { useState, useMemo } from "react";
import { Video, Search, Filter, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useVideoGallery } from "../../hooks/useVideoGallery";
import { useAuth } from "../../context/AuthContext";
import VideoGalleryCard from "../components/VideoGalleryCard";
import VideoModal from "../components/VideoModal";
import { VideoItem } from "../../types";

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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30">
                                <Video size={24} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">คลังวีดีโอกิจกรรม</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{filteredVideos.length} วีดีโอ</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2.5 rounded-xl border transition-all ${hasActiveFilters
                                    ? "bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/30 dark:border-purple-700"
                                    : "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                                    }`}
                            >
                                <Filter size={20} />
                            </button>
                            {canEdit && (
                                <button
                                    onClick={handleAdd}
                                    className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow"
                                >
                                    <Plus size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหาวีดีโอ..."
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filter Panel */}
                    {showFilters && (
                        <div className="pt-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedCategory("all")}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedCategory === "all"
                                    ? "bg-purple-500 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                    }`}
                            >
                                ทั้งหมด
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat
                                        ? "bg-purple-500 text-white"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-sm flex items-center gap-2"
                                >
                                    <X size={16} />
                                    ล้างตัวกรอง
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
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
                                className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium hover:from-purple-600 hover:to-indigo-600 transition-all inline-flex items-center gap-2"
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
                                                        ? 'bg-purple-500 text-white shadow-md'
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
