import { Timestamp } from 'firebase/firestore'

export type StaffAvailability = 'available' | 'busy' | 'away' | 'day_off' | 'leave'

export type TaskCategoryId =
  | 'repair'
  | 'install'
  | 'event_support'
  | 'photo'
  | 'post_production'
  | 'graphic_pr'
  | 'it_support'
  | 'manual'

export interface TaskItem {
  id: string
  label: string
}

export interface TaskCategory {
  id: TaskCategoryId
  label: string
  icon: string
  tasks: TaskItem[]
}

export const TASK_CATEGORIES: TaskCategory[] = [
  {
    id: 'repair',
    label: 'ซ่อมบำรุง',
    icon: '🔧',
    tasks: [
      { id: 'repair_classroom', label: 'ซ่อมอุปกรณ์ห้องเรียน' },
      { id: 'repair_audio', label: 'ซ่อมเครื่องเสียง' },
      { id: 'repair_projector', label: 'ซ่อมโปรเจกเตอร์' },
      { id: 'repair_other', label: 'ซ่อมอื่นๆ' },
    ],
  },
  {
    id: 'install',
    label: 'ติดตั้ง/ขนย้าย',
    icon: '📦',
    tasks: [
      { id: 'install_speaker', label: 'ขนลำโพง/ติดตั้งลำโพง' },
      { id: 'install_equipment', label: 'ติดตั้งอุปกรณ์' },
    ],
  },
  {
    id: 'event_support',
    label: 'สนับสนุนงาน',
    icon: '🎤',
    tasks: [
      { id: 'event_sound', label: 'เปิดเครื่องเสียง' },
      { id: 'event_activity', label: 'ดูแลงานกิจกรรม' },
    ],
  },
  {
    id: 'photo',
    label: 'ถ่ายภาพ/วิดีโอ',
    icon: '📷',
    tasks: [
      { id: 'photo_shoot', label: 'ถ่ายภาพ' },
      { id: 'video_shoot', label: 'ถ่ายวิดีโอ' },
    ],
  },
  {
    id: 'post_production',
    label: 'หลังถ่าย',
    icon: '🖼️',
    tasks: [
      { id: 'photo_edit', label: 'คัดภาพ / แต่งภาพ' },
      { id: 'video_edit', label: 'ตัดต่อวิดีโอ' },
    ],
  },
  {
    id: 'graphic_pr',
    label: 'กราฟิก / PR',
    icon: '🎨',
    tasks: [
      { id: 'graphic_design', label: 'ออกแบบกราฟิก' },
      { id: 'pr_media', label: 'ทำสื่อ PR' },
      { id: 'social_post', label: 'โพสต์โซเชียล' },
    ],
  },
  {
    id: 'it_support',
    label: 'งาน IT',
    icon: '💻',
    tasks: [
      { id: 'it_system', label: 'ดูแลระบบ' },
      { id: 'it_user_help', label: 'ช่วยเหลือ User' },
    ],
  },
]

export interface StaffStatus {
  uid: string
  displayName: string
  photoURL?: string | null
  role: string
  isPhotographer?: boolean
  phone?: string | null
  availability: StaffAvailability
  taskCategoryId: TaskCategoryId | null
  taskLabel: string | null
  taskNote: string | null
  location: string | null
  updatedAt: Timestamp | null
}

// Context items pulled from existing system (booking / repair_ticket / photo_job)
export type ContextItemType = 'booking' | 'repair_ticket' | 'photo_job'

export interface StaffContextItem {
  id: string
  type: ContextItemType
  label: string
  timeRange?: string
  room?: string
}

export const AVAILABILITY_PRO_LABEL: Record<StaffAvailability, string> = {
  available: 'ว่าง',
  busy:      'ติดงาน',
  away:      'พัก',
  day_off:   'วันหยุด',
  leave:     'ลา',
}

export const AVAILABILITY_COLOR: Record<StaffAvailability, string> = {
  available: 'bg-emerald-500',
  busy:      'bg-amber-500',
  away:      'bg-sky-500',
  day_off:   'bg-red-500',
  leave:     'bg-red-500',
}
