"use client";

import React from "react";
import { Camera, Calendar as CalendarIcon, Image as ImageIcon } from "lucide-react";
import { PhotographyJob } from "@/types";

interface PhotoGalleryListProps {
    photoJobs: PhotographyJob[];
}

export default function PhotoGalleryList({ photoJobs }: PhotoGalleryListProps) {
    if (photoJobs.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <Camera size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">ยังไม่มีภาพกิจกรรม</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3">
            {photoJobs.slice(0, 5).map((job) => (
                <div
                    key={job.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {job.coverImage ? (
                            <img
                                src={job.coverImage}
                                alt={job.title}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="text-gray-400" size={20} />
                            </div>
                        )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-white transition-colors truncate">
                            {job.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <CalendarIcon size={11} />
                            <span>{job.endTime?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        </div>
                    </div>
                    {/* Action Icons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {job.driveLink && (
                            <a
                                href={job.driveLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="เปิด Google Drive"
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img src="/Google_Drive_icon.png" alt="Drive" className="w-5 h-5 object-contain" />
                            </a>
                        )}
                        {(job.facebookPostId || job.facebookPermalink) && (
                            <a
                                href={job.facebookPermalink || (job.facebookPostId ? `https://www.facebook.com/permalink.php?story_fbid=${job.facebookPostId.split('_')[1] || job.facebookPostId}&id=${job.facebookPostId.split('_')[0]}` : '#')}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="เปิดโพส Facebook"
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img src="/facebook-logo.png" alt="Facebook" className="w-5 h-5 object-contain" />
                            </a>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
