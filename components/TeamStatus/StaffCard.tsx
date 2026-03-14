'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarClock, Wrench, Camera, Phone, ChevronDown } from 'lucide-react'
import {
  AVAILABILITY_COLOR,
  AVAILABILITY_PRO_LABEL,
  type StaffAvailability,
  type StaffStatus,
  type StaffContextItem,
} from '@/types/staffStatus'

const AVAILABILITY_RING: Record<StaffAvailability, string> = {
  available: 'ring-emerald-500',
  busy:      'ring-amber-500',
  away:      'ring-sky-500',
  day_off:   'ring-red-500',
  leave:     'ring-red-500',
}

interface StaffCardProps {
  staff: StaffStatus
  context: StaffContextItem[]
  onAvatarChange?: (uid: string, file: File) => void
  onStatusOverride?: (staff: StaffStatus) => void
  priority?: boolean
}

const CONTEXT_ICON: Record<StaffContextItem['type'], React.ReactNode> = {
  booking:       <CalendarClock size={12} />,
  repair_ticket: <Wrench size={12} />,
  photo_job:     <Camera size={12} />,
}

function timeAgo(ts: StaffStatus['updatedAt']): string {
  if (!ts) return 'ยังไม่เคยอัพเดท'
  try {
    return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: th })
  } catch {
    return ''
  }
}

export default function StaffCard({ staff, context, onAvatarChange, onStatusOverride, priority = false }: StaffCardProps) {
  const inputRef   = useRef<HTMLInputElement>(null)
  const dotColor   = AVAILABILITY_COLOR[staff.availability]
  const ringColor  = AVAILABILITY_RING[staff.availability]
  const statusLabel = AVAILABILITY_PRO_LABEL[staff.availability]

  return (
    <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 flex flex-col overflow-hidden hover:shadow-xl dark:hover:shadow-gray-900/60 transition-shadow">

      {/* ── Avatar area ── */}
      <div className="relative bg-gray-100 dark:bg-gray-700/50 flex items-end justify-center" style={{ height: 120 }}>

        {/* Avatar — always circle */}
        <div className="mb-4 relative shrink-0">
          {staff.photoURL ? (
            <div className={`w-[88px] h-[88px] rounded-full overflow-hidden ring-4 ${ringColor} shrink-0`}>
              <Image
                src={staff.photoURL}
                alt={staff.displayName}
                width={88}
                height={88}
                className="w-full h-full object-cover"
                unoptimized
                priority={priority}
              />
            </div>
          ) : (
            <div
              className={`rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-3xl select-none ring-4 ${ringColor}`}
              style={{ width: 88, height: 88 }}
            >
              {staff.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Status dot */}
          <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${dotColor}`} />
        </div>

        {/* Admin: upload button */}
        {onAvatarChange && (
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 hover:bg-black/70 text-white text-[11px] font-medium transition-colors"
          >
            <Camera size={11} />
            เปลี่ยนรูป
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onAvatarChange?.(staff.uid, file)
            e.target.value = ''
          }}
        />
      </div>

      {/* ── Info area ── */}
      <div className="px-4 py-4 flex flex-col gap-3">

        {/* Name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-base text-gray-900 dark:text-white truncate leading-tight">{staff.displayName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              <p className="text-sm text-gray-500 dark:text-gray-400">{statusLabel}</p>
            </div>
          </div>
          {onStatusOverride && (
            <button
              onClick={() => onStatusOverride(staff)}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="admin: เปลี่ยนสถานะ"
            >
              <ChevronDown size={12} />
              สถานะ
            </button>
          )}
        </div>

        {/* Current task */}
        {staff.taskLabel && (
          <div className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600/60">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-snug">{staff.taskLabel}</p>
            {staff.taskNote && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{staff.taskNote}</p>
            )}
          </div>
        )}

        {/* System context */}
        {context.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">งานในระบบวันนี้</p>
            {context.map(item => (
              <div key={item.id} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500">{CONTEXT_ICON[item.type]}</span>
                <span className="leading-snug">
                  {item.label}
                  {item.timeRange && <span className="text-gray-400 dark:text-gray-500"> · {item.timeRange}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Phone */}
        {staff.phone && (
          <a
            href={`tel:${staff.phone}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
          >
            <Phone size={14} className="shrink-0 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
              {staff.phone}
            </span>
          </a>
        )}

        {/* Timestamp */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-auto pt-1 border-t border-gray-100 dark:border-gray-700">
          {timeAgo(staff.updatedAt)}
        </p>
      </div>
    </div>
  )
}
