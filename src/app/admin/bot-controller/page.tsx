'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Vehicle, VehicleBodyType } from '@/lib/fleet'
import { VEHICLE_BODY_TYPES, VEHICLE_CATEGORIES } from '@/lib/vehicle-taxonomy'

type Settings = {
  botEnabled: boolean
  customerText: Record<string, string>
  adminText: Record<string, string>
  buttonText: Record<string, string>
  customButtons: Record<string, CustomButton[]>
}

type Locale = 'en' | 'ru'
type CustomButton = {
  id: string
  labelEn: string
  labelRu: string
  action: 'manager' | 'url'
  url?: string | null
}
type LocaleCopy = Record<Locale, string>
type FieldScope = 'customerText' | 'adminText' | 'buttonText'
type Field = { scope: FieldScope; key: string; label: string; fallback: string; kind?: 'text' | 'textarea' }
type BuilderNode = {
  id: string
  title: LocaleCopy
  eyebrow: LocaleCopy
  type: 'trigger' | 'question' | 'message' | 'action' | 'handoff'
  x: number
  y: number
  fields: Field[]
  buttons: string[]
}

const emptySettings: Settings = { botEnabled: true, customerText: {}, adminText: {}, buttonText: {}, customButtons: {} }
const CATEGORIES = VEHICLE_CATEGORIES
const BODY_TYPES: VehicleBodyType[] = [...VEHICLE_BODY_TYPES]
const STATUS_OPTIONS = ['Available', 'Booked', 'Service'] as const
const CUSTOM_BUTTON_NODES = ['start', 'class', 'size', 'terms', 'payment'] as const
const BODY_TYPE_LABELS: Record<Locale, Partial<Record<VehicleBodyType, string>>> = {
  en: { SUV: 'SUVs', Sedan: 'Sedans', Convertible: 'Convertibles', Coupe: 'Coupes', Van: 'Vans & Minibuses' },
  ru: { SUV: 'Внедорожники', Sedan: 'Седаны', Convertible: 'Кабриолеты', Coupe: 'Купе', Van: 'Фургоны и микроавтобусы' },
}
const TYPE_LABELS: Record<Locale, Record<BuilderNode['type'], string>> = {
  en: { trigger: 'trigger', question: 'question', message: 'message', action: 'action', handoff: 'handoff' },
  ru: { trigger: 'старт', question: 'вопрос', message: 'сообщение', action: 'действие', handoff: 'менеджер' },
}
const SYSTEM_BUTTON_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    'Book vehicle': 'Book vehicle',
    'Start date': 'Start date',
    'Return date': 'Return date',
    Name: 'Name',
    Phone: 'Phone',
    ID: 'ID',
    License: 'License',
  },
  ru: {
    'Book vehicle': 'Забронировать',
    'Start date': 'Дата начала',
    'Return date': 'Дата возврата',
    Name: 'Имя',
    Phone: 'Телефон',
    ID: 'Паспорт',
    License: 'Права',
  },
}
const UI_TEXT = {
  flow: { en: 'Flow', ru: 'Схема' },
  vehicles: { en: 'Vehicles', ru: 'Авто' },
  nodes: { en: 'Steps', ru: 'Шаги' },
  nodeHelp: {
    en: 'Select a step to edit the Telegram text and buttons.',
    ru: 'Выберите шаг, чтобы редактировать текст и кнопки Telegram.',
  },
  inspector: { en: 'Editor', ru: 'Редактор' },
  standardButtons: { en: 'Standard buttons', ru: 'Кнопки' },
  addButton: { en: 'Add button', ru: 'Добавить' },
  addButtonHelp: {
    en: 'Add extra buttons under this Telegram step.',
    ru: 'Добавьте дополнительные кнопки для этого шага.',
  },
  noButtons: { en: 'No extra buttons on this step.', ru: 'Дополнительных кнопок нет.' },
  buttonText: { en: 'Button text', ru: 'Текст кнопки' },
  managerAction: { en: 'Manager', ru: 'Менеджер' },
  linkAction: { en: 'Link', ru: 'Ссылка' },
  systemStep: {
    en: 'This step is generated from live vehicle, booking, or calendar data.',
    ru: 'Этот шаг создаётся из данных авто, бронирований или календаря.',
  },
  vehicleRouting: { en: 'Vehicle routing', ru: 'Маршрутизация авто' },
  vehicleHelp: {
    en: 'Category controls the first Telegram menu. Vehicle size controls the second menu. Status controls if the vehicle appears.',
    ru: 'Категория управляет первым меню Telegram. Размер авто управляет вторым меню. Статус управляет показом авто.',
  },
  custom: { en: 'custom', ru: 'доп.' },
  botOn: { en: 'Bot on', ru: 'Бот включён' },
  botOff: { en: 'Bot off', ru: 'Бот выключен' },
  botToggle: { en: 'Toggle Telegram bot', ru: 'Включить/выключить Telegram-бот' },
}

