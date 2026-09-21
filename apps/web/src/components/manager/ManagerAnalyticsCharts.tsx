'use client'

import React, { useState, useMemo } from 'react'
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Activity,
  BedDouble,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Building2,
} from 'lucide-react'
import type { MonthlyRevenueItem, DailyBookingTrendItem, Room } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'

interface ManagerAnalyticsChartsProps {
  hotelName?: string
  monthlyRevenue?: MonthlyRevenueItem[]
  bookingTrends?: DailyBookingTrendItem[]
  rooms?: Room[]
  occupiedToday?: number
}

export function ManagerAnalyticsCharts({
  hotelName = 'Hotel',
  monthlyRevenue = [],
  bookingTrends = [],
  rooms = [],
  occupiedToday = 0,
}: ManagerAnalyticsChartsProps) {
  const [revenueTimeframe, setRevenueTimeframe] = useState<'6M' | '12M'>('6M')
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null)
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null)

  // 1. Process Monthly Revenue Series
  const revenueData = useMemo(() => {
    if (!monthlyRevenue || monthlyRevenue.length === 0) {
      // Default placeholder series if no data yet
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return months.slice(-6).map((m) => ({ month: m, revenue: 0, rawMonth: m }))
    }
    const count = revenueTimeframe === '6M' ? 6 : 12
    return monthlyRevenue.slice(-count).map((item) => {
      let label = item.month
      if (item.month.includes('-')) {
        const parts = item.month.split('-')
        const monthNum = parseInt(parts[1], 10)
        const dateObj = new Date(parseInt(parts[0], 10), monthNum - 1, 1)
        label = dateObj.toLocaleString('en-US', { month: 'short' })
      }
      return {
        month: label,
        revenue: item.revenue ?? 0,
        rawMonth: item.month,
      }
    })
  }, [monthlyRevenue, revenueTimeframe])

  const maxRevenue = useMemo(() => {
    const maxVal = Math.max(...revenueData.map((d) => d.revenue), 1000)
    return Math.ceil(maxVal / 1000) * 1000
  }, [revenueData])

  const totalRevenueSum = useMemo(() => {
    return revenueData.reduce((acc, curr) => acc + curr.revenue, 0)
  }, [revenueData])

  const peakMonth = useMemo(() => {
    return [...revenueData].sort((a, b) => b.revenue - a.revenue)[0] || { month: '—', revenue: 0 }
  }, [revenueData])

  // Generate SVG Cubic Bezier Path for Revenue Chart
  const svgWidth = 600
  const svgHeight = 220
  const paddingX = 40
  const paddingY = 25
  const chartW = svgWidth - paddingX * 2
  const chartH = svgHeight - paddingY * 2

  const points = useMemo(() => {
    if (revenueData.length === 0) return []
    const stepX = chartW / Math.max(revenueData.length - 1, 1)
    return revenueData.map((d, i) => {
      const x = paddingX + i * stepX
      const y = paddingY + chartH - (d.revenue / maxRevenue) * chartH
      return { x, y, data: d }
    })
  }, [revenueData, chartW, chartH, maxRevenue, paddingX, paddingY])

  const { pathD, areaD } = useMemo(() => {
    if (points.length === 0) return { pathD: '', areaD: '' }
    if (points.length === 1) {
      const p = points[0]
      return {
        pathD: `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y}`,
        areaD: `M ${p.x - 20} ${paddingY + chartH} L ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y} L ${p.x + 20} ${paddingY + chartH} Z`,
      }
    }

    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cpX1 = p0.x + (p1.x - p0.x) / 2
      const cpY1 = p0.y
      const cpX2 = p0.x + (p1.x - p0.x) / 2
      const cpY2 = p1.y
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`
    }

    const first = points[0]
    const last = points[points.length - 1]
    const baselineY = paddingY + chartH
    const area = `${d} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`

    return { pathD: d, areaD: area }
  }, [points, chartH, paddingY])

  // 2. Process Booking Velocity Series (Past 30 Days)
  const trendsData = useMemo(() => {
    if (!bookingTrends || bookingTrends.length === 0) {
      return Array.from({ length: 14 }).map((_, i) => ({
        date: `Day ${i + 1}`,
        fullDate: `Day ${i + 1}`,
        bookings: 0,
      }))
    }
    return bookingTrends.slice(-30).map((t) => ({
      date: t.date.length > 5 ? t.date.slice(5) : t.date,
      fullDate: t.date,
      bookings: t.bookings ?? t.count ?? 0,
    }))
  }, [bookingTrends])

  const maxBookings = useMemo(() => {
    const maxVal = Math.max(...trendsData.map((d) => d.bookings), 5)
    return Math.ceil(maxVal)
  }, [trendsData])

  const totalBookingsVelocity = useMemo(() => {
    return trendsData.reduce((acc, curr) => acc + curr.bookings, 0)
  }, [trendsData])

  // 3. Process Room Status Breakdown
  const roomMetrics = useMemo(() => {
    const total = rooms.length
    const available = rooms.filter((r) => r.status === 'AVAILABLE').length
    const maintenance = rooms.filter((r) => r.status === 'MAINTENANCE').length
    const cleaning = rooms.filter((r) => (r as any).status === 'CLEANING').length
    const occupied = occupiedToday

    return {
      total,
      available,
      occupied,
      maintenance,
      cleaning,
      availablePct: total > 0 ? Math.round((available / total) * 100) : 0,
      occupiedPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
      maintenancePct: total > 0 ? Math.round((maintenance / total) * 100) : 0,
      cleaningPct: total > 0 ? Math.round((cleaning / total) * 100) : 0,
    }
  }, [rooms, occupiedToday])

  return (
    <div className="space-y-6 mb-8">
      {/* Top Split: Revenue Area Spline & Booking Frequency Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Property Revenue Curve (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0F2942]/5 border border-[#0F2942]/10 flex items-center justify-center text-[#0F2942]">
                  <DollarSign className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base">Revenue Performance Curve</h3>
                  <p className="text-xs text-[#64748B]">
                    Monthly collected revenue stream for {hotelName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRevenueTimeframe('6M')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    revenueTimeframe === '6M'
                      ? 'bg-[#0F2942] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Past 6M
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueTimeframe('12M')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    revenueTimeframe === '12M'
                      ? 'bg-[#0F2942] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Past 12M
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0]/60 rounded-xl">
            <div>
              <span className="text-[11px] font-medium text-[#64748B]">Period Revenue</span>
              <p className="text-base font-bold text-[#0F172A] mt-0.5">
                {formatEthiopianBirr(totalRevenueSum)}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#64748B]">Peak Month</span>
              <p className="text-base font-bold text-[#2563EB] mt-0.5">
                {peakMonth.month} ({formatEthiopianBirr(peakMonth.revenue)})
              </p>
            </div>
            <div className="hidden sm:block">
              <span className="text-[11px] font-medium text-[#64748B]">Monthly Average</span>
              <p className="text-base font-bold text-emerald-600 mt-0.5">
                {formatEthiopianBirr(revenueData.length > 0 ? totalRevenueSum / revenueData.length : 0)}
              </p>
            </div>
          </div>

          {/* SVG Graph */}
          <div className="relative w-full h-[220px]">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="managerRevGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.32" />
                  <stop offset="60%" stopColor="#D4AF37" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = paddingY + chartH * ratio
                return (
                  <g key={ratio}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill="#94A3B8"
                      className="font-mono"
                    >
                      {Math.round(maxRevenue * (1 - ratio)).toLocaleString()}
                    </text>
                  </g>
                )
              })}

              {/* Shaded Area */}
              {areaD && <path d={areaD} fill="url(#managerRevGradient)" />}

              {/* Curve Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  filter="url(#glow)"
                  strokeLinecap="round"
                />
              )}

              {/* Interactive Points */}
              {points.map((p, idx) => {
                const isHovered = hoveredMonthIndex === idx
                return (
                  <g
                    key={p.data.rawMonth || idx}
                    onMouseEnter={() => setHoveredMonthIndex(idx)}
                    onMouseLeave={() => setHoveredMonthIndex(null)}
                    className="cursor-pointer"
                  >
                    {/* Vertical guideline on hover */}
                    {isHovered && (
                      <line
                        x1={p.x}
                        y1={paddingY}
                        x2={p.x}
                        y2={paddingY + chartH}
                        stroke="#2563EB"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}

                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : 3.5}
                      fill={isHovered ? '#D4AF37' : '#FFFFFF'}
                      stroke="#2563EB"
                      strokeWidth={isHovered ? 2.5 : 2}
                      className="transition-all duration-150"
                    />

                    {/* Month Label */}
                    <text
                      x={p.x}
                      y={paddingY + chartH + 18}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isHovered ? '#0F172A' : '#64748B'}
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {p.data.month}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* Floating Tooltip */}
            {hoveredMonthIndex !== null && points[hoveredMonthIndex] && (
              <div
                className="absolute pointer-events-none bg-[#0F2942] text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-[#D4AF37]/30 -translate-x-1/2 -translate-y-full mb-3"
                style={{
                  left: `${(points[hoveredMonthIndex].x / svgWidth) * 100}%`,
                  top: `${(points[hoveredMonthIndex].y / svgHeight) * 100}%`,
                }}
              >
                <div className="font-semibold text-[#D4AF37] flex items-center gap-1">
                  <span>{points[hoveredMonthIndex].data.month}</span>
                </div>
                <div className="font-mono font-bold text-white text-sm mt-0.5">
                  {formatEthiopianBirr(points[hoveredMonthIndex].data.revenue)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side Chart: 30-Day Reservation Velocity (1 Column) */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base">Booking Velocity</h3>
                  <p className="text-xs text-[#64748B]">Daily reservations (Past 30 Days)</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#2563EB]">
                {totalBookingsVelocity} Total
              </span>
            </div>

            {/* Daily Bars Visualizer */}
            <div className="h-[175px] flex items-end gap-1 pt-6 px-1 border-b border-[#E2E8F0]">
              {trendsData.map((d, i) => {
                const heightPct = maxBookings > 0 ? (d.bookings / maxBookings) * 100 : 0
                const isHovered = hoveredTrendIndex === i
                return (
                  <div
                    key={d.fullDate || i}
                    className="flex-1 flex flex-col items-center group relative cursor-pointer h-full justify-end"
                    onMouseEnter={() => setHoveredTrendIndex(i)}
                    onMouseLeave={() => setHoveredTrendIndex(null)}
                  >
                    {/* Hover Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-10 bg-[#0F2942] text-white text-[10px] px-2 py-1 rounded-md shadow-md whitespace-nowrap z-20 pointer-events-none">
                        <div className="font-bold">{d.fullDate || d.date}</div>
                        <div className="text-[#D4AF37] font-semibold">{d.bookings} booking{d.bookings === 1 ? '' : 's'}</div>
                      </div>
                    )}

                    <div
                      className={`w-full rounded-t-sm transition-all duration-200 ${
                        isHovered
                          ? 'bg-[#D4AF37]'
                          : d.bookings > 0
                            ? 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                            : 'bg-slate-100'
                      }`}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between items-center text-[10px] text-[#94A3B8] font-mono mt-2">
              <span>{trendsData[0]?.date || 'Day 1'}</span>
              <span>30 Days Activity</span>
              <span>{trendsData[trendsData.length - 1]?.date || 'Today'}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Real-time Guest Velocity</span>
            </div>
            <span className="font-semibold text-[#0F172A]">
              {(totalBookingsVelocity / Math.max(trendsData.length, 1)).toFixed(1)} bookings / day
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Visualizer: Room Status & Operational Distribution */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <BedDouble className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#0F172A] text-base">Room Inventory &amp; Operational Status</h3>
              <p className="text-xs text-[#64748B]">
                Current room readiness across {roomMetrics.total} configured units
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{roomMetrics.available} Ready for Check-in</span>
            </span>
          </div>
        </div>

        {/* Segmented Multi-Color Progress Bar */}
        <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden flex mb-5 border border-slate-200/80">
          <div
            className="bg-emerald-500 h-full transition-all duration-500 hover:opacity-90"
            style={{ width: `${roomMetrics.availablePct}%` }}
            title={`Available: ${roomMetrics.available} (${roomMetrics.availablePct}%)`}
          />
          <div
            className="bg-[#2563EB] h-full transition-all duration-500 hover:opacity-90"
            style={{ width: `${roomMetrics.occupiedPct}%` }}
            title={`Occupied: ${roomMetrics.occupied} (${roomMetrics.occupiedPct}%)`}
          />
          <div
            className="bg-amber-400 h-full transition-all duration-500 hover:opacity-90"
            style={{ width: `${roomMetrics.cleaningPct}%` }}
            title={`Cleaning: ${roomMetrics.cleaning} (${roomMetrics.cleaningPct}%)`}
          />
          <div
            className="bg-rose-500 h-full transition-all duration-500 hover:opacity-90"
            style={{ width: `${roomMetrics.maintenancePct}%` }}
            title={`Maintenance: ${roomMetrics.maintenance} (${roomMetrics.maintenancePct}%)`}
          />
        </div>

        {/* Breakdown Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-900">Available</span>
            </div>
            <div className="text-xl font-bold text-[#0F172A]">{roomMetrics.available}</div>
            <span className="text-[11px] text-emerald-700">{roomMetrics.availablePct}% of total inventory</span>
          </div>

          <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              <span className="text-xs font-semibold text-blue-900">Occupied Today</span>
            </div>
            <div className="text-xl font-bold text-[#0F172A]">{roomMetrics.occupied}</div>
            <span className="text-[11px] text-blue-700">{roomMetrics.occupiedPct}% occupancy rate</span>
          </div>

          <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-amber-900">Housekeeping</span>
            </div>
            <div className="text-xl font-bold text-[#0F172A]">{roomMetrics.cleaning}</div>
            <span className="text-[11px] text-amber-700">{roomMetrics.cleaningPct}% undergoing turnover</span>
          </div>

          <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-xs font-semibold text-rose-900">Maintenance</span>
            </div>
            <div className="text-xl font-bold text-[#0F172A]">{roomMetrics.maintenance}</div>
            <span className="text-[11px] text-rose-700">{roomMetrics.maintenancePct}% blocked out-of-service</span>
          </div>
        </div>
      </div>
    </div>
  )
}
