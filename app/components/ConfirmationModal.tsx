"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Info, X } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    isDangerous = false,
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-scale-in overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <X size={18} />
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDangerous
                            ? 'bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30'
                            : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                        }`}>
                        {isDangerous ? (
                            <AlertTriangle size={24} />
                        ) : (
                            <Info size={24} />
                        )}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{message}</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-[0.98] text-sm ${isDangerous
                                ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:shadow-red-500/30'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-blue-500/30'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
