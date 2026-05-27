import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const [latestLeadsRes, leadCountRes, bookingCountRes] = await Promise.all([
      supabase
        .from('telegram_customers')
        .select('id, full_name, telegram_name, phone, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase
        .from('telegram_customers')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('telegram_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaiting_payment_confirmation'),
    ])

    const error = latestLeadsRes.error || leadCountRes.error || bookingCountRes.error
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      latestTelegramLeads: latestLeadsRes.data ?? [],
      telegramLeadCount: leadCountRes.count ?? 0,
      awaitingPayment: bookingCountRes.count ?? 0,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Telegram summary' },
      { status: 500 },
    )
  }
}
