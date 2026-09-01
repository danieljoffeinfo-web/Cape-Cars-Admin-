'use client'

import { useState, useEffect, useCallback } from 'react'
import VehicleModal from '@/components/vehicle-modal'
import { useAdminLanguage } from '@/app/admin/admin-language'
import type { Vehicle, VehicleCategory } from '@/lib/fleet'
import { getTelegramSegment, type TelegramSegment } from '@/lib/telegram-catalog'

type BlockedRange = {
  startDate: string
  endDate: string
  source: 'telegram' | 'rental'
  status: string
}

type FleetVehicle = Vehicle & {
  blockedRanges?: BlockedRange[]
  isBlocked?: boolean
}

const statusColor: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700',
  Booked:    'bg-amber-100 text-amber-700',
  Service:   'bg-red-100 text-red-600',
}

const STATUSES = ['Available', 'Booked', 'Service'] as const
type VehicleStatus = typeof STATUSES[number]

const SEGMENT_FILTERS: Array<{ key: 'all' | TelegramSegment; en: string; ru: string }> = [
  { key: 'all', en: 'All vehicles', ru: 'Все авто' },
  { key: 'luxury', en: 'Luxury', ru: 'Люкс' },
  { key: 'mid', en: 'Mid Tier', ru: 'Средний класс' },
  { key: 'economy', en: 'Economy', ru: 'Эконом' },
]

const CATEGORY_FILTERS: Array<{ key: 'all' | VehicleCategory; en: string; ru: string }> = [
  { key: 'all', en: 'All categories', ru: 'Все категории' },
  { key: 'Luxury Vehicles', en: 'Luxury Vehicles', ru: 'Люксовые авто' },
  { key: 'Mid Tier Vehicles', en: 'Mid Tier Vehicles', ru: 'Средний класс' },
  { key: 'Economy Vehicles', en: 'Economy Vehicles', ru: 'Эконом' },
  { key: 'Large Vehicles', en: 'Large Vehicles', ru: 'Большие авто' },
]

