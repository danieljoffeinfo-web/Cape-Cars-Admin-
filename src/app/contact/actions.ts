'use server'

import { createClient } from "@/lib/supabase/server"

export async function createBooking(formData: FormData) {
  const payload = {
    name:           String(formData.get('name') ?? ''),
    email:          String(formData.get('email') ?? ''),
    phone:          (String(formData.get('phone') ?? '')) || null,
    preferred_date: (String(formData.get('date') ?? '')) || null,
    car_interest:   (String(formData.get('car') ?? '')) || null,
    booking_type:   String(formData.get('type') ?? 'Afternoon'),
    notes:          (String(formData.get('notes') ?? '')) || null,
  }

  try {
    const supabase = createClient()
    const { error } = await supabase.from('bookings').insert(payload)
    if (error) {
      return { ok: false as const, error: error.message }
    }

    return { ok: true as const }
  } catch (error) {
    console.error('[booking] create failed', error, payload)
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Booking request failed',
    }
  }
}