const fields: Record<string, Field> = {
  welcomeEn: { scope: 'customerText', key: 'welcomeEn', label: 'Welcome message, English', fallback: '⛰️ Welcome to Cape Cars Rentals. View our available vehicles below.', kind: 'textarea' },
  welcomeRu: { scope: 'customerText', key: 'welcomeRu', label: 'Welcome message, Russian', fallback: '⛰️ Добро пожаловать в Cape Cars Rentals. Посмотрите доступные автомобили ниже.', kind: 'textarea' },
  languageEnglish: { scope: 'buttonText', key: 'languageEnglish', label: 'English start button', fallback: 'View vehicles' },
  languageRussian: { scope: 'buttonText', key: 'languageRussian', label: 'Russian start button', fallback: 'Посмотреть автомобили' },
  reviews: { scope: 'buttonText', key: 'reviews', label: 'Reviews button', fallback: '⭐ Reviews / Отзывы' },
  termsEn: { scope: 'buttonText', key: 'termsEn', label: 'Terms button', fallback: 'Terms and Conditions' },
  termsRu: { scope: 'buttonText', key: 'termsRu', label: 'Terms button', fallback: 'Условия аренды' },
  chooseCategoryEn: { scope: 'customerText', key: 'chooseCategoryEn', label: 'Choose class message', fallback: 'Choose a vehicle class below.', kind: 'textarea' },
  chooseCategoryRu: { scope: 'customerText', key: 'chooseCategoryRu', label: 'Choose class message', fallback: 'Выберите класс автомобиля ниже.', kind: 'textarea' },
  luxuryEn: { scope: 'buttonText', key: 'luxuryEn', label: 'Luxury button', fallback: 'Luxury' },
  luxuryRu: { scope: 'buttonText', key: 'luxuryRu', label: 'Luxury button', fallback: 'Люкс' },
  midEn: { scope: 'buttonText', key: 'midEn', label: 'Mid-range button', fallback: 'Mid-range' },
  midRu: { scope: 'buttonText', key: 'midRu', label: 'Mid-range button', fallback: 'Средний класс' },
  economyEn: { scope: 'buttonText', key: 'economyEn', label: 'Economy button', fallback: 'Economy' },
  economyRu: { scope: 'buttonText', key: 'economyRu', label: 'Economy button', fallback: 'Эконом' },
  chooseBodyTypeEn: { scope: 'customerText', key: 'chooseBodyTypeEn', label: 'Choose body type message', fallback: 'Choose a body type below.', kind: 'textarea' },
  chooseBodyTypeRu: { scope: 'customerText', key: 'chooseBodyTypeRu', label: 'Choose body type message', fallback: 'Выберите тип кузова ниже.', kind: 'textarea' },
  noVehiclesEn: { scope: 'customerText', key: 'noVehiclesEn', label: 'No vehicles fallback', fallback: 'There are no vehicles in this category right now.', kind: 'textarea' },
  noVehiclesRu: { scope: 'customerText', key: 'noVehiclesRu', label: 'No vehicles fallback', fallback: 'Сейчас в этой категории нет автомобилей.', kind: 'textarea' },
  termsDocumentCaptionEn: { scope: 'customerText', key: 'termsDocumentCaptionEn', label: 'Rental terms caption', fallback: 'Cape Cars rental terms. Read the document, then tap Accept below.', kind: 'textarea' },
  termsDocumentCaptionRu: { scope: 'customerText', key: 'termsDocumentCaptionRu', label: 'Rental terms caption', fallback: 'Условия аренды Cape Cars. Прочитайте документ и нажмите «Принять» ниже.', kind: 'textarea' },
  acceptEn: { scope: 'buttonText', key: 'acceptEn', label: 'Accept terms button', fallback: 'Accept' },
  acceptRu: { scope: 'buttonText', key: 'acceptRu', label: 'Accept terms button', fallback: 'Принять' },
  paymentDetailsEn: { scope: 'customerText', key: 'paymentDetailsEn', label: 'Payment details message', fallback: 'PAYMENT DETAILS\n\n+7-999-217-03-12\nЕвгений Н.\nАльфа-Банк / Сбербанк / Т-Банк\n\nDeposit due now: 5000 RUB to secure the booking.\nPlease send proof of payment after payment.', kind: 'textarea' },
  paymentDetailsRu: { scope: 'customerText', key: 'paymentDetailsRu', label: 'Payment details message', fallback: 'РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ\n\n+7-999-217-03-12\nЕвгений Н.\nАльфа-Банк / Сбербанк / Т-Банк\n\nПредоплата сейчас: 5000 ₽ для закрепления бронирования.\nПожалуйста, отправьте подтверждение оплаты после перевода.', kind: 'textarea' },
  cashEn: { scope: 'buttonText', key: 'cashEn', label: 'Cash payment button', fallback: 'Cash payment option' },
  cashRu: { scope: 'buttonText', key: 'cashRu', label: 'Cash payment button', fallback: 'Оплата наличными' },
  managerEn: { scope: 'buttonText', key: 'managerEn', label: 'Speak to manager button', fallback: 'Speak to manager' },
  managerRu: { scope: 'buttonText', key: 'managerRu', label: 'Speak to manager button', fallback: 'Связаться с менеджером' },
  managerRequestedEn: { scope: 'customerText', key: 'managerRequestedEn', label: 'Manager requested response', fallback: 'A manager has been notified and will reach out shortly. You can also continue browsing vehicles below.', kind: 'textarea' },
  managerRequestedRu: { scope: 'customerText', key: 'managerRequestedRu', label: 'Manager requested response', fallback: 'Менеджер уже уведомлён и скоро свяжется с вами. Вы также можете продолжить просмотр автомобилей ниже.', kind: 'textarea' },
  mainMenu: { scope: 'adminText', key: 'mainMenu', label: 'Admin main menu message', fallback: 'Cape Cars admin bot is ready. Choose what you want to manage.', kind: 'textarea' },
  vehicleManager: { scope: 'adminText', key: 'vehicleManager', label: 'Vehicle manager button', fallback: 'Vehicle manager' },
  pricingChange: { scope: 'adminText', key: 'pricingChange', label: 'Pricing change button', fallback: 'Pricing change' },
  viewBookings: { scope: 'adminText', key: 'viewBookings', label: 'View bookings button', fallback: 'View all bookings' },
} satisfies Record<string, Field>

