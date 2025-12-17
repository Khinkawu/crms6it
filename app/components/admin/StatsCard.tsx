import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean; // true for up, false for down (color green or red)
    color?: 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';
    className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    trendUp,
    color = 'blue',
    className = ''
}) => {
    // Color mapping for backgrounds and icons
    const colorStyles = {
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
        rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20' },
    };

    const style = colorStyles[color];

    return (
        <div className={`p-6 rounded-2xl border bg-card/50 backdrop-blur-md shadow-sm ${style.border} ${className}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-text-secondary text-sm font-medium mb-1">{title}</h3>
                    <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
                </div>
                <div className={`p-3 rounded-xl ${style.bg} ${style.text}`}>
                    <Icon size={24} />
                </div>
            </div>
            {trend && (
                <div className="mt-4 flex items-center gap-1 text-xs">
                    <span className={trendUp ? 'text-emerald-400' : 'text-rose-400'}>
                        {trendUp ? '↑' : '↓'} {trend}
                    </span>
                    <span className="text-text-secondary">vs last month</span>
                </div>
            )}
        </div>
    );
};

export default StatsCard;
