import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { CATEGORY_ORDER, TELEGRAM_CATALOG, getTelegramBodyType, getTelegramSegment, getTelegramVehicleDisplay, type TelegramBodyType, type TelegramSegment, type VehicleCategory } from '@/lib/telegram-catalog'
import { buildTelegramProxyUrl, getLatestTelegramBookingForChat, getTelegramSession, getVehicleById, getVehiclesForCustomerCategory, logTelegramConversation, publicBaseUrl, type VehicleBlockedRange, upsertTelegramBooking, upsertTelegramCustomer, upsertTelegramSession } from '@/lib/telegram-admin'
import { notifyAdminCashPayment, notifyAdminManagerRequest, notifyAdminNewBooking, notifyAdminPaymentProof } from '@/lib/telegram-admin-bot'

type Locale = 'en' | 'ru'

export type SessionStep =
  | 'choosing_language'
  | 'choosing_category'
  | 'choosing_body_type'
  | 'choosing_vehicle'
  | 'awaiting_start_date'
  | 'awaiting_end_date'
  | 'awaiting_confirmation'
  | 'awaiting_full_name'
  | 'awaiting_phone'
  | 'awaiting_id_image'
  | 'awaiting_license_image'
  | 'awaiting_license_back_image'
  | 'awaiting_terms_acceptance'
  | 'awaiting_payment_proof'
  | 'completed'

export type BotSession = {
  chat_id: string
  booking_id?: string | null
  customer_id?: string | null
  step: SessionStep
  locale?: Locale | null
  telegram_name?: string | null
  telegram_username?: string | null
  customer_full_name?: string | null
  customer_phone?: string | null
  selected_segment?: TelegramSegment | null
  selected_category?: VehicleCategory | null
  selected_body_type?: TelegramBodyType | null
  selected_vehicle_id?: string | null
  selected_vehicle_model?: string | null
  selected_vehicle_display_model?: string | null
  daily_rate?: number | null
  requested_start_date?: string | null
  requested_days?: number | null
  requested_end_date?: string | null
  total_amount?: number | null
  id_file_id?: string | null
  license_file_id?: string | null
  license_back_file_id?: string | null
  blocked_ranges?: VehicleBlockedRange[]
  updated_at?: string
}

type TelegramMessage = {
  chat: { id: number | string }
  text?: string
  from?: { first_name?: string; last_name?: string; username?: string }
  photo?: { file_id: string }[]
  document?: { file_id: string; mime_type?: string }
}

type CallbackQuery = {
  id: string
  data?: string
  from?: { first_name?: string; last_name?: string; username?: string }
  message?: { chat: { id: number | string }; message_id?: number }
}

export type TelegramUpdate = {
  message?: TelegramMessage
  callback_query?: CallbackQuery
}

type TelegramInlineButton = { text: string; callback_data?: string; url?: string }

type VehicleChoice = {
  id: string
  model: string
  bookingModel: string
  category: VehicleCategory
  bodyType: TelegramBodyType
  rate: number
  status: string
  imageUrl: string
  source: 'db' | 'static'
  blockedRanges: VehicleBlockedRange[]
  isBlocked: boolean
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const memorySessions = new Map<string, BotSession>()

type BotControllerConfig = {
  botEnabled?: boolean
  customerText?: Record<string, string>
  adminText?: Record<string, string>
  buttonText?: Record<string, string>
  customButtons?: Record<string, Array<{
    id: string
    labelEn: string
    labelRu: string
    action: 'manager' | 'url'
    url?: string | null
  }>>
}

const SEGMENT_ORDER: TelegramSegment[] = ['luxury', 'mid', 'economy']

const SEGMENT_LABELS: Record<Locale, Record<TelegramSegment, string>> = {
  en: {
    luxury: 'Luxury',
    mid: 'Mid-range',
    economy: 'Economy',
  },
  ru: {
    luxury: 'Люкс',
    mid: 'Средний класс',
    economy: 'Эконом',
  },
}

const BODY_TYPE_LABELS: Record<Locale, Record<TelegramBodyType, string>> = {
  en: {
    SUV: 'SUVs',
    Sedan: 'Sedans',
    Convertible: 'Convertibles',
    Coupe: 'Coupes',
    Hatchback: 'Hatchbacks',
    Van: 'Vans',
    Minibus: 'Minibuses',
    'People Mover': 'People Movers',
  },
  ru: {
    SUV: 'SUV',
    Sedan: 'Седаны',
    Convertible: 'Кабриолеты',
    Coupe: 'Купе',
    Hatchback: 'Хэтчбеки',
    Van: 'Фургоны',
    Minibus: 'Микроавтобусы',
    'People Mover': 'Минивэны',
  },
}

const MONTH_NAMES: Record<Locale, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
}

const DAY_NAMES: Record<Locale, string[]> = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
}

