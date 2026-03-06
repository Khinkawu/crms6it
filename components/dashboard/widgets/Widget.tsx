"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

interface WidgetProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    icon?: React.ElementType;
    action?: {
        label: string;
        href?: string;
        action?: () => void;
    };
    gradient?: string;
}

export default function Widget({ children, className = "", title, icon: Icon, action, gradient }: WidgetProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg shadow-gray-200/20 dark:shadow-none ${className}`}
        >
            {gradient && (
                <div className={`absolute inset-0 opacity-5 ${gradient}`} />
            )}
            <div className="relative z-10 h-full flex flex-col">
                {(title || action) && (
                    <div className="flex items-center justify-between p-5 pb-3">
                        <div className="flex items-center gap-2">
                            {Icon && (
                                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700/50">
                                    <Icon size={18} className="text-gray-600 dark:text-gray-300" />
                                </div>
                            )}
                            {title && (
                                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                            )}
                        </div>
                        {action && (
                            typeof action.action === 'function' ? (
                                <button
                                    onClick={action.action}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 tap-scale"
                                >
                                    {action.label}
                                    <Plus size={14} />
                                </button>
                            ) : (
                                <Link
                                    href={action.href!}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 tap-scale"
                                >
                                    {action.label}
                                    <ChevronRight size={14} />
                                </Link>
                            )
                        )}
                    </div>
                )}
                <div className="flex-1 px-5 pb-5">
                    {children}
                </div>
            </div>
        </motion.div>
    );
}
