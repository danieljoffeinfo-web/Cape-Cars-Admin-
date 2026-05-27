import { NextRequest, NextResponse } from 'next/server'
import { processTelegramAdminUpdate } from '@/lib/telegram-admin-bot'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'telegram-admin-webhook',
    tokenConfigured: Boolean(process.env.TELEGRAM_ADMIN_BOT_TOKEN),
  })
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json()
    await processTelegramAdminUpdate(update)
  } catch (error) {
    // Telegram retries on non-200 responses, which duplicates admin actions.
    console.error('telegram admin webhook error', error)
  }
  return NextResponse.json({ ok: true })
}
