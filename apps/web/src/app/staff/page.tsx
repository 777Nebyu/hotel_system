'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { managerApi, paymentApi } from '@/lib/services'
import { useAuth } from '@/lib/auth-store'
import AuthGate from '@/components/AuthGate'
import type { Booking, Hotel, OperationalRoom, Room, StayRequest } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  Sparkles,
  BedDouble,
  Wrench,
  CheckCircle2,
  RefreshCw,
  Search,
  Building2,
  User,
  Phone,
  DoorOpen,
  Filter,
} from 'lucide-react'

type Tab = 'Dashboard' | 'Housekeeping & Rooms' | 'Bookings' | 'Stay Requests'

type StaffBooking = Booking & {
  user?: { fullName: string; email: string; phone?: string | null }
  details?: Array<{ id: string; roomId: string; room?: { id: string; roomNumber: string; type: string } }>
}

const statusStyle = (status: string) => {
  if (status === 'CONFIRMED' || status === 'CHECKED_IN') return 'bg-blue-50 text-blue-700'
  if (status === 'CHECKED_OUT') return 'bg-green-50 text-green-700'
  if (status === 'REJECTED' || status === 'CANCELLED') return 'bg-red-50 text-red-600'
  return 'bg-amber-50 text-amber-700'
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))

const formatMoney = (value: number | string | null | undefined) =>
  value === null || value === undefined ? '—' : formatEthiopianBirr(value)

export default function StaffDashboardPage() {
  return (
    <AuthGate roles={['STAFF', 'ADMIN', 'MANAGER']}>
      <StaffDashboard />
    </AuthGate>
  )
}

