"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface QuickActionProps {
    icon: React.ElementType;
    title: string;
    description: string;
    href?: string;
    onClick?: () => void;
    gradient: string;
    delay: number;
    badge?: number;
}

export default function QuickAction({ icon: Icon, title, description, href, onClick, gradient, delay, badge }: QuickActionProps) {
    const content = (
        <>
            <div className="relative inline-flex">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg mb-3`}>
                    <Icon size={22} className="text-white" />
                </div>
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {description}
            </p>
        </>
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
        >
            {href ? (
                <Link
                    href={href}
                    className="group block p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all tap-scale"
                >
                    {content}
                </Link>
            ) : (
                <button
                    onClick={onClick}
                    className="group w-full text-left block p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all tap-scale"
                >
                    {content}
                </button>
            )}
        </motion.div>
    );
}
