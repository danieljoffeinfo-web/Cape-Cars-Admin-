'use client'

import { useState } from 'react'
import { Icon } from './icon'
import { createBooking } from '@/app/contact/actions'

const FLEET_MODELS = [
  'Porsche 911 GT3', 'McLaren 720S', 'Aston Martin DB12', 'Ferrari 296 GTB',
  'Lamborghini Huracán STO', 'Porsche Taycan Turbo S', 'BMW M4 CSL',
  'Mercedes-AMG GT Black', 'Porsche Cayman GT4 RS', 'Audi R8 V10', 'Lotus Emira V6',
]

const inputCls =
  'w-full bg-neutral-50 border border-black/[0.08] rounded-xl px-4 py-3 text-neutral-900 ' +
  'placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors'

export default function BookingForm({ defaultSent }: { defaultSent?: boolean }) {
  const [sent, setSent] = useState(defaultSent ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', car: '', date: '', notes: '', type: 'Afternoon',
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      const result = await createBooking(fd)
      if (!result.ok) {
        setError(result.error || 'We could not submit your request right now.')
        return
      }

      setSent(true)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'We could not submit your request right now.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-20">
        <div className="w-14 h-14 rounded-full bg-neutral-900 text-white grid place-items-center mb-6">
          <Icon.check width={22} height={22} />
        </div>
        <h3 className="text-3xl font-light text-neutral-900">Request received.</h3>
        <p className="mt-3 text-neutral-600 max-w-md">
          We&apos;ll confirm your slot and walk you through check-in within the hour. Keep an eye on your inbox.
        </p>
        <button
          onClick={() => { setSent(false); setForm({ name:'',email:'',phone:'',car:'',date:'',notes:'',type:'Afternoon' }) }}
          className="mt-8 px-5 py-2.5 rounded-full border border-black/15 text-sm hover:bg-neutral-100 text-neutral-900"
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Type toggle */}
      <div>
        <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-3">Booking type</div>
        <div className="flex flex-wrap gap-2">
          {['Afternoon', 'Members', 'Concierge', 'Event / Film'].map(t => (
            <button
              type="button"
              key={t}
              onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`px-4 py-2 rounded-full text-sm transition-colors border ${
                form.type === t
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'border-black/15 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="block">
          <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-2">Name</div>
          <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Alex Porter" />
        </label>
        <label className="block">
          <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-2">Email</div>
          <input required type="email" value={form.email} onChange={set('email')} className={inputCls} placeholder="alex@domain.com" />
        </label>
        <label className="block">
          <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-2">Phone</div>
          <input value={form.phone} onChange={set('phone')} className={inputCls} placeholder="+27 82 555 0199" />
        </label>
        <label className="block">
          <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-2">Preferred date</div>
          <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
        </label>
      </div>

      <label className="block">
        <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-2">Car of interest</div>
        <select value={form.car} onChange={set('car')} className={inputCls}>
          <option value="">No preference</option>
          {FLEET_MODELS.map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="mt-1.5 text-xs text-neutral-500">Leave blank for &apos;whatever&apos;s ready&apos;.</div>
      </label>

      <label className="block">
        <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-2">Anything we should know?</div>
        <textarea rows={4} value={form.notes} onChange={set('notes')} className={inputCls} placeholder="Route ideas, track experience, guest count…" />
      </label>

      <div className="flex items-center justify-between pt-4 border-t border-black/[0.08]">
        <div className="text-xs text-neutral-500">By submitting, you agree to our driver terms.</div>
        <button
          type="submit"
          disabled={loading}
          className="group inline-flex items-center gap-2 pl-5 pr-1 py-1 rounded-full bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors disabled:opacity-60"
        >
          {loading ? 'Sending…' : 'Send request'}
          <span className="w-9 h-9 rounded-full bg-white text-neutral-900 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <Icon.arrow width={13} height={13} />
          </span>
        </button>
      </div>
    </form>
  )
}
