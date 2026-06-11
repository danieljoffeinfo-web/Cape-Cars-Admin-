import {
  closeVehicleForDates,
  getAdminSubscriberChatIds,
  getTelegramBookingById,
  getTelegramBookingsForRange,
  getTelegramBotSettings,
  getTelegramSession,
  getVehicleById,
  hasTelegramConversationMarker,
  logTelegramConversation,
  getVehiclesForCategory,
  openVehicleForBooking,
  pendingHoldExpiresAt,
  publicBaseUrl,
  registerAdminSubscriber,
  syncTelegramBookingToRental,
  updateAllVehicleRatesByPercent,
  updateTelegramBookingStatus,
  upsertTelegramSession,
  updateVehicleRate,
  type TelegramBookingWithCustomer,
} from '@/lib/telegram-admin'
import { CATEGORY_ORDER, type VehicleCategory } from '@/lib/telegram-catalog'

const TELEGRAM_ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN
const TELEGRAM_CUSTOMER_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TERMS_PDF_VERSION = '2026-05-27-v3'

type AdminStep =
  | 'home'
  | 'awaiting_vehicle_category'
  | 'awaiting_vehicle_selection'
  | 'awaiting_vehicle_dates'
  | 'awaiting_pricing_category'
  | 'awaiting_pricing_vehicle'
  | 'awaiting_single_price'
  | 'awaiting_global_percentage'
  | 'awaiting_bookings_range'

export type TelegramMessage = {
  chat: { id: number | string }
  text?: string
  from?: { first_name?: string; last_name?: string; username?: string }
}

type CallbackQuery = {
  id: string
  data?: string
  from?: { first_name?: string; last_name?: string; username?: string }
  message?: { chat: { id: number | string } }
}

export type TelegramUpdate = {
  message?: TelegramMessage
  callback_query?: CallbackQuery
}

type InlineButton = { text: string; callback_data?: string; url?: string }
type CustomerLocale = 'en' | 'ru'
type CustomerSessionData = {
  chat_id: string
  step: string
  locale?: CustomerLocale | null
  booking_id?: string | null
  customer_id?: string | null
  total_amount?: number | null
}

type VehicleAction = 'open' | 'close'

type AdminSession = {
  chatId: string
  step: AdminStep
  selectedCategory?: VehicleCategory | null
  selectedVehicleId?: string | null
  vehicleAction?: VehicleAction | null
}

type BotSettings = Awaited<ReturnType<typeof getTelegramBotSettings>>

const sessions = new Map<string, AdminSession>()

function getSession(chatId: string): AdminSession {
  return sessions.get(chatId) ?? { chatId, step: 'home', selectedCategory: null, selectedVehicleId: null, vehicleAction: null }
}

function saveSession(chatId: string, patch: Partial<AdminSession>) {
  const next = { ...getSession(chatId), ...patch, chatId }
  sessions.set(chatId, next)
  return next
}

function fullName(person?: { first_name?: string; last_name?: string }) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(' ').trim() || null
}

