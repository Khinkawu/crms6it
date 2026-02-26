import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { generateThumbnail } from '@/utils/generateThumbnail';
import { fetchWithRetry } from '@/utils/fetchWithRetry';

interface UploadResult {
    ids: string[];
    folderLink: string;
}

interface UseDailyReportUploadReturn {
    // Job files state
    reportFiles: File[];
    previews: string[];

    // Upload state
    uploadProgress: number;
    isUploading: boolean;

    // Drag state
    isDraggingFiles: boolean;

    // Drive link
    driveLink: string;

    // Handlers
    handleLinkChange: (value: string) => void;
    handleReportFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleReportFilesDragOver: (e: React.DragEvent) => void;
    handleReportFilesDragLeave: (e: React.DragEvent) => void;
    handleReportFilesDrop: (e: React.DragEvent) => void;
    removeFile: (index: number) => void;
    performDriveUpload: (photographerName: string, dateStr: string) => Promise<UploadResult>;

    // Setters for external updates
    setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
    setUploadProgress: React.Dispatch<React.SetStateAction<number>>;
    setDriveLink: React.Dispatch<React.SetStateAction<string>>;

    // Cancel
    cancelUpload: () => void;

    // Cleanup
    clearUploadState: () => void;
}

/**
 * Custom hook for managing daily photography report file uploads
 * Handles up to 10 activity photos, drag & drop, and Google Drive uploads
 */
export function useDailyReportUpload(): UseDailyReportUploadReturn {
    // Job files state
    const [reportFiles, setReportFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);

    // Upload state
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState<boolean>(false);

    // Drag state
    const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);

    // Drive link
    const [driveLink, setDriveLink] = useState<string>('');

    // Abort controller
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cancel ongoing upload
    const cancelUpload = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsUploading(false);
        setUploadProgress(0);
        toast('ยกเลิกการอัปโหลดแล้ว', { icon: '🚫' });
    }, []);

    // Link change handler
    const handleLinkChange = useCallback((value: string) => {
        setDriveLink(value);
    }, []);

    // Process job files
    const MAX_FILE_SIZE_MB = 25;
    const MAX_FILES = 10;

    const processReportFiles = useCallback(async (newFiles: File[]) => {
        const imageFiles = newFiles.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length < newFiles.length) {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
        }

        // Reject oversized files
        const oversized = imageFiles.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
        const validFiles = imageFiles.filter(f => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);

        if (oversized.length > 0) {
            toast.error(`${oversized.length} ไฟล์มีขนาดเกิน ${MAX_FILE_SIZE_MB}MB — กรุณาลดขนาดก่อน`);
        }

        if (validFiles.length > 0) {
            setReportFiles(prev => {
                const combined = [...prev, ...validFiles];
                if (combined.length > MAX_FILES) {
                    toast.error(`เลือกรูปภาพได้สูงสุด ${MAX_FILES} รูป`);
                    return combined.slice(0, MAX_FILES);
                }
                return combined;
            });

            // Generate thumbnails
            const newPreviews = await Promise.all(
                validFiles.map(file =>
                    generateThumbnail(file, 250).catch(() => URL.createObjectURL(file))
                )
            );

            setPreviews(prev => {
                const combined = [...prev, ...newPreviews];
                if (combined.length > MAX_FILES) return combined.slice(0, MAX_FILES);
                return combined;
            });
        }
    }, []);

    // Job files change handler
    const handleReportFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) processReportFiles(files);
    }, [processReportFiles]);

    // Drag & Drop handlers for job files
    const handleReportFilesDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFiles(true);
    }, []);

    const handleReportFilesDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const relatedTarget = e.relatedTarget as Node;
        if (!e.currentTarget.contains(relatedTarget)) {
            setIsDraggingFiles(false);
        }
    }, []);

    const handleReportFilesDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFiles(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) processReportFiles(files);
    }, [processReportFiles]);

    // Remove file
    const removeFile = useCallback((index: number) => {
        setReportFiles(prev => {
            const files = [...prev];
            files.splice(index, 1);
            return files;
        });
        setPreviews(prev => {
            const currentPreviews = [...prev];
            currentPreviews.splice(index, 1);
            return currentPreviews;
        });
    }, []);

    // Perform Google Drive upload
    const performDriveUpload = useCallback(async (photographerName: string, dateStr: string): Promise<UploadResult> => {
        if (reportFiles.length === 0) return { ids: [], folderLink: "" };

        // Create AbortController for this upload
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const { signal } = abortController;

        // Get Firebase Auth Token
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('User not authenticated');
        let idToken = await currentUser.getIdToken();

        const getHeaders = () => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        });

        // STEP 1: Pre-create folder hierarchy
        const prepareResponse = await fetchWithRetry('/api/drive/prepare-daily-report', {
            method: 'POST',
            headers: getHeaders(),
            signal,
            body: JSON.stringify({
                photographerName,
                dateStr
            }),
        });

        if (!prepareResponse.ok) {
            const error = await prepareResponse.json();
            throw new Error(error.error || 'Failed to prepare folder');
        }
        const { folderId, folderLink } = await prepareResponse.json();

        // STEP 2: Upload files
        const BATCH_SIZE = 5;
        const TOKEN_REFRESH_INTERVAL = 50;
        const uploadedIds: string[] = [];
        let completedCount = 0;
        let failedCount = 0;
        const totalFiles = reportFiles.length;

        for (let i = 0; i < reportFiles.length; i += BATCH_SIZE) {
            if (i > 0 && i % TOKEN_REFRESH_INTERVAL === 0) {
                idToken = await currentUser.getIdToken(true);
            }

            const batch = reportFiles.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.allSettled(batch.map(async (file) => {
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
                    const errorMsg = await initResponse.text();
                    throw new Error(`[${file.name}] Failed to initiate upload: ${errorMsg}`);
                }
                const { uploadUrl } = await initResponse.json();

                const uploadResponse = await fetchWithRetry(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    signal,
                    headers: { 'Content-Type': file.type },
                });

                if (!uploadResponse.ok) throw new Error(`Failed to upload ${file.name}`);
                const uploadResult = await uploadResponse.json();

                return uploadResult.id || null;
            }));

            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    uploadedIds.push(result.value);
                } else if (result.status === 'rejected') {
                    failedCount++;
                    console.error('[Drive Upload] File failed:', result.reason?.message);
                }
                completedCount++;
                setUploadProgress(Math.round((completedCount / totalFiles) * 100));
            });
        }

        abortControllerRef.current = null;

        if (failedCount > 0) {
            toast.error(`${failedCount} ไฟล์อัปโหลดไม่สำเร็จ (สำเร็จ ${uploadedIds.length}/${totalFiles})`);
        }

        return { ids: uploadedIds, folderLink };
    }, [reportFiles]);

    const clearUploadState = useCallback(() => {
        setReportFiles([]);
        setPreviews([]);
        setUploadProgress(0);
        setIsUploading(false);
        setDriveLink('');
    }, []);

    return {
        reportFiles,
        previews,
        uploadProgress,
        isUploading,
        isDraggingFiles,
        driveLink,
        handleLinkChange,
        handleReportFilesChange,
        handleReportFilesDragOver,
        handleReportFilesDragLeave,
        handleReportFilesDrop,
        removeFile,
        performDriveUpload,
        setIsUploading,
        setUploadProgress,
        setDriveLink,
        cancelUpload,
        clearUploadState,
    };
}
