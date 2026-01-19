"use client";

import React from "react";
import { VideoItem, VideoPlatform, VideoLink } from "../../types";
import { Calendar, Play, Pencil } from "lucide-react";

// Platform icons mapping
const platformIcons: Record<VideoPlatform, string> = {
    youtube: "/youtube_icon.png",
    tiktok: "/tiktok_icon.png",
    gdrive: "/Google_Drive_icon.png",
    facebook: "/facebook-logo.png",
    other: "/Google_Drive_icon.png"
};

interface VideoGalleryCardProps {
    video: VideoItem;
    onEdit?: (video: VideoItem) => void;
    canEdit?: boolean;
}

export default function VideoGalleryCard({ video, onEdit, canEdit }: VideoGalleryCardProps) {
    const formatDate = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    // Collect all links (primary + additional)
    const allLinks: { platform: VideoPlatform; url: string }[] = [
        { platform: video.platform, url: video.videoUrl }
    ];
    if (video.videoLinks) {
        video.videoLinks.forEach(link => {
            allLinks.push({ platform: link.platform, url: link.url });
        });
    }

    return (
        <div className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
            {/* Thumbnail */}
            <a
                href={video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 relative overflow-hidden"
            >
                {video.thumbnailUrl ? (
                    <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Play size={48} className="text-gray-300 dark:text-gray-600" />
                    </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                        <Play size={28} className="text-gray-900 ml-1" fill="currentColor" />
                    </div>
                </div>

                {/* Category badge */}
                {video.category && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
                        {video.category}
                    </div>
                )}
            </a>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {video.title}
                </h3>

                {video.description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {video.description}
                    </p>
                )}

                <div className="mt-3 flex items-center justify-between">
                    {/* Date */}
                    <div className="flex items-center gap-2">
                        {video.eventDate && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <Calendar size={14} />
                                <span>{formatDate(video.eventDate)}</span>
                            </div>
                        )}
                    </div>

                    {/* Platform icons and edit button */}
                    <div className="flex items-center gap-1">
                        {/* Platform icons */}
                        {allLinks.map((link, index) => (
                            <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
                                title={link.platform}
                            >
                                <img
                                    src={platformIcons[link.platform]}
                                    alt={link.platform}
                                    className="w-5 h-5 object-contain"
                                />
                            </a>
                        ))}

                        {/* Edit button */}
                        {canEdit && onEdit && (
                            <button
                                onClick={() => onEdit(video)}
                                className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 transition-colors"
                                title="แก้ไข"
                            >
                                <Pencil size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