async function adminTelegramApi(method: string, payload: Record<string, unknown>) {
  if (!TELEGRAM_ADMIN_BOT_TOKEN) throw new Error('Missing TELEGRAM_ADMIN_BOT_TOKEN')

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_ADMIN_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Admin Telegram API ${method} failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function customerTelegramApi(method: string, payload: Record<string, unknown>) {
  if (!TELEGRAM_CUSTOMER_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_CUSTOMER_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Customer Telegram API ${method} failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function customerSendDocument(chatId: string, document: string, caption: string, buttons?: InlineButton[][]) {
  return customerTelegramApi('sendDocument', {
    chat_id: chatId,
    document,
    caption,
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  })
}

async function sendMessage(chatId: string, text: string, buttons?: InlineButton[][]) {
  return adminTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  })
}

async function sendPhoto(chatId: string, photo: string, caption?: string) {
  return adminTelegramApi('sendPhoto', {
    chat_id: chatId,
    photo,
    caption,
  })
}

async function sendPhotoFromCustomerFileId(chatId: string, fileId: string, caption?: string) {
  if (!TELEGRAM_CUSTOMER_BOT_TOKEN || !TELEGRAM_ADMIN_BOT_TOKEN) throw new Error('Missing Telegram bot token')

  const metaResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_CUSTOMER_BOT_TOKEN}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })

  const metaPayload = await metaResponse.json()
  const filePath = metaPayload?.result?.file_path
  if (!metaResponse.ok || !filePath) throw new Error('Could not resolve Telegram file path')

  const fileResponse = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_CUSTOMER_BOT_TOKEN}/${filePath}`)
  if (!fileResponse.ok) throw new Error('Could not download Telegram file')

  const contentType = fileResponse.headers.get('content-type') || 'image/jpeg'
  const fileBuffer = await fileResponse.arrayBuffer()
  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'

  const form = new FormData()
  form.append('chat_id', chatId)
  if (caption) form.append('caption', caption)
  form.append('photo', new Blob([fileBuffer], { type: contentType }), `telegram-upload.${extension}`)

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_ADMIN_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(`Admin Telegram API sendPhoto upload failed: ${response.status} ${await response.text()}`)
  }
}

async function sendPhotoBestEffort(chatId: string, fileId: string | null, caption?: string) {
  if (!fileId) return
  try {
    await sendPhotoFromCustomerFileId(chatId, fileId, caption)
  } catch (error) {
    console.error('sendPhotoBestEffort failed', { chatId, caption, error })
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return adminTelegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  })
}

function money(value: number) {
  return `R ${value.toLocaleString('en-ZA')}`
}

function menuButtons(): InlineButton[][] {
  return [
    [{ text: 'Управление автомобилями', callback_data: 'admin:vehicle_manager' }],
    [{ text: 'Изменение цен', callback_data: 'admin:pricing_change' }],
    [{ text: 'Все бронирования', callback_data: 'admin:view_bookings' }],
  ]
}

function settingsCopy(settings: BotSettings, key: string, fallback: string) {
  const value = settings.adminText?.[key] ?? settings.buttonText?.[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

async function liveMenuButtons(settings?: BotSettings): Promise<InlineButton[][]> {
  const s = settings ?? await getTelegramBotSettings()
  return [
    [{ text: settingsCopy(s, 'vehicleManager', 'Управление автомобилями'), callback_data: 'admin:vehicle_manager' }],
    [{ text: settingsCopy(s, 'pricingChange', 'Изменение цен'), callback_data: 'admin:pricing_change' }],
    [{ text: settingsCopy(s, 'viewBookings', 'Все бронирования'), callback_data: 'admin:view_bookings' }],
  ]
}

function categoryButtons(prefix: string): InlineButton[][] {
  return CATEGORY_ORDER.map((category) => [{ text: category, callback_data: `${prefix}:${category}` }])
}

function parseDate(text: string) {
  const value = text.trim().toLowerCase().replace(/,/g, ' ')
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(date.getTime()) ? null : value
  }

  const toIsoDate = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10)
  const nextWeekday = (targetDay: number, allowSameDay = false) => {
    const now = new Date()
    const date = new Date(now)
    let diff = (targetDay - now.getDay() + 7) % 7
    if (!allowSameDay && diff === 0) diff = 7
    date.setDate(now.getDate() + diff)
    return toIsoDate(date)
  }

  if (value === 'today') return toIsoDate(new Date())
  if (value === 'tomorrow') {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return toIsoDate(date)
  }

  const weekdays: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  }

  if (value in weekdays) return nextWeekday(weekdays[value])
  if (value.startsWith('next ')) {
    const day = value.replace('next ', '').trim()
    if (day in weekdays) return nextWeekday(weekdays[day])
  }
  if (value.startsWith('this ')) {
    const day = value.replace('this ', '').trim()
    if (day in weekdays) return nextWeekday(weekdays[day], true)
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    const year = y ? Number(y.length === 2 ? `20${y}` : y) : new Date().getFullYear()
    const date = new Date(year, Number(m) - 1, Number(d))
    return Number.isNaN(date.getTime()) ? null : toIsoDate(date)
  }

  const cleaned = value
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, '$1')
    .replace(/\bof\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (/^\d{1,2}$/.test(cleaned)) {
    const today = new Date()
    let year = today.getFullYear()
    let month = today.getMonth()
    let candidate = new Date(year, month, Number(cleaned))
    if (candidate.getDate() !== Number(cleaned) || candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      candidate = new Date(year, month + 1, Number(cleaned))
    }
    return Number.isNaN(candidate.getTime()) ? null : toIsoDate(candidate)
  }

  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const directDayMonth = cleaned.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (directDayMonth && monthNames.includes(directDayMonth[2])) {
    const day = Number(directDayMonth[1])
    const month = monthNames.indexOf(directDayMonth[2])
    const year = directDayMonth[3] ? Number(directDayMonth[3]) : new Date().getFullYear()
    const date = new Date(year, month, day)
    return Number.isNaN(date.getTime()) ? null : toIsoDate(date)
  }

  const natural = new Date(cleaned)
  if (!Number.isNaN(natural.getTime())) return toIsoDate(natural)
  return null
}

function parseDateRange(text: string) {
  const normalized = text.trim().replace(/\s+/g, ' ')
  const separators = [' to ', ' until ', ' - ', ' → ']

  for (const separator of separators) {
    if (!normalized.toLowerCase().includes(separator.trim())) continue
    const parts = normalized.split(new RegExp(separator, 'i')).map((part) => part.trim()).filter(Boolean)
    if (parts.length !== 2) continue
    const startDate = parseDate(parts[0])
    const endDate = parseDate(parts[1])
    if (startDate && endDate) return { startDate, endDate }
  }

  const singleDate = parseDate(normalized)
  if (singleDate) return { startDate: singleDate, endDate: singleDate }
  return null
}

function parseCurrency(text: string) {
  const digits = text.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = Number.parseInt(digits, 10)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function parsePercent(text: string) {
  const match = text.trim().match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number.parseFloat(match[0])
  return Number.isFinite(value) ? value : null
}

function bookingCode(id: string) {
  return `CC-${id.slice(0, 8).toUpperCase()}`
}

function customerShape(booking: TelegramBookingWithCustomer) {
  const raw = booking.telegram_customers
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw ?? null
}

async function sendMainMenu(chatId: string, text = 'Бот Cape Cars готов к работе. Выберите действие.') {
  const settings = await getTelegramBotSettings()
  saveSession(chatId, { step: 'home', selectedCategory: null, selectedVehicleId: null, vehicleAction: null })
  await sendMessage(chatId, settingsCopy(settings, 'mainMenu', text), await liveMenuButtons(settings))
}

function customerLocale(value?: string | null): CustomerLocale {
  return value === 'en' ? 'en' : 'ru'
}

function termsCaption(locale: CustomerLocale) {
  return locale === 'ru'
    ? '✅ Бронирование подтверждено.\n\nУсловия аренды Cape Cars прикреплены PDF-файлом. Прочитайте документ и нажмите «Принять», чтобы получить реквизиты для оплаты.'
    : '✅ Booking confirmed.\n\nCape Cars rental terms are attached as a PDF. Read the document, then tap Accept to receive the payment details.'
}

function termsAcceptButtons(locale: CustomerLocale): InlineButton[][] {
  return [[{ text: locale === 'ru' ? 'Принять' : 'Accept', callback_data: `terms_accept:${locale}` }]]
}

function termsPdfUrl(locale: CustomerLocale) {
  return `${publicBaseUrl()}/telegram-terms/cape-cars-rental-terms-${locale}-${TERMS_PDF_VERSION}.pdf`
}

async function sendCustomerBookingConfirmed(booking: TelegramBookingWithCustomer) {
  const persisted = await getTelegramSession<CustomerSessionData>(booking.chat_id)
  const previousSession = persisted?.session_data ?? null
  const locale = customerLocale(previousSession?.locale)

  await upsertTelegramSession({
    ...(previousSession ?? {}),
    chat_id: booking.chat_id,
    step: 'awaiting_id_image',
    locale,
    booking_id: booking.id,
    customer_id: booking.customer_id,
    total_amount: booking.total_amount ?? previousSession?.total_amount ?? null,
  })

  await customerTelegramApi('sendMessage', {
    chat_id: booking.chat_id,
    text: locale === 'ru'
      ? '✅ Даты и автомобиль подтверждены. Теперь, пожалуйста, отправьте чёткое фото вашего паспорта или ID.'
      : '✅ Your dates and vehicle have been confirmed. Please now send a clear photo of your passport or ID.',
  })
}

export async function sendCustomerBookingUnavailable(booking: TelegramBookingWithCustomer) {
  const persisted = await getTelegramSession<CustomerSessionData>(booking.chat_id)
  const previousSession = persisted?.session_data ?? null
  const locale = customerLocale(previousSession?.locale)

  await upsertTelegramSession({
    ...(previousSession ?? {}),
    chat_id: booking.chat_id,
    step: 'home',
    locale,
    booking_id: null,
  })

  await customerTelegramApi('sendMessage', {
    chat_id: booking.chat_id,
    text: locale === 'ru'
      ? 'К сожалению, автомобиль недоступен на выбранные вами даты. Менеджер свяжется с вами в ближайшее время.'
      : 'Unfortunately, the vehicle isn\'t available for the dates you selected. The manager will be in touch with you shortly.',
  })
}

function customerChatButtonRow(_chatId: string, username?: string | null): InlineButton[] | null {
  if (!username) return null
  return [{ text: 'Написать клиенту', url: `https://t.me/${username}` }]
}