const NODES: BuilderNode[] = [
  {
    id: 'start',
    title: { en: 'Start', ru: 'Старт' },
    eyebrow: { en: 'Trigger', ru: 'Запуск' },
    type: 'trigger',
    x: 48,
    y: 150,
    fields: [fields.welcomeEn, fields.welcomeRu],
    buttons: ['languageEnglish', 'languageRussian', 'reviews', 'managerEn', 'managerRu', 'termsEn', 'termsRu'],
  },
  {
    id: 'class',
    title: { en: 'Vehicle class', ru: 'Класс авто' },
    eyebrow: { en: 'Ask a question', ru: 'Вопрос' },
    type: 'question',
    x: 320,
    y: 70,
    fields: [fields.chooseCategoryEn, fields.chooseCategoryRu],
    buttons: ['luxuryEn', 'luxuryRu', 'midEn', 'midRu', 'economyEn', 'economyRu', 'managerEn', 'managerRu'],
  },
  {
    id: 'size',
    title: { en: 'Vehicle size', ru: 'Размер авто' },
    eyebrow: { en: 'List message', ru: 'Список' },
    type: 'question',
    x: 620,
    y: 70,
    fields: [fields.chooseBodyTypeEn, fields.chooseBodyTypeRu, fields.noVehiclesEn, fields.noVehiclesRu],
    buttons: BODY_TYPES,
  },
  {
    id: 'vehicle',
    title: { en: 'Vehicle cards', ru: 'Карточки авто' },
    eyebrow: { en: 'Catalog', ru: 'Каталог' },
    type: 'message',
    x: 920,
    y: 70,
    fields: [],
    buttons: ['Book vehicle'],
  },
  {
    id: 'dates',
    title: { en: 'Calendar', ru: 'Календарь' },
    eyebrow: { en: 'Ask a question', ru: 'Вопрос' },
    type: 'question',
    x: 1220,
    y: 70,
    fields: [],
    buttons: ['Start date', 'Return date'],
  },
  {
    id: 'customer',
    title: { en: 'Customer docs', ru: 'Документы' },
    eyebrow: { en: 'Collect details', ru: 'Сбор данных' },
    type: 'question',
    x: 920,
    y: 300,
    fields: [],
    buttons: ['Name', 'Phone', 'ID', 'License'],
  },
  {
    id: 'terms',
    title: { en: 'Terms PDF', ru: 'Условия PDF' },
    eyebrow: { en: 'Send document', ru: 'Документ' },
    type: 'message',
    x: 620,
    y: 300,
    fields: [fields.termsDocumentCaptionEn, fields.termsDocumentCaptionRu],
    buttons: ['acceptEn', 'acceptRu'],
  },
  {
    id: 'payment',
    title: { en: 'Payment', ru: 'Оплата' },
    eyebrow: { en: 'Buttons', ru: 'Кнопки' },
    type: 'action',
    x: 320,
    y: 300,
    fields: [fields.paymentDetailsEn, fields.paymentDetailsRu],
    buttons: ['cashEn', 'cashRu', 'managerEn', 'managerRu'],
  },
  {
    id: 'manager',
    title: { en: 'Manager handoff', ru: 'Менеджер' },
    eyebrow: { en: 'Handoff', ru: 'Передача' },
    type: 'handoff',
    x: 48,
    y: 300,
    fields: [fields.managerRequestedEn, fields.managerRequestedRu],
    buttons: ['managerEn', 'managerRu'],
  },
  {
    id: 'admin',
    title: { en: 'Admin bot', ru: 'Админ-бот' },
    eyebrow: { en: 'Internal bot', ru: 'Внутренний бот' },
    type: 'action',
    x: 48,
    y: 500,
    fields: [fields.mainMenu],
    buttons: ['vehicleManager', 'pricingChange', 'viewBookings'],
  },
]

