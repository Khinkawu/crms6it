'use client'

import { useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '@/lib/firebase'
import {
  AVAILABILITY_COLOR,
  AVAILABILITY_PRO_LABEL,
  type StaffAvailability,
  type StaffStatus,
} from '@/types/staffStatus'

interface AdminStatusOverrideProps {
  staff: StaffStatus
  onClose: () => void
}

const ALL_STATUSES: { value: StaffAvailability; emoji: string }[] = [
  { value: 'available', emoji: '✅' },
  { value: 'busy',      emoji: '🔧' },
  { value: 'away',      emoji: '🚶' },
  { value: 'day_off',   emoji: '🏖️' },
  { value: 'leave',     emoji: '🤒' },
]

export default function AdminStatusOverride({ staff, onClose }: AdminStatusOverrideProps) {
  const [selected, setSelected] = useState<StaffAvailability>(staff.availability)
  const [note, setNote] = useState(staff.taskNote ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'staff_status', staff.uid), {
        availability: selected,
        taskCategoryId: ['day_off', 'leave'].includes(selected) ? null : staff.taskCategoryId,
        taskLabel: ['day_off', 'leave'].includes(selected)
          ? AVAILABILITY_PRO_LABEL[selected]
          : staff.taskLabel,
        taskNote: note.trim() || null,
        updatedAt: serverTimestamp(),
      })
      toast.success(`อัพเดทสถานะ ${staff.displayName} แล้ว`)
      onClose()
    } catch (err) {
      console.error('[AdminStatusOverride] error:', err)
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{staff.displayName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">ตั้งค่าสถานะโดย admin</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Status options */}
          <div className="grid grid-cols-1 gap-2">
            {ALL_STATUSES.map(s => {
              const dot = AVAILABILITY_COLOR[s.value]
              const isSelected = selected === s.value
              return (
                <button
                  key={s.value}
                  onClick={() => setSelected(s.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />
                  <span className="text-lg">{s.emoji}</span>
                  <span className={`text-sm font-medium ${isSelected ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-200'}`}>
                    {AVAILABILITY_PRO_LABEL[s.value]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Note */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">หมายเหตุ (ไม่บังคับ)</p>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="เช่น ลาป่วย, ลากิจ, หยุดชดเชย..."
              maxLength={60}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