function bookingActionButtons(booking: TelegramBookingWithCustomer) {
  const customer = customerShape(booking)
  const rows: InlineButton[][] = []
  const customerRow = customerChatButtonRow(booking.chat_id, customer?.telegram_username || null)
  if (customerRow) rows.push(customerRow)

  if (booking.status === 'pending') {
    rows.push([{ text: 'Подтвердить бронирование', callback_data: `admin:booking_confirm:${booking.id}` }])
    rows.push([{ text: 'Не подтверждать', callback_data: `admin:booking_decline:${booking.id}` }])
  }

  return rows
}

async function sendBookingSummary(
  chatId: string,
  booking: TelegramBookingWithCustomer,
  heading = 'Новое бронирование',
  options?: { includeDocuments?: boolean },
) {
  const customer = customerShape(booking)
  const customerName = customer?.full_name || customer?.telegram_name || booking.chat_id
  const telegramHandle = customer?.telegram_username ? `@${customer.telegram_username}` : 'Нет username'
  const holdUntil = pendingHoldExpiresAt(booking.created_at)
  const summary = [
    heading,
    '',
    `Код: ${bookingCode(booking.id)}`,
    `Клиент: ${customerName}`,
    `Telegram: ${telegramHandle}`,
    `Телефон: ${customer?.phone || 'Телефон не указан'}`,
    `Telegram ID: ${booking.chat_id}`,
    `Автомобиль: ${booking.vehicle_name || 'Автомобиль не выбран'}`,
    `Категория: ${booking.vehicle_category || 'Категория не выбрана'}`,
    `Даты: ${booking.start_date || 'Дата не указана'} → ${booking.end_date || 'Дата не указана'}`,
    `Дней: ${booking.total_days || 0}`,
    `Итого: ${booking.total_amount ? money(booking.total_amount) : 'Сумма не указана'}`,
    `Статус: ${booking.status}`,
    `Бронь действует до: ${new Date(holdUntil).toLocaleString('ru-RU')}`,
  ].join('\n')

  await sendMessage(chatId, summary, bookingActionButtons(booking))

  if (options?.includeDocuments) {
    await Promise.all([
      sendPhotoBestEffort(chatId, booking.id_file_id ?? null, `Паспорт / ID — ${customerName}`),
      sendPhotoBestEffort(chatId, booking.license_file_id ?? null, `Водит. удост. (перед) — ${customerName}`),
      sendPhotoBestEffort(chatId, booking.license_back_file_id ?? null, `Водит. удост. (обор.) — ${customerName}`),
    ])
  }
}

