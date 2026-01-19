import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VideoItem } from '../types';

interface UseVideoGalleryOptions {
    category?: string;
    limit?: number;
    publishedOnly?: boolean;
}

interface UseVideoGalleryReturn {
    videos: VideoItem[];
    categories: string[];
    loading: boolean;
    error: string | null;
}

// Default categories
const DEFAULT_CATEGORIES = ['กีฬาสี', 'วันสำคัญ', 'ประชาสัมพันธ์', 'กิจกรรมอื่นๆ'];

export function useVideoGallery(options: UseVideoGalleryOptions = {}): UseVideoGalleryReturn {
    const { category, limit: queryLimit = 50, publishedOnly = true } = options;

    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let q = query(
            collection(db, 'video_gallery'),
            orderBy('createdAt', 'desc'),
            limit(queryLimit)
        );

        // Filter by published status
        if (publishedOnly) {
            q = query(
                collection(db, 'video_gallery'),
                where('isPublished', '==', true),
                orderBy('createdAt', 'desc'),
                limit(queryLimit)
            );
        }

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                let fetchedVideos = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as VideoItem[];

                // Filter by category if provided
                if (category && category !== 'all') {
                    fetchedVideos = fetchedVideos.filter(v => v.category === category);
                }

                setVideos(fetchedVideos);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching videos:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [category, queryLimit, publishedOnly]);

    // Get unique categories from videos + defaults
    const categories = Array.from(new Set([
        ...DEFAULT_CATEGORIES,
        ...videos.map(v => v.category).filter(Boolean)
    ]));

    return { videos, categories, loading, error };
}

// Helper function to extract YouTube video ID
export function extractYouTubeId(url: string): string | null {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

// Helper function to get YouTube thumbnail
export function getYouTubeThumbnail(url: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string {
    const videoId = extractYouTubeId(url);
    if (!videoId) return '';

    const qualityMap = {
        default: 'default',
        mq: 'mqdefault',
        hq: 'hqdefault',
        sd: 'sddefault',
        maxres: 'maxresdefault'
    };

    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

// Helper function to extract Google Drive file ID (supports multiple URL formats)
export function extractGDriveId(url: string): string | null {
    // Format 1: /d/{fileId}/
    let match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];

    // Format 2: id={fileId}
    match = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (match) return match[1];

    // Format 3: /file/d/{fileId}
    match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];

    return null;
}

// Helper function to get Google Drive thumbnail
// Note: This requires the file to be publicly shared
export function getGDriveThumbnail(url: string): string {
    const fileId = extractGDriveId(url);
    if (!fileId) return '';

    // Use lh3.googleusercontent.com which works better for public files
    // Alternative formats to try if one doesn't work:
    // 1. https://drive.google.com/thumbnail?id=${fileId}&sz=w400
    // 2. https://lh3.googleusercontent.com/d/${fileId}=w400
    // 3. https://drive.google.com/uc?export=view&id=${fileId}

    return `https://lh3.googleusercontent.com/d/${fileId}=w400`;
}

// Helper function to detect platform from URL
export function detectPlatform(url: string): VideoItem['platform'] {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('drive.google.com')) return 'gdrive';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    return 'other';
}

// Helper function to auto-generate thumbnail from URL
export function autoGenerateThumbnail(url: string): string {
    const platform = detectPlatform(url);

    switch (platform) {
        case 'youtube':
            return getYouTubeThumbnail(url);
        case 'gdrive':
            return getGDriveThumbnail(url);
        default:
            return ''; // User needs to provide thumbnail manually
    }
}