const EDGES = [
  ['start', 'class'],
  ['class', 'size'],
  ['size', 'vehicle'],
  ['vehicle', 'dates'],
  ['dates', 'customer'],
  ['customer', 'terms'],
  ['terms', 'payment'],
  ['payment', 'manager'],
  ['manager', 'class'],
  ['manager', 'admin'],
] as const

function settingValue(settings: Settings, field: Field) {
  return settings[field.scope][field.key] ?? field.fallback
}

function buttonValue(settings: Settings, key: string) {
  const field = fields[key]
  return field ? settingValue(settings, field) : key
}

function displayButtonValue(settings: Settings, key: string, locale: Locale) {
  if (BODY_TYPES.includes(key as VehicleBodyType)) return BODY_TYPE_LABELS[locale][key as VehicleBodyType] ?? key
  if (!fields[key]) return SYSTEM_BUTTON_LABELS[locale][key] ?? key
  return buttonValue(settings, key)
}

function keyLocale(key: string): Locale | null {
  if (key.endsWith('Ru')) return 'ru'
  if (key.endsWith('Russian')) return 'ru'
  if (key.endsWith('En') || key.endsWith('English')) return 'en'
  return null
}

function localizedFields(node: BuilderNode, locale: Locale) {
  return node.fields.filter((field) => {
    const fieldLocale = keyLocale(field.key)
    return !fieldLocale || fieldLocale === locale
  })
}

function localizedButtonKeys(node: BuilderNode, locale: Locale) {
  return node.buttons.filter((key) => {
    const buttonLocale = keyLocale(key)
    return !buttonLocale || buttonLocale === locale
  })
}

function nodeTone(type: BuilderNode['type']) {
  if (type === 'trigger') return 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
  if (type === 'question') return 'border-blue-200 bg-blue-50/70 text-blue-800'
  if (type === 'action') return 'border-violet-200 bg-violet-50/70 text-violet-800'
  if (type === 'handoff') return 'border-amber-200 bg-amber-50/80 text-amber-800'
  return 'border-neutral-200 bg-neutral-50 text-neutral-800'
}

function insertBlankLine(value: string, selectionStart: number, selectionEnd: number) {
  return `${value.slice(0, selectionStart)}\n\n${value.slice(selectionEnd)}`
}