async function handleBookingAction(chatId: string, callbackId: string, bookingId: string, action: 'confirm' | 'decline' | 'paid') {
  const booking = await getTelegramBookingById(bookingId)
  if (!booking) {
    await answerCallbackQuery(callbackId, 'Бронирование не найдено')
    await sendMessage(chatId, 'Это бронирование больше не существует.')
    return
  }

  if (action === 'confirm') {
    if (['confirmed_booking', 'awaiting_payment_confirmation', 'confirmed', 'payment_collected'].includes(booking.status)) {
      await Promise.all([
        answerCallbackQuery(callbackId, 'Бронирование уже подтверждено'),
        sendBookingSummary(chatId, booking, 'Бронирование уже подтверждено'),
      ])
      return
    }

    const previousStatus = booking.status
    const updated = await updateTelegramBookingStatus(bookingId, 'confirmed_booking')
    if (!updated) {
      await answerCallbackQuery(callbackId, 'Не удалось подтвердить бронирование')
      return
    }

    const rentalSync = await syncTelegramBookingToRental(bookingId)
    if (!rentalSync.ok) {
      await updateTelegramBookingStatus(bookingId, previousStatus)
      await answerCallbackQuery(callbackId, 'Бронирование сохранено, синхронизация с сайтом не удалась')
      await sendMessage(chatId, `Подтверждение бронирования отменено — ошибка синхронизации с сайтом: ${rentalSync.error}`)
      return
    }

    await Promise.all([
      answerCallbackQuery(callbackId, 'Бронирование подтверждено'),
      sendCustomerBookingConfirmed(updated).catch((e) => console.error('sendCustomerBookingConfirmed failed', e)),
      sendBookingSummary(chatId, updated, 'Бронирование подтверждено'),
    ])
    return
  }

  if (action === 'decline') {
    if (['cancelled', 'expired'].includes(booking.status)) {
      await Promise.all([
        answerCallbackQuery(callbackId, 'Бронирование уже закрыто'),
        sendBookingSummary(chatId, booking, 'Бронирование уже закрыто'),
      ])
      return
    }

    const updated = await updateTelegramBookingStatus(bookingId, 'cancelled')
    if (!updated) {
      await answerCallbackQuery(callbackId, 'Не удалось отклонить бронирование')
      return
    }

    await Promise.all([
      answerCallbackQuery(callbackId, 'Бронирование отклонено'),
      sendCustomerBookingUnavailable(updated).catch((e) => console.error('sendCustomerBookingUnavailable failed', e)),
      sendBookingSummary(chatId, updated, 'Бронирование отклонено'),
    ])
    return
  }

  const previousStatus = booking.status
  const updated = await updateTelegramBookingStatus(bookingId, 'confirmed')
  await answerCallbackQuery(callbackId, 'Оплата получена')
  if (!updated) {
    await sendMessage(chatId, 'Оплата помечена как полученная, но запись бронирования не обновилась корректно.')
    return
  }

  const rentalSync = await syncTelegramBookingToRental(bookingId)
  if (!rentalSync.ok) {
    await updateTelegramBookingStatus(bookingId, previousStatus)
    await sendMessage(chatId, `Статус оплаты отменён — ошибка синхронизации с сайтом: ${rentalSync.error}`)
    return
  }

  await sendBookingSummary(chatId, updated, 'Оплата получена')
}