const TEXT = {
  welcome: {
    en: '⛰️ Welcome to Cape Cars Rentals. View our available vehicles below.',
    ru: '⛰️ Добро пожаловать в Cape Cars Rentals. Посмотрите доступные автомобили ниже.',
  },
  chooseCategory: {
    en: 'Choose a vehicle class below.',
    ru: 'Выберите класс автомобиля ниже.',
  },
  categoryIntro: {
    en: (segment: TelegramSegment) => `${SEGMENT_LABELS.en[segment]} vehicles. Browse by body type below.`,
    ru: (segment: TelegramSegment) => `${SEGMENT_LABELS.ru[segment]}. Ниже автомобили по типу кузова.`,
  },
  chooseVehicle: {
    en: 'Please choose a vehicle from the category list above.',
    ru: 'Пожалуйста, выберите автомобиль из списка выше.',
  },
  chooseBodyType: {
    en: 'Choose a body type below.',
    ru: 'Выберите тип кузова ниже.',
  },
  bookingVehicle: {
    en: (model: string) => `Book ${model}`,
    ru: (model: string) => `Забронировать ${model}`,
  },
  calendarStart: {
    en: (model: string) => `📅 ${model}\n\nSelect your start date.\n• = already booked`,
    ru: (model: string) => `📅 ${model}\n\nВыберите дату начала аренды.\n• = уже забронировано`,
  },
  calendarEnd: {
    en: (startDate: string) => `📅 Start date: ${startDate}\n\nNow select your return date.\n• = already booked`,
    ru: (startDate: string) => `📅 Дата начала: ${startDate}\n\nВыберите дату возврата.\n• = уже забронировано`,
  },
  confirmSummary: {
    en: (model: string, dailyRate: number, days: number, totalAmount: number, startDate: string, endDate: string) => [
      `Daily rate on ${model} is ${formatCurrency(dailyRate)}.`,
      `For ${days} day${days === 1 ? '' : 's'}, your total is ${formatCurrency(totalAmount)}.`,
      '',
      `Start date: ${startDate}`,
      `End date: ${endDate}`,
      '',
      'Would you like to confirm, make changes, or view other vehicles?',
    ].join('\n'),
    ru: (model: string, dailyRate: number, days: number, totalAmount: number, startDate: string, endDate: string) => [
      `Дневная ставка на ${model}: ${formatCurrency(dailyRate)}.`,
      `За ${days} дн. сумма составит ${formatCurrency(totalAmount)}.`,
      '',
      `Дата начала: ${startDate}`,
      `Дата окончания: ${endDate}`,
      '',
      'Подтвердить, изменить данные или посмотреть другие автомобили?',
    ].join('\n'),
  },
  fullName: {
    en: 'Please send your full name and surname.',
    ru: 'Пожалуйста, отправьте ваше полное имя и фамилию.',
  },
  phone: {
    en: 'Please send your phone number.',
    ru: 'Пожалуйста, отправьте ваш номер телефона.',
  },
  idPassport: {
    en: 'Please send a clear image of your ID or passport.',
    ru: 'Пожалуйста, отправьте чёткое фото вашего ID или паспорта.',
  },
  license: {
    en: 'Thanks. Now please send a clear image of the FRONT of your driver’s license.',
    ru: 'Спасибо. Теперь отправьте чёткое фото ПЕРЕДНЕЙ стороны водительского удостоверения.',
  },
  licenseBack: {
    en: 'Perfect. Now send a clear image of the BACK of your driver’s license.',
    ru: 'Отлично. Теперь отправьте чёткое фото ОБРАТНОЙ стороны водительского удостоверения.',
  },
  done: {
    en: (bookingCode: string) => `Perfect. Your booking ${bookingCode} is confirmed in the Cape Cars system and the dates are now reserved.\n\nA manager will be in touch shortly.`,
    ru: (bookingCode: string) => `Отлично. Ваше бронирование ${bookingCode} подтверждено в системе Cape Cars, и даты уже зарезервированы.\n\nМенеджер свяжется с вами в ближайшее время.`,
  },
  alreadyCompleted: {
    en: (bookingCode: string) => `Your booking ${bookingCode} is already locked in Cape Cars and those dates are reserved. Send /start only if you want to begin a new booking.`,
    ru: (bookingCode: string) => `Ваше бронирование ${bookingCode} уже зафиксировано в Cape Cars, и эти даты зарезервированы. Отправьте /start, только если хотите начать новое бронирование.`,
  },
  vehicleNotFound: {
    en: 'Vehicle not found',
    ru: 'Автомобиль не найден',
  },
  noVehicles: {
    en: 'There are no vehicles in this category right now.',
    ru: 'Сейчас в этой категории нет автомобилей.',
  },
  bookingConfirmed: {
    en: '✅ Booking confirmed. Choose your language below to review the rental terms.',
    ru: '✅ Бронирование подтверждено. Выберите язык ниже, чтобы посмотреть условия аренды.',
  },
  termsDocumentCaption: {
    en: 'Cape Cars rental terms. Read the document, then tap Accept below.',
    ru: 'Условия аренды Cape Cars. Прочитайте документ и нажмите «Принять» ниже.',
  },
  termsDocumentViewCaption: {
    en: 'Cape Cars rental terms and conditions are attached.',
    ru: 'Условия аренды Cape Cars прикреплены.',
  },
  termsAcceptanceReminder: {
    en: 'Please read and accept the rental terms above before payment details are sent.',
    ru: 'Пожалуйста, прочитайте и примите условия аренды выше, после этого мы отправим реквизиты для оплаты.',
  },
  managerRequested: {
    en: 'A manager has been notified and will reach out shortly. You can also continue browsing vehicles below.',
    ru: 'Менеджер уже уведомлён и скоро свяжется с вами. Вы также можете продолжить просмотр автомобилей ниже.',
  },
  paymentDetails: {
    en: (totalAmount?: number | null) => [
      'PAYMENT DETAILS',
      '',
      '+7-999-217-03-12',
      'Евгений Н.',
      'Альфа-Банк / Сбербанк / Т-Банк',
      '',
      'Deposit due now: 5000 RUB to secure the booking.',
      totalAmount ? `Rental total: ${formatCurrency(totalAmount)}.` : null,
      'The remaining rental balance is due upfront on collection, before the vehicle is released.',
      '',
      'Please send proof of payment after payment.',
    ].filter(Boolean).join('\n'),
    ru: (totalAmount?: number | null) => [
      'РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ',
      '',
      '+7-999-217-03-12',
      'Евгений Н.',
      'Альфа-Банк / Сбербанк / Т-Банк',
      '',
      'Предоплата сейчас: 5000 ₽ для закрепления бронирования.',
      totalAmount ? `Итоговая сумма аренды: ${formatCurrency(totalAmount)}.` : null,
      'Оставшаяся сумма аренды оплачивается полностью при получении автомобиля, до передачи ключей.',
      '',
      'Пожалуйста, отправьте подтверждение оплаты после перевода.',
    ].filter(Boolean).join('\n'),
  },
  cashPayment: {
    en: 'Cash payment selected. A manager will be in touch shortly.',
    ru: 'Выбрана оплата наличными. Менеджер свяжется с вами в ближайшее время.',
  },
  paymentProof: {
    en: 'Please send a screenshot or photo of your payment confirmation here.',
    ru: 'Пожалуйста, отправьте сюда скриншот или фото подтверждения оплаты.',
  },
  paymentProofReceived: {
    en: '✅ Payment proof received. Cape Cars admin has been notified and will confirm shortly.\n\nA manager will be in touch shortly.',
    ru: '✅ Подтверждение оплаты получено. Администратор Cape Cars уведомлён и скоро подтвердит оплату.\n\nМенеджер свяжется с вами в ближайшее время.',
  },
} as const

async function getBotControllerConfig(): Promise<BotControllerConfig> {
  const supabase = getPublicSupabaseClient()
  if (!supabase) return {}

  try {
    const { data, error } = await supabase
      .from('telegram_bot_settings')
      .select('settings')
      .eq('id', 'live')
      .maybeSingle()

    if (error) {
      console.error('getBotControllerConfig failed', error)
      return {}
    }

    return (data?.settings ?? {}) as BotControllerConfig
  } catch (error) {
    console.error('getBotControllerConfig exception', error)
    return {}
  }
}

