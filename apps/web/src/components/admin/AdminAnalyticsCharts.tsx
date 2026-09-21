'use client'

import { useState } from 'react'
import {
  TrendingUp,
  BarChart2,
  Calendar,
  DollarSign,
  Building2,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import { formatEthiopianBirr } from '@/lib/currency'

export interface MonthlyRevenuePoint {
  month: string
  revenue: number
}

export interface BookingTrendPoint {
  date: string
  bookings: number
}

export interface TopHotelPoint {
  hotelId: string
  name: string
  bookings: number
  starRating?: number
  revenue?: number
}

export interface OccupancyBreakdownPoint {
  hotelId: string
  name: string
  totalRooms: number
  occupiedToday: number
  occupancyRate: number
}

interface AdminAnalyticsChartsProps {
  monthlyRevenue: MonthlyRevenuePoint[]
  bookingTrends: BookingTrendPoint[]
  topHotels: TopHotelPoint[]
  occupancyBreakdown?: OccupancyBreakdownPoint[]
}

const formatMoney = (val: number) => formatEthiopianBirr(val)

const formatShortMonth = (ym: string) => {
  if (!ym) return ''
  const parts = ym.split('-')
  if (parts.length < 2) return ym
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)
}

const formatFullMonth = (ym: string) => {
  if (!ym) return ''
  const parts = ym.split('-')
  if (parts.length < 2) return ym
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

const formatShortDate = (ymd: string) => {
  if (!ymd) return ''
  const parts = ymd.split('-')
  if (parts.length < 3) return ymd
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export function AdminAnalyticsCharts({
  monthlyRevenue,
  bookingTrends,
  topHotels,
  occupancyBreakdown,
}: AdminAnalyticsChartsProps) {
  const [revenueRange, setRevenueRange] = useState<'6' | '12'>('12')
  const [hoveredRevenueIdx, setHoveredRevenueIdx] = useState<number | null>(null)
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'revenue' | 'bookings'>('revenue')

  // Filter revenue series based on selected range
  const revenueData =
    revenueRange === '6' ? monthlyRevenue.slice(-6) : monthlyRevenue.slice(-12)

  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1000)
  const totalPeriodRevenue = revenueData.reduce((acc, d) => acc + d.revenue, 0)
  const avgMonthlyRevenue = revenueData.length ? Math.round(totalPeriodRevenue / revenueData.length) : 0

  // 30-day booking trend stats
  const maxBookings = Math.max(...bookingTrends.map((d) => d.bookings), 5)
  const totalRecentBookings = bookingTrends.reduce((acc, d) => acc + d.bookings, 0)

  // Generate smooth SVG curve coordinates for revenue area chart
  const svgWidth = 800
  const svgHeight = 260
  const paddingX = 40
  const paddingY = 30
  const chartWidth = svgWidth - paddingX * 2
  const chartHeight = svgHeight - paddingY * 2

  const points = revenueData.map((d, i) => {
    const x =
      paddingX +
      (i / Math.max(revenueData.length - 1, 1)) * chartWidth
    const y =
      svgHeight -
      paddingY -
      (d.revenue / maxRevenue) * chartHeight
    return { x, y, ...d }
  })

  // Cubic Bezier Path calculation for organic smooth curvature
  let pathD = ''
  if (points.length > 0) {
    pathD = `M ${points[0].x},${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cpX1 = p0.x + (p1.x - p0.x) / 2
      const cpY1 = p0.y
      const cpX2 = p0.x + (p1.x - p0.x) / 2
      const cpY2 = p1.y
      pathD += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`
    }
  }

  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x},${svgHeight - paddingY} L ${points[0].x},${svgHeight - paddingY} Z`
    : ''

  const hoveredPoint =
    hoveredRevenueIdx !== null && points[hoveredRevenueIdx]
      ? points[hoveredRevenueIdx]
      : null

  return (
    <div className="space-y-6 mb-8">
      {/* Chart Header & Mode Tabs */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#0F172A]">Platform Performance Trends</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#2563EB] border border-blue-100">
                <Sparkles className="w-3 h-3" /> Live Analytics
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Historical revenue curves, reservation pacing, and property-level occupancy distributions.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('revenue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'revenue'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Revenue Velocity
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bookings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'bookings'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30-Day Reservations
              </button>
            </div>

            {activeTab === 'revenue' && (
              <div className="inline-flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRevenueRange('6')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    revenueRange === '6'
                      ? 'bg-[#0F2942] text-[#D4AF37] shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  6M
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueRange('12')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    revenueRange === '12'
                      ? 'bg-[#0F2942] text-[#D4AF37] shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  12M
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Revenue Velocity Area Chart */}
        {activeTab === 'revenue' && (
          <div>
            {/* KPI Run Rate Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-500 font-medium">Period Total Revenue</div>
                <div className="text-xl font-bold text-[#0F172A] mt-1">
                  {formatMoney(totalPeriodRevenue)}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Settled guest transactions</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-500 font-medium">Monthly Run Rate Average</div>
                <div className="text-xl font-bold text-[#0F172A] mt-1">
                  {formatMoney(avgMonthlyRevenue)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Across {revenueData.length} recorded months</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-500 font-medium">Peak Performance Month</div>
                <div className="text-xl font-bold text-[#2563EB] mt-1">
                  {formatMoney(maxRevenue)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Highest recorded monthly gross</div>
              </div>
            </div>

            {/* Interactive SVG Chart Container */}
            <div className="relative w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-64 select-none"
              >
                <defs>
                  {/* Subtle luxury gradient fill */}
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                    <stop offset="70%" stopColor="#2563EB" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Horizontal gridline pattern */}
                  <pattern id="grid" width={svgWidth} height="40" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2={svgWidth} y2="0" stroke="#F1F5F9" strokeWidth="1" />
                  </pattern>
                </defs>

                {/* Horizontal Background Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = paddingY + chartHeight * (1 - ratio)
                  return (
                    <g key={ratio}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={svgWidth - paddingX}
                        y2={y}
                        stroke="#F1F5F9"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={paddingX - 8}
                        y={y + 3.5}
                        fontSize="9"
                        fill="#94A3B8"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {formatEthiopianBirr(Math.round(maxRevenue * ratio))}
                      </text>
                    </g>
                  )
                })}

                {/* Gradient Area */}
                {areaD && <path d={areaD} fill="url(#revenueGrad)" />}

                {/* Main Curve Line */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points and Interaction Hit Areas */}
                {points.map((p, idx) => {
                  const isHovered = hoveredRevenueIdx === idx
                  return (
                    <g key={p.month}>
                      {/* Vertical Crosshair on Hover */}
                      {isHovered && (
                        <line
                          x1={p.x}
                          y1={paddingY}
                          x2={p.x}
                          y2={svgHeight - paddingY}
                          stroke="#93C5FD"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Outer Ring */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 6 : 3.5}
                        fill="#FFFFFF"
                        stroke="#2563EB"
                        strokeWidth={isHovered ? 3 : 2}
                        className="transition-all duration-150"
                      />

                      {/* Invisible Mouse Hit Target */}
                      <rect
                        x={p.x - chartWidth / (revenueData.length * 2)}
                        y={paddingY}
                        width={chartWidth / revenueData.length}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredRevenueIdx(idx)}
                        onMouseLeave={() => setHoveredRevenueIdx(null)}
                      />

                      {/* X-Axis Month Labels */}
                      <text
                        x={p.x}
                        y={svgHeight - paddingY + 18}
                        fontSize="10"
                        fill={isHovered ? '#0F172A' : '#64748B'}
                        fontWeight={isHovered ? 'bold' : 'normal'}
                        textAnchor="middle"
                      >
                        {formatShortMonth(p.month)}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Dynamic Interactive Floating Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none z-20 bg-[#0F2942] text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs border border-[#D4AF37]/30 -translate-x-1/2 -translate-y-full transition-all duration-100"
                  style={{
                    left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                    top: `${(hoveredPoint.y / svgHeight) * 100 - 8}%`,
                  }}
                >
                  <div className="text-[11px] text-slate-300 font-medium">
                    {formatFullMonth(hoveredPoint.month)}
                  </div>
                  <div className="text-sm font-bold text-[#D4AF37] mt-0.5">
                    {formatMoney(hoveredPoint.revenue)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Total Platform Settled Revenue
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: 30-Day Daily Booking Velocity Chart */}
        {activeTab === 'bookings' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-[#64748B]">
                Daily reservation pacing over the last 30 calendar days ({totalRecentBookings} bookings recorded).
              </div>
              <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                Peak: {maxBookings} bookings / day
              </div>
            </div>

            {/* 30-Day Bar/Column Visualization */}
            <div className="flex items-end gap-1.5 h-44 pt-6 pb-2 px-2 bg-slate-50 rounded-xl border border-slate-100 relative">
              {bookingTrends.map((d, idx) => {
                const heightPercent = maxBookings > 0 ? (d.bookings / maxBookings) * 100 : 0
                const isHovered = hoveredTrendIdx === idx
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                    onMouseEnter={() => setHoveredTrendIdx(idx)}
                    onMouseLeave={() => setHoveredTrendIdx(null)}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all duration-200 ${
                        isHovered
                          ? 'bg-[#0F2942]'
                          : d.bookings > 0
                            ? 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                            : 'bg-slate-200'
                      }`}
                      style={{ height: `${Math.max(heightPercent, 6)}%` }}
                    />

                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div className="absolute -top-12 z-30 bg-[#0F2942] text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[11px] whitespace-nowrap border border-slate-700 pointer-events-none">
                        <div className="font-semibold">{formatShortDate(d.date)}</div>
                        <div className="text-indigo-200">{d.bookings} {d.bookings === 1 ? 'reservation' : 'reservations'}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-1">
              <span>{formatShortDate(bookingTrends[0]?.date || '')}</span>
              <span>15 Days Ago</span>
              <span>Today ({formatShortDate(bookingTrends[bookingTrends.length - 1]?.date || '')})</span>
            </div>
          </div>
        )}
      </div>

      {/* Property Performance & Occupancy Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Booked Hotels Performance */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#2563EB]" />
              <span>Top Properties by Volume</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Ranked by Stays</span>
          </div>

          <div className="space-y-4">
            {topHotels.slice(0, 5).map((h, idx) => {
              const maxHotelBookings = Math.max(...topHotels.map((th) => th.bookings), 1)
              const percent = Math.round((h.bookings / maxHotelBookings) * 100)
              return (
                <div key={h.hotelId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-[#0F172A]">{h.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {h.bookings} {h.bookings === 1 ? 'booking' : 'bookings'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#2563EB] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}

            {!topHotels.length && (
              <p className="text-xs text-slate-400 py-6 text-center">
                No property reservations recorded yet.
              </p>
            )}
          </div>
        </div>

        {/* Live Occupancy by Hotel */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-600" />
              <span>Hotel Occupancy Distribution</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Today&apos;s Stays</span>
          </div>

          <div className="space-y-4">
            {occupancyBreakdown && occupancyBreakdown.length > 0 ? (
              occupancyBreakdown.slice(0, 5).map((ob) => {
                const ratePercent = Math.round((ob.occupancyRate || 0) * 100)
                return (
                  <div key={ob.hotelId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#0F172A]">{ob.name}</span>
                      <span className="font-bold text-slate-800">
                        {ratePercent}% ({ob.occupiedToday}/{ob.totalRooms} rooms)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          ratePercent > 70
                            ? 'bg-emerald-600'
                            : ratePercent > 30
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                        }`}
                        style={{ width: `${ratePercent}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                All rooms currently available for booking.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
