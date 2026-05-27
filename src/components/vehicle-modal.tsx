'use client'

import { useState, useRef, useCallback } from 'react'
import { useAdminLanguage } from '@/app/admin/admin-language'
import type { Vehicle } from '@/lib/fleet'

type ModalProps = {
  vehicle?: Vehicle | null
  onClose: () => void
  onSaved: () => void
}

const CATS = ['Luxury Vehicles', 'Mid Tier Vehicles', 'Large Vehicles'] as const
const BODY_TYPES = ['SUV', 'Sedan', 'Convertible', 'Coupe', 'Hatchback', 'Van', 'Minibus', 'People Mover'] as const
const FUELS = ['Petrol', 'Hybrid', 'Electric', 'Diesel'] as const
const STATUSES = ['Available', 'Booked', 'Service'] as const

const emptyForm = () => ({
  id: '',
  model: '',
  cat: 'Luxury Vehicles' as const,
  power: '',
  seats: 2,
  fuel: 'Petrol' as const,
  rate: 0,
  status: 'Available' as const,
  color: '',
  description: '',
  image_url: null as string | null,
  sort_order: 0,
  telegram_body_type: null as string | null,
})

async function encodeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function VehicleModal({ vehicle, onClose, onSaved }: ModalProps) {
  const { locale, t } = useAdminLanguage()
  const isEdit = !!vehicle
  const [form, setForm] = useState(vehicle ? { ...vehicle } : emptyForm())
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(vehicle?.image_url ?? null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: string | number | null) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = e => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const save = async () => {
    if (!form.model.trim()) { setError('Model name is required'); return }
    setSaving(true)
    setError(null)

    try {
      let image_url = form.image_url

      if (imageFile) {
        image_url = await encodeImage(imageFile)
      }

      const payload = {
        model: form.model.trim(),
        cat: form.cat,
        power: form.power,
        seats: Number(form.seats),
        fuel: form.fuel,
        rate: Number(form.rate),
        status: form.status,
        color: form.color,
        description: form.description,
        image_url,
        sort_order: Number(form.sort_order) || 0,
        telegram_body_type: form.telegram_body_type || null,
      }

      if (isEdit && vehicle?.id) {
        const response = await fetch(`/api/admin/fleet/${vehicle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to save vehicle')
      } else {
        const response = await fetch('/api/admin/fleet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to add vehicle')
      }

      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const deleteVehicle = async () => {
    if (!vehicle?.id) return
    setDeleting(true)
    const response = await fetch(`/api/admin/fleet/${vehicle.id}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) { setError(result.error || 'Failed to delete vehicle'); setDeleting(false); return }
    onSaved()
  }

  const categoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'Luxury Vehicles': 'Люксовые авто',
      'Mid Tier Vehicles': 'Средний класс',
      'Large Vehicles': 'Большие авто',
    }
    return locale === 'ru' ? labels[category] ?? category : category
  }

  const bodyTypeLabel = (bodyType: string) => {
    const labels: Record<string, string> = {
      SUV: 'Внедорожник',
      Sedan: 'Седан',
      Convertible: 'Кабриолет',
      Coupe: 'Купе',
      Hatchback: 'Хэтчбек',
      Van: 'Фургон',
      Minibus: 'Микроавтобус',
      'People Mover': 'Минивэн',
    }
    return locale === 'ru' ? labels[bodyType] ?? bodyType : bodyType
  }

  const fuelLabel = (fuel: string) => {
    const labels: Record<string, string> = {
      Petrol: 'Бензин',
      Hybrid: 'Гибрид',
      Electric: 'Электро',
      Diesel: 'Дизель',
    }
    return locale === 'ru' ? labels[fuel] ?? fuel : fuel
  }

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      Available: 'Доступен',
      Booked: 'Забронирован',
      Service: 'Сервис',
    }
    return locale === 'ru' ? labels[status] ?? status : status
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-black/[0.06] px-7 py-5 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-lg font-medium text-neutral-900">{isEdit ? t('Edit vehicle', 'Редактировать авто') : t('Add vehicle', 'Добавить авто')}</h2>
            <p className="text-xs text-neutral-400 mt-0.5">{isEdit ? vehicle.model : t('New listing', 'Новая запись')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors flex items-center justify-center text-neutral-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-7 py-6 space-y-6">
          {/* Image upload */}
          <div>
            <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-2">{t('Vehicle image', 'Фото авто')}</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden ${
                dragging ? 'border-neutral-400 bg-neutral-50' : 'border-black/[0.1] hover:border-black/20 bg-neutral-50/50'
              }`}
            >
              {imagePreview ? (
                <div className="relative aspect-[16/7]">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full">{t('Change image', 'Изменить фото')}</span>
                  </div>
                </div>
              ) : (
                <div className="aspect-[16/7] flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
                  <div className="text-sm">{t('Drop image here or', 'Перетащите фото сюда или')} <span className="text-neutral-900 underline underline-offset-2">{t('browse', 'выберите')}</span></div>
                  <div className="text-xs text-neutral-400">JPG, PNG, WEBP</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          {/* Model + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Model *', 'Модель *')}</label>
              <input
                value={form.model}
                onChange={e => set('model', e.target.value)}
                placeholder={t('e.g. Porsche 911 GT3', 'например Porsche 911 GT3')}
                className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Color', 'Цвет')}</label>
              <input
                value={form.color}
                onChange={e => set('color', e.target.value)}
                placeholder={t('e.g. Shark Blue', 'например синий')}
                className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 bg-white"
              />
            </div>
          </div>

          {/* Category + Body type + Fuel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Category', 'Категория')}</label>
              <select value={form.cat} onChange={e => set('cat', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 bg-white">
                {CATS.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Body type', 'Тип кузова')}</label>
              <select value={form.telegram_body_type ?? ''} onChange={e => set('telegram_body_type', e.target.value || null)} className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 bg-white">
                <option value="">{t('Auto-detect', 'Автоопределение')}</option>
                {BODY_TYPES.map(bodyType => <option key={bodyType} value={bodyType}>{bodyTypeLabel(bodyType)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Fuel', 'Топливо')}</label>
              <select value={form.fuel} onChange={e => set('fuel', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 bg-white">
                {FUELS.map(f => <option key={f} value={f}>{fuelLabel(f)}</option>)}
              </select>
            </div>
          </div>

          {/* Power + Seats + Rate */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Power', 'Мощность')}</label>
              <input value={form.power} onChange={e => set('power', e.target.value)} placeholder="502 hp" className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 bg-white" />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Seats', 'Места')}</label>
              <input type="number" value={form.seats} onChange={e => set('seats', e.target.value)} min={1} max={9} className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 bg-white" />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Rate / day (R)', 'Цена / день (R)')}</label>
              <input type="number" value={form.rate} onChange={e => set('rate', e.target.value)} min={0} className="w-full px-4 py-2.5 rounded-xl border border-black/[0.1] text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 bg-white" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Status', 'Статус')}</label>
            <div className="flex gap-2">
              {STATUSES.map(s => (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    form.status === s
                      ? s === 'Available' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : s === 'Booked' ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-neutral-50 border-black/[0.08] text-neutral-500 hover:bg-neutral-100'
                  }`}
                >{statusLabel(s)}</button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1.5">{t('Description', 'Описание')}</label>
            <textarea
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              placeholder={t('Describe the vehicle, driving experience, features, what makes it special...', 'Опишите авто, впечатления от вождения, особенности и преимущества...')}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-black/[0.1] text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 bg-white resize-none"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 break-words">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-black/[0.06] px-7 py-5 flex items-center justify-between rounded-b-3xl">
          <div>
            {isEdit && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-400 hover:text-red-600 transition-colors">
                {t('Delete vehicle', 'Удалить авто')}
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-500">{t('Sure?', 'Уверены?')}</span>
                <button onClick={deleteVehicle} disabled={deleting} className="text-sm text-red-500 font-medium hover:text-red-700">
                  {deleting ? t('Deleting…', 'Удаление…') : t('Yes, delete', 'Да, удалить')}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-sm text-neutral-400 hover:text-neutral-700">{t('Cancel', 'Отмена')}</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-black/[0.1] text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
              {t('Cancel', 'Отмена')}
            </button>
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-full bg-neutral-900 text-white text-sm hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px] text-center"
            >
              {saving ? t('Saving…', 'Сохранение…') : isEdit ? t('Save changes', 'Сохранить') : t('Add vehicle', 'Добавить авто')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
