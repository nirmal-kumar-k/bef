'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLiveRefresh } from '@/shared/realtime/live-updates'
import { ActivityList, type ActivityEvent } from './activity-list'

// Everything that happened to one order and its plans (including plans that
// were later deleted), newest first.
export function OrderHistory({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/activity?orderId=${orderId}&limit=300`)
    if (res.ok) setEvents((await res.json()).events)
  }, [orderId])

  useEffect(() => { setEvents(null); setShowAll(false); load() }, [load])
  useLiveRefresh(['order', 'production_plan'], load, { immediate: true })

  const shown = events && !showAll ? events.slice(0, 10) : events
  return (
    <div className="space-y-2">
      <h3 className="text-[#64748B] text-xs font-semibold uppercase tracking-wider border-b border-[#E0E7FF] pb-2">History</h3>
      <div className="bg-white border border-[#E0E7FF] rounded-lg px-4">
        {!shown ? <p className="text-sm text-[#94A3B8] py-4 text-center">Loading...</p>
          : <ActivityList events={shown} showOrder={false} empty="No changes recorded for this order yet." />}
      </div>
      {events && events.length > 10 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">
          Show all {events.length} changes
        </button>
      )}
    </div>
  )
}
