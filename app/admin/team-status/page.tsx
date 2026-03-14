'use client'

import { useState, useCallback } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, updateDoc } from 'firebase/firestore'
import Link from 'next/link'
import { RefreshCw, Users, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { db, storage } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useStaffStatus } from '@/hooks/useStaffStatus'
import { useAllStaffContext } from '@/hooks/useAllStaffContext'
import StaffCard from '@/components/TeamStatus/StaffCard'
import AdminStatusOverride from '@/components/TeamStatus/AdminStatusOverride'
import AvatarCropModal from '@/components/TeamStatus/AvatarCropModal'
import { type StaffStatus } from '@/types/staffStatus'

export default function TeamStatusPage() {
  const { role } = useAuth()
  const { staff, loading: staffLoading } = useStaffStatus()
  const { contextMap, loading: ctxLoading } = useAllStaffContext()

  const [overrideTarget, setOverrideTarget]   = useState<StaffStatus | null>(null)
  const [cropTarget, setCropTarget]           = useState<{ uid: string; src: string } | null>(null)

  const loading = staffLoading || ctxLoading
  const isAdmin = role === 'admin'

  const STATUS_ITEMS = [
    { key: 'available' as const, dot: 'bg-emerald-500', label: 'ว่าง' },
    { key: 'busy'      as const, dot: 'bg-amber-500',   label: 'ติดงาน' },
    { key: 'away'      as const, dot: 'bg-sky-500',     label: 'พัก' },
    { key: 'day_off'   as const, dot: 'bg-red-500',     label: 'วันหยุด' },
    { key: 'leave'     as const, dot: 'bg-red-500',     label: 'ลา' },
  ]

  const handleStatusOverride = useCallback((staff: StaffStatus) => {
    setOverrideTarget(staff)
  }, [])

  // Called by StaffCard when file is selected → open crop modal
  const handleAvatarChange = useCallback((uid: string, file: File) => {
    const src = URL.createObjectURL(file)
    setCropTarget({ uid, src })
  }, [])

  // Called by AvatarCropModal after confirm → upload cropped blob
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    if (!cropTarget) return
    const { uid, src } = cropTarget
    setCropTarget(null)
    URL.revokeObjectURL(src)
    const toastId = toast.loading('กำลังอัพโหลดรูป...')
    try {
      const storageRef = ref(storage, `staff_avatars/${uid}`)
      await uploadBytes(storageRef, blob)
      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'staff_status', uid), { photoURL: url })
      toast.success('อัพเดทรูปสำเร็จ', { id: toastId })
    } catch (err) {
      console.error('[TeamStatus] avatar upload error:', err)
      toast.error('อัพโหลดรูปไม่สำเร็จ', { id: toastId })
    }
  }, [cropTarget])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/team-status"
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
              title="กลับหน้าสถานะทีม"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">สถานะทีมโสตฯ</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                Real-time · อัพเดทอัตโนมัติ
                {isAdmin && <span className="ml-2 text-indigo-500 dark:text-indigo-400">· admin: กด &ldquo;เปลี่ยนรูป&rdquo; บนการ์ดเพื่ออัพโหลด PNG ครึ่งตัว</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-5 bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
          {STATUS_ITEMS.map((s, i) => {
            const count = staff.filter(m => m.availability === s.key).length
            return (
              <div
                key={s.key}
                className={`flex flex-col items-center justify-center gap-1.5 px-1 py-3 ${i < STATUS_ITEMS.length - 1 ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${count === 0 ? 'opacity-30' : ''}`} />
                <p className={`text-lg font-bold leading-none ${count === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-white'}`}>{count}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            ยังไม่มีข้อมูล — โสตฯ login ครั้งแรกแล้วจะขึ้นอัตโนมัติ
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {staff.map((member, i) => (
              <StaffCard
                key={member.uid}
                staff={member}
                context={contextMap.get(member.uid) ?? []}
                onAvatarChange={isAdmin ? handleAvatarChange : undefined}
                onStatusOverride={isAdmin ? handleStatusOverride : undefined}
                priority={i < 4}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <RefreshCw size={11} />
          <span>สถานะอัพเดท real-time · context รีเฟรชทุก 5 นาที</span>
        </div>
      </div>

      {overrideTarget && (
        <AdminStatusOverride
          staff={overrideTarget}
          onClose={() => setOverrideTarget(null)}
        />
      )}

      {cropTarget && (
        <AvatarCropModal
          imageSrc={cropTarget.src}
          onConfirm={handleCropConfirm}
          onClose={() => {
            URL.revokeObjectURL(cropTarget.src)
            setCropTarget(null)
          }}
        />
      )}
    </div>
  )
}
