import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { getBangkokDateString } from '@/lib/dateUtils';
import { generateThumbnail } from '@/utils/generateThumbnail';
import { fetchWithRetry } from '@/utils/fetchWithRetry';

interface UploadResult {
    ids: string[];
    folderLink: string;
}

interface UsePhotographyJobUploadReturn {
    // Cover file state
    coverFiles: Record<string, File>;
    coverPreviews: Record<string, string>;

    // Job files state
    jobFiles: Record<string, File[]>;
    previews: Record<string, string[]>;

    // Upload state
    uploadProgress: Record<string, number>;
    isUploadComplete: Record<string, boolean>;
    isUploading: Record<string, boolean>;
    uploadedFileIds: Record<string, string[]>;

    // Drag state
    isDraggingCover: Record<string, boolean>;
    isDraggingFiles: Record<string, boolean>;

    // Drive links
    driveLinks: Record<string, string>;

    // Handlers
    handleLinkChange: (jobId: string, value: string) => void;
    handleCoverChange: (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
    handleJobFilesChange: (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
    handleCoverDragOver: (jobId: string, e: React.DragEvent) => void;
    handleCoverDragLeave: (jobId: string, e: React.DragEvent) => void;
    handleCoverDrop: (jobId: string, e: React.DragEvent) => void;
    handleJobFilesDragOver: (jobId: string, e: React.DragEvent) => void;
    handleJobFilesDragLeave: (jobId: string, e: React.DragEvent) => void;
    handleJobFilesDrop: (jobId: string, e: React.DragEvent) => void;
    removeFile: (jobId: string, index: number) => void;
    performDriveUpload: (jobId: string, jobTitle: string, jobDate: any) => Promise<UploadResult>;
    fileToBase64: (file: File) => Promise<string>;

    // Setters for external updates
    setIsUploadComplete: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setIsUploading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setUploadedFileIds: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    setUploadProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setDriveLinks: React.Dispatch<React.SetStateAction<Record<string, string>>>;

    // Cancel
    cancelUpload: (jobId: string) => void;

    // Cleanup
    clearJobState: (jobId: string) => void;
}

/**
 * Custom hook for managing photography job file uploads
 * Handles cover images, activity photos, drag & drop, and Google Drive uploads
 */
export function usePhotographyJobUpload(): UsePhotographyJobUploadReturn {
    // Cover file state
    const [coverFiles, setCoverFiles] = useState<Record<string, File>>({});
    const [coverPreviews, setCoverPreviews] = useState<Record<string, string>>({});

    // Job files state
    const [jobFiles, setJobFiles] = useState<Record<string, File[]>>({});
    const [previews, setPreviews] = useState<Record<string, string[]>>({});

    // Upload state
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isUploadComplete, setIsUploadComplete] = useState<Record<string, boolean>>({});
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [uploadedFileIds, setUploadedFileIds] = useState<Record<string, string[]>>({});

    // Drag state
    const [isDraggingCover, setIsDraggingCover] = useState<Record<string, boolean>>({});
    const [isDraggingFiles, setIsDraggingFiles] = useState<Record<string, boolean>>({});

    // Drive links
    const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});

    // F. Abort controllers per job
    const abortControllersRef = useRef<Record<string, AbortController>>({});

    // Cancel ongoing upload for a job
    const cancelUpload = useCallback((jobId: string) => {
        const controller = abortControllersRef.current[jobId];
        if (controller) {
            controller.abort();
            delete abortControllersRef.current[jobId];
        }
        setIsUploading(prev => ({ ...prev, [jobId]: false }));
        setUploadProgress(prev => ({ ...prev, [jobId]: 0 }));
        toast('ยกเลิกการอัปโหลดแล้ว', { icon: '🚫' });
    }, []);

    // Link change handler
    const handleLinkChange = useCallback((jobId: string, value: string) => {
        setDriveLinks(prev => ({ ...prev, [jobId]: value }));
    }, []);

    // Process cover file (generates 300px thumbnail for preview)
    const processCoverFile = useCallback(async (jobId: string, file: File) => {
        if (file && file.type.startsWith('image/')) {
            setCoverFiles(prev => ({ ...prev, [jobId]: file }));
            try {
                const thumbnail = await generateThumbnail(file, 300);
                setCoverPreviews(prev => ({ ...prev, [jobId]: thumbnail }));
            } catch {
                // Fallback to blob URL if thumbnail fails
                setCoverPreviews(prev => ({ ...prev, [jobId]: URL.createObjectURL(file) }));
            }
        } else {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
        }
    }, []);

    // Process job files (generates 150px thumbnails for preview grid)
    // E. File size validation: reject files > 25MB
    const MAX_FILE_SIZE_MB = 25;
    const processJobFiles = useCallback(async (jobId: string, newFiles: File[]) => {
        const imageFiles = newFiles.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length < newFiles.length) {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น (ไฟล์ที่ไม่ใช่รูปภาพถูกข้าม)");
        }
        // Reject oversized files
        const oversized = imageFiles.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
        const validFiles = imageFiles.filter(f => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);
        if (oversized.length > 0) {
            toast.error(`${oversized.length} ไฟล์มีขนาดเกิน ${MAX_FILE_SIZE_MB}MB — กรุณาลดขนาดก่อน`);
        }
        if (validFiles.length > 0) {
            setJobFiles(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...validFiles] }));
            // Generate tiny thumbnails instead of full-res blob URLs
            const newPreviews = await Promise.all(
                validFiles.map(file =>
                    generateThumbnail(file, 250).catch(() => URL.createObjectURL(file))
                )
            );
            setPreviews(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...newPreviews] }));
            setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
        }
    }, []);

    // Cover change handler
    const handleCoverChange = useCallback((jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processCoverFile(jobId, file);
    }, [processCoverFile]);

    // Job files change handler
    const handleJobFilesChange = useCallback((jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) processJobFiles(jobId, files);
    }, [processJobFiles]);

    // Drag & Drop handlers for cover
    const handleCoverDragOver = useCallback((jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingCover(prev => ({ ...prev, [jobId]: true }));
    }, []);

    const handleCoverDragLeave = useCallback((jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const relatedTarget = e.relatedTarget as Node;
        if (!e.currentTarget.contains(relatedTarget)) {
            setIsDraggingCover(prev => ({ ...prev, [jobId]: false }));
        }
    }, []);

    const handleCoverDrop = useCallback((jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingCover(prev => ({ ...prev, [jobId]: false }));
        const file = e.dataTransfer.files?.[0];
        if (file) processCoverFile(jobId, file);
    }, [processCoverFile]);

    // Drag & Drop handlers for job files
    const handleJobFilesDragOver = useCallback((jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFiles(prev => ({ ...prev, [jobId]: true }));
    }, []);

    const handleJobFilesDragLeave = useCallback((jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const relatedTarget = e.relatedTarget as Node;
        if (!e.currentTarget.contains(relatedTarget)) {
            setIsDraggingFiles(prev => ({ ...prev, [jobId]: false }));
        }
    }, []);

    const handleJobFilesDrop = useCallback((jobId: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFiles(prev => ({ ...prev, [jobId]: false }));
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) processJobFiles(jobId, files);
    }, [processJobFiles]);

    // Remove file
    const removeFile = useCallback((jobId: string, index: number) => {
        setJobFiles(prev => {
            const files = [...(prev[jobId] || [])];
            files.splice(index, 1);
            return { ...prev, [jobId]: files };
        });
        setPreviews(prev => {
            const currentPreviews = [...(prev[jobId] || [])];
            currentPreviews.splice(index, 1);
            return { ...prev, [jobId]: currentPreviews };
        });
        setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
    }, []);

    // Perform Google Drive upload (with retry, allSettled, token refresh, abort)
    const performDriveUpload = useCallback(async (jobId: string, jobTitle: string, jobDate: any): Promise<UploadResult> => {
        const files = jobFiles[jobId] || [];
        if (files.length === 0) return { ids: [], folderLink: "" };

        // F. Create AbortController for this upload
        const abortController = new AbortController();
        abortControllersRef.current[jobId] = abortController;
        const { signal } = abortController;

        // Get Firebase Auth Token for API authentication
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('User not authenticated');
        let idToken = await currentUser.getIdToken();

        const getHeaders = () => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        });

        // STEP 1: Pre-create folder hierarchy (ONCE, prevents race condition)
        const prepareResponse = await fetchWithRetry('/api/drive/prepare-folder', {
            method: 'POST',
            headers: getHeaders(),
            signal,
            body: JSON.stringify({
                eventName: jobTitle,
                jobDate: jobDate
            }),
        });

        if (!prepareResponse.ok) {
            const error = await prepareResponse.json();
            throw new Error(error.error || 'Failed to prepare folder');
        }
        const { folderId, folderLink } = await prepareResponse.json();

        // STEP 2: Upload files in PARALLEL batches
        const BATCH_SIZE = 5;
        const TOKEN_REFRESH_INTERVAL = 50; // D. Refresh token every 50 files
        const uploadedIds: string[] = [];
        let completedCount = 0;
        let failedCount = 0;
        const totalFiles = files.length;

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            // D. Token refresh: prevent expiry during long uploads
            if (i > 0 && i % TOKEN_REFRESH_INTERVAL === 0) {
                idToken = await currentUser.getIdToken(true);
            }

            const batch = files.slice(i, i + BATCH_SIZE);

            // C. Promise.allSettled: partial failures don't abort entire batch
            const batchResults = await Promise.allSettled(batch.map(async (file) => {
                // B. fetchWithRetry: auto-retry on server errors
                const initResponse = await fetchWithRetry('/api/drive/upload-to-folder', {
                    method: 'POST',
                    headers: getHeaders(),
                    signal,
                    body: JSON.stringify({
                        fileName: file.name,
                        mimeType: file.type,
                        folderId: folderId
                    }),
                });

                if (!initResponse.ok) {
                    let errorMessage;
                    try {
                        const error = await initResponse.json();
                        errorMessage = error.error;
                    } catch (e) {
                        const text = await initResponse.text();
                        errorMessage = `Server Error (${initResponse.status}): ${text.slice(0, 50)}`;
                    }
                    throw new Error(`[${file.name}] ${errorMessage || 'Failed to initiate upload'}`);
                }
                const { uploadUrl } = await initResponse.json();

                const uploadResponse = await fetchWithRetry(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    signal,
                    headers: { 'Content-Type': file.type },
                });

                if (!uploadResponse.ok) throw new Error(`Failed to upload ${file.name} to Google Drive`);
                const uploadResult = await uploadResponse.json();

                return uploadResult.id || null;
            }));

            // Process results: collect successes, count failures
            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    uploadedIds.push(result.value);
                } else if (result.status === 'rejected') {
                    failedCount++;
                    console.error('[Drive Upload] File failed:', result.reason?.message);
                }
                completedCount++;
                setUploadProgress(prev => ({ ...prev, [jobId]: Math.round((completedCount / totalFiles) * 100) }));
            });
        }

        // Cleanup abort controller
        delete abortControllersRef.current[jobId];

        // Warn about partial failures but don't throw
        if (failedCount > 0) {
            toast.error(`${failedCount} ไฟล์อัปโหลดไม่สำเร็จ (สำเร็จ ${uploadedIds.length}/${totalFiles})`);
        }

        return { ids: uploadedIds, folderLink: folderLink };
    }, [jobFiles]);

    // Convert file to base64
    const fileToBase64 = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:image/...;base64, prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }, []);

    // Cleanup job state
    const clearJobState = useCallback((jobId: string) => {
        setCoverFiles(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setJobFiles(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setIsUploadComplete(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setPreviews(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setCoverPreviews(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        setUploadedFileIds(prev => { const n = { ...prev }; delete n[jobId]; return n; });
    }, []);

    return {
        // State
        coverFiles,
        coverPreviews,
        jobFiles,
        previews,
        uploadProgress,
        isUploadComplete,
        isUploading,
        uploadedFileIds,
        isDraggingCover,
        isDraggingFiles,
        driveLinks,

        // Handlers
        handleLinkChange,
        handleCoverChange,
        handleJobFilesChange,
        handleCoverDragOver,
        handleCoverDragLeave,
        handleCoverDrop,
        handleJobFilesDragOver,
        handleJobFilesDragLeave,
        handleJobFilesDrop,
        removeFile,
        performDriveUpload,
        fileToBase64,

        // Setters
        setIsUploadComplete,
        setIsUploading,
        setUploadedFileIds,
        setUploadProgress,
        setDriveLinks,

        // Cancel
        cancelUpload,

        // Cleanup
        clearJobState,
    };
}