async function handleCallback(callback: CallbackQuery) {
  const data = callback.data ?? ''
  const chatId = String(callback.message?.chat.id ?? '')
  if (!chatId) return

  if (data === 'admin:main_menu') {
    await answerCallbackQuery(callback.id, 'Главное меню')
    await sendMainMenu(chatId)
    return
  }

  if (data === 'admin:vehicle_manager') {
    saveSession(chatId, { step: 'awaiting_vehicle_category', selectedCategory: null, selectedVehicleId: null, vehicleAction: null })
    await answerCallbackQuery(callback.id, 'Управление автомобилями')
    await sendMessage(chatId, 'Выберите категорию автомобиля.', categoryButtons('admin:vehicle_category'))
    return
  }

  if (data === 'admin:pricing_change') {
    await answerCallbackQuery(callback.id, 'Изменение цен')
    await sendMessage(chatId, 'Выберите действие.', [
      [{ text: 'Изменить все цены на %', callback_data: 'admin:pricing_all' }],
      [{ text: 'Изменить цену одного автомобиля', callback_data: 'admin:pricing_single' }],
      [{ text: 'Главное меню', callback_data: 'admin:main_menu' }],
    ])
    return
  }

  if (data === 'admin:view_bookings') {
    saveSession(chatId, { step: 'awaiting_bookings_range', selectedCategory: null, selectedVehicleId: null, vehicleAction: null })
    await answerCallbackQuery(callback.id, 'Просмотр бронирований')
    await sendMessage(chatId, 'Выберите период бронирований.', [
      [{ text: 'Эта неделя', callback_data: 'admin:bookings:week' }],
      [{ text: 'Этот месяц', callback_data: 'admin:bookings:month' }],
      [{ text: 'Три месяца', callback_data: 'admin:bookings:three_months' }],
      [{ text: 'Всё время', callback_data: 'admin:bookings:all' }],
    ])
    return
  }

  if (data === 'admin:pricing_all') {
    saveSession(chatId, { step: 'awaiting_global_percentage', selectedCategory: null, selectedVehicleId: null, vehicleAction: null })
    await answerCallbackQuery(callback.id, 'Изменить все цены')
    await sendMessage(chatId, 'Отправьте процент изменения. Пример: +10 или -5')
    return
  }

  if (data === 'admin:pricing_single') {
    saveSession(chatId, { step: 'awaiting_pricing_category', selectedCategory: null, selectedVehicleId: null, vehicleAction: null })
    await answerCallbackQuery(callback.id, 'Изменить одну цену')
    await sendMessage(chatId, 'Выберите категорию автомобиля для изменения цены.', categoryButtons('admin:pricing_category'))
    return
  }

  if (data.startsWith('admin:vehicle_category:')) {
    const category = data.replace('admin:vehicle_category:', '') as VehicleCategory
    const vehicles = await getVehiclesForCategory(category)
    saveSession(chatId, { step: 'awaiting_vehicle_selection', selectedCategory: category, selectedVehicleId: null, vehicleAction: null })
    await answerCallbackQuery(callback.id, category)
    if (vehicles.length === 0) {
      await sendMessage(chatId, `Автомобили в категории ${category} не найдены.`, [[{ text: 'Главное меню', callback_data: 'admin:main_menu' }]])
      return
    }
    await sendMessage(chatId, `Выберите автомобиль для управления в категории ${category}.`, vehicles.map((vehicle) => [{ text: `${vehicle.model} (${vehicle.status})`, callback_data: `admin:vehicle:${vehicle.id}` }]))
    return
  }

  if (data.startsWith('admin:vehicle:')) {
    const vehicleId = data.replace('admin:vehicle:', '')
    const vehicle = await getVehicleById(vehicleId)
    saveSession(chatId, { selectedVehicleId: vehicleId, vehicleAction: null, step: 'awaiting_vehicle_selection' })
    await answerCallbackQuery(callback.id, vehicle?.model || 'Автомобиль выбран')
    await sendMessage(chatId, `${vehicle?.model || 'Автомобиль'} выбран. Что хотите сделать?`, [
      [{ text: 'Закрыть автомобиль', callback_data: 'admin:vehicle_action:close' }],
      [{ text: 'Открыть автомобиль', callback_data: 'admin:vehicle_action:open' }],
      [{ text: 'Главное меню', callback_data: 'admin:main_menu' }],
    ])
    return
  }

  if (data.startsWith('admin:vehicle_action:')) {
    const action = data.replace('admin:vehicle_action:', '') as VehicleAction
    const session = getSession(chatId)
    const vehicle = session.selectedVehicleId ? await getVehicleById(session.selectedVehicleId) : null
    if (!session.selectedVehicleId || !vehicle) {
      await answerCallbackQuery(callback.id, 'Сначала выберите автомобиль')
      await sendMainMenu(chatId, 'Сначала выберите раздел «Управление автомобилями» и выберите автомобиль.')
      return
    }

    if (action === 'open') {
      const result = await openVehicleForBooking(session.selectedVehicleId)
      await answerCallbackQuery(callback.id, 'Автомобиль открыт')
      if (!result.ok) {
        await sendMessage(chatId, `Не удалось открыть автомобиль: ${result.error}`)
        return
      }
      await sendMainMenu(chatId, `${result.vehicle.model} теперь открыт для бронирования.`)
      return
    }

    saveSession(chatId, { step: 'awaiting_vehicle_dates', vehicleAction: 'close' })
    await answerCallbackQuery(callback.id, 'Закрыть автомобиль')
    await sendMessage(chatId, `Отправьте даты закрытия ${vehicle.model}. Пример: 16/05/2026 - 20/05/2026`)
    return
  }

  if (data.startsWith('admin:pricing_category:')) {
    const category = data.replace('admin:pricing_category:', '') as VehicleCategory
    const vehicles = await getVehiclesForCategory(category)
    saveSession(chatId, { step: 'awaiting_pricing_vehicle', selectedCategory: category, selectedVehicleId: null })
    await answerCallbackQuery(callback.id, category)
    if (vehicles.length === 0) {
      await sendMessage(chatId, `Автомобили в категории ${category} не найдены.`, [[{ text: 'Главное меню', callback_data: 'admin:main_menu' }]])
      return
    }
    await sendMessage(chatId, `Выберите автомобиль для изменения цены в категории ${category}.`, vehicles.map((vehicle) => [{ text: `Изменить цену ${vehicle.model}`, callback_data: `admin:price_vehicle:${vehicle.id}` }]))
    return
  }

  if (data.startsWith('admin:price_vehicle:')) {
    const vehicleId = data.replace('admin:price_vehicle:', '')
    const vehicle = await getVehicleById(vehicleId)
    saveSession(chatId, { step: 'awaiting_single_price', selectedVehicleId: vehicleId })
    await answerCallbackQuery(callback.id, vehicle?.model || 'Автомобиль выбран')
    await sendMessage(chatId, `Отправьте новую дневную ставку для ${vehicle?.model || 'автомобиля'}. Формат: R3000 или 3000`)
    return
  }

  if (data.startsWith('admin:bookings:')) {
    const range = data.replace('admin:bookings:', '') as 'week' | 'month' | 'three_months' | 'all'
    const bookings = await getTelegramBookingsForRange(range)
    await answerCallbackQuery(callback.id, 'Загрузка бронирований')
    if (bookings.length === 0) {
      await sendMessage(chatId, 'Бронирования за этот период не найдены.', [[{ text: 'Главное меню', callback_data: 'admin:main_menu' }]])
      return
    }

    const lines = bookings.slice(0, 20).map((booking) => {
      const customer = customerShape(booking)
      return [
        `${bookingCode(booking.id)} · ${booking.vehicle_name || 'Автомобиль не выбран'}`,
        `${customer?.full_name || customer?.telegram_name || booking.chat_id}`,
        `${booking.start_date || 'Дата не указана'} → ${booking.end_date || 'Дата не указана'}`,
        `${booking.status} · ${booking.total_amount ? money(booking.total_amount) : 'Сумма не указана'}`,
      ].join('\n')
    })

    await sendMessage(chatId, [`Бронирований найдено: ${bookings.length}`, '', ...lines].join('\n\n'), [[{ text: 'Главное меню', callback_data: 'admin:main_menu' }]])
    saveSession(chatId, { step: 'home', selectedCategory: null, selectedVehicleId: null, vehicleAction: null })
    return
  }

  if (data.startsWith('admin:booking_confirm:')) {
    await handleBookingAction(chatId, callback.id, data.replace('admin:booking_confirm:', ''), 'confirm')
    return
  }

  if (data.startsWith('admin:booking_decline:')) {
    await handleBookingAction(chatId, callback.id, data.replace('admin:booking_decline:', ''), 'decline')
    return
  }

  if (data.startsWith('admin:booking_paid:')) {
    await handleBookingAction(chatId, callback.id, data.replace('admin:booking_paid:', ''), 'paid')
  }
}

