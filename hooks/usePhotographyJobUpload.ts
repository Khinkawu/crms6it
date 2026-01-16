import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { getBangkokDateString } from '@/lib/dateUtils';

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

    // Link change handler
    const handleLinkChange = useCallback((jobId: string, value: string) => {
        setDriveLinks(prev => ({ ...prev, [jobId]: value }));
    }, []);

    // Process cover file
    const processCoverFile = useCallback((jobId: string, file: File) => {
        if (file && file.type.startsWith('image/')) {
            setCoverFiles(prev => ({ ...prev, [jobId]: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreviews(prev => ({ ...prev, [jobId]: reader.result as string }));
            };
            reader.readAsDataURL(file);
        } else {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
        }
    }, []);

    // Process job files
    const processJobFiles = useCallback((jobId: string, newFiles: File[]) => {
        const validFiles = newFiles.filter(file => file.type.startsWith('image/'));
        if (validFiles.length < newFiles.length) {
            toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น (ไฟล์ที่ไม่ใช่รูปภาพถูกข้าม)");
        }
        if (validFiles.length > 0) {
            setJobFiles(prev => ({ ...prev, [jobId]: [...(prev[jobId] || []), ...validFiles] }));
            const newPreviews = validFiles.map(file => URL.createObjectURL(file));
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
            URL.revokeObjectURL(currentPreviews[index]);
            currentPreviews.splice(index, 1);
            return { ...prev, [jobId]: currentPreviews };
        });
        setIsUploadComplete(prev => ({ ...prev, [jobId]: false }));
    }, []);

    // Perform Google Drive upload
    const performDriveUpload = useCallback(async (jobId: string, jobTitle: string, jobDate: any): Promise<UploadResult> => {
        const files = jobFiles[jobId] || [];
        if (files.length === 0) return { ids: [], folderLink: "" };

        // Get Firebase Auth Token for API authentication
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('User not authenticated');
        const idToken = await currentUser.getIdToken();

        let completedCount = 0;
        const totalFiles = files.length;
        let driveFolderLink = "";
        const uploadedIds: string[] = [];

        // Upload ทีละไฟล์ (sequential to avoid race condition)
        for (const file of files) {
            const initResponse = await fetch('/api/drive/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    mimeType: file.type,
                    eventName: jobTitle,
                    jobDate: jobDate
                }),
            });

            if (!initResponse.ok) throw new Error('Failed to initiate upload');
            const { uploadUrl, folderLink } = await initResponse.json();

            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
            });

            if (!uploadResponse.ok) throw new Error('Failed to upload to Google Drive');
            const uploadResult = await uploadResponse.json();

            if (uploadResult.id) uploadedIds.push(uploadResult.id);
            if (!driveFolderLink && folderLink) driveFolderLink = folderLink;

            completedCount++;
            setUploadProgress(prev => ({ ...prev, [jobId]: Math.round((completedCount / totalFiles) * 100) }));
        }

        return { ids: uploadedIds, folderLink: driveFolderLink };
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

        // Cleanup
        clearJobState,
    };
}
