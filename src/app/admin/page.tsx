'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAdminLanguage } from './admin-language'

type DashboardMetrics = {
  totalVehicles: number
  availableVehicles: number
  bookedVehicles: number
  serviceVehicles: number
  totalCustomers: number
  activeRentals: number
  pendingBookings: number
  confirmedBookings: number
  telegramLeads: number
  awaitingPayment: number
  revenueMtd: number
}

type TelegramLead = {
  id: string
  full_name: string | null
  telegram_name: string | null
  phone: string | null
  updated_at: string
}

const QUICK_ACTIONS = [
  {
    href: '/admin/telegram',
    title: 'Telegram inbox',
    description: 'Open the live booking chats, customer profiles, and uploaded documents.',
    icon: '✈️',
  },
  {
    href: '/admin/fleet',
    title: 'Vehicles',
    description: 'Change prices, swap photos, or mark a car unavailable in a few taps.',
    icon: '🚘',
  },
  {
    href: '/admin/rentals',
    title: 'Calendar + rentals',
    description: 'See what is booked out and block cars for maintenance or private use.',
    icon: '📅',
  },
]

export default function AdminDashboard() {
  const supabase = createClient()
  const { t } = useAdminLanguage()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalVehicles: 0,
    availableVehicles: 0,
    bookedVehicles: 0,
    serviceVehicles: 0,
    totalCustomers: 0,
    activeRentals: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    telegramLeads: 0,
    awaitingPayment: 0,
    revenueMtd: 0,
  })
  const [latestTelegramLeads, setLatestTelegramLeads] = useState<TelegramLead[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [vehiclesRes, customersRes, rentalsRes, invoicesRes, bookingsRes, telegramSummaryRes] = await Promise.all([
        supabase.from('vehicles').select('status'),
        supabase.from('customers').select('id'),
        supabase.from('rentals').select('status'),
        supabase.from('invoices').select('status,total_amount,created_at'),
        supabase.from('bookings').select('status'),
        fetch('/api/admin/telegram/summary', { cache: 'no-store' }),
      ])

      const vehicles = vehiclesRes.data ?? []
      const customers = customersRes.data ?? []
      const rentals = rentalsRes.data ?? []
      const invoices = invoicesRes.data ?? []
      const bookings = bookingsRes.data ?? []
      const telegramSummary = telegramSummaryRes.ok
        ? await telegramSummaryRes.json()
        : { latestTelegramLeads: [], telegramLeadCount: 0, awaitingPayment: 0 }
      const telegramCustomers = (telegramSummary.latestTelegramLeads as TelegramLead[] | undefined) ?? []

      const revenueMtd = invoices
        .filter((invoice: any) => invoice.status === 'paid' && invoice.created_at >= monthStart)
        .reduce((sum: number, invoice: any) => sum + (invoice.total_amount ?? 0), 0)

      setMetrics({
        totalVehicles: vehicles.length,
        availableVehicles: vehicles.filter((item: any) => item.status === 'Available').length,
        bookedVehicles: vehicles.filter((item: any) => item.status === 'Booked').length,
        serviceVehicles: vehicles.filter((item: any) => item.status === 'Service').length,
        totalCustomers: customers.length,
        activeRentals: rentals.filter((item: any) => item.status === 'active').length,
        pendingBookings: bookings.filter((item: any) => item.status === 'new').length,
        confirmedBookings: bookings.filter((item: any) => item.status === 'confirmed').length,
        telegramLeads: telegramSummary.telegramLeadCount ?? 0,
        awaitingPayment: telegramSummary.awaitingPayment ?? 0,
        revenueMtd,
      })

      setLatestTelegramLeads(telegramCustomers)
      setLoading(false)
    }

    load()
  }, [supabase])

  const money = (value: number) => `R ${value.toLocaleString('en-ZA')}`

  return (
    <div className="space-y-8 max-w-7xl">
      <section className="rounded-[28px] bg-[#0f1115] px-6 py-6 text-white md:px-8 md:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-white/45">Cape Cars admin</div>
            <h1 className="mt-3 text-3xl font-light tracking-tight md:text-4xl">{t('Simple control room for bookings, cars, and customer handover.', 'Простая панель для бронирований, автомобилей и передачи клиенту.')}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65 md:text-[15px]">
              {t('This is the client-facing control panel: check new Telegram leads, update vehicle availability, and move bookings through to payment confirmation.', 'Панель для клиента: проверяйте новые лиды из Telegram, обновляйте доступность авто и проводите бронирования до подтверждения оплаты.')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">{t('Revenue MTD', 'Выручка за месяц')}</div>
              <div className="mt-2 text-2xl font-light">{loading ? '—' : money(metrics.revenueMtd)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">{t('Awaiting payment', 'Ожидает оплату')}</div>
              <div className="mt-2 text-2xl font-light">{loading ? '—' : metrics.awaitingPayment}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Available cars', value: metrics.availableVehicles, detail: `${metrics.totalVehicles} total in fleet` },
          { label: 'Cars booked out', value: metrics.bookedVehicles, detail: `${metrics.serviceVehicles} in service` },
          { label: 'Open booking requests', value: metrics.pendingBookings, detail: `${metrics.confirmedBookings} confirmed` },
          { label: 'Telegram leads', value: metrics.telegramLeads, detail: `${metrics.awaitingPayment} waiting for payment` },
        ].map((card) => (
          <div key={card.label} className="rounded-3xl border border-black/[0.06] bg-white p-5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">{card.label}</div>
            <div className="mt-2 text-3xl font-light text-neutral-900">{loading ? '—' : card.value}</div>
            <div className="mt-2 text-sm text-neutral-500">{card.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr,0.9fr]">
        <div className="rounded-3xl border border-black/[0.06] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Quick actions</div>
              <h2 className="mt-2 text-xl font-light text-neutral-900">What the client will actually use most</h2>
            </div>
            <Link href="/admin/telegram" className="text-sm text-neutral-500 hover:text-neutral-900">
              Open Telegram inbox →
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href} className="rounded-2xl bg-neutral-50 p-5 transition hover:bg-neutral-100">
                <div className="text-2xl">{action.icon}</div>
                <div className="mt-4 text-base font-medium text-neutral-900">{action.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-neutral-500">{action.description}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-black/[0.06] bg-white p-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Operations snapshot</div>
          <div className="mt-4 space-y-4">
            {[
              { label: 'Customers in CRM', value: metrics.totalCustomers },
              { label: 'Active rentals right now', value: metrics.activeRentals },
              { label: 'Fleet currently available', value: metrics.availableVehicles },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-neutral-50 px-4 py-3">
                <div className="text-sm text-neutral-500">{item.label}</div>
                <div className="mt-1 text-2xl font-light text-neutral-900">{loading ? '—' : item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-3xl border border-black/[0.06] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Telegram leads</div>
              <h2 className="mt-2 text-xl font-light text-neutral-900">Latest customer profiles</h2>
            </div>
            <Link href="/admin/telegram" className="text-sm text-neutral-500 hover:text-neutral-900">
              View all →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {latestTelegramLeads.length === 0 ? (
              <div className="rounded-2xl bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
                No Telegram leads saved yet. Once customers chat to the bot, they will appear here automatically.
              </div>
            ) : latestTelegramLeads.map((lead) => (
              <div key={lead.id} className="rounded-2xl bg-neutral-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-neutral-900">{lead.full_name || lead.telegram_name || 'Unnamed customer'}</div>
                    <div className="mt-1 text-sm text-neutral-500">{lead.phone || 'Phone not captured yet'}</div>
                  </div>
                  <div className="text-xs text-neutral-400">{new Date(lead.updated_at).toLocaleDateString('en-ZA')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-black/[0.06] bg-white p-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Suggested flow</div>
          <h2 className="mt-2 text-xl font-light text-neutral-900">How the client should use this dashboard</h2>
          <div className="mt-5 space-y-3">
            {[
              '1. Open Telegram to see new booking requests and customer documents.',
              '2. Check Vehicles to confirm the correct car and daily rate are live.',
              '3. Use Rentals to block out dates once payment is confirmed.',
              '4. Keep CRM updated so repeat customers are fast to process.',
            ].map((line) => (
              <div key={line} className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{line}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
