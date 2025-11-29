"use client";

import React, { useState, useEffect } from "react";
import { QrReader } from "@blackbox-vision/react-qr-reader";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

export default function ScanPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    const handleScan = (result: any, error: any) => {
        if (result) {
            const text = result?.text;
            if (text) {
                setScanResult(text);
                // Logic to extract Product ID
                // Expected format: "https://.../product/123" or just "123" or "/product/123"

                let productId = text;

                // If it's a URL, try to extract the last segment
                if (text.includes("/product/")) {
                    const parts = text.split("/product/");
                    if (parts.length > 1) {
                        productId = parts[1].split("/")[0]; // Get the ID part
                    }
                }

                // Redirect
                router.push(`/product/${productId}`);
            }
        }

        if (error) {
            // QR Reader often throws errors for "no QR found" in every frame, so we usually ignore them
            // or only log critical ones.
            // console.warn(error);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-text">Scan QR Code</h1>
                    <p className="text-text-secondary">Point your camera at a product QR code.</p>
                </div>

                <div className="bg-card p-4 overflow-hidden relative rounded-2xl border-2 border-border shadow-2xl">
                    <div className="aspect-square bg-black/50 rounded-xl overflow-hidden relative">
                        {/* Scanner Overlay */}
                        <div className="absolute inset-0 z-10 border-[30px] border-black/40 pointer-events-none">
                            <div className="w-full h-full border-2 border-cyan-400/50 relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-cyan-400"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-cyan-400"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-cyan-400"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-cyan-400"></div>
                            </div>
                        </div>

                        <QrReader
                            onResult={handleScan}
                            constraints={{ facingMode: "environment" }}
                            className="w-full h-full object-cover"
                            containerStyle={{ width: '100%', height: '100%' }}
                            videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={() => router.back()}
                        className="px-8 py-3 rounded-xl bg-card text-text font-medium hover:bg-border/50 transition-colors border border-border"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
