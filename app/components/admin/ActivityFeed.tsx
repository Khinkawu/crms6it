import React from 'react';
import { Clock, Wrench, Calendar, Package, Monitor } from 'lucide-react';
import { useActivityLogs, ActivityLog } from '../../../hooks/useActivityLogs';

const ActivityFeed: React.FC = () => {
    const { activities, loading } = useActivityLogs({
        limitCount: 10,
        filterRepairOnly: false
    });

    const getDotColor = (type: string) => {
        if (type.includes('repair')) return 'bg-rose-500';
        if (type.includes('booking')) return 'bg-amber-500';
        if (type.includes('borrow') || type.includes('requisition')) return 'bg-blue-500';
        return 'bg-gray-500';
    };

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'repair': return 'requested repair';
            case 'repair_update': return 'updated repair';
            case 'borrow': return 'borrowed item';
            case 'return': return 'returned item';
            case 'requisition': return 'requisitioned item';
            case 'add': return 'added stock';
            case 'update': return 'updated record';
            default: return action;
        }
    };

    return (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-6 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Clock size={20} className="text-gray-500 dark:text-gray-400" />
                Recent Activity
            </h3>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative before:absolute before:inset-0 before:ml-[7px] before:-translate-x-px md:before:ml-[7px] before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
                {loading ? (
                    <div className="pl-6 text-sm text-gray-500">Loading activities...</div>
                ) : activities.length === 0 ? (
                    <div className="pl-6 text-sm text-gray-500">No recent activity</div>
                ) : (
                    activities.map((activity) => (
                        <div key={activity.id} className="relative flex gap-4 pl-6 group">
                            {/* Timeline Dot */}
                            <div className={`absolute left-0 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800 ${getDotColor(activity.action)} ring-4 ring-white/20 dark:ring-gray-700/20 group-hover:ring-blue-100 dark:group-hover:ring-blue-900/30 transition-all shadow-sm`} />

                            <div className="flex flex-col">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-medium text-gray-900 dark:text-white">{activity.userName}</span>{' '}
                                    <span className="text-gray-500 dark:text-gray-400">{getActionLabel(activity.action)}</span>{' '}
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                                        {activity.productName || activity.details}
                                    </span>
                                </p>
                                <span className="text-xs text-gray-400 mt-0.5">
                                    {formatTimeAgo(activity.timestamp)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="pt-4 mt-auto border-t border-gray-100 dark:border-gray-700">
                <button className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                    View All Activity
                </button>
            </div>
        </div>
    );
};

export default ActivityFeed;