export default function BotControllerPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Settings>(emptySettings)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState('start')
  const [workspace, setWorkspace] = useState<'flow' | 'vehicles'>('flow')
  const [locale, setLocale] = useState<Locale>('en')
  const [zoom, setZoom] = useState(0.78)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    const [settingsRes, vehiclesRes] = await Promise.all([
      fetch('/api/admin/telegram/bot-controller', { cache: 'no-store' }),
      supabase.from('vehicles').select('*').order('sort_order', { ascending: true }),
    ])

    const payload = settingsRes.ok ? await settingsRes.json() : { settings: {} }
    const next = payload.settings ?? {}
    setSettings({
      botEnabled: next.botEnabled !== false,
      customerText: next.customerText ?? {},
      adminText: next.adminText ?? {},
      buttonText: next.buttonText ?? {},
      customButtons: next.customButtons ?? {},
    })
    setVehicles((vehiclesRes.data as Vehicle[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const selectedNode = useMemo(
    () => NODES.find((node) => node.id === selectedNodeId) ?? NODES[0],
    [selectedNodeId],
  )
  const selectedFields = useMemo(() => localizedFields(selectedNode, locale), [selectedNode, locale])
  const selectedButtonKeys = useMemo(() => localizedButtonKeys(selectedNode, locale), [selectedNode, locale])
  const selectedCustomButtons = settings.customButtons[selectedNode.id] ?? []
  const canAddButtons = CUSTOM_BUTTON_NODES.includes(selectedNode.id as typeof CUSTOM_BUTTON_NODES[number])

  const vehicleCounts = useMemo(() => {
    return {
      available: vehicles.filter((vehicle) => vehicle.status === 'Available').length,
      hidden: vehicles.filter((vehicle) => vehicle.status !== 'Available').length,
      total: vehicles.length,
    }
  }, [vehicles])

  const setField = (field: Field, nextValue: string) => {
    setSettings((current) => ({
      ...current,
      [field.scope]: { ...current[field.scope], [field.key]: nextValue },
    }))
  }

  const insertFieldBlankLine = (field: Field, selectionStart: number, selectionEnd: number) => {
    const currentValue = settingValue(settings, field)
    const nextValue = insertBlankLine(currentValue, selectionStart, selectionEnd)
    setField(field, nextValue)
    return selectionStart + 2
  }

  const addCustomButton = () => {
    const id = `button-${Date.now()}`
    const nextButton: CustomButton = {
      id,
      labelEn: 'New button',
      labelRu: 'Новая кнопка',
      action: 'manager',
      url: '',
    }
    setSettings((current) => ({
      ...current,
      customButtons: {
        ...current.customButtons,
        [selectedNode.id]: [...(current.customButtons[selectedNode.id] ?? []), nextButton],
      },
    }))
  }

  const updateCustomButton = (buttonId: string, patch: Partial<CustomButton>) => {
    setSettings((current) => ({
      ...current,
      customButtons: {
        ...current.customButtons,
        [selectedNode.id]: (current.customButtons[selectedNode.id] ?? []).map((button) =>
          button.id === buttonId ? { ...button, ...patch } : button,
        ),
      },
    }))
  }

  const removeCustomButton = (buttonId: string) => {
    setSettings((current) => ({
      ...current,
      customButtons: {
        ...current.customButtons,
        [selectedNode.id]: (current.customButtons[selectedNode.id] ?? []).filter((button) => button.id !== buttonId),
      },
    }))
  }

  const saveSettings = async (nextSettings: Settings, successMessage = 'Changes applied live to Telegram.') => {
    setSaving(true)
    setStatus(null)
    const response = await fetch('/api/admin/telegram/bot-controller', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: nextSettings }),
    })
    const payload = await response.json()
    setSaving(false)
    setStatus(response.ok ? successMessage : (payload.error || 'Could not apply changes.'))
    return response.ok
  }

  const applyChanges = async () => {
    await saveSettings(settings)
  }

  const toggleBotEnabled = async () => {
    const nextSettings = { ...settings, botEnabled: !settings.botEnabled }
    setSettings(nextSettings)
    const ok = await saveSettings(
      nextSettings,
      nextSettings.botEnabled ? 'Bot turned on.' : 'Bot turned off.',
    )
    if (!ok) setSettings(settings)
  }

  const updateVehicle = async (vehicleId: string, patch: Partial<Vehicle>) => {
    setVehicles((current) => current.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, ...patch } : vehicle))
    const { error } = await supabase.from('vehicles').update(patch).eq('id', vehicleId)
    setStatus(error ? error.message : 'Vehicle allocation saved live.')
  }

  return (
    <div className="h-[calc(100vh-9rem)] min-h-[760px] overflow-hidden rounded-2xl border border-black/[0.08] bg-[#f7f7f4] shadow-sm">
      <header className="flex h-16 items-center justify-between border-b border-black/[0.08] bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-900 text-sm text-white">T</div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-900">Telegram Bot Controller</div>
            <div className="text-xs text-neutral-500">Pick a language, choose a step, edit text and buttons</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleBotEnabled}
            disabled={saving || loading}
            aria-pressed={settings.botEnabled}
            aria-label={UI_TEXT.botToggle[locale]}
            title={UI_TEXT.botToggle[locale]}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
              settings.botEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${settings.botEnabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {settings.botEnabled ? UI_TEXT.botOn[locale] : UI_TEXT.botOff[locale]}
          </button>
          <div className="grid grid-cols-2 rounded-full bg-neutral-100 p-1 text-xs">
            <button
              onClick={() => setLocale('en')}
              className={`rounded-full px-3 py-1.5 ${locale === 'en' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
            >
              English
            </button>
            <button
              onClick={() => setLocale('ru')}
              className={`rounded-full px-3 py-1.5 ${locale === 'ru' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
            >
              Russian
            </button>
          </div>
          <div className="hidden rounded-full border border-black/[0.08] bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 md:block">
            {vehicleCounts.available} live vehicles, {vehicleCounts.hidden} hidden
          </div>
          {status && <div className="hidden max-w-[280px] truncate text-xs text-neutral-500 lg:block">{status}</div>}
          <button onClick={load} className="rounded-full border border-black/[0.1] bg-white px-3 py-2 text-xs text-neutral-600 hover:bg-neutral-50">Refresh</button>
          <button
            onClick={applyChanges}
            disabled={saving || loading}
            className="rounded-full bg-[#118c7e] px-4 py-2 text-xs font-medium text-white hover:bg-[#0f7c70] disabled:opacity-50"
          >
            {saving ? 'Applying...' : 'Apply changes'}
          </button>
        </div>
      </header>

      <div className="grid h-[calc(100%-4rem)] grid-cols-[260px,1fr,360px]">
        <aside className="border-r border-black/[0.08] bg-white">
          <div className="border-b border-black/[0.08] p-3">
            <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1 text-xs">
              <button
              onClick={() => setWorkspace('flow')}
              className={`rounded-lg px-3 py-2 ${workspace === 'flow' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
            >
                {UI_TEXT.flow[locale]}
              </button>
              <button
                onClick={() => setWorkspace('vehicles')}
                className={`rounded-lg px-3 py-2 ${workspace === 'vehicles' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
              >
                {UI_TEXT.vehicles[locale]}
              </button>
            </div>
          </div>

          {workspace === 'flow' ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-black/[0.06] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">{UI_TEXT.nodes[locale]}</div>
                <div className="mt-2 text-sm text-neutral-600">{UI_TEXT.nodeHelp[locale]}</div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {NODES.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selectedNode.id === node.id ? 'border-[#118c7e] bg-[#edf8f6]' : 'border-black/[0.06] bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{node.eyebrow[locale]}</div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{node.title[locale]}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">{UI_TEXT.vehicleRouting[locale]}</div>
              <div className="rounded-xl border border-black/[0.06] bg-neutral-50 p-3 text-sm text-neutral-600">
                {UI_TEXT.vehicleHelp[locale]}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                  <div className="text-lg font-medium">{vehicleCounts.available}</div>
                  <div>Live</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                  <div className="text-lg font-medium">{vehicleCounts.hidden}</div>
                  <div>Hidden</div>
                </div>
                <div className="rounded-xl bg-neutral-100 p-3 text-neutral-700">
                  <div className="text-lg font-medium">{vehicleCounts.total}</div>
                  <div>Total</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="relative overflow-hidden">
          {workspace === 'flow' ? (
            <>
              <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-2 py-1 shadow-sm">
                <button onClick={() => setZoom((value) => Math.max(0.58, value - 0.08))} className="grid h-7 w-7 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100">-</button>
                <div className="w-12 text-center text-xs tabular-nums text-neutral-500">{Math.round(zoom * 100)}%</div>
                <button onClick={() => setZoom((value) => Math.min(1, value + 0.08))} className="grid h-7 w-7 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100">+</button>
                <button onClick={() => setZoom(0.78)} className="rounded-full px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100">Center</button>
              </div>

              <div className="h-full overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(20,20,20,0.12)_1px,transparent_0)] [background-size:24px_24px]">
                <div className="relative h-[760px] w-[1480px] origin-top-left" style={{ transform: `scale(${zoom})` }}>
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    {EDGES.map(([fromId, toId]) => {
                      const from = NODES.find((node) => node.id === fromId)!
                      const to = NODES.find((node) => node.id === toId)!
                      const x1 = from.x + 220
                      const y1 = from.y + 54
                      const x2 = to.x
                      const y2 = to.y + 54
                      const mid = (x1 + x2) / 2
                      return (
                        <path
                          key={`${fromId}-${toId}`}
                          d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke="rgba(17, 140, 126, 0.42)"
                          strokeWidth="2"
                        />
                      )
                    })}
                  </svg>

                  {NODES.map((node) => {
                    const nodeFields = localizedFields(node, locale)
                    const nodeButtons = localizedButtonKeys(node, locale)
                    const customCount = settings.customButtons[node.id]?.length ?? 0
                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`absolute w-[220px] rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                          selectedNode.id === node.id ? 'border-[#118c7e] ring-4 ring-[#118c7e]/10' : 'border-black/[0.08]'
                        }`}
                        style={{ left: node.x, top: node.y }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{node.eyebrow[locale]}</div>
                            <div className="mt-1 text-base font-medium text-neutral-900">{node.title[locale]}</div>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[10px] ${nodeTone(node.type)}`}>{TYPE_LABELS[locale][node.type]}</span>
                        </div>
                        <div className="mt-3 line-clamp-3 min-h-9 whitespace-pre-line text-xs leading-relaxed text-neutral-500">
                          {nodeFields[0] ? settingValue(settings, nodeFields[0]) : UI_TEXT.systemStep[locale]}
                        </div>
                        {(nodeButtons.length > 0 || customCount > 0) && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {nodeButtons.slice(0, 3).map((button) => (
                              <span key={button} className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600">{displayButtonValue(settings, button, locale)}</span>
                            ))}
                            {customCount > 0 && <span className="rounded-full bg-[#edf8f6] px-2 py-1 text-[10px] text-[#118c7e]">+{customCount} {UI_TEXT.custom[locale]}</span>}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full overflow-auto bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-black/[0.08] text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                    <th className="px-5 py-3 text-left font-normal">Vehicle</th>
                    <th className="px-5 py-3 text-left font-normal">Category</th>
                    <th className="px-5 py-3 text-left font-normal">Size</th>
                    <th className="px-5 py-3 text-left font-normal">Status</th>
                    <th className="px-5 py-3 text-left font-normal">Image</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-neutral-900">{vehicle.model}</div>
                        <div className="text-xs text-neutral-400">{vehicle.color || 'No color set'}</div>
                      </td>
                      <td className="px-5 py-3">
                        <select value={vehicle.cat} onChange={(event) => updateVehicle(vehicle.id, { cat: event.target.value as Vehicle['cat'] })} className="rounded-full border border-black/[0.1] bg-white px-3 py-1.5 text-xs text-neutral-700">
                          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={vehicle.telegram_body_type ?? ''}
                          onChange={(event) => updateVehicle(vehicle.id, { telegram_body_type: (event.target.value || null) as Vehicle['telegram_body_type'] })}
                          className="rounded-full border border-black/[0.1] bg-white px-3 py-1.5 text-xs text-neutral-700"
                        >
                          <option value="">Auto from model</option>
                          {BODY_TYPES.map((bodyType) => <option key={bodyType}>{bodyType}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <select value={vehicle.status} onChange={(event) => updateVehicle(vehicle.id, { status: event.target.value as Vehicle['status'] })} className="rounded-full border border-black/[0.1] bg-white px-3 py-1.5 text-xs text-neutral-700">
                          {STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          value={vehicle.image_url ?? ''}
                          onChange={(event) => updateVehicle(vehicle.id, { image_url: event.target.value || null })}
                          placeholder="Image URL"
                          className="w-72 rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs text-neutral-700 outline-none focus:border-neutral-400"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && vehicles.length === 0 && <div className="p-6 text-sm text-neutral-400">No vehicles found.</div>}
            </div>
          )}
        </main>

        <aside className="border-l border-black/[0.08] bg-white">
          <div className="flex h-full flex-col">
            <div className="border-b border-black/[0.08] p-4">
              <div className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">{UI_TEXT.inspector[locale]}</div>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium text-neutral-900">{selectedNode.title[locale]}</div>
                  <div className="text-sm text-neutral-500">{selectedNode.eyebrow[locale]}</div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] ${nodeTone(selectedNode.type)}`}>{TYPE_LABELS[locale][selectedNode.type]}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedFields.length === 0 && (
                <div className="rounded-2xl border border-black/[0.06] bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
                  {UI_TEXT.systemStep[locale]}
                </div>
              )}

              {selectedFields.map((field) => (
                <label key={`${field.scope}-${field.key}`} className="mb-4 block">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{field.label}</span>
                  {field.kind === 'textarea' ? (
                    <textarea
                      value={settingValue(settings, field)}
                      onChange={(event) => setField(field, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        const target = event.currentTarget
                        const cursor = insertFieldBlankLine(field, target.selectionStart, target.selectionEnd)
                        requestAnimationFrame(() => target.setSelectionRange(cursor, cursor))
                      }}
                      rows={field.fallback.length > 120 ? 7 : 4}
                      className="mt-2 w-full resize-y whitespace-pre-wrap rounded-xl border border-black/[0.1] bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-[#118c7e]"
                    />
                  ) : (
                    <input
                      value={settingValue(settings, field)}
                      onChange={(event) => setField(field, event.target.value)}
                      className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-[#118c7e]"
                    />
                  )}
                </label>
              ))}

              {(selectedButtonKeys.length > 0 || canAddButtons) && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{UI_TEXT.standardButtons[locale]}</div>
                      {canAddButtons && <div className="mt-1 text-xs text-neutral-500">{UI_TEXT.addButtonHelp[locale]}</div>}
                    </div>
                    {canAddButtons && (
                      <button
                        onClick={addCustomButton}
                        className="grid h-8 w-8 place-items-center rounded-full bg-neutral-900 text-lg leading-none text-white hover:bg-neutral-700"
                        aria-label={UI_TEXT.addButton[locale]}
                        title={UI_TEXT.addButton[locale]}
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedButtonKeys.map((button) => {
                      const field = fields[button]
                      if (!field) return <div key={button} className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-600">{displayButtonValue(settings, button, locale)}</div>
                      return (
                        <input
                          key={button}
                          value={settingValue(settings, field)}
                          onChange={(event) => setField(field, event.target.value)}
                          className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-[#118c7e]"
                        />
                      )
                    })}

                    {selectedCustomButtons.map((button) => (
                      <div key={button.id} className="rounded-xl border border-black/[0.08] bg-white p-3">
                        <div className="grid grid-cols-[1fr,104px,32px] gap-2">
                          <input
                            value={locale === 'ru' ? button.labelRu : button.labelEn}
                            onChange={(event) => updateCustomButton(button.id, locale === 'ru' ? { labelRu: event.target.value } : { labelEn: event.target.value })}
                            placeholder={UI_TEXT.buttonText[locale]}
                            className="min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 text-sm outline-none focus:border-[#118c7e]"
                          />
                          <select
                            value={button.action}
                            onChange={(event) => updateCustomButton(button.id, { action: event.target.value as CustomButton['action'] })}
                            className="rounded-xl border border-black/[0.1] bg-white px-2 py-2 text-xs text-neutral-700"
                          >
                            <option value="manager">{UI_TEXT.managerAction[locale]}</option>
                            <option value="url">{UI_TEXT.linkAction[locale]}</option>
                          </select>
                          <button onClick={() => removeCustomButton(button.id)} className="rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600">x</button>
                        </div>
                        {button.action === 'url' && (
                          <input
                            value={button.url ?? ''}
                            onChange={(event) => updateCustomButton(button.id, { url: event.target.value })}
                            placeholder="https://..."
                            className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm outline-none focus:border-[#118c7e]"
                          />
                        )}
                      </div>
                    ))}
                    {canAddButtons && selectedCustomButtons.length === 0 && (
                      <div className="rounded-xl border border-dashed border-black/[0.12] bg-white px-3 py-4 text-center text-xs text-neutral-500">
                        {UI_TEXT.noButtons[locale]}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-[28px] border border-black/[0.08] bg-[#f1f5f3] p-3">
                <div className="mx-auto max-w-[250px] rounded-[24px] bg-[#e5ddd5] p-3 shadow-sm">
                  <div className="whitespace-pre-line rounded-2xl bg-white px-3 py-2 text-sm leading-relaxed text-neutral-800">
                    {selectedFields[0] ? settingValue(settings, selectedFields[0]) : UI_TEXT.systemStep[locale]}
                  </div>
                  {(selectedButtonKeys.length > 0 || selectedCustomButtons.length > 0) && (
                    <div className="mt-2 space-y-1.5">
                      {selectedButtonKeys.slice(0, 4).map((button) => (
                        <div key={button} className="rounded-xl bg-white px-3 py-2 text-center text-xs font-medium text-[#118c7e] shadow-sm">
                          {displayButtonValue(settings, button, locale)}
                        </div>
                      ))}
                      {selectedCustomButtons.map((button) => (
                        <div key={button.id} className="rounded-xl bg-white px-3 py-2 text-center text-xs font-medium text-[#118c7e] shadow-sm">
                          {locale === 'ru' ? button.labelRu : button.labelEn}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
