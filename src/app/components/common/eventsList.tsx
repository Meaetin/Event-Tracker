'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/supabaseClient'
import { Timestamp } from 'next/dist/server/lib/cache-handlers/types'

type Event = {
  event_id: number
  event_name: string
  event_desc: string
  start_date: Timestamp
  end_date: Timestamp
}

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase.from('events').select('*')
      if (error) {
        console.error('Error fetching events:', error)
      } else {
        console.log("Data received:", data);
        setEvents(data || [])
      }
    }

    fetchEvents()
  }, [])

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Upcoming Events</h2>
      {events.length === 0 && <p>No events found</p>}
      <ul>
        {events.map(event => (
          <li key={event.event_id} className="mb-2 border p-2 rounded shadow">
            <strong>{event.event_name}</strong>
            <p>{event.event_desc}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