async function handleMessage(message: TelegramMessage) {
  const chatId = String(message.chat.id)
  const text = message.text?.trim() ?? ''
  const session = getSession(chatId)

  await registerAdminSubscriber(chatId, fullName(message.from), message.from?.username ?? null)

  if (!text || text === '/start' || text.toLowerCase() === 'start') {
    await sendMainMenu(chatId)
    return
  }

  if (session.step === 'awaiting_vehicle_dates' && session.selectedVehicleId && session.vehicleAction === 'close') {
    const range = parseDateRange(text)
    if (!range) {
      await sendMessage(chatId, 'Нужен корректный диапазон дат. Пример: 16/05/2026 - 20/05/2026')
      return
    }

    const result = await closeVehicleForDates(session.selectedVehicleId, range.startDate, range.endDate)
    if (!result.ok) {
      await sendMessage(chatId, `Не удалось закрыть автомобиль: ${result.error}`)
      return
    }

    await sendMainMenu(chatId, `${result.vehicle.model} закрыт с ${range.startDate} по ${range.endDate}. Автомобиль скрыт из списка для клиентов.`)
    return
  }

  if (session.step === 'awaiting_single_price' && session.selectedVehicleId) {
    const rate = parseCurrency(text)
    if (rate === null) {
      await sendMessage(chatId, 'Отправьте корректную дневную ставку. Формат: R3000 или 3000')
      return
    }

    const result = await updateVehicleRate(session.selectedVehicleId, rate)
    if (!result.ok) {
      await sendMessage(chatId, `Не удалось обновить цену: ${result.error}`)
      return
    }

    await sendMainMenu(chatId, `${result.vehicle.model}: новая дневная ставка — ${money(rate)}.`)
    return
  }

  if (session.step === 'awaiting_global_percentage') {
    const percent = parsePercent(text)
    if (percent === null) {
      await sendMessage(chatId, 'Отправьте корректный процент, например: +10 или -5')
      return
    }

    const result = await updateAllVehicleRatesByPercent(percent)
    if (!result.ok) {
      await sendMessage(chatId, `Не удалось обновить все цены: ${result.error}`)
      return
    }

    await sendMainMenu(chatId, `Обновлено ${result.count} автомобилей на ${percent}%.`)
    return
  }

  await sendMainMenu(chatId)
}

export async function processTelegramAdminUpdate(update: TelegramUpdate) {
  if (update.callback_query) {
    await handleCallback(update.callback_query)
    return
  }

  if (update.message) {
    await handleMessage(update.message)
  }
}

export async function notifyAdminManagerRequest(input: {
  chatId: string
  locale: 'en' | 'ru'
  telegramName?: string | null
  username?: string | null
  customerName?: string | null
  phone?: string | null
  requestType?: string | null
}) {
  const adminChatIds = await getAdminSubscriberChatIds()
  if (adminChatIds.length === 0) return

  const marker = `ADMIN_MANAGER_REQUEST_SENT:${input.chatId}:${Date.now()}`

  const customerLabel = input.customerName || input.telegramName || input.chatId
  const summary = [
    'Запрос к менеджеру',
    '',
    input.requestType ? `Тип запроса: ${input.requestType}` : null,
    `Клиент: ${customerLabel}`,
    `Telegram: ${input.username ? `@${input.username}` : 'Нет username'}`,
    `Телефон: ${input.phone || 'Телефон не указан'}`,
    `Telegram ID: ${input.chatId}`,
    `Язык: ${input.locale === 'ru' ? 'Русский' : 'Английский'}`,
  ].filter(Boolean).join('\n')

  const buttons = (() => {
    const row = customerChatButtonRow(input.chatId, input.username || null)
    return row ? [row] : undefined
  })()

  await Promise.all(adminChatIds.map((adminChatId) => sendMessage(adminChatId, summary, buttons)))

  await logTelegramConversation({
    chatId: input.chatId,
    direction: 'outbound',
    messageType: 'text',
    body: marker,
    meta: { adminChatIds, locale: input.locale, requestType: input.requestType ?? null },
  })
}

