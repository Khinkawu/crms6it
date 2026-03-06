"use client";

import React from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-text mb-1">{title}</h1>
                {subtitle && <p className="text-text-secondary">{subtitle}</p>}
            </div>
            {children && (
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
                    {children}
                </div>
            )}
        </div>
    );
}
