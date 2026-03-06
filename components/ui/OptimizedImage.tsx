"use client";

import React, { useState, memo } from "react";
import Image, { ImageProps } from "next/image";
import { ImageOff } from "lucide-react";

interface OptimizedImageProps extends Omit<ImageProps, "onError" | "onLoad"> {
    fallbackSrc?: string;
    showPlaceholder?: boolean;
    containerClassName?: string;
}

/**
 * Optimized image component using next/image with fallback and loading states
 * Memoized for performance
 */
const OptimizedImage = memo(function OptimizedImage({
    src,
    alt,
    fallbackSrc = "/placeholder.png",
    showPlaceholder = true,
    containerClassName = "",
    className = "",
    ...props
}: OptimizedImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleError = () => {
        setHasError(true);
        setIsLoading(false);
    };

    // If error and no fallback, show placeholder
    if (hasError && !fallbackSrc) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${containerClassName}`}>
                <ImageOff className="text-gray-400" size={32} />
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${containerClassName}`}>
            {/* Loading skeleton */}
            {isLoading && showPlaceholder && (
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
            )}

            <Image
                src={hasError ? fallbackSrc : src}
                alt={alt}
                className={`transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"} ${className}`}
                onLoad={handleLoad}
                onError={handleError}
                {...props}
            />
        </div>
    );
});

export default OptimizedImage;

/**
 * Avatar component optimized for user profile images
 */
export const OptimizedAvatar = memo(function OptimizedAvatar({
    src,
    alt,
    size = 40,
    className = ""
}: {
    src?: string | null;
    alt: string;
    size?: number;
    className?: string;
}) {
    const [hasError, setHasError] = useState(false);

    if (!src || hasError) {
        // Fallback to initials
        const initials = alt
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

        return (
            <div
                className={`flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold rounded-full ${className}`}
                style={{ width: size, height: size, fontSize: size * 0.4 }}
            >
                {initials}
            </div>
        );
    }

    return (
        <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            className={`rounded-full object-cover ${className}`}
            onError={() => setHasError(true)}
        />
    );
});
