'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminLanguage } from '../admin-language'

type TelegramCustomer = {
  id: string
  chat_id: string
  telegram_name: string | null
  telegram_username: string | null
  full_name: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

type TelegramBooking = {
  id: string
  customer_id: string | null
  chat_id: string
  vehicle_name: string | null
  vehicle_category: string | null
  start_date: string | null
  total_days: number | null
  end_date: string | null
  daily_rate: number | null
  total_amount: number | null
  status: string
  created_at: string
  updated_at: string
}

type TelegramConversation = {
  id: string
  customer_id: string | null
  chat_id: string
  direction: 'inbound' | 'outbound'
  message_type: 'text' | 'photo' | 'document' | 'button'
  body: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

type ConversationTab = 'active' | 'expired'
type ConversationDeleteMode = 'selected' | 'all'

const CONVERSATION_EXPIRY_MS = 24 * 60 * 60 * 1000

function latestTimestamp(...values: Array<string | null | undefined>) {
  return values.reduce((latest, value) => {
    if (!value) return latest
    const stamp = new Date(value).getTime()
    return Number.isFinite(stamp) && stamp > latest ? stamp : latest
  }, 0)
}

function conversationTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function messageBody(item: TelegramConversation, fallback: string) {
  if (item.body) return item.body
  if (item.message_type === 'photo') return fallback
  if (item.message_type === 'document') return 'Document'
  return 'Message'
}

export default function TelegramBotPage() {
  const { locale, t } = useAdminLanguage()
  const [customers, setCustomers] = useState<TelegramCustomer[]>([])
  const [bookings, setBookings] = useState<TelegramBooking[]>([])
  const [conversations, setConversations] = useState<TelegramConversation[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [conversationTab, setConversationTab] = useState<ConversationTab>('active')
  const [confirmDeleteMode, setConfirmDeleteMode] = useState<ConversationDeleteMode | null>(null)
  const [deletingConversations, setDeletingConversations] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const response = await fetch('/api/admin/telegram/inbox', { cache: 'no-store' })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to load Telegram data')
      setCustomers([])
      setBookings([])
      setConversations([])
      setLoading(false)
      return
    }

    const loadedCustomers = (payload.customers as TelegramCustomer[] | undefined) ?? []
    setCustomers(loadedCustomers)
    setBookings((payload.bookings as TelegramBooking[] | undefined) ?? [])
    setConversations((payload.conversations as TelegramConversation[] | undefined) ?? [])
    setSelectedCustomerId(prev => prev ?? loadedCustomers[0]?.id ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const cards = useMemo(() => {
    return customers.map(customer => {
      const customerBookings = bookings.filter(booking => booking.customer_id === customer.id || booking.chat_id === customer.chat_id)
      const customerConversations = conversations.filter(item => item.customer_id === customer.id || item.chat_id === customer.chat_id)
      const latestBooking = customerBookings[0] ?? null
      const lastActivityAt = latestTimestamp(
        customer.updated_at,
        latestBooking?.updated_at,
        customerConversations[0]?.created_at,
      )
      const expired = lastActivityAt > 0 && Date.now() - lastActivityAt > CONVERSATION_EXPIRY_MS
      return {
        customer,
        bookings: customerBookings,
        conversations: customerConversations,
        latestBooking,
        lastActivityAt,
        expired,
      }
    })
  }, [customers, bookings, conversations])

  const activeCards = useMemo(() => cards.filter(card => !card.expired), [cards])
  const expiredCards = useMemo(() => cards.filter(card => card.expired), [cards])
  const visibleCards = useMemo(
    () => conversationTab === 'active' ? activeCards : expiredCards,
    [activeCards, conversationTab, expiredCards],
  )
  const selected = visibleCards.find(card => card.customer.id === selectedCustomerId) ?? visibleCards[0] ?? null
  const selectedMessages = useMemo(
    () => [...(selected?.conversations ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [selected],
  )

  useEffect(() => {
    setSelectedCustomerId((current) => visibleCards.some(card => card.customer.id === current) ? current : visibleCards[0]?.customer.id ?? null)
  }, [visibleCards])

  const deleteConversations = async (mode: ConversationDeleteMode) => {
    setDeletingConversations(true)
    setError(null)
    const response = await fetch('/api/admin/telegram/inbox', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'selected' ? { chatId: selected?.customer.chat_id } : {}),
    })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to delete Telegram conversations')
      setDeletingConversations(false)
      return
    }

    if (mode === 'selected' && selected) {
      const chatId = selected.customer.chat_id
      setCustomers((items) => items.filter((item) => item.chat_id !== chatId))
      setConversations((items) => items.filter((item) => item.chat_id !== chatId))
      setSelectedCustomerId(null)
    } else {
      setCustomers([])
      setConversations([])
      setSelectedCustomerId(null)
    }
    setConfirmDeleteMode(null)
    setDeletingConversations(false)
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-neutral-900">{t('Telegram Bookings', 'Бронирования Telegram')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('Customer profiles, live booking drafts, and full Telegram conversation history', 'Профили клиентов, активные черновики бронирований и полная история переписки в Telegram')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {confirmDeleteMode ? (
            <>
              <button
                onClick={() => setConfirmDeleteMode(null)}
                disabled={deletingConversations}
                className="rounded-full border border-black/[0.08] bg-white px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                Keep conversations
              </button>
              <button
                onClick={() => deleteConversations(confirmDeleteMode)}
                disabled={deletingConversations || (confirmDeleteMode === 'selected' && !selected)}
                className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingConversations
                  ? 'Deleting...'
                  : confirmDeleteMode === 'all' ? 'Delete all conversations' : 'Delete selected'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDeleteMode('selected')}
                disabled={!selected}
                className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Delete selected
              </button>
              <button
                onClick={() => setConfirmDeleteMode('all')}
                disabled={customers.length === 0}
                className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Delete all conversations
              </button>
              <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-900 text-white text-sm hover:bg-neutral-800 transition-colors">
                {t('Refresh', 'Обновить')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Telegram customers', value: customers.length },
          { label: 'Live bookings', value: bookings.length },
          { label: 'Pending holds', value: bookings.filter((booking) => booking.status === 'pending').length },
          { label: 'Awaiting payment proof', value: bookings.filter((booking) => booking.status === 'awaiting_payment_confirmation').length },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-4 border border-black/[0.06]">
            <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-400">{card.label}</div>
            <div className="mt-1.5 text-xl font-light tabular-nums text-neutral-900">{loading ? '—' : card.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          {error.includes('relation') || error.includes('schema cache')
            ? `${error}. If the Telegram tables are missing, run the new Supabase migration first.`
            : error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
          <div className="border-b border-black/[0.06] px-5 py-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-400">Conversations</div>
            <div className="mt-3 grid grid-cols-2 rounded-xl bg-neutral-100 p-1 text-xs">
              {[
                { id: 'active' as const, label: `Active (${activeCards.length})` },
                { id: 'expired' as const, label: `Expired (${expiredCards.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setConversationTab(tab.id)}
                  className={`rounded-lg px-3 py-2 transition-colors ${conversationTab === tab.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-neutral-400">Loading Telegram customers…</div>
          ) : visibleCards.length === 0 ? (
            <div className="p-6 text-sm text-neutral-400">
              {conversationTab === 'active' ? 'No active conversations.' : 'No expired conversations.'}
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {visibleCards.map(({ customer, latestBooking, conversations: customerConversations, lastActivityAt, expired }) => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`w-full text-left px-5 py-4 transition-colors ${selectedCustomerId === customer.id ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-neutral-900">{customer.full_name || customer.telegram_name || 'Unnamed customer'}</div>
                      <div className="text-xs text-neutral-400 mt-0.5">{customer.phone || customer.telegram_username || customer.chat_id}</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-neutral-400">{latestBooking?.status || 'new'}</div>
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    {latestBooking?.vehicle_name || 'No vehicle yet'} · {customerConversations.length} messages
                  </div>
                  <div className={`mt-1 text-[11px] ${expired ? 'text-neutral-400' : 'text-emerald-600'}`}>
                    {lastActivityAt ? `${expired ? 'Expired' : 'Active'} · ${new Date(lastActivityAt).toLocaleString('en-ZA')}` : 'No activity yet'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
          <div className="border-b border-black/[0.06] px-5 py-4 text-[10px] uppercase tracking-[0.25em] text-neutral-400">{t('Conversation + booking detail', 'Переписка и бронирование')}</div>
          {!selected ? (
            <div className="p-6 text-sm text-neutral-400">{t('Choose a Telegram customer to inspect the full profile.', 'Выберите клиента Telegram, чтобы посмотреть профиль.')}</div>
          ) : (
            <div className="p-5 space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-neutral-50 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{t('Customer', 'Клиент')}</div>
                  <div className="mt-2 font-medium text-neutral-900">{selected.customer.full_name || selected.customer.telegram_name || 'Unnamed customer'}</div>
                  <div className="text-sm text-neutral-500 mt-1">{selected.customer.phone || t('No phone yet', 'Телефон не указан')}</div>
                  <div className="text-xs text-neutral-400 mt-1">{selected.customer.telegram_username || selected.customer.chat_id}</div>
                </div>
                <div className="rounded-xl bg-neutral-50 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{t('Latest booking', 'Последнее бронирование')}</div>
                  {selected.latestBooking ? (
                    <>
                      <div className="mt-2 font-medium text-neutral-900">{selected.latestBooking.vehicle_name || t('Vehicle pending', 'Авто не выбрано')}</div>
                      <div className="text-sm text-neutral-500 mt-1">{selected.latestBooking.start_date || t('No date', 'Дата не указана')} · {selected.latestBooking.total_days || 0} {t('days', 'дн.')}</div>
                      <div className="text-sm text-neutral-500 mt-1">{selected.latestBooking.total_amount ? `R ${selected.latestBooking.total_amount.toLocaleString('en-ZA')}` : t('No total yet', 'Сумма не указана')}</div>
                    </>
                  ) : <div className="mt-2 text-sm text-neutral-400">{t('No booking draft yet.', 'Черновика бронирования пока нет.')}</div>}
                </div>
                <div className="rounded-xl bg-neutral-50 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{t('Status', 'Статус')}</div>
                  <div className="mt-2 font-medium text-neutral-900">{selected.latestBooking?.status || 'new'}</div>
                  <div className="text-sm text-neutral-500 mt-1">{selected.bookings.length} {t('booking record(s)', 'записей бронирования')}</div>
                  <div className="text-sm text-neutral-500 mt-1">{selected.conversations.length} {t('message(s)', 'сообщений')}</div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-400">{t('Telegram phone preview', 'Предпросмотр телефона Telegram')}</div>
                  <div className="text-xs text-neutral-400">{selectedMessages.length} {t('messages', 'сообщений')}</div>
                </div>
                <div className="mx-auto max-w-[390px] rounded-[2rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
                  <div className="rounded-[1.35rem] bg-[#f4f1ea] overflow-hidden">
                    <div className="bg-neutral-900 px-4 py-3 text-white">
                      <div className="text-sm font-medium truncate">{selected.customer.full_name || selected.customer.telegram_name || t('Telegram customer', 'Клиент Telegram')}</div>
                      <div className="text-[11px] text-white/50 truncate">{selected.customer.telegram_username || selected.customer.chat_id}</div>
                    </div>
                    <div className="h-[520px] overflow-y-auto px-3 py-4 space-y-2 bg-[linear-gradient(180deg,#f6f1e8,#efe8dc)]">
                      {selectedMessages.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-neutral-400">{t('No conversation messages logged yet.', 'Сообщений в переписке пока нет.')}</div>
                      ) : selectedMessages.map(item => {
                        const inbound = item.direction === 'inbound'
                        return (
                          <div key={item.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${inbound ? 'rounded-bl-md bg-white text-neutral-800' : 'rounded-br-md bg-[#d7f4c3] text-neutral-900'}`}>
                              <div className="whitespace-pre-wrap break-words">{messageBody(item, t('Media message', 'Медиа-сообщение'))}</div>
                              {typeof item.meta?.fileId === 'string' && (
                                <a
                                  className="mt-1.5 inline-flex text-xs font-medium underline underline-offset-2"
                                  href={`/api/telegram/file/${encodeURIComponent(item.meta.fileId)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t('Open uploaded file', 'Открыть файл')}
                                </a>
                              )}
                              <div className="mt-1 text-right text-[10px] text-neutral-400">{conversationTime(item.created_at, locale)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
