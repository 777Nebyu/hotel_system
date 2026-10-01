'use client'

import * as React from 'react'
import { Users, Plus, Minus, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

export interface GuestCount {
  adults: number
  children: number
}

export interface GuestSelectorProps {
  value: GuestCount
  onChange: (value: GuestCount) => void
  maxGuests?: number
  className?: string
}

export function GuestSelector({
  value,
  onChange,
  maxGuests = 10,
  className = '',
}: GuestSelectorProps) {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Outside click closes popover
  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const totalGuests = value.adults + value.children

  const updateAdults = (delta: number) => {
    const next = Math.max(1, Math.min(maxGuests - value.children, value.adults + delta))
    onChange({ ...value, adults: next })
  }

  const updateChildren = (delta: number) => {
    const next = Math.max(0, Math.min(maxGuests - value.adults, value.children + delta))
    onChange({ ...value, children: next })
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#0F2942]/30 transition-all text-sm font-medium text-slate-800 text-left min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">
            {t('hotel', value.adults === 1 ? 'adultCountOne' : 'adultCountMany', { count: value.adults })}
            {value.children > 0 && t('hotel', value.children === 1 ? 'childCountOne' : 'childCountMany', { count: value.children })}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t('hotel', 'selectGuestsLabel')}
          className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-white shadow-2xl border border-slate-100 p-5 z-50 animate-in fade-in zoom-in-95 space-y-4"
        >
          {/* Adults Stepper */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">{t('hotel', 'adultsLabel')}</p>
              <p className="text-xs text-slate-400">{t('hotel', 'ages13Above')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateAdults(-1)}
                disabled={value.adults <= 1}
                aria-label={t('hotel', 'decreaseAdults')}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold w-4 text-center text-slate-900">
                {value.adults}
              </span>
              <button
                type="button"
                onClick={() => updateAdults(1)}
                disabled={totalGuests >= maxGuests}
                aria-label={t('hotel', 'increaseAdults')}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Children Stepper */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">{t('hotel', 'childrenLabel')}</p>
              <p className="text-xs text-slate-400">{t('hotel', 'ages0to12')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateChildren(-1)}
                disabled={value.children <= 0}
                aria-label={t('hotel', 'decreaseChildren')}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold w-4 text-center text-slate-900">
                {value.children}
              </span>
              <button
                type="button"
                onClick={() => updateChildren(1)}
                disabled={totalGuests >= maxGuests}
                aria-label={t('hotel', 'increaseChildren')}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 bg-[#0F2942] text-white text-xs font-semibold rounded-xl hover:bg-[#163859]               transition-colors cursor-pointer"
            >
              {t('hotel', 'doneLabel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
