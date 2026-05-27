'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type AdminLocale = 'en' | 'ru'

type AdminLanguageContextValue = {
  locale: AdminLocale
  setLocale: (locale: AdminLocale) => void
  t: (en: string, ru: string) => string
}

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null)

const ADMIN_TRANSLATIONS: Record<string, string> = {
  'Dashboard': 'Панель',
  'Fleet': 'Автопарк',
  'Customers': 'Клиенты',
  'Bookings': 'Бронирования',
  'Rentals': 'Аренды',
  'Telegram': 'Телеграм',
  'Bot Controller': 'Бот-контроллер',
  'Sales': 'Продажи',
  'Fleet Catalogue': 'Каталог автопарка',
  'Sales Performance': 'Продажи',
  'Telegram Bookings': 'Бронирования Telegram',
  'Delete all bookings': 'Удалить все бронирования',
  'Keep bookings': 'Оставить бронирования',
  'Delete all conversations': 'Удалить все переписки',
  'Delete selected': 'Удалить выбранную',
  'Keep conversations': 'Оставить переписки',
  'Refresh': 'Обновить',
  'Loading bookings…': 'Загрузка бронирований…',
  'Loading Telegram customers…': 'Загрузка клиентов Telegram…',
  'No Telegram bookings in this stage yet.': 'На этом этапе пока нет бронирований Telegram.',
  'No active conversations.': 'Активных переписок нет.',
  'No expired conversations.': 'Истекших переписок нет.',
  'Choose a Telegram customer to inspect the full profile.': 'Выберите клиента Telegram, чтобы посмотреть профиль.',
  'No conversation messages logged yet.': 'Сообщений в переписке пока нет.',
  'Open uploaded file': 'Открыть загруженный файл',
  'Pending': 'Ожидает',
  'Confirmed booking': 'Бронирование подтверждено',
  'Awaiting payment proof': 'Ожидает оплату',
  'Confirmed': 'Подтверждено',
  'Cancelled': 'Отменено',
  'Expired': 'Истекло',
  'All': 'Все',
  'Customer': 'Клиент',
  'Vehicle': 'Авто',
  'Dates': 'Даты',
  'Total': 'Итого',
  'Status': 'Статус',
  'Documents': 'Документы',
  'Next action': 'Следующее действие',
  'Booking code': 'Код бронирования',
  'Rental window': 'Период аренды',
  'Confirm booking': 'Подтвердить бронирование',
  'Cancel booking': 'Отменить бронирование',
  'View ID / passport': 'Открыть ID / паспорт',
  'View license front': 'Открыть лицензию, лицевая сторона',
  'View license back': 'Открыть лицензию, обратная сторона',
  'No ID / passport': 'Нет ID / паспорта',
  'No license front': 'Нет лицевой стороны лицензии',
  'No license back': 'Нет обратной стороны лицензии',
  'Telegram customers': 'Клиенты Telegram',
  'Live bookings': 'Активные бронирования',
  'Pending holds': 'Ожидающие резервы',
  'Conversations': 'Переписки',
  'Active': 'Активные',
  'Conversation + booking detail': 'Переписка и бронирование',
  'Conversation history': 'История переписки',
  'Latest booking': 'Последнее бронирование',
  'No phone yet': 'Телефон не указан',
  'No date': 'Дата не указана',
  'No total yet': 'Сумма не указана',
  'No booking draft yet.': 'Черновика бронирования пока нет.',
  'No vehicle yet': 'Авто не выбрано',
  'No activity yet': 'Активности пока нет',
  'Inbound': 'Входящее',
  'Outbound': 'Исходящее',
  'Media message': 'Медиа-сообщение',
  'Speak to Customer': 'Написать клиенту',
  'Payment received': 'Оплата получена',
  'Vehicle manager': 'Управление авто',
  'Pricing change': 'Изменить цены',
  'View all bookings': 'Все бронирования',
  'Toggle Telegram bot': 'Включить/выключить Telegram-бот',
  'Changes applied live to Telegram.': 'Изменения применены в Telegram.',
  'No vehicles found.': 'Автомобили не найдены.',
  'No color set': 'Цвет не указан',
}

function translateText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return text
  if (ADMIN_TRANSLATIONS[trimmed]) return text.replace(trimmed, ADMIN_TRANSLATIONS[trimmed])

  let translated = trimmed
    .replace(/\bDashboard\b/g, 'Панель')
    .replace(/\bBookings\b/g, 'Бронирования')
    .replace(/\bCustomers\b/g, 'Клиенты')
    .replace(/\bRentals\b/g, 'Аренды')
    .replace(/\bFleet\b/g, 'Автопарк')
    .replace(/\bTelegram leads\b/g, 'Лиды Telegram')
    .replace(/\bwaiting for payment\b/g, 'ожидают оплату')
    .replace(/\bconfirmed\b/g, 'подтверждено')
    .replace(/\bmessages\b/g, 'сообщений')
    .replace(/\bmessage\(s\)\b/g, 'сообщений')
    .replace(/\bbooking record\(s\)\b/g, 'записей бронирования')
    .replace(/\bday\(s\)\b/g, 'дн.')
    .replace(/\bdays\b/g, 'дн.')
    .replace(/\bActive\b/g, 'Активно')
    .replace(/\bExpired\b/g, 'Истекло')
    .replace(/\bnew\b/g, 'новое')
  return text.replace(trimmed, translated)
}

function translateAdminDom(locale: AdminLocale) {
  if (locale !== 'ru' || typeof document === 'undefined') return
  const root = document.querySelector('[data-admin-shell]')
  if (!root) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest('script,style,textarea,input,select,[data-no-auto-translate]')) {
        return NodeFilter.FILTER_REJECT
      }
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const next = translateText(node.textContent ?? '')
    if (next !== node.textContent) node.textContent = next
  }
}

export function AdminLanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem('cape_cars_admin_locale')
    if (saved === 'ru' || saved === 'en') setLocaleState(saved)
  }, [])

  const setLocale = (next: AdminLocale) => {
    setLocaleState(next)
    window.localStorage.setItem('cape_cars_admin_locale', next)
  }

  const value = useMemo<AdminLanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (en, ru) => locale === 'ru' ? ru : en,
  }), [locale])

  useEffect(() => {
    if (locale !== 'ru') return
    translateAdminDom(locale)
    const observer = new MutationObserver(() => translateAdminDom(locale))
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [locale])

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>
}

export function useAdminLanguage() {
  const ctx = useContext(AdminLanguageContext)
  if (!ctx) throw new Error('useAdminLanguage must be used within AdminLanguageProvider')
  return ctx
}
