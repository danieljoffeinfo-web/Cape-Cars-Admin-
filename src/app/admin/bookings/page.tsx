'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminLanguage } from '../admin-language'

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
  id_file_id: string | null
  license_file_id: string | null
  license_back_file_id?: string | null
  booking_code?: string | null
  hold_expires_at?: string | null
  released_at?: string | null
  status: string
  created_at: string
  updated_at: string
  telegram_customers?: {
    full_name: string | null
    phone: string | null
    telegram_name: string | null
    telegram_username?: string | null
  } | null
}

const STATUS_OPTIONS = ['pending', 'confirmed_booking', 'awaiting_payment_confirmation', 'confirmed', 'cancelled', 'expired'] as const

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed_booking: 'bg-blue-50 text-blue-700 border-blue-200',
  awaiting_payment_confirmation: 'bg-violet-50 text-violet-700 border-violet-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  expired: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

const STATUS_LABELS: Record<string, { en: string, ru: string }> = {
  pending: { en: 'Pending', ru: 'Ожидает' },
  confirmed_booking: { en: 'Confirmed booking', ru: 'Бронирование подтверждено' },
  awaiting_payment_confirmation: { en: 'Awaiting payment proof', ru: 'Ожидает оплату' },
  confirmed: { en: 'Confirmed', ru: 'Подтверждено' },
  cancelled: { en: 'Cancelled', ru: 'Отменено' },
  expired: { en: 'Expired', ru: 'Истекло' },
}

function bookingCode(id: string, code?: string | null) {
  return `CC-${(code || id.slice(0, 8)).toUpperCase()}`
}

function displayDoc(value: string | null) {
  if (!value) return null
  return value.startsWith('/api/') ? value : `/api/telegram/file/${encodeURIComponent(value)}`
}

