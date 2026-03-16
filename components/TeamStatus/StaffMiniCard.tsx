'use client'

import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { Phone } from 'lucide-react'
import {
  AVAILABILITY_COLOR,
  AVAILABILITY_PRO_LABEL,
  type StaffAvailability,
  type StaffStatus,
} from '@/types/staffStatus'

const RING: Record<StaffAvailability, string> = {
  available: 'ring-emerald-500',
  busy:      'ring-amber-500',
  away:      'ring-sky-500',
  day_off:   'ring-red-500',
  leave:     'ring-red-500',
}

function timeAgo(ts: StaffStatus['updatedAt']): string {
  if (!ts) return ''
  try { return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: th }) }
  catch { return '' }
}

export default function StaffMiniCard({ staff, priority = false }: { staff: StaffStatus; priority?: boolean }) {
  const dot   = AVAILABILITY_COLOR[staff.availability]
  const ring  = RING[staff.availability]
  const label = AVAILABILITY_PRO_LABEL[staff.availability]

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 flex flex-col items-center gap-2 text-center h-full">

      {/* Avatar */}
      <div className="relative shrink-0 mt-1">
        {staff.photoURL ? (
          <div className={`w-12 h-12 rounded-full overflow-hidden ring-[3px] ${ring}`}>
            <Image
              src={staff.photoURL}
              alt={staff.displayName}
              width={48}
              height={48}
              className="w-full h-full object-cover"
              unoptimized
              priority={priority}
            />
          </div>
        ) : (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg ring-[3px] ${ring}`}>
            {staff.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${dot}`} />
      </div>

      {/* Name */}
      <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight line-clamp-1 w-full">
        {staff.displayName.split(' ')[0]}
      </p>

      {/* Status */}
      <div className="flex items-center gap-1 justify-center">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
      </div>

      {/* Task — 2 lines max */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-2 w-full min-h-[28px] leading-snug">
        {staff.taskLabel ?? ''}
      </p>

      {/* Footer: phone icon + time ago */}
      <div className="mt-auto flex items-center justify-between w-full pt-2 border-t border-gray-100 dark:border-gray-800">
        {staff.phone ? (
          <a
            href={`tel:${staff.phone}`}
            title={staff.phone}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <Phone size={12} className="text-gray-500 dark:text-gray-400" />
          </a>
        ) : <span />}
        <span className="text-[9px] text-gray-400 dark:text-gray-500">{timeAgo(staff.updatedAt)}</span>
      </div>
    </div>
  )
}
