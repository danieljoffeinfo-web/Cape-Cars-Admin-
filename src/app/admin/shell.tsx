'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdminLanguageProvider, useAdminLanguage, type AdminLocale } from './admin-language'

const PIN = '121227'

const NAV = [
  { href: '/admin', label: { en: 'Dashboard', ru: 'Панель' }, icon: '◈' },
  { href: '/admin/fleet', label: { en: 'Fleet', ru: 'Автопарк' }, icon: '🏎' },
  { href: '/admin/crm', label: { en: 'Customers', ru: 'Клиенты' }, icon: '👤' },
  { href: '/admin/bookings', label: { en: 'Bookings', ru: 'Бронирования' }, icon: '📅' },
  { href: '/admin/rentals', label: { en: 'Rentals', ru: 'Аренды' }, icon: '🚗' },
  { href: '/admin/telegram', label: { en: 'Telegram', ru: 'Телеграм' }, icon: '✈️' },
  { href: '/admin/bot-controller', label: { en: 'Bot Controller', ru: 'Бот-контроллер' }, icon: '⌘' },
  { href: '/admin/sales', label: { en: 'Sales', ru: 'Продажи' }, icon: '📈' },
]

function LanguageToggle() {
  const { locale, setLocale } = useAdminLanguage()
  const options: { code: AdminLocale; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
  ]

  return (
    <div className="inline-flex items-center rounded-full border border-black/[0.08] bg-white p-1 text-xs shadow-sm">
      {options.map((option) => (
        <button
          key={option.code}
          onClick={() => setLocale(option.code)}
          className={`rounded-full px-3 py-1 transition-colors ${locale === option.code ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useAdminLanguage()
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const press = (d: string) => {
    if (digits.length >= 6) return
    const next = digits + d
    setDigits(next)
    setError(false)
    if (next.length === 6) {
      if (next === PIN) {
        onUnlock()
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => { setDigits(''); setShake(false) }, 600)
      }
    }
  }

  const del = () => setDigits((d) => d.slice(0, -1))

  return (
    <div className="min-h-screen bg-[#0e0e10] flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-2.5 mb-12">
        <span className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-white/80" />
        </span>
        <span className="text-[13px] tracking-[0.28em] uppercase font-medium text-white/70">Cape Cars</span>
      </div>

      <div className={`flex flex-col items-center transition-transform duration-100 ${shake ? 'translate-x-2' : ''}`} style={shake ? { animation: 'shake 0.5s ease' } : {}}>
        <div className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-6">{t('Admin access', 'Доступ администратора')}</div>

        <div className="flex items-center gap-3 mb-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-150 ${i < digits.length ? (error ? 'bg-red-400' : 'bg-white') : 'bg-white/20'}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 w-64">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
            <button
              key={i}
              onClick={() => (k === '⌫' ? del() : k ? press(k) : undefined)}
              disabled={!k}
              className={`h-16 rounded-2xl text-xl font-light transition-all duration-100 ${!k ? 'invisible' : k === '⌫' ? 'bg-white/5 text-white/40 hover:bg-white/10 active:scale-95' : 'bg-white/8 text-white hover:bg-white/15 active:scale-95 border border-white/[0.06]'}`}
              style={k && k !== '⌫' ? { background: 'rgba(255,255,255,0.05)' } : {}}
            >
              {k}
            </button>
          ))}
        </div>

        {error && <div className="mt-6 text-red-400 text-sm tracking-wide">{t('Incorrect PIN', 'Неверный PIN')}</div>}
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const { locale, t } = useAdminLanguage()
  const [unlocked, setUnlocked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const ok = sessionStorage.getItem('admin_auth')
    if (ok === 'true') setUnlocked(true)
  }, [])

  const unlock = () => {
    sessionStorage.setItem('admin_auth', 'true')
    setUnlocked(true)
  }

  if (!unlocked) return <PinLock onUnlock={unlock} />

  return (
    <div data-admin-shell className="min-h-screen bg-[#f4f1ea] flex">
      <aside
        className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-[#0e0e10] flex flex-col
        transition-transform duration-300 md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <div className="px-6 py-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            </span>
            <span className="text-[11px] tracking-[0.28em] uppercase font-medium text-white/60">Cape Cars Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'}`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label[locale]}
              </Link>
            )
          })}
        </nav>

        <div className="px-6 py-5 border-t border-white/[0.06]">
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              setUnlocked(false)
            }}
            className="text-[11px] tracking-[0.2em] uppercase text-white/30 hover:text-white/60 transition-colors"
          >
            {t('Lock', 'Заблокировать')}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-[#f4f1ea]/90 backdrop-blur-sm border-b border-black/[0.07] px-6 py-4 flex items-center justify-between gap-3">
          <button className="md:hidden w-9 h-9 rounded-lg bg-black/5 grid place-items-center text-neutral-700" onClick={() => setSidebarOpen((o) => !o)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:block text-sm text-neutral-500 tabular-nums">
              {new Date().toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <LanguageToggle />
            <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.2em] uppercase text-neutral-500 hover:text-neutral-900 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              {t('Back to site', 'Назад на сайт')}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminLanguageProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminLanguageProvider>
  )
}