function pendingUntil(createdAt: string, holdExpiresAt?: string | null) {
  return new Date(holdExpiresAt || new Date(new Date(createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString())
}

function normalizeDay(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseBookingDay(value: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export default function BookingsPage() {
  const { locale, t } = useAdminLanguage()
  const [bookings, setBookings] = useState<TelegramBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await fetch('/api/admin/telegram/bookings', { cache: 'no-store' })
    const payload = await response.json()

    if (!response.ok) {
      setBookings([])
      setError(payload.error || 'Failed to load Telegram bookings')
      setLoading(false)
      return
    }

    const normalized = (((payload.bookings as TelegramBooking[] | undefined) ?? [])).map((booking) => ({
      ...booking,
      status: booking.status === 'pre_confirmation' ? 'pending' : booking.status,
    }))
    setBookings(normalized)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (booking: TelegramBooking, status: string) => {
    setUpdatingId(booking.id)
    setError(null)
    const response = await fetch(`/api/admin/telegram/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to update booking')
      setUpdatingId(null)
      return
    }

    setBookings((items) => items.map((item) => item.id === booking.id
      ? { ...item, ...(payload.booking as TelegramBooking), status }
      : item))
    setUpdatingId(null)
  }

  const deleteAllBookings = async () => {
    setDeletingAll(true)
    setError(null)
    const response = await fetch('/api/admin/telegram/bookings', { method: 'DELETE' })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to delete Telegram bookings')
      setDeletingAll(false)
      return
    }

    setBookings([])
    setExpandedId(null)
    setConfirmDeleteAll(false)
    setDeletingAll(false)
  }

  const counts = useMemo(() => ({
    pending: bookings.filter((booking) => booking.status === 'pending').length,
    confirmed_booking: bookings.filter((booking) => booking.status === 'confirmed_booking').length,
    awaiting_payment_confirmation: bookings.filter((booking) => booking.status === 'awaiting_payment_confirmation').length,
    confirmed: bookings.filter((booking) => booking.status === 'confirmed').length,
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    expired: bookings.filter((booking) => booking.status === 'expired').length,
  }), [bookings])

  const filtered = filterStatus === 'all' ? bookings : bookings.filter((booking) => booking.status === filterStatus)
  const statusLabel = (status: string) => STATUS_LABELS[status]?.[locale] ?? status.replace(/_/g, ' ')
  const canConfirm = (booking: TelegramBooking) => !['confirmed', 'cancelled', 'expired'].includes(booking.status)
  const activeCalendarBookings = useMemo(() => bookings.filter((booking) => (
    booking.start_date
    && booking.end_date
    && !['cancelled', 'expired'].includes(booking.status)
  )), [bookings])

  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const startOffset = (first.getDay() + 6) % 7
    const gridStart = addDays(first, -startOffset)

    return Array.from({ length: 42 }, (_, index) => {
      const day = addDays(gridStart, index)
      const dayKey = normalizeDay(day)
      const dayBookings = activeCalendarBookings.filter((booking) => {
        const start = parseBookingDay(booking.start_date)
        const end = parseBookingDay(booking.end_date)
        if (!start || !end) return false
        return day >= start && day <= end
      })

      return {
        date: day,
        key: dayKey,
        inMonth: day.getMonth() === calendarMonth.getMonth(),
        bookings: dayBookings,
      }
    })
  }, [activeCalendarBookings, calendarMonth])

  const monthLabel = calendarMonth.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-ZA', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-light text-neutral-900">{t('Bookings', 'Бронирования')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('Review documents and confirm bookings from the Telegram flow.', 'Проверяйте документы и подтверждайте бронирования из Telegram.')}</p>
        </div>
        <div className="flex items-center gap-2">
          {confirmDeleteAll ? (
            <>
              <button
                onClick={() => setConfirmDeleteAll(false)}
                disabled={deletingAll}
                className="rounded-full border border-black/[0.08] bg-white px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                {t('Keep bookings', 'Оставить бронирования')}
              </button>
              <button
                onClick={deleteAllBookings}
                disabled={deletingAll}
                className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingAll ? t('Deleting...', 'Удаление...') : t('Delete all bookings', 'Удалить все бронирования')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              disabled={loading || bookings.length === 0}
              className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              {t('Delete all bookings', 'Удалить все бронирования')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('Pending', 'Ожидает'), value: counts.pending },
          { label: t('Confirmed booking', 'Бронирование подтверждено'), value: counts.confirmed_booking },
          { label: t('Awaiting payment proof', 'Ожидает оплату'), value: counts.awaiting_payment_confirmation },
          { label: t('Confirmed', 'Подтверждено'), value: counts.confirmed },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-4 border border-black/[0.06]">
            <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-400">{card.label}</div>
            <div className="mt-1.5 text-xl font-light tabular-nums text-neutral-900">{loading ? '—' : card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-neutral-900">{t('Booking calendar', 'Календарь бронирований')}</h2>
            <p className="mt-1 text-sm text-neutral-500">{t('All active Telegram bookings and confirmed holds by day.', 'Все активные бронирования Telegram и подтвержденные резервы по дням.')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-full border border-black/[0.08] px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              aria-label={t('Previous month', 'Предыдущий месяц')}
            >
              ‹
            </button>
            <div className="min-w-40 text-center text-sm font-medium capitalize text-neutral-900">{monthLabel}</div>
            <button
              onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-full border border-black/[0.08] px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              aria-label={t('Next month', 'Следующий месяц')}
            >
              ›
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 border-l border-t border-black/[0.06] text-xs">
            {(locale === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((day) => (
              <div key={day} className="border-b border-r border-black/[0.06] bg-neutral-50 px-2 py-2 text-center font-medium text-neutral-500">
                {day}
              </div>
            ))}
            {calendarDays.map((day) => (
              <div
                key={day.key}
                className={`min-h-28 border-b border-r border-black/[0.06] p-2 ${day.inMonth ? 'bg-white' : 'bg-neutral-50/60 text-neutral-300'}`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={`text-xs tabular-nums ${day.inMonth ? 'text-neutral-700' : 'text-neutral-300'}`}>{day.date.getDate()}</span>
                  {day.bookings.length > 0 && (
                    <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">{day.bookings.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {day.bookings.slice(0, 3).map((booking) => (
                    <button
                      key={booking.id}
                      onClick={() => {
                        setExpandedId(booking.id)
                        setFilterStatus('all')
                      }}
                      className={`block w-full truncate rounded-md px-2 py-1 text-left text-[11px] font-medium ${
                        booking.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : booking.status === 'awaiting_payment_confirmation'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                      title={`${booking.vehicle_name || t('No vehicle yet', 'Авто не выбрано')} · ${booking.telegram_customers?.full_name || booking.telegram_customers?.telegram_name || t('Unnamed customer', 'Клиент без имени')}`}
                    >
                      {booking.vehicle_name || t('No vehicle yet', 'Авто не выбрано')}
                    </button>
                  ))}
                  {day.bookings.length > 3 && (
                    <div className="text-[11px] text-neutral-400">+{day.bookings.length - 3} {t('more', 'еще')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', ...STATUS_OPTIONS].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-full text-xs capitalize transition-colors border ${
              filterStatus === status
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-500 border-black/[0.08] hover:border-black/20'
            }`}
          >
            {status === 'all' ? `${t('All', 'Все')} (${bookings.length})` : `${statusLabel(status)} (${bookings.filter((booking) => booking.status === status).length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
        {loading ? (
          <div className="py-20 flex items-center justify-center text-neutral-400 text-sm">{t('Loading bookings...', 'Загрузка бронирований...')}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 text-sm">{t('No Telegram bookings in this stage yet.', 'На этом этапе пока нет бронирований Telegram.')}</div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-black/[0.06]">
              {filtered.map((booking) => {
                const holdUntil = pendingUntil(booking.created_at, booking.hold_expires_at)
                const holdExpired = booking.status === 'pending' && holdUntil.getTime() < Date.now()
                const isExpanded = expandedId === booking.id

                return (
                  <div key={booking.id} className="p-4">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                      className="w-full text-left space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 text-sm break-words">{bookingCode(booking.id, booking.booking_code)}</div>
                          <div className="mt-1 text-sm text-neutral-900 break-words">{booking.telegram_customers?.full_name || booking.telegram_customers?.telegram_name || 'Unnamed customer'}</div>
                          <div className="text-xs text-neutral-400 mt-0.5 break-words">{booking.telegram_customers?.phone || booking.chat_id}</div>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] tracking-[0.1em] uppercase font-medium border ${STATUS_STYLES[booking.status] || 'bg-neutral-50 border-black/[0.08] text-neutral-500'}`}>
                          {statusLabel(booking.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="uppercase tracking-widest text-neutral-400 mb-1">Vehicle</div>
                          <div className="text-neutral-700 break-words">{booking.vehicle_name || '—'}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-widest text-neutral-400 mb-1">Dates</div>
                          <div className="text-neutral-700 break-words">{booking.start_date ? `${booking.start_date} → ${booking.end_date}` : '—'}</div>
                        </div>
                      </div>

                      {booking.status === 'pending' && (
                        <div className={`text-[11px] ${holdExpired ? 'text-red-500' : 'text-amber-600'}`}>
                          {t('Hold until', 'Резерв до')} {holdUntil.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-ZA')}
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t border-black/[0.06] pt-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="uppercase tracking-widest text-neutral-400 mb-1">Total</div>
                            <div className="text-neutral-900">{booking.total_amount ? `R ${booking.total_amount.toLocaleString('en-ZA')}` : '—'}</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-widest text-neutral-400 mb-1">Days</div>
                            <div className="text-neutral-900">{booking.total_days || 0} {t('day(s)', 'дн.')}</div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          {displayDoc(booking.id_file_id) ? <a className="block rounded-xl border border-black/[0.08] px-3 py-2 text-neutral-700" href={displayDoc(booking.id_file_id)!} target="_blank">{t('View ID / passport', 'Открыть ID / паспорт')}</a> : <div className="rounded-xl border border-dashed border-black/[0.08] px-3 py-2 text-neutral-300">{t('No ID / passport', 'Нет ID / паспорта')}</div>}
                          {displayDoc(booking.license_file_id) ? <a className="block rounded-xl border border-black/[0.08] px-3 py-2 text-neutral-700" href={displayDoc(booking.license_file_id)!} target="_blank">{t('View license front', 'Открыть лицензию, лицевая сторона')}</a> : <div className="rounded-xl border border-dashed border-black/[0.08] px-3 py-2 text-neutral-300">{t('No license front', 'Нет лицевой стороны лицензии')}</div>}
                          {displayDoc(booking.license_back_file_id ?? null) ? <a className="block rounded-xl border border-black/[0.08] px-3 py-2 text-neutral-700" href={displayDoc(booking.license_back_file_id ?? null)!} target="_blank">{t('View license back', 'Открыть лицензию, обратная сторона')}</a> : <div className="rounded-xl border border-dashed border-black/[0.08] px-3 py-2 text-neutral-300">{t('No license back', 'Нет обратной стороны лицензии')}</div>}
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <button
                            disabled={updatingId === booking.id || !canConfirm(booking)}
                            onClick={() => updateStatus(booking, 'confirmed')}
                            className="px-3 py-3 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-40"
                          >
                            {t('Confirmed', 'Подтверждено')}
                          </button>
                          <button
                            disabled={updatingId === booking.id || booking.status === 'cancelled'}
                            onClick={() => updateStatus(booking, 'cancelled')}
                            className="px-3 py-3 rounded-xl bg-white border border-red-200 text-red-600 text-sm disabled:opacity-40"
                          >
                            {t('Cancel booking', 'Отменить бронирование')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-[10px] tracking-[0.2em] uppercase text-neutral-400">
                    <th className="text-left px-5 py-3 font-normal">{t('Code', 'Код')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Customer', 'Клиент')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Vehicle', 'Авто')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Dates', 'Даты')}</th>
                    <th className="text-left px-5 py-3 font-normal hidden lg:table-cell">{t('Total', 'Итого')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Status', 'Статус')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filtered.map((booking) => {
                    const holdUntil = pendingUntil(booking.created_at, booking.hold_expires_at)
                    const holdExpired = booking.status === 'pending' && holdUntil.getTime() < Date.now()

                    return (
                      <>
                        <tr key={booking.id} className="hover:bg-neutral-50 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}>
                          <td className="px-5 py-4 font-medium text-neutral-900">{bookingCode(booking.id, booking.booking_code)}</td>
                          <td className="px-5 py-4">
                            <div className="font-medium text-neutral-900">{booking.telegram_customers?.full_name || booking.telegram_customers?.telegram_name || 'Unnamed customer'}</div>
                            <div className="text-xs text-neutral-400 mt-0.5">{booking.telegram_customers?.phone || booking.chat_id}</div>
                            {booking.status === 'pending' && (
                              <div className={`text-[11px] mt-1 ${holdExpired ? 'text-red-500' : 'text-amber-600'}`}>
                                {t('Hold until', 'Резерв до')} {holdUntil.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-ZA')}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-neutral-600">{booking.vehicle_name || '—'}</td>
                          <td className="px-5 py-4 text-neutral-500">
                            {booking.start_date ? `${booking.start_date} → ${booking.end_date}` : '—'}
                          </td>
                          <td className="px-5 py-4 hidden lg:table-cell text-neutral-900">{booking.total_amount ? `R ${booking.total_amount.toLocaleString('en-ZA')}` : '—'}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] tracking-[0.1em] uppercase font-medium border ${STATUS_STYLES[booking.status] || 'bg-neutral-50 border-black/[0.08] text-neutral-500'}`}>
                              {statusLabel(booking.status)}
                            </span>
                          </td>
                        </tr>
                        {expandedId === booking.id && (
                          <tr key={`${booking.id}-expanded`} className="bg-neutral-50">
                            <td colSpan={6} className="px-5 py-4">
                              <div className="grid gap-4 md:grid-cols-4 text-sm">
                                <div>
                                  <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{t('Booking code', 'Код бронирования')}</div>
                                  <div className="text-neutral-700">{bookingCode(booking.id, booking.booking_code)}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{t('Rental window', 'Период аренды')}</div>
                                  <div className="text-neutral-700">{booking.start_date || '—'}</div>
                                  <div className="text-xs text-neutral-500">{booking.total_days || 0} {t('day(s)', 'дн.')}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{t('Documents', 'Документы')}</div>
                                  <div className="flex flex-col gap-1">
                                    {displayDoc(booking.id_file_id) ? <a className="text-neutral-700 underline underline-offset-2" href={displayDoc(booking.id_file_id)!} target="_blank">{t('View ID / passport', 'Открыть ID / паспорт')}</a> : <span className="text-neutral-300">{t('No ID / passport', 'Нет ID / паспорта')}</span>}
                                    {displayDoc(booking.license_file_id) ? <a className="text-neutral-700 underline underline-offset-2" href={displayDoc(booking.license_file_id)!} target="_blank">{t('View license front', 'Открыть лицензию, лицевая сторона')}</a> : <span className="text-neutral-300">{t('No license front', 'Нет лицевой стороны лицензии')}</span>}
                                    {displayDoc(booking.license_back_file_id ?? null) ? <a className="text-neutral-700 underline underline-offset-2" href={displayDoc(booking.license_back_file_id ?? null)!} target="_blank">{t('View license back', 'Открыть лицензию, обратная сторона')}</a> : <span className="text-neutral-300">{t('No license back', 'Нет обратной стороны лицензии')}</span>}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{t('Next action', 'Следующее действие')}</div>
                                  <div className="flex flex-col gap-2">
                                    <button
                                      disabled={updatingId === booking.id || !canConfirm(booking)}
                                      onClick={(event) => { event.stopPropagation(); updateStatus(booking, 'confirmed') }}
                                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs disabled:opacity-40"
                                    >
                                      {t('Confirmed', 'Подтверждено')}
                                    </button>
                                    <button
                                      disabled={updatingId === booking.id || booking.status === 'cancelled'}
                                      onClick={(event) => { event.stopPropagation(); updateStatus(booking, 'cancelled') }}
                                      className="px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs disabled:opacity-40"
                                    >
                                      {t('Cancel booking', 'Отменить бронирование')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