export async function notifyAdminNewBooking(input: {
  bookingId: string
  chatId: string
  customerName?: string | null
  phone?: string | null
  username?: string | null
  vehicleName?: string | null
  vehicleCategory?: string | null
  startDate?: string | null
  endDate?: string | null
  totalDays?: number | null
  totalAmount?: number | null
  idFileId?: string | null
  licenseFileId?: string | null
  licenseBackFileId?: string | null
}) {
  const adminChatIds = await getAdminSubscriberChatIds()
  if (adminChatIds.length === 0) return

  const marker = `ADMIN_BOOKING_ALERT_SENT:${input.bookingId}`
  const alreadySent = await hasTelegramConversationMarker(input.chatId, marker)
  if (alreadySent) return

  const booking = await getTelegramBookingById(input.bookingId)
  if (booking) {
    await Promise.all(adminChatIds.map((adminChatId) => sendBookingSummary(adminChatId, booking, 'Новое бронирование')))
    await logTelegramConversation({
      chatId: input.chatId,
      direction: 'outbound',
      messageType: 'text',
      body: marker,
      meta: { bookingId: input.bookingId, adminChatIds },
    })
    return
  }

  const telegramHandle = input.username ? `@${input.username}` : 'Нет username'
  const holdUntil = pendingHoldExpiresAt(new Date().toISOString())
  const summary = [
    'Новое бронирование',
    '',
    `Код: ${bookingCode(input.bookingId)}`,
    `Клиент: ${input.customerName || 'Клиент неизвестен'}`,
    `Telegram: ${telegramHandle}`,
    `Телефон: ${input.phone || 'Телефон не указан'}`,
    `Telegram ID: ${input.chatId}`,
    `Автомобиль: ${input.vehicleName || 'Автомобиль не выбран'}`,
    `Категория: ${input.vehicleCategory || 'Категория не выбрана'}`,
    `Даты: ${input.startDate || 'Дата не указана'} → ${input.endDate || 'Дата не указана'}`,
    `Дней: ${input.totalDays || 0}`,
    `Итого: ${input.totalAmount ? money(input.totalAmount) : 'Сумма не указана'}`,
    'Статус: подтверждено клиентом',
    `Оплата до: ${new Date(holdUntil).toLocaleString('ru-RU')}`,
  ].join('\n')

  const contactRow = customerChatButtonRow(input.chatId, input.username || null)
  const buttons = contactRow ? [contactRow] : undefined

  const customerName = input.customerName || 'Клиент'
  await Promise.all(adminChatIds.map(async (adminChatId) => {
    await sendMessage(adminChatId, summary, buttons)
    await Promise.all([
      sendPhotoBestEffort(adminChatId, input.idFileId ?? null, `Паспорт / ID — ${customerName}`),
      sendPhotoBestEffort(adminChatId, input.licenseFileId ?? null, `Водит. удост. (перед) — ${customerName}`),
      sendPhotoBestEffort(adminChatId, input.licenseBackFileId ?? null, `Водит. удост. (обор.) — ${customerName}`),
    ])
  }))

  await logTelegramConversation({
    chatId: input.chatId,
    direction: 'outbound',
    messageType: 'text',
    body: marker,
    meta: { bookingId: input.bookingId, adminChatIds },
  })
}

export async function notifyAdminDocumentUpload(input: {
  bookingId: string
  chatId: string
  fileId?: string | null
  documentKind: 'id_passport' | 'license_front' | 'license_back'
}) {
  if (!input.bookingId || !input.fileId) return

  const adminChatIds = await getAdminSubscriberChatIds()
  if (adminChatIds.length === 0) return

  const marker = `ADMIN_DOCUMENT_UPLOAD_SENT:${input.bookingId}:${input.documentKind}:${input.fileId}`
  const alreadySent = await hasTelegramConversationMarker(input.chatId, marker)
  if (alreadySent) return

  const booking = await getTelegramBookingById(input.bookingId)
  const customer = booking ? customerShape(booking) : null
  const customerName = customer?.full_name || customer?.telegram_name || input.chatId
  const documentLabel = input.documentKind === 'id_passport'
    ? 'Паспорт / ID'
    : input.documentKind === 'license_front'
      ? 'Водит. удост. (перед)'
      : 'Водит. удост. (обор.)'

  const summary = booking
    ? [
      `${documentLabel} получен`,
      '',
      `Код: ${bookingCode(booking.id)}`,
      `Клиент: ${customerName}`,
      `Telegram: ${customer?.telegram_username ? `@${customer.telegram_username}` : 'Нет username'}`,
      `Телефон: ${customer?.phone || 'Телефон не указан'}`,
      `Автомобиль: ${booking.vehicle_name || 'Автомобиль не выбран'}`,
      `Даты: ${booking.start_date || 'Дата не указана'} → ${booking.end_date || 'Дата не указана'}`,
      `Статус: ${booking.status}`,
    ].join('\n')
    : [
      `${documentLabel} получен`,
      '',
      `Код: ${bookingCode(input.bookingId)}`,
      `Telegram ID клиента: ${input.chatId}`,
    ].join('\n')

  const contactRow = customerChatButtonRow(input.chatId, customer?.telegram_username || null)
  const buttons = contactRow ? [contactRow] : undefined

  await Promise.all(adminChatIds.map(async (adminChatId) => {
    await sendMessage(adminChatId, summary, buttons)
    await sendPhotoBestEffort(adminChatId, input.fileId ?? null, `${documentLabel} — ${customerName}`)
  }))

  await logTelegramConversation({
    chatId: input.chatId,
    direction: 'outbound',
    messageType: 'text',
    body: marker,
    meta: { bookingId: input.bookingId, adminChatIds, documentKind: input.documentKind },
  })
}

