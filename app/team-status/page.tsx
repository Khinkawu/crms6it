'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, Users, Settings, Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useStaffStatus } from '@/hooks/useStaffStatus'
import { useAllStaffContext } from '@/hooks/useAllStaffContext'
import StaffCard from '@/components/TeamStatus/StaffCard'
import { PageSkeleton } from '@/components/ui/Skeleton'

export default function TeamStatusPublicPage() {
  const { user, role, isPhotographer, loading: authLoading } = useAuth()
  const router = useRouter()
  const { staff, loading: staffLoading } = useStaffStatus(!!user)
  const { contextMap, loading: ctxLoading } = useAllStaffContext(!!user)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  if (authLoading || staffLoading || ctxLoading) return <PageSkeleton />
  if (!user) return null

  const isAVStaff = role === 'technician' || isPhotographer === true

  const STATUS_ITEMS = [
    { key: 'available' as const, dot: 'bg-emerald-500', label: 'ว่าง' },
    { key: 'busy'      as const, dot: 'bg-amber-500',   label: 'ติดงาน' },
    { key: 'away'      as const, dot: 'bg-sky-500',     label: 'พัก' },
    { key: 'day_off'   as const, dot: 'bg-red-500',     label: 'วันหยุด' },
    { key: 'leave'     as const, dot: 'bg-red-500',     label: 'ลา' },
  ]

  return (
    <div className="animate-fade-in pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">สถานะทีมโสตฯ</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">Real-time · อัพเดทอัตโนมัติ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAVStaff && (
              <Link
                href="/my-work"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
              >
                <Pencil size={12} />
                อัพเดทสถานะ
              </Link>
            )}
            {role === 'admin' && (
              <Link
                href="/admin/team-status"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings size={13} />
                <span className="hidden sm:inline">จัดการ</span>
              </Link>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <RefreshCw size={11} />
              <span className="hidden sm:inline">real-time</span>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex flex-wrap items-stretch bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
          {STATUS_ITEMS.map((s, i) => {
            const count = staff.filter(m => m.availability === s.key).length
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 px-5 py-3.5 flex-1 min-w-[80px] ${i < STATUS_ITEMS.length - 1 ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot} ${count === 0 ? 'opacity-30' : ''}`} />
                <div>
                  <p className={`text-xl font-bold leading-none ${count === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-white'}`}>{count}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{s.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Grid — read-only for all */}
        {staff.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">ยังไม่มีข้อมูล</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {staff.map((member, i) => (
              <StaffCard
                key={member.uid}
                staff={member}
                context={contextMap.get(member.uid) ?? []}
                priority={i < 3}
              />
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">context รีเฟรชทุก 5 นาที</p>
      </div>
    </div>
  )
}
