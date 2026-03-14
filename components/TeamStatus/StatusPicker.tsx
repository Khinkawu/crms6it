'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '@/lib/firebase'
import {
  TASK_CATEGORIES,
  AVAILABILITY_COLOR,
  AVAILABILITY_PRO_LABEL,
  type StaffAvailability,
  type TaskCategoryId,
  type StaffStatus,
} from '@/types/staffStatus'

interface StatusPickerProps {
  uid: string
  displayName: string
  photoURL?: string | null
  role: string
  isPhotographer?: boolean
}

const QUICK_STATUSES: { value: StaffAvailability; label: string; dot: string }[] = [
  { value: 'available', label: 'ว่าง',     dot: 'bg-emerald-500' },
  { value: 'busy',      label: 'ติดงาน',   dot: 'bg-amber-500'   },
  { value: 'away',      label: 'พัก',      dot: 'bg-sky-500'     },
  { value: 'day_off',   label: 'วันหยุด',  dot: 'bg-red-500'     },
  { value: 'leave',     label: 'ลา',       dot: 'bg-red-500'     },
]

export default function StatusPicker({ uid, displayName, photoURL, role, isPhotographer }: StatusPickerProps) {
  const [expanded, setExpanded]             = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [phone, setPhone]                   = useState('')
  const [note, setNote]                     = useState('')
  const [selectedAvailability, setSelectedAvailability] = useState<StaffAvailability>('available')
  const [selectedCategoryId, setSelectedCategoryId]     = useState<TaskCategoryId | null>(null)
  const [selectedTaskLabel, setSelectedTaskLabel]       = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(db, 'staff_status', uid))
      .then(snap => {
        if (!snap.exists()) return
        const data = snap.data() as StaffStatus
        setSelectedAvailability(data.availability ?? 'available')
        setSelectedCategoryId(data.taskCategoryId ?? null)
        setSelectedTaskLabel(data.taskLabel ?? null)
        setNote(data.taskNote ?? '')
        setPhone(data.phone ?? '')
      })
      .catch(err => console.error('[StatusPicker] load error:', err))
  }, [uid])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'staff_status', uid), {
        uid,
        displayName,
        photoURL: photoURL ?? null,
        role,
        isPhotographer: isPhotographer ?? false,
        phone: phone.trim() || null,
        availability: selectedAvailability,
        taskCategoryId: selectedCategoryId,
        taskLabel: selectedTaskLabel,
        taskNote: note.trim() || null,
        location: null,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setExpanded(false)
      toast.success('อัพเดทสถานะแล้ว')
    } catch (err) {
      console.error('[StatusPicker] save error:', err)
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }, [uid, displayName, photoURL, role, isPhotographer, phone, selectedAvailability, selectedCategoryId, selectedTaskLabel, note])

  const handleSelectAvailability = (value: StaffAvailability) => {
    setSelectedAvailability(value)
    if (value === 'available') {
      setSelectedCategoryId(null)
      setSelectedTaskLabel(null)
      setNote('')
    }
  }

  const handleSelectCategory = (id: TaskCategoryId) => {
    setSelectedCategoryId(prev => prev === id ? null : id)
    setSelectedTaskLabel(null)
  }

  const dotColor = AVAILABILITY_COLOR[selectedAvailability]
  const proLabel = AVAILABILITY_PRO_LABEL[selectedAvailability]
  const needsTask = selectedAvailability !== 'available'
  const activeCategory = TASK_CATEGORIES.find(c => c.id === selectedCategoryId)

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 overflow-hidden">

      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              สถานะของฉัน — <span className="font-normal">{proLabel}</span>
            </p>
            {selectedTaskLabel && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {selectedTaskLabel}{note ? ` · ${note}` : ''}
              </p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-gray-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 space-y-5">

          {/* Step 1 — Status */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">สถานะ</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_STATUSES.map(s => {
                const isSelected = selectedAvailability === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => handleSelectAvailability(s.value)}
                    className={`flex-1 min-w-[calc(33.333%-6px)] flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-gray-900 dark:bg-white border-transparent text-white dark:text-gray-900'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 2 — Task category (horizontal chips) */}
          {needsTask && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">กำลังทำอะไร?</p>

              {/* Category chips — horizontal scroll */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {TASK_CATEGORIES.map(cat => {
                  const isSelected = selectedCategoryId === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                        isSelected
                          ? 'bg-gray-900 dark:bg-white border-transparent text-white dark:text-gray-900'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  )
                })}
              </div>

              {/* Tasks for selected category */}
              {activeCategory && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeCategory.tasks.map(task => {
                    const isSelected = selectedTaskLabel === task.label
                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskLabel(isSelected ? null : task.label)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${
                          isSelected
                            ? 'bg-gray-900 dark:bg-white border-transparent text-white dark:text-gray-900 font-medium'
                            : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {task.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Note (only if task selected) */}
          {needsTask && selectedTaskLabel && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">หมายเหตุ <span className="normal-case font-normal">(ไม่บังคับ)</span></p>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="เช่น ห้อง 301, งานวันครู..."
                maxLength={60}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
              />
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            บันทึกสถานะ
          </button>

          {/* Phone — secondary, at bottom */}
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="เบอร์โทรศัพท์"
              maxLength={20}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent text-gray-600 dark:text-gray-400 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600"
            />
          </div>

        </div>
      )}
    </div>
  )
}
