/**
 * Client-side image compression utility
 * Uses Canvas API to resize and compress images before upload
 */

interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0-1, default 0.8
    maxSizeMB?: number; // Target max file size in MB
}

/**
 * Compress an image file to reduce its size
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<File> - The compressed image file
 */
export async function compressImage(
    file: File,
    options: CompressOptions = {}
): Promise<File> {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.8,
        maxSizeMB = 1
    } = options;

    // Skip if file is already small enough
    if (file.size <= maxSizeMB * 1024 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Use high-quality image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob with compression
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        const compressedFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, '.jpg'), // Convert to jpg
                            { type: 'image/jpeg' }
                        );

                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = event.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Compress image with progressive quality reduction until target size is reached
 * @param file - The image file to compress
 * @param targetSizeMB - Target file size in MB
 * @param minQuality - Minimum quality to use (default 0.5)
 * @returns Promise<File> - The compressed image file
 */
export async function compressImageToSize(
    file: File,
    targetSizeMB: number = 0.5,
    minQuality: number = 0.5
): Promise<File> {
    let quality = 0.9;
    let compressedFile = file;

    while (compressedFile.size > targetSizeMB * 1024 * 1024 && quality >= minQuality) {
        compressedFile = await compressImage(file, {
            quality,
            maxWidth: 1920,
            maxHeight: 1080,
            maxSizeMB: targetSizeMB
        });
        quality -= 0.1;
    }

    return compressedFile;
}
