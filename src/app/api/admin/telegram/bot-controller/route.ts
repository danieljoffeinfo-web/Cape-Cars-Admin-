import { NextRequest, NextResponse } from 'next/server'
import { getTelegramBotSettings, updateTelegramBotSettings, type TelegramBotSettings } from '@/lib/telegram-admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const settings = await getTelegramBotSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load bot controller settings' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const settings = (body?.settings ?? {}) as TelegramBotSettings
    const currentSettings = await getTelegramBotSettings()
    const result = await updateTelegramBotSettings({
      botEnabled: settings.botEnabled !== false,
      customerText: settings.customerText ?? {},
      adminText: settings.adminText ?? {},
      buttonText: settings.buttonText ?? {},
      customButtons: settings.customButtons ?? {},
      adminSubscribers: currentSettings.adminSubscribers ?? [],
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save bot controller settings' },
      { status: 500 },
    )
  }
}
