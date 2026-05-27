import { NextRequest, NextResponse } from 'next/server'
import { getTelegramBookingById, syncTelegramBookingToRental, updateTelegramBookingStatus } from '@/lib/telegram-admin'

export const runtime = 'nodejs'

const ALLOWED_STATUSES = new Set(['pending', 'confirmed_booking', 'awaiting_payment_confirmation', 'confirmed', 'cancelled', 'expired'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(request: NextRequest, { params }: { params: { bookingId: string } }) {
  try {
    const bookingId = params.bookingId
    const body = await request.json()
    const status = typeof body?.status === 'string' ? body.status : ''

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (!UUID_PATTERN.test(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
    }

    const current = await getTelegramBookingById(bookingId)
    if (!current) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const updated = await updateTelegramBookingStatus(bookingId, status)
    if (!updated) {
      return NextResponse.json({ error: 'Could not update booking status' }, { status: 500 })
    }

    if (status === 'confirmed_booking' || status === 'confirmed') {
      const rentalSync = await syncTelegramBookingToRental(bookingId)
      if (!rentalSync.ok) {
        await updateTelegramBookingStatus(bookingId, current.status)
        return NextResponse.json({ error: rentalSync.error }, { status: 409 })
      }
    }

    return NextResponse.json({ booking: updated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update booking' },
      { status: 500 },
    )
  }
}
