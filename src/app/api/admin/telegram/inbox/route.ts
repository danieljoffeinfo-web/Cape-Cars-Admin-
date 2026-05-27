import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const [customersRes, bookingsRes, conversationsRes] = await Promise.all([
      supabase.from('telegram_customers').select('*').order('updated_at', { ascending: false }),
      supabase.from('telegram_bookings').select('*').order('updated_at', { ascending: false }).limit(300),
      supabase.from('telegram_conversations').select('*').order('created_at', { ascending: false }).limit(500),
    ])

    const error = customersRes.error || bookingsRes.error || conversationsRes.error
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      customers: customersRes.data ?? [],
      bookings: bookingsRes.data ?? [],
      conversations: conversationsRes.data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Telegram inbox' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const chatId = typeof body?.chatId === 'string' ? body.chatId.trim() : ''
    const supabase = createAdminClient()

    const conversationDelete = chatId
      ? await supabase.from('telegram_conversations').delete().eq('chat_id', chatId)
      : await supabase.from('telegram_conversations').delete().not('id', 'is', null)

    if (conversationDelete.error) {
      return NextResponse.json({ error: conversationDelete.error.message }, { status: 500 })
    }

    const sessionDelete = chatId
      ? await supabase.from('telegram_sessions').delete().eq('chat_id', chatId)
      : await supabase.from('telegram_sessions').delete().not('chat_id', 'is', null)

    if (sessionDelete.error) {
      return NextResponse.json({ error: sessionDelete.error.message }, { status: 500 })
    }

    const customerDelete = chatId
      ? await supabase.from('telegram_customers').delete().eq('chat_id', chatId)
      : await supabase.from('telegram_customers').delete().not('id', 'is', null)

    if (customerDelete.error) {
      return NextResponse.json({ error: customerDelete.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete Telegram conversations' },
      { status: 500 },
    )
  }
}
