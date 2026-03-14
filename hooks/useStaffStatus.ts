'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { StaffStatus } from '@/types/staffStatus'

interface UseStaffStatusReturn {
  staff: StaffStatus[]
  loading: boolean
}

export function useStaffStatus(enabled = true): UseStaffStatusReturn {
  const [staff, setStaff] = useState<StaffStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = onSnapshot(
      query(collection(db, 'staff_status')),
      snapshot => {
        const docs = snapshot.docs.map(d => ({
          uid: d.id,
          ...d.data(),
        })) as StaffStatus[]

        // Sort: busy first → available → away; alphabetical within group
        docs.sort((a, b) => {
          const order = { busy: 0, available: 1, away: 2 }
          const diff = order[a.availability] - order[b.availability]
          if (diff !== 0) return diff
          return a.displayName.localeCompare(b.displayName, 'th')
        })

        setStaff(docs)
        setLoading(false)
      },
      err => {
        console.error('[useStaffStatus] onSnapshot error:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [enabled])

  return { staff, loading }
}
