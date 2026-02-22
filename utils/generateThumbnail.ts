/**
 * Generate a small thumbnail data URL from an image file.
 * Uses Canvas API to resize the image — avoids rendering full-res images in preview grids.
 *
 * @param file - The image file to create a thumbnail for
 * @param maxSize - Maximum width/height in pixels (default 150)
 * @returns Promise<string> - A data URL of the thumbnail (image/jpeg)
 */
export function generateThumbnail(file: File, maxSize: number = 150): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            // Release the full-size blob URL immediately
            URL.revokeObjectURL(url);

            // Calculate dimensions maintaining aspect ratio
            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }

            // Draw resized image on canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Return as compact JPEG data URL
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = url;
    });
}
