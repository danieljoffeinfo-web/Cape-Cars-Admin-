import { NextResponse } from 'next/server'
import { deleteAllTelegramBookings, getTelegramBookingsForRange } from '@/lib/telegram-admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const bookings = await getTelegramBookingsForRange('all')
    return NextResponse.json({ bookings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Telegram bookings' },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    const result = await deleteAllTelegramBookings()
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete Telegram bookings' },
      { status: 500 },
    )
  }
}
