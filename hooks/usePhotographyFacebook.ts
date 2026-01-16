import { useState, useCallback } from 'react';
import { compressImage } from '@/utils/imageCompression';

interface UsePhotographyFacebookReturn {
    // State
    facebookEnabled: Record<string, boolean>;
    facebookSent: Record<string, boolean>;
    facebookCaption: Record<string, string>;
    facebookSelectedOrder: Record<string, number[]>;
    facebookDraftMode: Record<string, boolean>;
    lastClickedIndex: Record<string, number>;

    // Handlers
    handleFacebookToggle: (jobId: string) => void;
    handleFacebookPhotoClick: (jobId: string, index: number, shiftKey: boolean) => void;
    selectFirstN: (jobId: string, n: number, totalPhotos: number) => void;
    selectAll: (jobId: string, totalPhotos: number) => void;
    selectNone: (jobId: string) => void;
    performFacebookPost: (
        jobId: string,
        files: File[],
        fileToBase64: (file: File) => Promise<string>
    ) => Promise<void>;

    // Setters
    setFacebookCaption: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setFacebookDraftMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setFacebookSent: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

    // Cleanup
    clearFacebookState: (jobId: string) => void;
}

/**
 * Custom hook for managing Facebook posting functionality
 * Handles photo selection, captions, draft mode, and API calls
 */
export function usePhotographyFacebook(): UsePhotographyFacebookReturn {
    const [facebookEnabled, setFacebookEnabled] = useState<Record<string, boolean>>({});
    const [facebookSent, setFacebookSent] = useState<Record<string, boolean>>({});
    const [facebookCaption, setFacebookCaption] = useState<Record<string, string>>({});
    const [facebookSelectedOrder, setFacebookSelectedOrder] = useState<Record<string, number[]>>({});
    const [facebookDraftMode, setFacebookDraftMode] = useState<Record<string, boolean>>({});
    const [lastClickedIndex, setLastClickedIndex] = useState<Record<string, number>>({});

    // Toggle Facebook posting
    const handleFacebookToggle = useCallback((jobId: string) => {
        setFacebookEnabled(prev => ({ ...prev, [jobId]: !prev[jobId] }));
    }, []);

    // Handle photo click with shift-select support
    const handleFacebookPhotoClick = useCallback((jobId: string, index: number, shiftKey: boolean) => {
        setFacebookSelectedOrder(prev => {
            const current = [...(prev[jobId] || [])];
            if (shiftKey && lastClickedIndex[jobId] !== undefined) {
                const start = Math.min(lastClickedIndex[jobId], index);
                const end = Math.max(lastClickedIndex[jobId], index);
                for (let i = start; i <= end; i++) {
                    if (!current.includes(i)) current.push(i);
                }
            } else {
                const existingIdx = current.indexOf(index);
                if (existingIdx !== -1) current.splice(existingIdx, 1);
                else current.push(index);
            }
            return { ...prev, [jobId]: current };
        });
        setLastClickedIndex(prev => ({ ...prev, [jobId]: index }));
    }, [lastClickedIndex]);

    // Select first N photos
    const selectFirstN = useCallback((jobId: string, n: number, totalPhotos: number) => {
        const indices = Array.from({ length: Math.min(n, totalPhotos) }, (_, i) => i);
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: indices }));
    }, []);

    // Select all photos
    const selectAll = useCallback((jobId: string, totalPhotos: number) => {
        const indices = Array.from({ length: totalPhotos }, (_, i) => i);
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: indices }));
    }, []);

    // Clear selection
    const selectNone = useCallback((jobId: string) => {
        setFacebookSelectedOrder(prev => ({ ...prev, [jobId]: [] }));
    }, []);

    // Perform Facebook post
    const performFacebookPost = useCallback(async (
        jobId: string,
        files: File[],
        fileToBase64: (file: File) => Promise<string>
    ) => {
        const selectedOrder = facebookSelectedOrder[jobId];
        if (!selectedOrder || selectedOrder.length === 0) return;

        if (!files || files.length === 0) throw new Error('ไม่พบไฟล์สำหรับ Facebook');

        const asDraft = facebookDraftMode[jobId] || false;
        const caption = facebookCaption[jobId] || '';

        // Upload photos one by one to avoid 413 Payload Too Large
        const photoIds: string[] = [];

        for (let i = 0; i < selectedOrder.length; i++) {
            const idx = selectedOrder[i];
            const file = files[idx];
            if (!file) continue;

            // Always compress for Facebook to stay under Vercel 4.5MB limit
            let fileToUpload = file;
            if (file.size > 3 * 1024 * 1024) {
                fileToUpload = await compressImage(file, {
                    maxWidth: 2048,
                    maxHeight: 2048,
                    quality: 0.8,
                    maxSizeMB: 3
                });
            }

            const base64 = await fileToBase64(fileToUpload);

            // Upload single photo
            const res = await fetch('/api/facebook/upload-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photo: { base64, mimeType: fileToUpload.type },
                    published: false // Always unpublished first
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || `Failed to upload photo ${i + 1}`);
            }

            const data = await res.json();
            if (data.photoId) photoIds.push(data.photoId);
        }

        if (photoIds.length === 0) throw new Error('ไม่สามารถอัปโหลดภาพไป Facebook ได้');

        // Create post with all uploaded photos
        const postRes = await fetch('/api/facebook/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                caption,
                photoIds,
                asDraft
            })
        });

        if (!postRes.ok) {
            const error = await postRes.json();
            throw new Error(error.error || 'Failed to create Facebook post');
        }
    }, [facebookSelectedOrder, facebookDraftMode, facebookCaption]);

    // Remove file index from selection
    const removeFromSelection = useCallback((jobId: string, index: number) => {
        setFacebookSelectedOrder(prev => {
            const current = prev[jobId] || [];
            return { ...prev, [jobId]: current.filter(i => i !== index).map(i => i > index ? i - 1 : i) };
        });
    }, []);

    // Cleanup job state
    const clearFacebookState = useCallback((jobId: string) => {
        setFacebookEnabled(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setFacebookSent(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setFacebookSelectedOrder(prev => { const n = { ...prev }; delete n[jobId]; return n; });
    }, []);

    return {
        // State
        facebookEnabled,
        facebookSent,
        facebookCaption,
        facebookSelectedOrder,
        facebookDraftMode,
        lastClickedIndex,

        // Handlers
        handleFacebookToggle,
        handleFacebookPhotoClick,
        selectFirstN,
        selectAll,
        selectNone,
        performFacebookPost,

        // Setters
        setFacebookCaption,
        setFacebookDraftMode,
        setFacebookSent,

        // Cleanup
        clearFacebookState,
    };
}

// Re-export removeFromSelection for use in main component
export function removeFromFacebookSelection(
    setFacebookSelectedOrder: React.Dispatch<React.SetStateAction<Record<string, number[]>>>,
    jobId: string,
    index: number
) {
    setFacebookSelectedOrder(prev => {
        const current = prev[jobId] || [];
        return { ...prev, [jobId]: current.filter(i => i !== index).map(i => i > index ? i - 1 : i) };
    });
}
