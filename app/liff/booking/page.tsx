"use client";

import React from "react";
import { useLiff } from "../../../hooks/useLiff";
import { Loader2, AlertCircle } from "lucide-react";

export default function BookingLiffPage() {
    const { profile, isLoggedIn, error } = useLiff(process.env.NEXT_PUBLIC_LINE_LIFF_ID_BOOKING || "");

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-red-50 text-red-600">
                <AlertCircle className="w-12 h-12 mb-2" />
                <p>{error}</p>
            </div>
        );
    }

    if (!isLoggedIn || !profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
                <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
                <p className="text-gray-500">Loading Booking System...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col items-center p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-purple-500 pb-2">
                Room Booking
            </h1>

            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6 flex flex-col items-center text-center shadow-sm w-full max-w-sm">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md mb-4 bg-gray-200">
                    {profile.pictureUrl ? (
                        <img src={profile.pictureUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-3xl">
                            {profile.displayName.charAt(0)}
                        </div>
                    )}
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-1">{profile.displayName}</h2>
                <p className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                    Booking Access
                </p>
            </div>

            <div className="mt-8 text-center text-gray-500 text-sm">
                <p>Select a room to reserve.</p>
            </div>
        </div>
    );
}