function StaffDashboard() {
  const router = useRouter()
  const logout = useAuth((state) => state.logout)
  const user = useAuth((state) => state.user)

  const [tab, setTab] = useState<Tab>('Dashboard')
  const [bookings, setBookings] = useState<StaffBooking[]>([])
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    todaysCheckIns: 0,
    todaysCheckOuts: 0,
    activeGuests: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successBanner, setSuccessBanner] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  // Modals state
  const [walkInModalOpen, setWalkInModalOpen] = useState(false)
  const [walkInSubmitting, setWalkInSubmitting] = useState(false)
  const [walkInForm, setWalkInForm] = useState({
    hotelId: '',
    roomId: '',
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    guestIdNumber: '',
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    paidImmediately: true,
  })

  // Relocate Modal
  const [relocateBooking, setRelocateBooking] = useState<StaffBooking | null>(null)
  const [relocateNewRoomId, setRelocateNewRoomId] = useState('')
  const [relocateReason, setRelocateReason] = useState('Front desk room transfer')
  const [relocateSubmitting, setRelocateSubmitting] = useState(false)

  // Stay Requests
  const [stayRequests, setStayRequests] = useState<StayRequest[]>([])
  const [decidingRequest, setDecidingRequest] = useState<StayRequest | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [decidingSubmitting, setDecidingSubmitting] = useState(false)

  // Available Rooms for Walk-in / Relocation
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])

  // Operational Housekeeping & Room Status Board State
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [selectedHotelId, setSelectedHotelId] = useState<string>('')
  const [operationalRooms, setOperationalRooms] = useState<OperationalRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE' | 'OCCUPIED'>('ALL')
  const [roomSearchQuery, setRoomSearchQuery] = useState('')
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null)

  const loadOperationalRooms = useCallback(async (hotelId: string) => {
    if (!hotelId) return
    setRoomsLoading(true)
    try {
      const rooms = await managerApi.getOperationalRooms(hotelId)
      setOperationalRooms(rooms)
    } catch (err) {
      console.error('Failed to load operational rooms', err)
    } finally {
      setRoomsLoading(false)
    }
  }, [])

  const handleSelectHotel = (hotelId: string) => {
    setSelectedHotelId(hotelId)
    setWalkInForm((prev) => ({ ...prev, hotelId }))
    void loadOperationalRooms(hotelId)
    managerApi.listStayRequests(hotelId).then(setStayRequests).catch(() => setStayRequests([]))
  }

  const handleUpdateRoomStatus = async (
    roomId: string,
    newStatus: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE',
  ) => {
    setUpdatingRoomId(roomId)
    setError('')
    try {
      await managerApi.updateRoomStatus(roomId, newStatus)
      setSuccessBanner(`Room status successfully updated to ${newStatus}.`)
      setOperationalRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r)),
      )
      if (selectedHotelId) {
        void loadOperationalRooms(selectedHotelId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update room status.')
    } finally {
      setUpdatingRoomId(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bookingData, statsData, hotelsData] = await Promise.all([
        managerApi.bookings({ pageSize: 50 }),
        managerApi.stats().catch(() => ({
          pendingApprovals: 0,
          todaysCheckIns: 0,
          todaysCheckOuts: 0,
          activeGuests: 0,
        })),
        managerApi.hotels().catch(() => []),
      ])

      const bData = bookingData.data as StaffBooking[]
      setBookings(bData)
      setStats(statsData)
      setHotels(hotelsData)

      // Set default hotel for front desk operations
      if (hotelsData.length > 0) {
        const primaryHotel = hotelsData[0]
        const activeHotelId = selectedHotelId || primaryHotel.id
        setSelectedHotelId(activeHotelId)
        setWalkInForm((prev) => ({ ...prev, hotelId: activeHotelId }))
        if (primaryHotel.rooms) setAvailableRooms(primaryHotel.rooms)

        void loadOperationalRooms(activeHotelId)

        // Load stay requests for hotel
        managerApi
          .listStayRequests(activeHotelId)
          .then(setStayRequests)
          .catch(() => setStayRequests([]))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load front desk dashboard.')
    } finally {
      setLoading(false)
    }
  }, [loadOperationalRooms, selectedHotelId])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (id: string, action: 'confirm' | 'reject' | 'check-in' | 'check-out') => {
    setActing(id)
    setError('')
    try {
      await managerApi.action(id, action)
      setSuccessBanner(`Reservation marked as ${action.replace('-', ' ')}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update reservation.')
    } finally {
      setActing(null)
    }
  }

  const markCashPaid = async (bookingId: string) => {
    setError('')
    try {
      await paymentApi.markCashPaid(bookingId, 'Front desk cash collection')
      setSuccessBanner('Payment recorded as SUCCEEDED (Cash).')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record cash payment.')
    }
  }

  const markNoShow = async (bookingId: string) => {
    if (!confirm('Mark guest as No-Show and release room availability?')) return
    setError('')
    try {
      await managerApi.noShow(bookingId)
      setSuccessBanner('Guest marked as No-Show.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark No-Show.')
    }
  }

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkInForm.hotelId || !walkInForm.roomId) return
    setWalkInSubmitting(true)
    setError('')
    try {
      await managerApi.createWalkIn({
        hotelId: walkInForm.hotelId,
        roomIds: [walkInForm.roomId],
        guestName: walkInForm.guestName.trim(),
        guestPhone: walkInForm.guestPhone.trim(),
        guestEmail: walkInForm.guestEmail.trim() || undefined,
        guestIdNumber: walkInForm.guestIdNumber.trim() || undefined,
        checkIn: walkInForm.checkIn,
        checkOut: walkInForm.checkOut,
        paymentMethod: walkInForm.paymentMethod,
        paidImmediately: walkInForm.paidImmediately,
      })
      setSuccessBanner('Walk-in guest registered & checked in!')
      setWalkInModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register walk-in guest.')
    } finally {
      setWalkInSubmitting(false)
    }
  }

  const handleRelocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!relocateBooking || !relocateNewRoomId) return
    const oldRoomId = relocateBooking.details?.[0]?.roomId || ''
    setRelocateSubmitting(true)
    setError('')
    try {
      await managerApi.relocateRoom(relocateBooking.id, {
        oldRoomId,
        newRoomId: relocateNewRoomId,
        reason: relocateReason.trim(),
      })
      setSuccessBanner('Guest room transfer complete!')
      setRelocateBooking(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer guest.')
    } finally {
      setRelocateSubmitting(false)
    }
  }

  const handleDecideStayRequest = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!decidingRequest) return
    setDecidingSubmitting(true)
    setError('')
    try {
      await managerApi.decideStayRequest(decidingRequest.id, {
        decision,
        decisionNote: decisionNote.trim() || undefined,
      })
      setSuccessBanner(`Stay request ${decision.toLowerCase()}!`)
      setDecidingRequest(null)
      setDecisionNote('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process stay request.')
    } finally {
      setDecidingSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        Loading front desk portal…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] hidden lg:flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-[#E2E8F0]">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {user?.fullName.charAt(0).toUpperCase() || 'S'}
          </div>
          <div className="font-semibold text-[#0F172A] mt-3">{user?.fullName || 'Front Desk Staff'}</div>
          <div className="text-[#64748B] text-xs">Reception & Operations</div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {(['Dashboard', 'Housekeeping & Rooms', 'Bookings', 'Stay Requests'] as Tab[]).map((item) => (
            <button
              key={item}
              onClick={() => {
                setTab(item)
                setError('')
                setSuccessBanner('')
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                tab === item ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>{item}</span>
              {item === 'Housekeeping & Rooms' &&
                operationalRooms.filter((r) => r.status === 'CLEANING').length > 0 && (
                  <span
                    className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                      tab === item ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {operationalRooms.filter((r) => r.status === 'CLEANING').length}
                  </span>
                )}
              {item === 'Stay Requests' && stayRequests.filter((r) => r.status === 'PENDING').length > 0 && (
                <span
                  className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                    tab === item ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stayRequests.filter((r) => r.status === 'PENDING').length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => {
              logout()
              router.push('/')
            }}
            className="w-full text-left px-3.5 py-2.5 text-sm text-red-500 rounded-xl hover:bg-red-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8 max-w-6xl overflow-auto">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold text-red-500">
              ✕
            </button>
          </div>
        )}

        {successBanner && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl p-3.5 flex items-center justify-between">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner('')} className="font-bold text-emerald-500">
              ✕
            </button>
          </div>
        )}

        {/* Dashboard Tab */}
        {tab === 'Dashboard' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="font-serif text-3xl text-[#0F172A]">Front Desk Console</h1>
                <p className="text-[#64748B]">Real-time arrivals, departures, and walk-in check-ins.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setWalkInModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  + Walk-In Guest
                </button>
                <button
                  onClick={() => void load()}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                ['Pending approvals', stats.pendingApprovals, '⏳'],
                ["Today's check-ins", stats.todaysCheckIns, '↪'],
                ["Today's check-outs", stats.todaysCheckOuts, '↩'],
                ['Active guests', stats.activeGuests, '👥'],
              ].map(([label, value, icon]) => (
                <div key={String(label)} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
                  <div className="text-2xl mb-3">{icon}</div>
                  <div className="font-bold text-[#0F172A] text-2xl">{value}</div>
                  <div className="text-[#64748B] text-xs">{label}</div>
                </div>
              ))}
              <div
                onClick={() => setTab('Housekeeping & Rooms')}
                className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm hover:border-amber-300 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-2xl mb-3">
                  <span>🧹</span>
                  <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full group-hover:bg-amber-100">
                    Board →
                  </span>
                </div>
                <div className="font-bold text-[#0F172A] text-2xl">
                  {operationalRooms.filter((r) => r.status === 'CLEANING' || r.status === 'MAINTENANCE').length}
                </div>
                <div className="text-[#64748B] text-xs">Housekeeping & Repairs</div>
              </div>
            </div>

            {/* Quick Reservations */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              <div className="p-5 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-bold text-[#0F172A]">Today&apos;s Arrivals & Stays</h2>
                <button onClick={() => setTab('Bookings')} className="text-sm text-[#2563EB] font-semibold">
                  View All ({bookings.length}) →
                </button>
              </div>

              {bookings.slice(0, 8).map((booking) => (
                <div key={booking.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[#0F172A]">
                      {booking.user?.fullName || 'Walk-in Guest'}{' '}
                      <span className="font-mono font-normal text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 space-x-3">
                      <span>📅 {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</span>
                      <span>💰 {formatMoney(booking.totalPrice)}</span>
                      <span>📞 {booking.user?.phone || 'No phone'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={booking.status} size="sm" />

                    <button
                      onClick={() => markCashPaid(booking.id)}
                      className="px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold"
                    >
                      💵 Cash Paid
                    </button>

                    {booking.status === 'PENDING' && (
                      <>
                        <button
                          disabled={acting === booking.id}
                          onClick={() => act(booking.id, 'confirm')}
                          className="px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold"
                        >
                          Confirm
                        </button>
                        <button
                          disabled={acting === booking.id}
                          onClick={() => act(booking.id, 'reject')}
                          className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {booking.status === 'CONFIRMED' && (
                      <>
                        <button
                          disabled={acting === booking.id}
                          onClick={() => act(booking.id, 'check-in')}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                        >
                          Check In
                        </button>
                        <button
                          onClick={() => markNoShow(booking.id)}
                          className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                        >
                          No-Show
                        </button>
                      </>
                    )}

                    {booking.status === 'CHECKED_IN' && (
                      <>
                        <button
                          disabled={acting === booking.id}
                          onClick={() => act(booking.id, 'check-out')}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                        >
                          Check Out
                        </button>
                        <button
                          onClick={() => {
                            setRelocateBooking(booking)
                            setRelocateNewRoomId('')
                          }}
                          className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                        >
                          Relocate
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Housekeeping & Room Status Tab */}
        {tab === 'Housekeeping & Rooms' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-serif text-3xl text-[#0F172A] flex items-center gap-2">
                  <span>Housekeeping & Room Status</span>
                </h1>
                <p className="text-[#64748B] text-sm mt-1">
                  Monitor room cleanliness, manage operational readiness, and view active guest occupancy.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Hotel Selector */}
                {hotels.length > 1 && (
                  <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 shadow-sm">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <select
                      value={selectedHotelId}
                      onChange={(e) => handleSelectHotel(e.target.value)}
                      className="text-sm font-medium text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
                    >
                      {hotels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => selectedHotelId && void loadOperationalRooms(selectedHotelId)}
                  disabled={roomsLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${roomsLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* KPI Counter Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-md ring-2 ring-[#D4AF37]/30'
                    : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wider opacity-75">All Rooms</div>
                <div className="text-2xl font-bold mt-1.5">{operationalRooms.length}</div>
                <div className="text-[11px] opacity-70 mt-1">Total hotel inventory</div>
              </button>

              <button
                onClick={() => setStatusFilter('AVAILABLE')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  statusFilter === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/30'
                    : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:border-emerald-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                  <span className={statusFilter === 'AVAILABLE' ? 'text-white' : 'text-emerald-700'}>Available</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.status === 'AVAILABLE' && !r.isOccupied).length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">Clean & ready for guests</div>
              </button>

              <button
                onClick={() => setStatusFilter('CLEANING')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  statusFilter === 'CLEANING'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-300/30'
                    : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:border-amber-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                  <span className={statusFilter === 'CLEANING' ? 'text-white' : 'text-amber-700'}>Cleaning</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.status === 'CLEANING').length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">Housekeeping required</div>
              </button>

              <button
                onClick={() => setStatusFilter('MAINTENANCE')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  statusFilter === 'MAINTENANCE'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300/30'
                    : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:border-rose-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                  <span className={statusFilter === 'MAINTENANCE' ? 'text-white' : 'text-rose-700'}>Maintenance</span>
                  <Wrench className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.status === 'MAINTENANCE').length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">Repair / Out of order</div>
              </button>

              <button
                onClick={() => setStatusFilter('OCCUPIED')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  statusFilter === 'OCCUPIED'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300/30'
                    : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:border-indigo-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                  <span className={statusFilter === 'OCCUPIED' ? 'text-white' : 'text-indigo-700'}>Occupied</span>
                  <User className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.isOccupied).length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">Checked-in active guests</div>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                  placeholder="Search room number, type, guest..."
                  className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filter:
                </span>
                {(['ALL', 'AVAILABLE', 'CLEANING', 'MAINTENANCE', 'OCCUPIED'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setStatusFilter(filterKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      statusFilter === filterKey
                        ? 'bg-[#0F2942] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filterKey === 'ALL' ? 'All' : filterKey.charAt(0) + filterKey.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Rooms Grid */}
            {roomsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="h-6 w-24 bg-slate-200 rounded-lg"></div>
                      <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
                    </div>
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                    <div className="h-9 bg-slate-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : operationalRooms
                .filter((room) => {
                  if (statusFilter === 'AVAILABLE' && (room.status !== 'AVAILABLE' || room.isOccupied)) return false
                  if (statusFilter === 'CLEANING' && room.status !== 'CLEANING') return false
                  if (statusFilter === 'MAINTENANCE' && room.status !== 'MAINTENANCE') return false
                  if (statusFilter === 'OCCUPIED' && !room.isOccupied) return false
                  if (roomSearchQuery.trim()) {
                    const q = roomSearchQuery.toLowerCase()
                    const matchNumber = room.roomNumber.toLowerCase().includes(q)
                    const matchType = room.type.toLowerCase().includes(q)
                    const matchGuest = room.currentGuest ? room.currentGuest.toLowerCase().includes(q) : false
                    const matchRef = room.currentBookingRef ? room.currentBookingRef.toLowerCase().includes(q) : false
                    return matchNumber || matchType || matchGuest || matchRef
                  }
                  return true
                }).length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <DoorOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-lg">No Rooms Found</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {roomSearchQuery
                    ? `No rooms match "${roomSearchQuery}".`
                    : 'No rooms match the selected operational status filter.'}
                </p>
                {(roomSearchQuery || statusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setRoomSearchQuery('')
                      setStatusFilter('ALL')
                    }}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {operationalRooms
                  .filter((room) => {
                    if (statusFilter === 'AVAILABLE' && (room.status !== 'AVAILABLE' || room.isOccupied)) return false
                    if (statusFilter === 'CLEANING' && room.status !== 'CLEANING') return false
                    if (statusFilter === 'MAINTENANCE' && room.status !== 'MAINTENANCE') return false
                    if (statusFilter === 'OCCUPIED' && !room.isOccupied) return false
                    if (roomSearchQuery.trim()) {
                      const q = roomSearchQuery.toLowerCase()
                      const matchNumber = room.roomNumber.toLowerCase().includes(q)
                      const matchType = room.type.toLowerCase().includes(q)
                      const matchGuest = room.currentGuest ? room.currentGuest.toLowerCase().includes(q) : false
                      const matchRef = room.currentBookingRef ? room.currentBookingRef.toLowerCase().includes(q) : false
                      return matchNumber || matchType || matchGuest || matchRef
                    }
                    return true
                  })
                  .map((room) => {
                    const isMutating = updatingRoomId === room.id
                    return (
                      <div
                        key={room.id}
                        className={`bg-white rounded-2xl border transition-all p-5 shadow-sm flex flex-col justify-between ${
                          room.status === 'CLEANING'
                            ? 'border-amber-300/80 ring-1 ring-amber-200/50'
                            : room.status === 'MAINTENANCE'
                              ? 'border-rose-300/80 ring-1 ring-rose-200/50'
                              : room.isOccupied
                                ? 'border-indigo-300/80 ring-1 ring-indigo-200/50'
                                : 'border-[#E2E8F0] hover:border-slate-300'
                        }`}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-serif font-bold text-xl text-[#0F172A]">
                                  Room {room.roomNumber}
                                </span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tracking-wide">
                                  {room.type}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>👥 {room.capacity} Guests</span>
                                <span>·</span>
                                <span>🛏️ {room.beds} Beds</span>
                                <span>·</span>
                                <span className="font-medium text-[#0F172A]">{formatMoney(room.basePrice)}/night</span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                              {room.status === 'AVAILABLE' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                                </span>
                              )}
                              {room.status === 'CLEANING' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                  <Sparkles className="w-3.5 h-3.5" /> Cleaning
                                </span>
                              )}
                              {room.status === 'MAINTENANCE' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  <Wrench className="w-3.5 h-3.5" /> Maintenance
                                </span>
                              )}
                              {room.status === 'UNAVAILABLE' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                  Blocked
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Occupancy Card Banner */}
                          {room.isOccupied ? (
                            <div className="mb-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-3 text-xs">
                              <div className="flex items-center justify-between font-semibold text-indigo-900 mb-1">
                                <span className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{room.currentGuest || 'Checked-in Guest'}</span>
                                </span>
                                <span className="font-mono text-[11px] text-indigo-600">
                                  #{room.currentBookingRef?.slice(-6) || 'STAY'}
                                </span>
                              </div>
                              <div className="text-slate-600 space-y-0.5 mt-1 text-[11px]">
                                {room.checkOutDate && (
                                  <div>
                                    Departure:{' '}
                                    <span className="font-medium text-slate-800">{formatDate(room.checkOutDate)}</span>
                                  </div>
                                )}
                                {room.currentGuestPhone && (
                                  <div className="flex items-center gap-1 text-slate-500">
                                    <Phone className="w-3 h-3" /> {room.currentGuestPhone}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mb-4 bg-slate-50 rounded-xl p-2.5 text-xs text-slate-500 flex items-center gap-2">
                              <DoorOpen className="w-4 h-4 text-slate-400" />
                              <span>Room is currently vacant & awaiting arrivals</span>
                            </div>
                          )}
                        </div>

                        {/* Operational Action Controls */}
                        <div className="pt-3 border-t border-slate-100">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Housekeeping Actions
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              disabled={isMutating || room.status === 'AVAILABLE'}
                              onClick={() => handleUpdateRoomStatus(room.id, 'AVAILABLE')}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                                room.status === 'AVAILABLE'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default opacity-90'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                              }`}
                              title="Mark room as clean and ready for arrivals"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ready</span>
                            </button>

                            <button
                              disabled={isMutating || room.status === 'CLEANING'}
                              onClick={() => handleUpdateRoomStatus(room.id, 'CLEANING')}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                                room.status === 'CLEANING'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200 cursor-default opacity-90'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                              }`}
                              title="Send room to housekeeping queue"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Cleaning</span>
                            </button>

                            <button
                              disabled={isMutating || room.status === 'MAINTENANCE'}
                              onClick={() => handleUpdateRoomStatus(room.id, 'MAINTENANCE')}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                                room.status === 'MAINTENANCE'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200 cursor-default opacity-90'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                              }`}
                              title="Flag room for maintenance or repairs"
                            >
                              <Wrench className="w-3 h-3" />
                              <span>Repair</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {tab === 'Bookings' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Front Desk Reservations</h1>
                <p className="text-[#64748B] text-sm">{bookings.length} reservations recorded</p>
              </div>
              <button
                onClick={() => setWalkInModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                + Walk-In Guest
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[#0F172A]">
                      {booking.user?.fullName || 'Walk-in Guest'}{' '}
                      <span className="font-mono font-normal text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 space-x-3">
                      <span>📅 {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</span>
                      <span>💰 {formatMoney(booking.totalPrice)}</span>
                      <span>📞 {booking.user?.phone || 'Direct Walk-in'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={booking.status} size="sm" />

                    <button
                      onClick={() => markCashPaid(booking.id)}
                      className="px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold"
                    >
                      💵 Mark Cash Paid
                    </button>

                    {booking.status === 'CONFIRMED' && (
                      <button
                        disabled={acting === booking.id}
                        onClick={() => act(booking.id, 'check-in')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                      >
                        Check In
                      </button>
                    )}

                    {booking.status === 'CHECKED_IN' && (
                      <button
                        disabled={acting === booking.id}
                        onClick={() => act(booking.id, 'check-out')}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                      >
                        Check Out
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stay Requests Tab */}
        {tab === 'Stay Requests' && (
          <div>
            <div className="mb-6">
              <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Guest Stay Requests</h1>
              <p className="text-[#64748B] text-sm">
                Handle early check-in and late check-out requests submitted by booked guests.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {stayRequests.map((req) => (
                <div key={req.id} className="p-5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-[#0F172A]">
                      {req.type === 'EARLY_CHECK_IN' ? 'Early Check-In' : 'Late Check-Out'} · Requested at {req.requestedTime}
                    </div>
                    <div className="text-xs text-[#64748B] mt-0.5">Booking #{req.bookingId.slice(-8)}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : req.status === 'REJECTED'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {req.status}
                    </span>

                    {req.status === 'PENDING' && (
                      <button
                        onClick={() => {
                          setDecidingRequest(req)
                          setDecisionNote('')
                        }}
                        className="px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold"
                      >
                        Decide
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!stayRequests.length && (
                <div className="p-8 text-center text-sm text-[#64748B]">No stay requests on file.</div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Walk-In Booking */}
        {walkInModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Front Desk Walk-In Check-In</h3>
                <button
                  onClick={() => setWalkInModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleWalkInSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Guest Full Name *</label>
                    <input
                      required
                      value={walkInForm.guestName}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestName: e.target.value }))}
                      placeholder="e.g. Almaz Ayana"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Phone Number *</label>
                    <input
                      required
                      value={walkInForm.guestPhone}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestPhone: e.target.value }))}
                      placeholder="+251 91 123 4567"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={walkInForm.guestEmail}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestEmail: e.target.value }))}
                      placeholder="guest@example.com"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">National ID / Passport</label>
                    <input
                      value={walkInForm.guestIdNumber}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestIdNumber: e.target.value }))}
                      placeholder="ID-98765"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Select Room *</label>
                  <select
                    required
                    value={walkInForm.roomId}
                    onChange={(e) => setWalkInForm((p) => ({ ...p, roomId: e.target.value }))}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">Choose an available room…</option>
                    {availableRooms
                      .filter((r) => r.status === 'AVAILABLE')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          Room #{r.roomNumber} ({r.type.replace(/_/g, ' ')}) · {formatMoney(r.basePrice)}/night
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Check-in</label>
                    <input
                      type="date"
                      required
                      value={walkInForm.checkIn}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, checkIn: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Check-out</label>
                    <input
                      type="date"
                      required
                      min={walkInForm.checkIn}
                      value={walkInForm.checkOut}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, checkOut: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Payment Method</label>
                    <select
                      value={walkInForm.paymentMethod}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="CASH">Cash</option>
                      <option value="TELEBIRR">Telebirr</option>
                      <option value="CBE_BIRR">CBE Birr</option>
                      <option value="CREDIT_CARD">Credit Card</option>
                    </select>
                  </div>
                  <div className="pt-5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#334155]">
                      <input
                        type="checkbox"
                        checked={walkInForm.paidImmediately}
                        onChange={(e) => setWalkInForm((p) => ({ ...p, paidImmediately: e.target.checked }))}
                        className="rounded text-[#2563EB]"
                      />
                      Mark Paid Immediately
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setWalkInModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={walkInSubmitting || !walkInForm.roomId}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {walkInSubmitting ? 'Registering…' : 'Check-In Guest'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Room Relocation */}
        {relocateBooking && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Room Relocation</h3>
                <button
                  onClick={() => setRelocateBooking(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRelocateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Target Room *</label>
                  <select
                    required
                    value={relocateNewRoomId}
                    onChange={(e) => setRelocateNewRoomId(e.target.value)}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">Select target room…</option>
                    {availableRooms
                      .filter((r) => r.status === 'AVAILABLE')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          Room #{r.roomNumber} ({r.type.replace(/_/g, ' ')})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Reason for Relocation *</label>
                  <textarea
                    required
                    rows={2}
                    value={relocateReason}
                    onChange={(e) => setRelocateReason(e.target.value)}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setRelocateBooking(null)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={relocateSubmitting || !relocateNewRoomId}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {relocateSubmitting ? 'Relocating…' : 'Confirm Relocation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Decide Stay Request */}
        {decidingRequest && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Decide Stay Request</h3>
                <button
                  onClick={() => setDecidingRequest(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 text-sm text-[#334155] space-y-1">
                <p>
                  <strong>Type:</strong>{' '}
                  {decidingRequest.type === 'EARLY_CHECK_IN' ? 'Early Check-In' : 'Late Check-Out'}
                </p>
                <p>
                  <strong>Requested Time:</strong> {decidingRequest.requestedTime}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Decision Note / Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Approved per hotel availability"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    disabled={decidingSubmitting}
                    onClick={() => handleDecideStayRequest('REJECTED')}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold"
                  >
                    Reject
                  </button>
                  <button
                    disabled={decidingSubmitting}
                    onClick={() => handleDecideStayRequest('APPROVED')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}