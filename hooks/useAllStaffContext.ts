'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { startOfDay, endOfDay } from 'date-fns'
import { db } from '@/lib/firebase'
import type { StaffContextItem } from '@/types/staffStatus'

// Fetches today's system tasks for ALL staff at once.
// Returns a Map: uid → StaffContextItem[]
// Refreshes every 5 minutes.
//
// Sources:
//   repair_tickets  → technicianId == uid (active tickets assigned to this tech)
//   photography_jobs → assigneeIds contains uid (today's jobs for this photographer)
//
// NOT included: bookings — requesterId is the teacher who booked, not AV staff.
export function useAllStaffContext(enabled = true) {
  const [contextMap, setContextMap] = useState<Map<string, StaffContextItem[]>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return

    const fetchContext = async () => {
      const today = new Date()
      const startTs = Timestamp.fromDate(startOfDay(today))
      const endTs = Timestamp.fromDate(endOfDay(today))

      const map = new Map<string, StaffContextItem[]>()
      const addItem = (uid: string, item: StaffContextItem) => {
        const prev = map.get(uid) ?? []
        map.set(uid, [...prev, item])
      }

      try {
        await Promise.all([
          // 1. Active repair tickets assigned to specific technicians
          getDocs(
            query(
              collection(db, 'repair_tickets'),
              where('status', 'in', ['pending', 'in_progress', 'waiting_parts'])
            )
          ).then(snap => {
            snap.docs.forEach(d => {
              const data = d.data()
              if (!data.technicianId) return
              addItem(data.technicianId, {
                id: d.id,
                type: 'repair_ticket',
                label: `ซ่อม: ${data.room ?? 'ไม่ระบุห้อง'}`,
                room: data.room,
              })
            })
          }),

          // 2. Today's photography jobs assigned to specific photographers
          getDocs(
            query(
              collection(db, 'photography_jobs'),
              where('startTime', '>=', startTs),
              where('startTime', '<=', endTs)
            )
          ).then(snap => {
            snap.docs.forEach(d => {
              const data = d.data()
              const assigneeIds: string[] = data.assigneeIds ?? []
              assigneeIds.forEach(uid => {
                addItem(uid, {
                  id: d.id,
                  type: 'photo_job',
                  label: data.title ?? 'งานถ่ายภาพ',
                  timeRange: formatTimeRange(data.startTime, data.endTime),
                  room: data.location,
                })
              })
            })
          }),
        ])
      } catch (err) {
        console.error('[useAllStaffContext] fetch error:', err)
      }

      setContextMap(new Map(map))
      setLoading(false)
    }

    fetchContext()
    const interval = setInterval(fetchContext, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [enabled])

  return { contextMap, loading }
}

function formatTimeRange(start: Timestamp, end: Timestamp): string {
  const fmt = (ts: Timestamp) =>
    ts?.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (!start) return ''
  return end ? `${fmt(start)}–${fmt(end)}` : fmt(start)
}