export default function FleetAdmin() {
  const { locale, t } = useAdminLanguage()
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<'add' | Vehicle | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [confirmDeleteBookings, setConfirmDeleteBookings] = useState(false)
  const [deletingBookings, setDeletingBookings] = useState(false)
  const [bookingCleanupStatus, setBookingCleanupStatus] = useState<string | null>(null)
  const [segmentFilter, setSegmentFilter] = useState<'all' | TelegramSegment>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | VehicleCategory>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await fetch('/api/admin/fleet', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      setVehicles([])
      setError(payload.error || 'Failed to load fleet availability')
      setLoading(false)
      return
    }
    setVehicles((payload.vehicles as FleetVehicle[] | undefined) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const effectiveStatus = (car: FleetVehicle): VehicleStatus => {
    if (car.status === 'Service') return 'Service'
    if (car.status === 'Booked' || car.isBlocked) return 'Booked'
    return 'Available'
  }

  const updateStatus = async (id: string, status: VehicleStatus) => {
    setUpdatingStatus(id)
    setError(null)
    const response = await fetch(`/api/admin/fleet/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to update vehicle status')
      setUpdatingStatus(null)
      return
    }

    await load()
    setUpdatingStatus(null)
  }

  const deleteAllBookings = async () => {
    setDeletingBookings(true)
    setBookingCleanupStatus(null)
    const response = await fetch('/api/admin/telegram/bookings', { method: 'DELETE' })
    const payload = await response.json()

    setDeletingBookings(false)
    if (!response.ok) {
      setBookingCleanupStatus(payload.error || 'Could not delete Telegram bookings.')
      return
    }

    setConfirmDeleteBookings(false)
    setBookingCleanupStatus('All bookings and date holds have been deleted.')
    await load()
  }

  const vehicleSegment = (car: FleetVehicle): TelegramSegment => getTelegramSegment(car.model, car.cat)

  const filteredVehicles = vehicles.filter((car) => {
    const matchesSegment = segmentFilter === 'all' || vehicleSegment(car) === segmentFilter
    const matchesCategory = categoryFilter === 'all' || car.cat === categoryFilter
    return matchesSegment && matchesCategory
  })

  const available = filteredVehicles.filter(c => effectiveStatus(c) === 'Available').length
  const booked    = filteredVehicles.filter(c => effectiveStatus(c) === 'Booked').length
  const service   = filteredVehicles.filter(c => effectiveStatus(c) === 'Service').length

  const formatRange = (range: BlockedRange) => {
    if (range.startDate === range.endDate) return range.startDate
    return `${range.startDate} → ${range.endDate}`
  }

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      Available: 'Доступно',
      Booked: 'Забронировано',
      Service: 'Сервис',
      Total: 'Всего',
    }
    return locale === 'ru' ? labels[status] ?? status : status
  }

  const bodyTypeLabel = (bodyType: string | null | undefined) => {
    if (!bodyType) return t('Body type: auto', 'Тип кузова: авто')
    const labels: Record<string, string> = {
      SUV: 'Внедорожник',
      Sedan: 'Седан',
      Convertible: 'Кабриолет',
      Coupe: 'Купе',
      Van: 'Фургон / микроавтобус',
      Hatchback: 'Хэтчбек',
      Minibus: 'Микроавтобус',
      'People Mover': 'Минивэн',
    }
    return locale === 'ru' ? labels[bodyType] ?? bodyType : bodyType
  }

  return (
    <>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-light text-neutral-900">{t('Fleet Catalogue', 'Каталог автопарка')}</h1>
            <p className="mt-1 text-sm text-neutral-500">{t('Vehicle listings, specs, pricing, and availability', 'Автомобили, характеристики, цены и доступность')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {confirmDeleteBookings ? (
              <>
                <button
                  onClick={() => setConfirmDeleteBookings(false)}
                  disabled={deletingBookings}
                  className="rounded-full border border-black/[0.08] bg-white px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {t('Keep bookings', 'Оставить бронирования')}
                </button>
                <button
                  onClick={deleteAllBookings}
                  disabled={deletingBookings}
                  className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingBookings ? t('Deleting...', 'Удаление...') : t('Delete all bookings', 'Удалить все бронирования')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDeleteBookings(true)}
                className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                {t('Delete all bookings', 'Удалить все бронирования')}
              </button>
            )}
            <button
              onClick={() => setModal('add')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-900 text-white text-sm hover:bg-neutral-800 transition-colors"
            >
              + {t('Add vehicle', 'Добавить авто')}
            </button>
          </div>
        </div>

        {bookingCleanupStatus && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${bookingCleanupStatus.startsWith('All') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {bookingCleanupStatus}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {SEGMENT_FILTERS.map((filter) => {
            const active = segmentFilter === filter.key
            return (
              <button
                key={filter.key}
                onClick={() => setSegmentFilter(filter.key)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-black/[0.08] bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
              >
                {locale === 'ru' ? filter.ru : filter.en}
              </button>
            )
          })}
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as 'all' | VehicleCategory)}
            className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            aria-label={t('Filter by category', 'Фильтр по категории')}
          >
            {CATEGORY_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {locale === 'ru' ? filter.ru : filter.en}
              </option>
            ))}
          </select>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Available', count: available, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Booked',    count: booked,    cls: 'bg-amber-50 text-amber-700 border-amber-200'   },
            { label: 'Service',   count: service,   cls: 'bg-red-50 text-red-600 border-red-200'         },
            { label: 'Total',     count: filteredVehicles.length, cls: 'bg-neutral-100 text-neutral-700 border-neutral-200' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm ${s.cls}`}>
              <span className="tabular-nums font-medium">{s.count}</span>
              <span className="text-xs uppercase tracking-wide">{statusLabel(s.label)}</span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
          {loading ? (
            <div className="py-20 flex items-center justify-center text-neutral-400 text-sm">
              <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              {t('Loading fleet…', 'Загрузка автопарка…')}
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="py-20 text-center text-neutral-400 text-sm">
              {t('No vehicles yet.', 'Автомобилей пока нет.')}{' '}
              <button onClick={() => setModal('add')} className="text-neutral-900 underline underline-offset-2">{t('Add your first vehicle.', 'Добавить первый автомобиль.')}</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-[10px] tracking-[0.2em] uppercase text-neutral-400">
                    <th className="text-left px-5 py-3 font-normal">{t('Image', 'Фото')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Model', 'Модель')}</th>
                    <th className="text-left px-5 py-3 font-normal hidden sm:table-cell">{t('Category', 'Категория')}</th>
                    <th className="text-left px-5 py-3 font-normal hidden md:table-cell">{t('Specs', 'Характеристики')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Rate / day', 'Цена / день')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Booked dates', 'Даты брони')}</th>
                    <th className="text-left px-5 py-3 font-normal">{t('Status', 'Статус')}</th>
                    <th className="text-right px-5 py-3 font-normal">{t('Actions', 'Действия')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredVehicles.map(car => (
                    <tr key={car.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-3">
                        {car.image_url ? (
                          <img src={car.image_url} alt={car.model} className="w-12 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-lg">🚗</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-neutral-900">{car.model}</div>
                        <div className="text-xs text-neutral-400 mt-0.5">{car.color}</div>
                      </td>
                      <td className="px-5 py-4 text-neutral-500 hidden sm:table-cell">
                        <div>{car.cat}</div>
                        <div className="mt-1 text-xs text-neutral-400">{bodyTypeLabel(car.telegram_body_type)}</div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                          <span>{car.power}</span>
                          <span>·</span>
                          <span>{car.seats} {t('seats', 'мест')}</span>
                          <span>·</span>
                          <span>{car.fuel}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 tabular-nums text-neutral-900">R {car.rate.toLocaleString()}</td>
                      <td className="px-5 py-4 min-w-48">
                        {car.blockedRanges?.length ? (
                          <div className="flex flex-col gap-1.5">
                            {car.blockedRanges.slice(0, 2).map((range, index) => (
                              <span key={`${range.startDate}-${range.endDate}-${index}`} className="w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                {formatRange(range)}
                              </span>
                            ))}
                            {car.blockedRanges.length > 2 && (
                          <span className="text-[11px] text-neutral-400">+{car.blockedRanges.length - 2} {t('more', 'ещё')}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-300">{t('No bookings', 'Нет бронирований')}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={effectiveStatus(car)}
                          disabled={updatingStatus === car.id}
                          onChange={e => updateStatus(car.id, e.target.value as VehicleStatus)}
                          className={`px-2.5 py-1 rounded-full text-[10px] tracking-[0.15em] uppercase font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-300 ${statusColor[effectiveStatus(car)]} ${updatingStatus === car.id ? 'opacity-50' : ''}`}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setModal(car)}
                          className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                        >
                          {t('Edit', 'Изменить')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-5 py-4 text-sm text-blue-700">
          💡 <strong>{t('Tip:', 'Совет:')}</strong> {t('Vehicles in Service status are automatically hidden from the public fleet page. Update status here to control live availability instantly.', 'Автомобили со статусом «Сервис» автоматически скрываются с публичной страницы. Обновляйте статус здесь, чтобы сразу управлять доступностью.')}
        </div>
      </div>

      {modal !== null && (
        <VehicleModal
          vehicle={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}