function copy(config: BotControllerConfig, scope: 'customerText' | 'adminText' | 'buttonText', key: string, fallback: string) {
  const value = config[scope]?.[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function customButtonRows(config: BotControllerConfig, nodeId: string, locale: Locale): TelegramInlineButton[][] {
  return (config.customButtons?.[nodeId] ?? [])
    .map((button): TelegramInlineButton[] | null => {
      const text = (locale === 'ru' ? button.labelRu : button.labelEn)?.trim()
      if (!text) return null
      if (button.action === 'url' && button.url?.trim()) return [{ text, url: button.url.trim() }]
      return [{ text, callback_data: 'manager_request' }]
    })
    .filter((row): row is TelegramInlineButton[] => Boolean(row))
}

function defaultSession(chatId: string): BotSession {
  return {
    chat_id: chatId,
    booking_id: null,
    customer_id: null,
    step: 'choosing_language',
    locale: null,
    telegram_name: null,
    telegram_username: null,
    customer_full_name: null,
    customer_phone: null,
    selected_segment: null,
    selected_category: null,
    selected_body_type: null,
    selected_vehicle_id: null,
    selected_vehicle_model: null,
    selected_vehicle_display_model: null,
    daily_rate: null,
    requested_start_date: null,
    requested_days: null,
    requested_end_date: null,
    total_amount: null,
    id_file_id: null,
    license_file_id: null,
    license_back_file_id: null,
    blocked_ranges: [],
    updated_at: new Date().toISOString(),
  }
}

function formatTelegramName(person?: { first_name?: string; last_name?: string }) {
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ').trim()
  return name || null
}

function t(locale: Locale | null | undefined) {
  return locale === 'ru' ? 'ru' : 'en'
}

function bookingCode(bookingId?: string | null) {
  return bookingId ? `CC-${bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'CC-PENDING'
}

function stepRank(step?: SessionStep | string | null) {
  const order: SessionStep[] = [
    'choosing_language',
    'choosing_category',
    'choosing_body_type',
    'choosing_vehicle',
    'awaiting_start_date',
    'awaiting_end_date',
    'awaiting_confirmation',
    'awaiting_full_name',
    'awaiting_phone',
    'awaiting_id_image',
    'awaiting_license_image',
    'awaiting_license_back_image',
    'awaiting_terms_acceptance',
    'awaiting_payment_proof',
    'completed',
  ]

  const index = order.indexOf(step as SessionStep)
  return index === -1 ? 0 : index
}

async function restoreSession(chatId: string): Promise<BotSession | null> {
  const booking = await getLatestTelegramBookingForChat(chatId)
  if (!booking) return null

  const customer = Array.isArray(booking.telegram_customers)
    ? booking.telegram_customers[0] ?? null
    : booking.telegram_customers ?? null

  const selectedCategory = (booking.vehicle_category as VehicleCategory | null) ?? null
  const display = booking.vehicle_name ? getTelegramVehicleDisplay(booking.vehicle_name) : null

  let blockedRanges: VehicleBlockedRange[] = []
  if (selectedCategory && booking.vehicle_name) {
    const vehicles = await getVehiclesForCustomerCategory(selectedCategory)
    const normalizedBookingModel = getTelegramVehicleDisplay(booking.vehicle_name).model
    const matched = vehicles.find((vehicle) => vehicle.model === normalizedBookingModel || vehicle.model === booking.vehicle_name)
    blockedRanges = matched?.blockedRanges ?? []
  }

  const inferredStep: SessionStep = (() => {
    if (!booking.vehicle_category) return 'choosing_category'
    if (!booking.vehicle_name) return 'choosing_vehicle'
    if (!booking.start_date) return 'awaiting_start_date'
    if (!booking.end_date || !booking.total_days) return 'awaiting_end_date'
    if (!(customer?.full_name ?? null)) return 'awaiting_full_name'
    if (!(customer?.phone ?? null)) return 'awaiting_phone'
    if (!booking.id_file_id) return 'awaiting_id_image'
    if (!booking.license_file_id) return 'awaiting_license_image'
    if (!booking.license_back_file_id) return 'awaiting_license_back_image'
    if (booking.status === 'quote_ready') return 'awaiting_confirmation'
    if (booking.status === 'confirmed_booking') return 'awaiting_terms_acceptance'
    if (booking.status === 'awaiting_payment_confirmation') return 'awaiting_payment_proof'
    return 'completed'
  })()

  return {
    ...defaultSession(chatId),
    booking_id: booking.id,
    customer_id: booking.customer_id,
    step: inferredStep,
    locale: 'en',
    telegram_name: customer?.telegram_name ?? null,
    telegram_username: customer?.telegram_username ?? null,
    customer_full_name: customer?.full_name ?? null,
    customer_phone: customer?.phone ?? null,
    selected_segment: getTelegramSegment(booking.vehicle_name ?? '', selectedCategory),
    selected_category: selectedCategory,
    selected_vehicle_model: booking.vehicle_name ?? null,
    selected_vehicle_display_model: display?.model ?? booking.vehicle_name ?? null,
    requested_start_date: booking.start_date ?? null,
    requested_days: booking.total_days ?? null,
    requested_end_date: booking.end_date ?? null,
    daily_rate: booking.daily_rate ?? null,
    total_amount: booking.total_amount ?? null,
    id_file_id: booking.id_file_id ?? null,
    license_file_id: booking.license_file_id ?? null,
    license_back_file_id: booking.license_back_file_id ?? null,
    blocked_ranges: blockedRanges,
    updated_at: booking.updated_at,
  }
}

async function restorePersistedSession(chatId: string): Promise<BotSession | null> {
  const record = await getTelegramSession<BotSession>(chatId)
  const data = record?.session_data

  if (!data || data.chat_id !== chatId || !data.step) return null

  const restoredBooking = await restoreSession(chatId)

  if (restoredBooking && stepRank(restoredBooking.step) > stepRank(data.step)) {
    return restoredBooking
  }

  return {
    ...defaultSession(chatId),
    ...(restoredBooking ?? {}),
    ...data,
    chat_id: chatId,
    updated_at: record.updated_at ?? data.updated_at ?? new Date().toISOString(),
  }
}

async function getSession(chatId: string): Promise<BotSession> {
  const existing = memorySessions.get(chatId)
  if (existing) return existing

  const persisted = await restorePersistedSession(chatId)
  if (persisted) {
    memorySessions.set(chatId, persisted)
    return persisted
  }

  const restored = await restoreSession(chatId)
  if (restored) {
    memorySessions.set(chatId, restored)
    return restored
  }

  return defaultSession(chatId)
}

async function saveSession(chatId: string, patch: Partial<BotSession>): Promise<BotSession> {
  const next: BotSession = {
    ...(await getSession(chatId)),
    ...patch,
    chat_id: chatId,
    updated_at: new Date().toISOString(),
  }
  memorySessions.set(chatId, next)
  await upsertTelegramSession(next)
  return next
}

async function resetSession(chatId: string, person?: { first_name?: string; last_name?: string; username?: string }, locale?: Locale | null): Promise<BotSession> {
  return saveSession(chatId, {
    ...defaultSession(chatId),
    locale: locale ?? null,
    step: locale ? 'choosing_category' : 'choosing_language',
    telegram_name: formatTelegramName(person),
    telegram_username: person?.username ?? null,
    selected_segment: null,
  })
}

async function ensureCustomer(session: BotSession): Promise<BotSession | null> {
  const customer = await upsertTelegramCustomer({
    chatId: session.chat_id,
    telegramName: session.telegram_name,
    telegramUsername: session.telegram_username,
    fullName: session.customer_full_name,
    phone: session.customer_phone,
    idUrl: session.id_file_id ? buildTelegramProxyUrl(session.id_file_id) : null,
    licenseUrl: session.license_file_id ? buildTelegramProxyUrl(session.license_file_id) : null,
  })

  if (!customer?.id) return null
  const next = await saveSession(session.chat_id, { customer_id: customer.id })
  return next
}

async function persistBooking(session: BotSession, status?: string) {
  if (!session.booking_id) return
  await upsertTelegramBooking({
    bookingId: session.booking_id,
    chatId: session.chat_id,
    customerId: session.customer_id ?? null,
    vehicleName: session.selected_vehicle_model ?? null,
    vehicleCategory: session.selected_category ?? null,
    startDate: session.requested_start_date ?? null,
    totalDays: session.requested_days ?? null,
    endDate: session.requested_end_date ?? null,
    dailyRate: session.daily_rate ?? null,
    totalAmount: session.total_amount ?? null,
    idFileId: session.id_file_id ?? null,
    licenseFileId: session.license_file_id ?? null,
    licenseBackFileId: session.license_back_file_id ?? null,
    status: status ?? 'draft',
  })
}

async function telegramApi(method: string, payload: Record<string, unknown>) {
  if (!TELEGRAM_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Telegram API ${method} failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function sendMessage(chatId: string, text: string, buttons?: TelegramInlineButton[][]) {
  const session = await getSession(chatId)
  try {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
    })
  } catch (error) {
    console.error('sendMessage failed', { chatId, error })
    return
  }
  await logTelegramConversation({
    chatId,
    customerId: session.customer_id ?? null,
    direction: 'outbound',
    messageType: 'text',
    body: text,
    meta: buttons ? { buttons } : null,
  })
}

async function editMessage(chatId: string, messageId: number, text: string, buttons?: TelegramInlineButton[][]) {
  try {
    await telegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
    })
  } catch (error) {
    console.error('editMessage failed', { chatId, messageId, error })
  }
}

async function sendPhoto(chatId: string, photo: string, caption: string, buttons?: TelegramInlineButton[][]) {
  const session = await getSession(chatId)
  await telegramApi('sendPhoto', {
    chat_id: chatId,
    photo,
    caption,
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  })
  await logTelegramConversation({
    chatId,
    customerId: session.customer_id ?? null,
    direction: 'outbound',
    messageType: 'photo',
    body: caption,
    meta: { photo, buttons: buttons ?? null },
  })
}

async function sendDocument(chatId: string, document: string, caption: string, buttons?: TelegramInlineButton[][]) {
  const session = await getSession(chatId)
  await telegramApi('sendDocument', {
    chat_id: chatId,
    document,
    caption,
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  })
  await logTelegramConversation({
    chatId,
    customerId: session.customer_id ?? null,
    direction: 'outbound',
    messageType: 'document',
    body: caption,
    meta: { document, buttons: buttons ?? null },
  })
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return telegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  })
}

function formatCurrency(amount: number) {
  return `R ${amount.toLocaleString('en-ZA')}`
}

function getLanguageButtons(config: BotControllerConfig = {}) {
  return [[
    { text: copy(config, 'buttonText', 'languageEnglish', 'View vehicles'), callback_data: 'lang:en' },
    { text: copy(config, 'buttonText', 'languageRussian', 'Посмотреть автомобили'), callback_data: 'lang:ru' },
  ]]
}

function getTermsLanguageButtons(config: BotControllerConfig = {}) {
  return [[
    { text: copy(config, 'buttonText', 'termsEnglish', 'English'), callback_data: 'terms:en' },
    { text: copy(config, 'buttonText', 'termsRussian', 'Русский'), callback_data: 'terms:ru' },
  ]]
}

function getManagerButton(locale: Locale, config: BotControllerConfig = {}): TelegramInlineButton[] {
  return [{ text: copy(config, 'buttonText', locale === 'ru' ? 'managerRu' : 'managerEn', locale === 'ru' ? 'Связаться с менеджером' : 'Speak to manager'), callback_data: 'manager_request' }]
}

function getTermsButton(locale: Locale, config: BotControllerConfig = {}): TelegramInlineButton[] {
  return [{ text: copy(config, 'buttonText', locale === 'ru' ? 'termsRu' : 'termsEn', locale === 'ru' ? 'Условия аренды' : 'Terms and Conditions'), callback_data: 'terms_view' }]
}

function getTermsAcceptButtons(locale: Locale, config: BotControllerConfig = {}) {
  return [
    [{ text: copy(config, 'buttonText', locale === 'ru' ? 'acceptRu' : 'acceptEn', locale === 'ru' ? 'Принять' : 'Accept'), callback_data: `terms_accept:${locale}` }],
    ...customButtonRows(config, 'terms', locale),
  ]
}

function getPaymentButtons(locale: Locale, config: BotControllerConfig = {}) {
  return [
    [{ text: copy(config, 'buttonText', locale === 'ru' ? 'cashRu' : 'cashEn', locale === 'ru' ? 'Оплата наличными' : 'Cash payment option'), callback_data: `cash_payment:${locale}` }],
    getManagerButton(locale, config),
    ...customButtonRows(config, 'payment', locale),
  ]
}

function getCategoryButtons(locale: Locale, config: BotControllerConfig = {}) {
  return [
    ...SEGMENT_ORDER.map((segment) => [{ text: copy(config, 'buttonText', `${segment}${locale === 'ru' ? 'Ru' : 'En'}`, SEGMENT_LABELS[locale][segment]), callback_data: `category:${segment}` }]),
    getTermsButton(locale, config),
    getManagerButton(locale, config),
    ...customButtonRows(config, 'class', locale),
  ]
}

function getPublicSupabaseClient() {
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) return null

  return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function getPublicVehiclesForCategory(category: VehicleCategory): Promise<VehicleChoice[]> {
  try {
    const vehicles = await getVehiclesForCustomerCategory(category)

    return vehicles.map((vehicle) => {
      const display = getTelegramVehicleDisplay(vehicle.model)
      const bodyType = vehicle.telegram_body_type && vehicle.telegram_body_type in BODY_TYPE_LABELS.en
        ? vehicle.telegram_body_type as TelegramBodyType
        : getTelegramBodyType(vehicle.model)

      return {
        id: vehicle.id,
        model: display.model,
        bookingModel: vehicle.model,
        category: vehicle.cat as VehicleCategory,
        bodyType,
        rate: vehicle.rate,
        status: vehicle.status,
        imageUrl: vehicle.image_url || display.imageUrl || '',
        source: 'db' as const,
        blockedRanges: vehicle.blockedRanges,
        isBlocked: vehicle.isBlocked,
      }
    }).filter((vehicle) => ['Available', 'Booked'].includes(vehicle.status))
  } catch (error) {
    console.error('getPublicVehiclesForCategory exception', { category, error })
    return []
  }
}

async function getLiveVehiclesForSegment(segment: TelegramSegment): Promise<VehicleChoice[]> {
  const all = (await Promise.all(CATEGORY_ORDER.map((category) => getPublicVehiclesForCategory(category)))).flat()

  return all.filter((vehicle) => getTelegramSegment(vehicle.bookingModel, vehicle.category) === segment)
}

async function getPublicVehicleById(vehicleId: string): Promise<VehicleChoice | null> {
  const all = (await Promise.all(CATEGORY_ORDER.map((category) => getPublicVehiclesForCategory(category)))).flat()
  return all.find((vehicle) => vehicle.id === vehicleId) ?? null
}

async function resolveVehicleChoice(vehicleId: string, source: 'db' | 'static', categoryHint?: VehicleCategory | null): Promise<VehicleChoice | null> {
  if (source === 'db') {
    if (categoryHint) {
      const vehicles = await getPublicVehiclesForCategory(categoryHint)
      const matched = vehicles.find((vehicle) => vehicle.id === vehicleId)
      if (matched) {
        return matched
      }
    }

    const publicMatch = await getPublicVehicleById(vehicleId)
    if (publicMatch) {
      return publicMatch
    }

    const vehicle = await getVehicleById(vehicleId)
    if (!vehicle) return null
    const display = getTelegramVehicleDisplay(vehicle.model)
    return {
      id: vehicle.id,
      model: display.model,
      bookingModel: vehicle.model,
      category: vehicle.cat as VehicleCategory,
      bodyType: (vehicle.telegram_body_type as TelegramBodyType | null) ?? getTelegramBodyType(vehicle.model),
      rate: vehicle.rate,
      status: vehicle.status,
      imageUrl: vehicle.image_url || display.imageUrl || '',
      source: 'db',
      blockedRanges: [],
      isBlocked: vehicle.status === 'Booked',
    }
  }

  const vehicle = TELEGRAM_CATALOG.find((item) => item.id === vehicleId)
  if (!vehicle) return null
  return {
    id: vehicle.id,
    model: vehicle.model,
    bookingModel: vehicle.model,
    category: vehicle.category,
    bodyType: getTelegramBodyType(vehicle.model),
    rate: vehicle.rate,
    status: vehicle.status,
    imageUrl: vehicle.imageUrl,
    source: 'static',
    blockedRanges: [],
    isBlocked: vehicle.status === 'Booked',
  }
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && endA >= startB
}

function formatVehicleCaption(vehicle: VehicleChoice, locale: Locale) {
  const segment = getTelegramSegment(vehicle.bookingModel, vehicle.category)
  return [
    `🚘 ${vehicle.model}`,
    `${SEGMENT_LABELS[locale][segment]} • ${BODY_TYPE_LABELS[locale][vehicle.bodyType]}`,
    locale === 'ru' ? `Ставка в день: ${formatCurrency(vehicle.rate)}` : `Daily rate: ${formatCurrency(vehicle.rate)}`,
  ].join('\n')
}

function toIsoDate(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function buildCalendarKeyboard(
  year: number,
  month: number,
  blockedRanges: VehicleBlockedRange[],
  mode: 'start' | 'end',
  locale: Locale,
  startDate?: string | null,
): TelegramInlineButton[][] {
  const today = toIsoDate(new Date())
  const monthStr = pad2(month + 1)
  const currentYM = today.slice(0, 7)
  const thisYM = `${year}-${monthStr}`

  const prevD = new Date(year, month - 1, 1)
  const nextD = new Date(year, month + 1, 1)
  const prevYM = `${prevD.getFullYear()}-${pad2(prevD.getMonth() + 1)}`
  const nextYM = `${nextD.getFullYear()}-${pad2(nextD.getMonth() + 1)}`
  const canPrev = prevYM >= currentYM

  const header: TelegramInlineButton[] = [
    { text: canPrev ? '‹' : ' ', callback_data: canPrev ? `cal:nav:${mode}:${prevYM}` : 'cal:noop' },
    { text: `${MONTH_NAMES[locale][month]} ${year}`, callback_data: 'cal:noop' },
    { text: '›', callback_data: `cal:nav:${mode}:${nextYM}` },
  ]

  const dayRow: TelegramInlineButton[] = DAY_NAMES[locale].map((d) => ({ text: d, callback_data: 'cal:noop' }))

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7

  const cells: Array<number | null> = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const rows: TelegramInlineButton[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    const row: TelegramInlineButton[] = []
    for (let j = 0; j < 7; j++) {
      const day = cells[i + j] ?? null
      if (day === null) {
        row.push({ text: ' ', callback_data: 'cal:noop' })
        continue
      }

      const dateStr = `${year}-${monthStr}-${pad2(day)}`
      const isPast = thisYM < currentYM || dateStr < today
      const isBlocked = blockedRanges.some((r) => dateStr >= r.startDate && dateStr <= r.endDate)
      const isBeforeOrOnStart = mode === 'end' && startDate != null && dateStr <= startDate
      const wouldOverlap = mode === 'end' && startDate != null
        && blockedRanges.some((r) => datesOverlap(startDate, dateStr, r.startDate, r.endDate))

      const disabled = isPast || isBlocked || isBeforeOrOnStart || wouldOverlap

      row.push({
        text: isBlocked ? '•' : disabled ? '·' : String(day),
        callback_data: disabled ? 'cal:noop' : `cal:select:${dateStr}`,
      })
    }
    while (row.length < 7) row.push({ text: ' ', callback_data: 'cal:noop' })
    rows.push(row)
  }

  return [header, dayRow, ...rows]
}

async function sendWelcome(chatId: string) {
  const config = await getBotControllerConfig()
  await sendMessage(
    chatId,
    `${copy(config, 'customerText', 'welcomeEn', TEXT.welcome.en)}\n\n\n${copy(config, 'customerText', 'welcomeRu', TEXT.welcome.ru)}`,
    getLanguageButtons(config),
  )
}

function getBodyTypeButtons(locale: Locale, segment: TelegramSegment, vehicles: VehicleChoice[], config: BotControllerConfig = {}) {
  const bodyOrder: TelegramBodyType[] = ['SUV', 'Sedan', 'Convertible', 'Coupe', 'Hatchback', 'People Mover', 'Van', 'Minibus']
  const available = bodyOrder.filter((bodyType) => vehicles.some((vehicle) => vehicle.bodyType === bodyType))
  return [
    ...available.map((bodyType) => [{ text: BODY_TYPE_LABELS[locale][bodyType], callback_data: `bodytype:${segment}:${encodeURIComponent(bodyType)}` }]),
    getManagerButton(locale, config),
    ...customButtonRows(config, 'size', locale),
  ]
}

async function sendCategoryPrompt(chatId: string, locale: Locale) {
  const config = await getBotControllerConfig()
  await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'chooseCategoryRu' : 'chooseCategoryEn', TEXT.chooseCategory[locale]), getCategoryButtons(locale, config))
}

async function sendBodyTypePrompt(chatId: string, segment: TelegramSegment, locale: Locale) {
  const config = await getBotControllerConfig()
  const liveVehicles = await getLiveVehiclesForSegment(segment)
  if (liveVehicles.length === 0) {
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'noVehiclesRu' : 'noVehiclesEn', TEXT.noVehicles[locale]), getCategoryButtons(locale, config))
    return
  }

  await sendMessage(
    chatId,
    `${TEXT.categoryIntro[locale](segment)}\n\n${copy(config, 'customerText', locale === 'ru' ? 'chooseBodyTypeRu' : 'chooseBodyTypeEn', TEXT.chooseBodyType[locale])}`,
    getBodyTypeButtons(locale, segment, liveVehicles, config),
  )
}

async function sendCategoryCatalog(chatId: string, segment: TelegramSegment, bodyType: TelegramBodyType, locale: Locale) {
  const config = await getBotControllerConfig()
  const liveVehicles = await getLiveVehiclesForSegment(segment)
  if (liveVehicles.length === 0) {
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'noVehiclesRu' : 'noVehiclesEn', TEXT.noVehicles[locale]), getCategoryButtons(locale, config))
    return
  }

  const grouped = new Map<TelegramBodyType, VehicleChoice[]>()

  for (const vehicle of liveVehicles) {
    const currentBodyType = vehicle.bodyType
    grouped.set(currentBodyType, [...(grouped.get(currentBodyType) ?? []), vehicle])
  }

  const group = grouped.get(bodyType)
  if (!group || group.length === 0) {
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'noVehiclesRu' : 'noVehiclesEn', TEXT.noVehicles[locale]), getBodyTypeButtons(locale, segment, liveVehicles, config))
    return
  }

  await sendMessage(chatId, `• ${BODY_TYPE_LABELS[locale][bodyType]}`)

  for (const vehicle of group) {
    try {
      if (vehicle.imageUrl) {
        await sendPhoto(
          chatId,
          vehicle.imageUrl,
          formatVehicleCaption(vehicle, locale),
          [[{ text: TEXT.bookingVehicle[locale](vehicle.model), callback_data: `${vehicle.source === 'db' ? 'bookdb' : 'book'}:${vehicle.id}` }]],
        )
      } else {
        await sendMessage(
          chatId,
          formatVehicleCaption(vehicle, locale),
          [[{ text: TEXT.bookingVehicle[locale](vehicle.model), callback_data: `${vehicle.source === 'db' ? 'bookdb' : 'book'}:${vehicle.id}` }]],
        )
      }
    } catch (error) {
      console.error('sendPhoto failed for vehicle', vehicle.id, error)
      await sendMessage(
        chatId,
        formatVehicleCaption(vehicle, locale),
        [[{ text: TEXT.bookingVehicle[locale](vehicle.model), callback_data: `${vehicle.source === 'db' ? 'bookdb' : 'book'}:${vehicle.id}` }]],
      )
    }
  }
}

function extractFileId(message?: TelegramMessage): string | null {
  if (!message) return null
  if (message.photo && message.photo.length > 0) return message.photo[message.photo.length - 1].file_id
  if (message.document?.mime_type?.startsWith('image/')) return message.document.file_id
  return null
}

async function logInboundText(chatId: string, body: string, type: 'text' | 'button' = 'text') {
  const session = await getSession(chatId)
  await logTelegramConversation({
    chatId,
    customerId: session.customer_id ?? null,
    direction: 'inbound',
    messageType: type,
    body,
  })
}

async function handleCategorySelect(callback: CallbackQuery, category: TelegramSegment) {
  const chatId = String(callback.message?.chat.id ?? '')
  if (!chatId) return

  const session = await getSession(chatId)
  const locale = t(session.locale)
  await logInboundText(chatId, `Selected segment: ${category}`, 'button')

  await saveSession(chatId, {
    step: 'choosing_body_type',
    selected_segment: category,
    selected_category: null,
    selected_body_type: null,
    selected_vehicle_id: null,
    selected_vehicle_model: null,
    selected_vehicle_display_model: null,
    daily_rate: null,
    requested_start_date: null,
    requested_days: null,
    requested_end_date: null,
    total_amount: null,
    id_file_id: null,
    license_file_id: null,
    license_back_file_id: null,
    blocked_ranges: [],
  })

  await answerCallbackQuery(callback.id, SEGMENT_LABELS[locale][category])
  await sendBodyTypePrompt(chatId, category, locale)
}

async function handleVehicleSelect(callback: CallbackQuery, vehicleId: string, source: 'db' | 'static') {
  const chatId = String(callback.message?.chat.id ?? '')
  if (!chatId) return

  const session = await getSession(chatId)
  const locale = t(session.locale)
  const vehicle = await resolveVehicleChoice(vehicleId, source, session.selected_category)
  if (!vehicle) {
    await answerCallbackQuery(callback.id, TEXT.vehicleNotFound[locale])
    await sendWelcome(chatId)
    return
  }

  await logInboundText(chatId, `Book ${vehicle.model}`, 'button')

  const bookingId = randomUUID()
  let next = await saveSession(chatId, {
    booking_id: bookingId,
    step: 'awaiting_start_date',
    telegram_name: formatTelegramName(callback.from),
    telegram_username: callback.from?.username ?? null,
    selected_segment: getTelegramSegment(vehicle.bookingModel, vehicle.category),
    selected_category: vehicle.category,
    selected_vehicle_id: vehicle.id,
    selected_vehicle_model: vehicle.bookingModel,
    selected_vehicle_display_model: vehicle.model,
    daily_rate: vehicle.rate,
    requested_start_date: null,
    requested_days: null,
    requested_end_date: null,
    total_amount: null,
    customer_full_name: null,
    customer_phone: null,
    id_file_id: null,
    license_file_id: null,
    license_back_file_id: null,
    blocked_ranges: vehicle.blockedRanges,
  })

  next = (await ensureCustomer(next)) ?? next
  await persistBooking(next, 'draft')

  await answerCallbackQuery(callback.id, TEXT.bookingVehicle[locale](vehicle.model))

  const now = new Date()
  const keyboard = buildCalendarKeyboard(now.getFullYear(), now.getMonth(), vehicle.blockedRanges, 'start', locale)
  await sendMessage(chatId, TEXT.calendarStart[locale](vehicle.model), keyboard)
}

async function handleCallback(callback: CallbackQuery) {
  const data = callback.data ?? ''
  const chatId = String(callback.message?.chat.id ?? '')
  if (!chatId) return

  let session = await getSession(chatId)
  let locale: Locale = t(session.locale)

  if (data.startsWith('lang:')) {
    locale = data.replace('lang:', '') as Locale
    session = await resetSession(chatId, callback.from, locale)
    session = (await ensureCustomer(session)) ?? session
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Русский' : 'English')
    await sendCategoryPrompt(chatId, locale)
    return
  }

  if (data.startsWith('terms:')) {
    locale = data.replace('terms:', '') as Locale
    const config = await getBotControllerConfig()
    session = await saveSession(chatId, { locale, step: 'awaiting_terms_acceptance' })
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Условия аренды' : 'Rental terms')
    await sendDocument(
      chatId,
      `${publicBaseUrl()}/telegram-terms/cape-cars-rental-terms-${locale}.pdf`,
      copy(config, 'customerText', locale === 'ru' ? 'termsDocumentCaptionRu' : 'termsDocumentCaptionEn', TEXT.termsDocumentCaption[locale]),
      getTermsAcceptButtons(locale, config),
    )
    return
  }

  if (data === 'terms_view') {
    const config = await getBotControllerConfig()
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Условия аренды' : 'Terms and Conditions')
    await sendDocument(
      chatId,
      `${publicBaseUrl()}/telegram-terms/cape-cars-rental-terms-${locale}.pdf`,
      copy(config, 'customerText', locale === 'ru' ? 'termsDocumentViewCaptionRu' : 'termsDocumentViewCaptionEn', TEXT.termsDocumentViewCaption[locale]),
      getCategoryButtons(locale, config),
    )
    return
  }

  if (data.startsWith('terms_accept:')) {
    locale = data.replace('terms_accept:', '') as Locale
    const config = await getBotControllerConfig()
    const next = await saveSession(chatId, { locale, step: 'awaiting_payment_proof' })
    await persistBooking(next, 'awaiting_payment_confirmation')
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Принято' : 'Accepted')
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'paymentDetailsRu' : 'paymentDetailsEn', TEXT.paymentDetails[locale](next.total_amount)), getPaymentButtons(locale, config))
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'paymentProofRu' : 'paymentProofEn', TEXT.paymentProof[locale]))
    return
  }

  if (data.startsWith('cash_payment:')) {
    locale = data.replace('cash_payment:', '') as Locale
    const config = await getBotControllerConfig()
    const next = await saveSession(chatId, { locale, step: 'completed' })
    await persistBooking(next, 'confirmed_booking')
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Оплата наличными' : 'Cash payment option')
    try {
      await notifyAdminCashPayment({
        bookingId: next.booking_id ?? '',
        chatId,
      })
    } catch (error) {
      console.error('notifyAdminCashPayment failed', error)
    }
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'cashPaymentRu' : 'cashPaymentEn', TEXT.cashPayment[locale]))
    return
  }

  if (data === 'manager_request') {
    const config = await getBotControllerConfig()
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Менеджер уведомлён' : 'Manager notified')
    await notifyAdminManagerRequest({
      chatId,
      locale,
      telegramName: session.telegram_name ?? formatTelegramName(callback.from),
      username: callback.from?.username ?? session.telegram_username ?? null,
      customerName: session.customer_full_name ?? null,
      phone: session.customer_phone ?? null,
    })
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'managerRequestedRu' : 'managerRequestedEn', TEXT.managerRequested[locale]), getCategoryButtons(locale, config))
    return
  }

  if (data.startsWith('category:')) {
    await handleCategorySelect(callback, data.replace('category:', '') as TelegramSegment)
    return
  }

  if (data.startsWith('bodytype:')) {
    const [segment, rawBodyType] = data.replace('bodytype:', '').split(':')
    if (!segment || !rawBodyType) {
      await answerCallbackQuery(callback.id, locale === 'ru' ? 'Категория недоступна' : 'Category unavailable')
      await sendCategoryPrompt(chatId, locale)
      return
    }
    const bodyType = decodeURIComponent(rawBodyType) as TelegramBodyType
    await logInboundText(chatId, `Selected body type: ${bodyType}`, 'button')
    await saveSession(chatId, { step: 'choosing_vehicle', selected_segment: segment as TelegramSegment, selected_body_type: bodyType })
    await answerCallbackQuery(callback.id, BODY_TYPE_LABELS[locale][bodyType])
    await sendCategoryCatalog(chatId, segment as TelegramSegment, bodyType, locale)
    return
  }

  if (data.startsWith('bookdb:')) {
    await handleVehicleSelect(callback, data.replace('bookdb:', ''), 'db')
    return
  }

  if (data.startsWith('book:')) {
    await handleVehicleSelect(callback, data.replace('book:', ''), 'static')
    return
  }

  if (data === 'cal:noop') {
    await answerCallbackQuery(callback.id)
    return
  }

  if (data.startsWith('cal:select:')) {
    const selectedDate = data.slice('cal:select:'.length)
    const session = await getSession(chatId)
    const locale = t(session.locale)

    await answerCallbackQuery(callback.id)
    await logInboundText(chatId, `Selected date: ${selectedDate}`, 'button')

    if (session.step === 'awaiting_start_date') {
      const next = await saveSession(chatId, {
        step: 'awaiting_end_date',
        requested_start_date: selectedDate,
        requested_days: null,
        requested_end_date: null,
        total_amount: null,
      })
      await persistBooking(next, 'draft')

      const [yr, mo] = selectedDate.split('-').map(Number)
      const keyboard = buildCalendarKeyboard(yr, mo - 1, next.blocked_ranges ?? [], 'end', locale, selectedDate)
      await sendMessage(chatId, TEXT.calendarEnd[locale](selectedDate), keyboard)
      return
    }

    if (session.step === 'awaiting_end_date') {
      const startDate = session.requested_start_date!
      const msPerDay = 1000 * 60 * 60 * 24
      const days = Math.round((new Date(selectedDate).getTime() - new Date(startDate).getTime()) / msPerDay)
      const totalAmount = (session.daily_rate ?? 0) * days

      const next = await saveSession(chatId, {
        step: 'awaiting_confirmation',
        requested_end_date: selectedDate,
        requested_days: days,
        total_amount: totalAmount,
      })
      await persistBooking(next, 'quote_ready')

      await sendMessage(
        chatId,
        TEXT.confirmSummary[locale](
          session.selected_vehicle_display_model || session.selected_vehicle_model || 'Vehicle',
          session.daily_rate ?? 0,
          days,
          totalAmount,
          startDate,
          selectedDate,
        ),
        [
          [{ text: locale === 'ru' ? 'Подтвердить' : 'Confirm', callback_data: 'confirm_booking' }],
          [{ text: locale === 'ru' ? 'Изменить даты' : 'Change dates', callback_data: 'change_booking' }],
          [{ text: locale === 'ru' ? 'Другие автомобили' : 'View other vehicles', callback_data: 'view_other_vehicles' }],
        ],
      )
      return
    }

    return
  }

  if (data.startsWith('cal:nav:')) {
    const parts = data.split(':')
    const mode = parts[2] as 'start' | 'end'
    const [navYear, navMonth] = parts[3].split('-').map(Number)
    const messageId = callback.message?.message_id

    const session = await getSession(chatId)
    const locale = t(session.locale)

    await answerCallbackQuery(callback.id)

    const keyboard = buildCalendarKeyboard(
      navYear,
      navMonth - 1,
      session.blocked_ranges ?? [],
      mode,
      locale,
      mode === 'end' ? session.requested_start_date : null,
    )

    const text = mode === 'start'
      ? TEXT.calendarStart[locale](session.selected_vehicle_display_model ?? session.selected_vehicle_model ?? '')
      : TEXT.calendarEnd[locale](session.requested_start_date ?? '')

    if (messageId) {
      await editMessage(chatId, messageId, text, keyboard)
    } else {
      await sendMessage(chatId, text, keyboard)
    }
    return
  }

  session = await getSession(chatId)
  locale = t(session.locale)

  if (data === 'confirm_booking') {
    const config = await getBotControllerConfig()
    await logInboundText(chatId, 'Confirmed booking', 'button')
    const next = await saveSession(chatId, { step: 'awaiting_full_name' })
    await persistBooking(next, 'customer_details_pending')
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Подтверждено' : 'Confirmed')
    await sendMessage(chatId, copy(config, 'customerText', locale === 'ru' ? 'fullNameRu' : 'fullNameEn', TEXT.fullName[locale]))
    return
  }

  if (data === 'change_booking') {
    await logInboundText(chatId, 'Make changes', 'button')
    const next = await saveSession(chatId, {
      step: 'awaiting_start_date',
      requested_start_date: null,
      requested_days: null,
      requested_end_date: null,
      total_amount: null,
    })
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Изменить' : 'Make changes')
    const now = new Date()
    const keyboard = buildCalendarKeyboard(now.getFullYear(), now.getMonth(), next.blocked_ranges ?? [], 'start', locale)
    await sendMessage(chatId, TEXT.calendarStart[locale](next.selected_vehicle_display_model ?? next.selected_vehicle_model ?? ''), keyboard)
    return
  }

  if (data === 'view_other_vehicles') {
    await logInboundText(chatId, 'View other vehicles', 'button')
    await saveSession(chatId, {
      step: 'choosing_category',
      booking_id: null,
      requested_start_date: null,
      requested_days: null,
      requested_end_date: null,
      total_amount: null,
      selected_vehicle_id: null,
      selected_vehicle_model: null,
      selected_vehicle_display_model: null,
      selected_segment: null,
      selected_category: null,
      selected_body_type: null,
      daily_rate: null,
      customer_full_name: null,
      customer_phone: null,
      id_file_id: null,
      license_file_id: null,
      license_back_file_id: null,
      blocked_ranges: [],
    })
    await answerCallbackQuery(callback.id, locale === 'ru' ? 'Другие автомобили' : 'Other vehicles')
    await sendCategoryPrompt(chatId, locale)
  }
}

async function handleMessage(message: TelegramMessage) {
  const chatId = String(message.chat.id)
  const text = message.text?.trim() ?? ''
  let session = await getSession(chatId)

  if (text) await logInboundText(chatId, text, 'text')

  if (text === '/start' || text.toLowerCase() === 'start') {
    session = await resetSession(chatId, message.from)
    session = (await ensureCustomer(session)) ?? session
    await sendWelcome(chatId)
    return
  }

  if (session.step === 'completed') {
    await sendMessage(chatId, TEXT.alreadyCompleted[t(session.locale)](bookingCode(session.booking_id)))
    return
  }

  let locale: Locale = t(session.locale)

  if (session.step === 'choosing_language' || !session.locale) {
    const restored = await restoreSession(chatId)
    if (restored && restored.step !== 'choosing_language') {
      memorySessions.set(chatId, restored)
      session = restored
      locale = t(session.locale)
    } else {
      await sendWelcome(chatId)
      return
    }
  }

  if (session.step === 'choosing_category') {
    await sendCategoryPrompt(chatId, locale)
    return
  }

  if (session.step === 'choosing_body_type') {
    if (session.selected_segment) {
      await sendBodyTypePrompt(chatId, session.selected_segment, locale)
    } else {
      await sendCategoryPrompt(chatId, locale)
    }
    return
  }

  if (session.step === 'choosing_vehicle') {
    await sendMessage(chatId, TEXT.chooseVehicle[locale])
    return
  }

  if (session.step === 'awaiting_start_date') {
    const now = new Date()
    const keyboard = buildCalendarKeyboard(now.getFullYear(), now.getMonth(), session.blocked_ranges ?? [], 'start', locale)
    await sendMessage(chatId, TEXT.calendarStart[locale](session.selected_vehicle_display_model ?? session.selected_vehicle_model ?? ''), keyboard)
    return
  }

  if (session.step === 'awaiting_end_date') {
    const startDate = session.requested_start_date!
    const [yr, mo] = startDate.split('-').map(Number)
    const keyboard = buildCalendarKeyboard(yr, mo - 1, session.blocked_ranges ?? [], 'end', locale, startDate)
    await sendMessage(chatId, TEXT.calendarEnd[locale](startDate), keyboard)
    return
  }

  if (session.step === 'awaiting_confirmation' && text && text.length >= 3 && text.includes(' ')) {
    session = await saveSession(chatId, {
      step: 'awaiting_phone',
      customer_full_name: text,
    })
    session = (await ensureCustomer(session)) ?? session
    await persistBooking(session, 'customer_details_pending')
    await sendMessage(chatId, TEXT.phone[locale])
    return
  }

  if (session.step === 'awaiting_full_name') {
    if (!text || text.length < 3 || !text.includes(' ')) {
      await sendMessage(chatId, TEXT.fullName[locale])
      return
    }

    session = await saveSession(chatId, {
      step: 'awaiting_phone',
      customer_full_name: text,
    })
    session = (await ensureCustomer(session)) ?? session
    await persistBooking(session, 'customer_details_pending')
    await sendMessage(chatId, TEXT.phone[locale])
    return
  }

  if (session.step === 'awaiting_phone') {
    if (!text || text.replace(/\D/g, '').length < 7) {
      await sendMessage(chatId, TEXT.phone[locale])
      return
    }

    session = await saveSession(chatId, {
      step: 'awaiting_id_image',
      customer_phone: text,
    })
    session = (await ensureCustomer(session)) ?? session
    await persistBooking(session, 'documents_pending')
    await sendMessage(chatId, TEXT.idPassport[locale])
    return
  }

  if (session.step === 'awaiting_id_image') {
    const fileId = extractFileId(message)
    if (!fileId) {
      await sendMessage(chatId, TEXT.idPassport[locale])
      return
    }

    await logTelegramConversation({
      chatId,
      customerId: session.customer_id ?? null,
      direction: 'inbound',
      messageType: 'photo',
      body: 'Customer ID or passport image uploaded',
      meta: { fileId },
    })

    session = await saveSession(chatId, { step: 'awaiting_license_image', id_file_id: fileId })
    await persistBooking(session, 'documents_pending')
    await sendMessage(chatId, TEXT.license[locale])
    return
  }

  if (session.step === 'awaiting_license_image') {
    const fileId = extractFileId(message)
    if (!fileId) {
      await sendMessage(chatId, TEXT.license[locale])
      return
    }

    await logTelegramConversation({
      chatId,
      customerId: session.customer_id ?? null,
      direction: 'inbound',
      messageType: 'photo',
      body: 'Driver license front image uploaded',
      meta: { fileId },
    })

    session = await saveSession(chatId, { step: 'awaiting_license_back_image', license_file_id: fileId })
    session = (await ensureCustomer(session)) ?? session
    await persistBooking(session, 'documents_pending')
    await sendMessage(chatId, TEXT.licenseBack[locale])
    return
  }

  if (session.step === 'awaiting_license_back_image') {
    const fileId = extractFileId(message)
    if (!fileId) {
      await sendMessage(chatId, TEXT.licenseBack[locale])
      return
    }

    await logTelegramConversation({
      chatId,
      customerId: session.customer_id ?? null,
      direction: 'inbound',
      messageType: 'photo',
      body: 'Driver license back image uploaded',
      meta: { fileId },
    })

    session = await saveSession(chatId, { step: 'completed', license_back_file_id: fileId })
    session = (await ensureCustomer(session)) ?? session
    await persistBooking(session, 'pending')

    try {
      await notifyAdminNewBooking({
        bookingId: session.booking_id ?? '',
        chatId,
        customerName: session.customer_full_name ?? session.telegram_name ?? null,
        phone: session.customer_phone ?? null,
        username: session.telegram_username ?? null,
        vehicleName: session.selected_vehicle_model ?? null,
        vehicleCategory: session.selected_category ?? null,
        startDate: session.requested_start_date ?? null,
        endDate: session.requested_end_date ?? null,
        totalDays: session.requested_days ?? null,
        totalAmount: session.total_amount ?? null,
        idFileId: session.id_file_id ?? null,
        licenseFileId: session.license_file_id ?? null,
        licenseBackFileId: fileId ?? null,
      })
    } catch (error) {
      console.error('notifyAdminNewBooking failed', error)
    }

    await sendMessage(chatId, TEXT.done[locale](bookingCode(session.booking_id)))
    return
  }

  if (session.step === 'awaiting_terms_acceptance') {
    const config = await getBotControllerConfig()
    await sendMessage(
      chatId,
      copy(config, 'customerText', locale === 'ru' ? 'termsAcceptanceReminderRu' : 'termsAcceptanceReminderEn', TEXT.termsAcceptanceReminder[locale]),
      getTermsAcceptButtons(locale, config),
    )
    return
  }

  if (session.step === 'awaiting_payment_proof') {
    const fileId = extractFileId(message)
    if (!fileId) {
      await sendMessage(chatId, TEXT.paymentProof[locale])
      return
    }

    await logTelegramConversation({
      chatId,
      customerId: session.customer_id ?? null,
      direction: 'inbound',
      messageType: 'photo',
      body: 'Payment proof uploaded',
      meta: { fileId, kind: 'payment_proof' },
    })

    const next = await saveSession(chatId, { step: 'completed' })
    await persistBooking(next, 'awaiting_payment_confirmation')
    try {
      await notifyAdminPaymentProof({
        bookingId: next.booking_id ?? '',
        chatId,
        paymentProofFileId: fileId,
      })
    } catch (error) {
      console.error('notifyAdminPaymentProof failed', error)
    }
    await sendMessage(chatId, TEXT.paymentProofReceived[locale])
    return
  }

  await sendMessage(
    chatId,
    locale === 'ru'
      ? 'Я сохранил ваше бронирование. Пожалуйста, используйте кнопки выше или отправьте /start, чтобы начать заново.'
      : 'I still have your booking saved. Please use the buttons above, or send /start if you want to begin again.',
  )
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  const config = await getBotControllerConfig()

  if (config.botEnabled === false) {
    if (update.callback_query) {
      await answerCallbackQuery(update.callback_query.id, 'Bot is currently off')
    }
    return
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query)
    return
  }

  if (update.message) {
    await handleMessage(update.message)
  }
}
