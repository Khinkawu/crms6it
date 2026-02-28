import { useState, useCallback } from 'react';
import { compressImageToSize } from '@/utils/imageCompression';
import { fetchWithRetry } from '@/utils/fetchWithRetry';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

interface UsePhotographyFacebookReturn {
    // State
    facebookEnabled: Record<string, boolean>;
    facebookSent: Record<string, boolean>;
    facebookCaption: Record<string, string>;
    facebookSelectedOrder: Record<string, number[]>;
    facebookDraftMode: Record<string, boolean>;
    facebookProgress: Record<string, number>;
    lastClickedIndex: Record<string, number>;
    isGeneratingCaption: Record<string, boolean>;

    // Handlers
    handleFacebookToggle: (jobId: string) => void;
    handleFacebookPhotoClick: (jobId: string, index: number, shiftKey: boolean) => void;
    selectFirstN: (jobId: string, n: number, totalPhotos: number) => void;
    selectAll: (jobId: string, totalPhotos: number) => void;
    selectNone: (jobId: string) => void;
    generateAutoCaption: (jobId: string, title: string, location?: string, date?: string, description?: string, bookingId?: string) => Promise<void>;
    performFacebookPost: (
        jobId: string,
        files: File[],
        fileToBase64: (file: File) => Promise<string>
    ) => Promise<void>;

    // Setters
    setFacebookCaption: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setFacebookDraftMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setFacebookSent: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setFacebookSelectedOrder: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;

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
    const [facebookProgress, setFacebookProgress] = useState<Record<string, number>>({});
    const [lastClickedIndex, setLastClickedIndex] = useState<Record<string, number>>({});
    const [isGeneratingCaption, setIsGeneratingCaption] = useState<Record<string, boolean>>({});

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

    // Generate Auto Caption
    const generateAutoCaption = useCallback(async (jobId: string, title: string, location?: string, date?: string, description?: string, bookingId?: string) => {
        setIsGeneratingCaption(prev => ({ ...prev, [jobId]: true }));
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error('User not authenticated');
            const idToken = await currentUser.getIdToken();

            const res = await fetchWithRetry('/api/facebook/generate-caption', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ title, location, date, description, bookingId })
            });

            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.error || `Error ${res.status}`);
            }

            const data = await res.json();
            if (data.success && data.caption) {
                setFacebookCaption(prev => ({ ...prev, [jobId]: data.caption }));
            }
        } catch (error: any) {
            console.error('Error generating caption:', error);
            throw new Error(error.message || 'ไม่สามารถสร้างแคปชั่นได้');
        } finally {
            setIsGeneratingCaption(prev => ({ ...prev, [jobId]: false }));
        }
    }, [setFacebookCaption]);

    // Perform Facebook post (with idempotency check, compression, and detailed error handling)
    const performFacebookPost = useCallback(async (
        jobId: string,
        files: File[],
        fileToBase64: (file: File) => Promise<string>
    ) => {
        const selectedOrder = facebookSelectedOrder[jobId];
        if (!selectedOrder || selectedOrder.length === 0) return;

        if (!files || files.length === 0) throw new Error('ไม่พบไฟล์สำหรับ Facebook');

        // IDEMPOTENCY CHECK: Prevent duplicate Facebook posts
        const jobDocRef = doc(db, "photography_jobs", jobId);
        const jobSnapshot = await getDoc(jobDocRef);
        if (jobSnapshot.exists()) {
            const jobData = jobSnapshot.data();
            if (jobData.facebookPostId) {
                console.warn('Facebook post already exists for this job:', jobId);
                return;
            }
        }

        const asDraft = facebookDraftMode[jobId] || false;
        const caption = facebookCaption[jobId] || '';

        // Get Firebase Auth Token for API authentication
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('User not authenticated');
        const idToken = await currentUser.getIdToken();
        const authHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        };

        // Upload photos one by one to avoid 413 Payload Too Large
        const photoIds: string[] = [];
        setFacebookProgress(prev => ({ ...prev, [jobId]: 0 }));

        for (let i = 0; i < selectedOrder.length; i++) {
            const idx = selectedOrder[i];
            const file = files[idx];
            if (!file) continue;

            // Always compress for Facebook to stay under Vercel 4.5MB limit
            // Base64 overhead is ~33%. Max safe file size is ~3.3MB → target 2.5MB for safety.
            const fileToUpload = await compressImageToSize(file, 2.5, 0.7);

            const base64 = await fileToBase64(fileToUpload);

            // Upload single photo (with auto-retry)
            const res = await fetchWithRetry('/api/facebook/upload-photo', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    photo: { base64, mimeType: fileToUpload.type },
                    published: false
                })
            });

            if (!res.ok) {
                let errorMessage;
                try {
                    const error = await res.json();
                    errorMessage = error.error;
                } catch (e) {
                    const text = await res.text();
                    if (res.status === 413 || text.includes('PAYLOAD_TOO_LARGE')) {
                        errorMessage = "รูปภาพมีขนาดใหญ่เกินไป (413 Payload Too Large) - กรุณาลดขนาดไฟล์";
                    } else if (res.status === 504) {
                        errorMessage = "การเชื่อมต่อหมดเวลา (504 Gateway Timeout) - กรุณาลองใหม่";
                    } else {
                        errorMessage = `Upload Error (${res.status}): ${text.substring(0, 100)}`;
                    }
                }
                throw new Error(`[${file.name}] ${errorMessage || 'Failed to upload photo ' + (i + 1)}`);
            }

            const data = await res.json();
            if (data.photoId) photoIds.push(data.photoId);

            // G. Update Facebook progress
            setFacebookProgress(prev => ({ ...prev, [jobId]: Math.round(((i + 1) / selectedOrder.length) * 100) }));
        }

        if (photoIds.length === 0) throw new Error('ไม่สามารถอัปโหลดภาพไป Facebook ได้');

        // Create post with all uploaded photos (with auto-retry)
        const postRes = await fetchWithRetry('/api/facebook/post', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                jobId,
                caption,
                photoIds,
                asDraft
            })
        });

        if (!postRes.ok) {
            let errorMessage;
            try {
                const error = await postRes.json();
                errorMessage = error.error;
            } catch (e) {
                const text = await postRes.text();
                errorMessage = `Post Error (${postRes.status}): ${text.substring(0, 100)}`;
            }
            throw new Error(errorMessage || 'Failed to create Facebook post');
        }
    }, [facebookSelectedOrder, facebookDraftMode, facebookCaption]);

    // Cleanup ALL Facebook state for a job
    const clearFacebookState = useCallback((jobId: string) => {
        setFacebookEnabled(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setFacebookSent(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setFacebookSelectedOrder(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setFacebookCaption(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setFacebookDraftMode(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setFacebookProgress(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setLastClickedIndex(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setIsGeneratingCaption(prev => { const n = { ...prev }; delete n[jobId]; return n; });
    }, []);

    return {
        facebookEnabled,
        facebookSent,
        facebookCaption,
        facebookSelectedOrder,
        facebookDraftMode,
        facebookProgress,
        lastClickedIndex,
        isGeneratingCaption,
        handleFacebookToggle,
        handleFacebookPhotoClick,
        selectFirstN,
        selectAll,
        selectNone,
        generateAutoCaption,
        performFacebookPost,
        setFacebookCaption,
        setFacebookDraftMode,
        setFacebookSent,
        setFacebookSelectedOrder,
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
