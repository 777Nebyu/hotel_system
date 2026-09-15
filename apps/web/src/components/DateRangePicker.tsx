'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  checkIn?: string   // ISO date yyyy-mm-dd
  checkOut?: string
  onSelect: (checkIn: string, checkOut: string) => void
  minDate?: Date
  className?: string
}

function parseISO(s?: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDisplay(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isBetween(d: Date, start: Date, end: Date) {
  return d > start && d < end
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function DateRangePicker({
  checkIn,
  checkOut,
  onSelect,
  minDate,
  className = '',
}: DateRangePickerProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const min = minDate ?? today
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selecting, setSelecting] = useState<'checkin' | 'checkout'>('checkin')
  const [hover, setHover] = useState<Date | null>(null)

  const ciDate = parseISO(checkIn)
  const coDate = parseISO(checkOut)

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const canPrev = () => {
    const prev = new Date(viewYear, viewMonth - 1, 1)
    return prev >= new Date(min.getFullYear(), min.getMonth(), 1)
  }

  const handleDay = (day: number) => {
    const clicked = new Date(viewYear, viewMonth, day)
    if (clicked < min) return

    if (selecting === 'checkin') {
      onSelect(formatISO(clicked), '')
      setSelecting('checkout')
    } else {
      if (ciDate && clicked <= ciDate) {
        onSelect(formatISO(clicked), '')
        setSelecting('checkout')
      } else if (ciDate) {
        onSelect(formatISO(ciDate), formatISO(clicked))
        setSelecting('checkin')
      }
    }
  }

  const nights = ciDate && coDate
    ? Math.round((coDate.getTime() - ciDate.getTime()) / 86400000)
    : 0

  const getDayState = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    const isPast = d < min
    const isCI = ciDate && isSameDay(d, ciDate)
    const isCO = coDate && isSameDay(d, coDate)
    const isToday = isSameDay(d, today)

    // highlight range
    const endForRange = coDate ?? (selecting === 'checkout' && hover ? hover : null)
    const inRange = ciDate && endForRange && ciDate < endForRange && isBetween(d, ciDate, endForRange)

    return { isPast, isCI, isCO, isToday, inRange }
  }

  type Cell = { type: 'empty'; i: number } | { type: 'day'; day: number }
  const cells: Cell[] = Array.from({ length: firstDay }, (_, i) => ({ type: 'empty' as const, i }))
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: 'day' as const, day: d })

  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-[#BFDBFE] overflow-hidden ${className}`}>
      {/* Summary bar */}
      <div className="grid grid-cols-2 divide-x divide-[#E2E8F0] border-b border-[#E2E8F0]">
        <button
          onClick={() => setSelecting('checkin')}
          className={`px-4 py-3 text-left cursor-pointer transition-colors ${selecting === 'checkin' ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'}`}
        >
          <div className="text-xs font-semibold text-[#1E3A8A] uppercase tracking-wider mb-0.5">Check-in</div>
          <div className={`text-sm font-semibold ${ciDate ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
            {ciDate ? formatDisplay(ciDate) : 'Select date'}
          </div>
        </button>
        <button
          onClick={() => setSelecting('checkout')}
          className={`px-4 py-3 text-left cursor-pointer transition-colors ${selecting === 'checkout' ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'}`}
        >
          <div className="text-xs font-semibold text-[#1E3A8A] uppercase tracking-wider mb-0.5">Check-out</div>
          <div className={`text-sm font-semibold ${coDate ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
            {coDate ? formatDisplay(coDate) : 'Select date'}
          </div>
        </button>
      </div>

      {/* Calendar header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={prevMonth}
          disabled={!canPrev()}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-[#0F172A] text-sm">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 px-3 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#94A3B8] uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-3 pb-4 gap-y-0.5">
        {cells.map((cell, idx) => {
          if (cell.type === 'empty') return <div key={`e-${idx}`} />

          // Type is now narrowed to { type: 'day'; day: number }
          const { day } = cell
          const { isPast, isCI, isCO, isToday, inRange } = getDayState(day)

          return (
            <button
              key={`d-${day}`}
              disabled={isPast}
              onClick={() => handleDay(day)}
              onMouseEnter={() => {
                if (selecting === 'checkout') {
                  setHover(new Date(viewYear, viewMonth, day))
                }
              }}
              onMouseLeave={() => setHover(null)}
              className={[
                'relative h-9 w-full text-xs font-medium rounded-lg transition-all cursor-pointer',
                isPast ? 'text-[#CBD5E1] cursor-not-allowed' : '',
                isCI || isCO
                  ? 'bg-[#1E3A8A] text-white font-bold z-10'
                  : inRange
                    ? 'bg-[#DBEAFE] text-[#1E3A8A] rounded-none'
                    : isToday && !isPast
                      ? 'border border-[#1E3A8A] text-[#1E3A8A]'
                      : !isPast
                        ? 'text-[#0F172A] hover:bg-[#F1F5F9]'
                        : '',
                isCI ? 'rounded-l-lg rounded-r-none' : '',
                isCO ? 'rounded-r-lg rounded-l-none' : '',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Nights summary */}
      {nights > 0 && (
        <div className="mx-4 mb-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[#3B82F6]">Total stay</span>
          <span className="text-sm font-bold text-[#1E3A8A]">
            {nights} night{nights !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Instruction */}
      <div className="px-4 pb-3 text-xs text-[#94A3B8] text-center">
        {selecting === 'checkin' ? 'Select your check-in date' : 'Now select your check-out date'}
      </div>
    </div>
  )
}