export async function notifyAdminPaymentProof(input: {
  bookingId: string
  chatId: string
  paymentProofFileId?: string | null
}) {
  if (!input.bookingId) return
  const adminChatIds = await getAdminSubscriberChatIds()
  if (adminChatIds.length === 0) return

  const marker = `ADMIN_PAYMENT_PROOF_SENT:${input.bookingId}`
  const alreadySent = await hasTelegramConversationMarker(input.chatId, marker)
  if (alreadySent) return

  const booking = await getTelegramBookingById(input.bookingId)
  const customer = booking ? customerShape(booking) : null
  const summary = booking
    ? [
      'Получено подтверждение оплаты',
      '',
      `Код: ${bookingCode(booking.id)}`,
      `Клиент: ${customer?.full_name || customer?.telegram_name || booking.chat_id}`,
      `Telegram: ${customer?.telegram_username ? `@${customer.telegram_username}` : 'Нет username'}`,
      `Телефон: ${customer?.phone || 'Телефон не указан'}`,
      `Автомобиль: ${booking.vehicle_name || 'Автомобиль не выбран'}`,
      `Даты: ${booking.start_date || 'Дата не указана'} → ${booking.end_date || 'Дата не указана'}`,
      `Итого: ${booking.total_amount ? money(booking.total_amount) : 'Сумма не указана'}`,
      `Статус: ${booking.status}`,
    ].join('\n')
    : [
      'Получено подтверждение оплаты',
      '',
      `Код: ${bookingCode(input.bookingId)}`,
      `Telegram ID клиента: ${input.chatId}`,
    ].join('\n')

  const contactRow = customerChatButtonRow(input.chatId, customer?.telegram_username || null)
  const buttons = [
    ...(contactRow ? [contactRow] : []),
    [{ text: 'Оплата получена', callback_data: `admin:booking_paid:${input.bookingId}` }],
  ]

  await Promise.all(adminChatIds.map(async (adminChatId) => {
    await sendMessage(adminChatId, summary, buttons)
    await sendPhotoBestEffort(adminChatId, input.paymentProofFileId ?? null, `Подтверждение оплаты — ${booking ? bookingCode(booking.id) : input.chatId}`)
  }))

  await logTelegramConversation({
    chatId: input.chatId,
    direction: 'outbound',
    messageType: 'text',
    body: marker,
    meta: { bookingId: input.bookingId, adminChatIds },
  })
}

export async function notifyAdminCashPayment(input: {
  bookingId: string
  chatId: string
}) {
  if (!input.bookingId) return
  const adminChatIds = await getAdminSubscriberChatIds()
  if (adminChatIds.length === 0) return

  const marker = `ADMIN_CASH_PAYMENT_SENT:${input.bookingId}`
  const alreadySent = await hasTelegramConversationMarker(input.chatId, marker)
  if (alreadySent) return

  const booking = await getTelegramBookingById(input.bookingId)
  const customer = booking ? customerShape(booking) : null
  const summary = booking
    ? [
      'Выбрана оплата наличными',
      '',
      `Код: ${bookingCode(booking.id)}`,
      `Клиент: ${customer?.full_name || customer?.telegram_name || booking.chat_id}`,
      `Telegram: ${customer?.telegram_username ? `@${customer.telegram_username}` : 'Нет username'}`,
      `Телефон: ${customer?.phone || 'Телефон не указан'}`,
      `Автомобиль: ${booking.vehicle_name || 'Автомобиль не выбран'}`,
      `Даты: ${booking.start_date || 'Дата не указана'} → ${booking.end_date || 'Дата не указана'}`,
      `Итого: ${booking.total_amount ? money(booking.total_amount) : 'Сумма не указана'}`,
    ].join('\n')
    : [
      'Выбрана оплата наличными',
      '',
      `Код: ${bookingCode(input.bookingId)}`,
      `Telegram ID клиента: ${input.chatId}`,
    ].join('\n')

  const contactRow = customerChatButtonRow(input.chatId, customer?.telegram_username || null)
  const buttons = [
    ...(contactRow ? [contactRow] : []),
    [{ text: 'Оплата получена', callback_data: `admin:booking_paid:${input.bookingId}` }],
  ]

  await Promise.all(adminChatIds.map((adminChatId) => sendMessage(adminChatId, summary, buttons)))

  await logTelegramConversation({
    chatId: input.chatId,
    direction: 'outbound',
    messageType: 'text',
    body: marker,
    meta: { bookingId: input.bookingId, adminChatIds },
  })
}
