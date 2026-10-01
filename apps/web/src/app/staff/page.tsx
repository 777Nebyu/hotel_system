'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { managerApi, paymentApi } from '@/lib/services'
import { useAuth } from '@/lib/auth-store'
import AuthGate from '@/components/AuthGate'
import type { Booking, Hotel, OperationalRoom, Room, StayRequest } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'
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
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  Users,
  Calendar,
  Banknote,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'



type Tab = 'Dashboard' | 'Housekeeping & Rooms' | 'Bookings' | 'Stay Requests'

type StaffBooking = Booking & {
  bookingRef?: string | null
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
  const router = useRouter()
  const { user, isInitialized } = useAuth()
  const { t } = useLanguage()

  useEffect(() => {
    if (isInitialized && user?.role === 'MANAGER') {
      router.replace('/manager')
    }
  }, [user, isInitialized, router])

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        <div className="w-8 h-8 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (user?.role === 'MANAGER') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        {t('staff', 'redirectingToManager')}
      </div>
    )
  }

  return (
    <AuthGate roles={['STAFF', 'ADMIN']}>
      <StaffDashboard />
    </AuthGate>
  )
}

function StaffDashboard() {
  const router = useRouter()
  const logout = useAuth((state) => state.logout)
  const user = useAuth((state) => state.user)
  const { t } = useLanguage()

  const tabLabels: Record<Tab, string> = {
    Dashboard: t('staff', 'tabDashboard'),
    'Housekeeping & Rooms': t('staff', 'tabHousekeeping'),
    Bookings: t('staff', 'tabBookings'),
    'Stay Requests': t('staff', 'tabStayRequests'),
  }

  const statusLabel = (status: string) => {
    if (status === 'PENDING') return t('staff', 'statusPending')
    if (status === 'CONFIRMED') return t('staff', 'statusConfirmed')
    if (status === 'CHECKED_IN') return t('staff', 'statusCheckedIn')
    if (status === 'CHECKED_OUT') return t('staff', 'statusCheckedOut')
    if (status === 'CANCELLED') return t('staff', 'statusCancelled')
    if (status === 'REJECTED') return t('staff', 'statusRejected')
    if (status === 'APPROVED') return t('staff', 'statusApproved')
    if (status === 'AVAILABLE') return t('staff', 'statusAvailable')
    if (status === 'CLEANING') return t('staff', 'statusCleaning')
    if (status === 'MAINTENANCE') return t('staff', 'statusMaintenance')
    if (status === 'UNAVAILABLE') return t('staff', 'statusUnavailable')
    if (status === 'SUCCEEDED') return t('staff', 'statusSucceeded')
    if (status === 'FAILED') return t('staff', 'statusFailed')
    if (status === 'ACTIVE') return t('staff', 'statusActive')
    return status
  }

  const roomTypeLabel = (type: string) => {
    if (type === 'SINGLE') return t('staff', 'roomTypeSingle')
    if (type === 'DOUBLE') return t('staff', 'roomTypeDouble')
    if (type === 'SUITE') return t('staff', 'roomTypeSuite')
    if (type === 'DELUXE') return t('staff', 'roomTypeDeluxe')
    if (type === 'PRESIDENTIAL') return t('staff', 'roomTypePresidential')
    return type.replace(/_/g, ' ')
  }

  const roomFilterLabels: Record<string, string> = {
    ALL: t('staff', 'filterAll'),
    AVAILABLE: t('staff', 'kpiAvailable'),
    CLEANING: t('staff', 'kpiCleaning'),
    MAINTENANCE: t('staff', 'kpiMaintenance'),
    OCCUPIED: t('staff', 'kpiOccupied'),
  }

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

  // Auto-dismiss notification banners
  useEffect(() => {
    if (!successBanner) return
    const timer = setTimeout(() => setSuccessBanner(''), 5000)
    return () => clearTimeout(timer)
  }, [successBanner])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(''), 7000)
    return () => clearTimeout(timer)
  }, [error])


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
  const [relocateReason, setRelocateReason] = useState(t('staff', 'defaultRelocateReason'))
  const [relocateSubmitting, setRelocateSubmitting] = useState(false)

  // Stay Requests
  const [stayRequests, setStayRequests] = useState<StayRequest[]>([])
  const [decidingRequest, setDecidingRequest] = useState<StayRequest | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [decidingSubmitting, setDecidingSubmitting] = useState(false)

  // No-Show Confirmation Modal
  const [noShowModalBooking, setNoShowModalBooking] = useState<StaffBooking | null>(null)
  const [noShowSubmitting, setNoShowSubmitting] = useState(false)


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
      setSuccessBanner(
        t('staff', 'msgRoomStatusUpdated', { status: statusLabel(newStatus) }),
      )
      setOperationalRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r)),
      )
      if (selectedHotelId) {
        void loadOperationalRooms(selectedHotelId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('staff', 'errUpdateRoomStatus'))
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
      setError(caught instanceof Error ? caught.message : t('staff', 'errLoadDashboard'))
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
      setSuccessBanner(
        action === 'confirm'
          ? t('staff', 'msgMarkedConfirm')
          : action === 'reject'
            ? t('staff', 'msgMarkedReject')
            : action === 'check-in'
              ? t('staff', 'msgMarkedCheckIn')
              : t('staff', 'msgMarkedCheckOut'),
      )
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('staff', 'errUpdateReservation'))
    } finally {
      setActing(null)
    }
  }

  const markCashPaid = async (bookingId: string) => {
    setError('')
    try {
      await paymentApi.markCashPaid(bookingId, 'Front desk cash collection')
      setSuccessBanner(t('staff', 'msgCashPaid'))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('staff', 'errRecordCashPayment'))
    }
  }

  const confirmNoShow = async () => {
    if (!noShowModalBooking) return
    setNoShowSubmitting(true)
    setError('')
    try {
      await managerApi.noShow(noShowModalBooking.id)
      setSuccessBanner(
        t('staff', 'msgNoShowMarked', { ref: noShowModalBooking.bookingRef ?? '' }),
      )
      setNoShowModalBooking(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('staff', 'errMarkNoShow'))
    } finally {
      setNoShowSubmitting(false)
    }
  }

  const openNoShowModal = (booking: StaffBooking) => {
    setNoShowModalBooking(booking)
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
      setSuccessBanner(t('staff', 'msgWalkInCreated'))
      setWalkInModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('staff', 'errWalkIn'))
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
      setSuccessBanner(t('staff', 'msgGuestTransferred'))
      setRelocateBooking(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('staff', 'errTransferGuest'))
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
      setSuccessBanner(
        decision === 'APPROVED' ? t('staff', 'msgStayRequestApproved') : t('staff', 'msgStayRequestRejected'),
      )
      setDecidingRequest(null)
      setDecisionNote('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('staff', 'errProcessStayRequest'))
    } finally {
      setDecidingSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        {t('staff', 'loadingPortal')}
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
          <div className="font-semibold text-[#0F172A] mt-3">{user?.fullName || t('staff', 'sidebarFallbackName')}</div>
          <div className="text-[#64748B] text-xs">{t('staff', 'sidebarSuiteName')}</div>
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
              <span>{tabLabels[item]}</span>
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
            {t('staff', 'signOut')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8 max-w-6xl overflow-auto">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-600 hover:text-rose-900 p-1.5 rounded-lg hover:bg-rose-100/60 transition-colors cursor-pointer"
              aria-label={t('staff', 'dismissNotification')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successBanner && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner('')}
              className="text-emerald-600 hover:text-emerald-900 p-1.5 rounded-lg hover:bg-emerald-100/60 transition-colors cursor-pointer"
              aria-label={t('staff', 'dismissNotification')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* Dashboard Tab */}
        {tab === 'Dashboard' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="font-serif text-3xl text-[#0F172A]">{t('staff', 'dashboardTitle')}</h1>
                <p className="text-[#64748B]">{t('staff', 'dashboardSubtitle')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setWalkInModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  {t('staff', 'btnWalkInGuest')}
                </button>
                <button
                  onClick={() => void load()}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  {t('staff', 'btnRefresh')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: t('staff', 'metricPendingApprovals'), value: stats.pendingApprovals, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                { label: t('staff', 'metricTodaysCheckIns'), value: stats.todaysCheckIns, icon: ArrowDownLeft, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                { label: t('staff', 'metricTodaysCheckOuts'), value: stats.todaysCheckOuts, icon: ArrowUpRight, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                { label: t('staff', 'metricActiveGuests'), value: stats.activeGuests, icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              ].map((item) => {
                const IconComp = item.icon
                return (
                  <div key={item.label} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${item.color}`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-[#0F172A] text-2xl">{item.value}</div>
                      <div className="text-[#64748B] text-xs">{item.label}</div>
                    </div>
                  </div>
                )
              })}
              <div
                onClick={() => setTab('Housekeeping & Rooms')}
                className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm hover:border-amber-300 cursor-pointer transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-amber-100 bg-amber-50 text-amber-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full group-hover:bg-amber-100">
                    {t('staff', 'boardLink')}
                  </span>
                </div>
                <div>
                  <div className="font-bold text-[#0F172A] text-2xl">
                    {operationalRooms.filter((r) => r.status === 'CLEANING' || r.status === 'MAINTENANCE').length}
                  </div>
                  <div className="text-[#64748B] text-xs">{t('staff', 'housekeepingRepairs')}</div>
                </div>
              </div>
            </div>

            {/* Quick Reservations */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              <div className="p-5 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-bold text-[#0F172A]">{t('staff', 'todaysArrivalsTitle')}</h2>
                <button onClick={() => setTab('Bookings')} className="text-sm text-[#2563EB] font-semibold">
                  {t('staff', 'viewAll', { count: bookings.length })}
                </button>
              </div>

              {bookings.slice(0, 8).map((booking) => (
                <div key={booking.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[#0F172A]">
                      {booking.user?.fullName || t('staff', 'walkInGuestFallback')}{' '}
                      <span className="font-mono font-normal text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatMoney(booking.totalPrice)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{booking.user?.phone || t('staff', 'noPhone')}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={booking.status} size="sm" />

                    <button
                      onClick={() => markCashPaid(booking.id)}
                      className="px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Banknote className="w-3.5 h-3.5" /> {t('staff', 'btnCashPaid')}
                    </button>

                    {booking.status === 'PENDING' && (
                      <>
                        <button
                          disabled={acting === booking.id}
                          onClick={() => act(booking.id, 'confirm')}
                          className="px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold"
                        >
                          {t('staff', 'btnConfirm')}
                        </button>
                        <button
                          disabled={acting === booking.id}
                          onClick={() => act(booking.id, 'reject')}
                          className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold"
                        >
                          {t('staff', 'btnReject')}
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
                          {t('staff', 'btnCheckIn')}
                        </button>
                        <button
                          onClick={() => openNoShowModal(booking)}
                          className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                        >

                          {t('staff', 'btnNoShow')}
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
                          {t('staff', 'btnCheckOut')}
                        </button>
                        <button
                          onClick={() => {
                            setRelocateBooking(booking)
                            setRelocateNewRoomId('')
                          }}
                          className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                        >
                          {t('staff', 'btnRelocate')}
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
                  <span>{t('staff', 'housekeepingTitle')}</span>
                </h1>
                <p className="text-[#64748B] text-sm mt-1">
                  {t('staff', 'housekeepingSubtitle')}
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
                  <span>{t('staff', 'btnRefresh')}</span>
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
                <div className="text-xs font-semibold uppercase tracking-wider opacity-75">{t('staff', 'kpiAllRooms')}</div>
                <div className="text-2xl font-bold mt-1.5">{operationalRooms.length}</div>
                <div className="text-[11px] opacity-70 mt-1">{t('staff', 'kpiTotalInventory')}</div>
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
                  <span className={statusFilter === 'AVAILABLE' ? 'text-white' : 'text-emerald-700'}>{t('staff', 'kpiAvailable')}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.status === 'AVAILABLE' && !r.isOccupied).length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">{t('staff', 'kpiAvailableCaption')}</div>
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
                  <span className={statusFilter === 'CLEANING' ? 'text-white' : 'text-amber-700'}>{t('staff', 'kpiCleaning')}</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.status === 'CLEANING').length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">{t('staff', 'kpiCleaningCaption')}</div>
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
                  <span className={statusFilter === 'MAINTENANCE' ? 'text-white' : 'text-rose-700'}>{t('staff', 'kpiMaintenance')}</span>
                  <Wrench className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.status === 'MAINTENANCE').length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">{t('staff', 'kpiMaintenanceCaption')}</div>
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
                  <span className={statusFilter === 'OCCUPIED' ? 'text-white' : 'text-indigo-700'}>{t('staff', 'kpiOccupied')}</span>
                  <User className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold mt-1.5">
                  {operationalRooms.filter((r) => r.isOccupied).length}
                </div>
                <div className="text-[11px] opacity-70 mt-1">{t('staff', 'kpiOccupiedCaption')}</div>
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
                  placeholder={t('staff', 'roomSearchPlaceholder')}
                  className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> {t('staff', 'filterLabel')}
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
                    {roomFilterLabels[filterKey]}
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
                <h3 className="font-bold text-slate-800 text-lg">{t('staff', 'noRoomsTitle')}</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {roomSearchQuery
                    ? t('staff', 'noRoomsMatchQuery', { query: roomSearchQuery })
                    : t('staff', 'noRoomsMatchFilter')}
                </p>
                {(roomSearchQuery || statusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setRoomSearchQuery('')
                      setStatusFilter('ALL')
                    }}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    {t('staff', 'btnClearFilters')}
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
                                  {t('staff', 'roomNumberLabel', { number: room.roomNumber })}
                                </span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tracking-wide">
                                  {roomTypeLabel(room.type)}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-slate-400" /> {t('staff', 'guestsCount', { count: room.capacity })}
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <BedDouble className="w-3.5 h-3.5 text-slate-400" /> {t('staff', 'bedsCount', { count: room.beds })}
                                </span>
                                <span>·</span>
                                <span className="font-medium text-[#0F172A]">{t('staff', 'pricePerNight', { price: formatMoney(room.basePrice) })}</span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                              {room.status === 'AVAILABLE' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('staff', 'badgeReady')}
                                </span>
                              )}
                              {room.status === 'CLEANING' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                  <Sparkles className="w-3.5 h-3.5" /> {t('staff', 'badgeCleaning')}
                                </span>
                              )}
                              {room.status === 'MAINTENANCE' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  <Wrench className="w-3.5 h-3.5" /> {t('staff', 'badgeMaintenance')}
                                </span>
                              )}
                              {room.status === 'UNAVAILABLE' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                  {t('staff', 'badgeBlocked')}
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
                                  <span>{room.currentGuest || t('staff', 'checkedInGuestFallback')}</span>
                                </span>
                                <span className="font-mono text-[11px] text-indigo-600">
                                  #{room.currentBookingRef?.slice(-6) || t('staff', 'stayRefFallback')}
                                </span>
                              </div>
                              <div className="text-slate-600 space-y-0.5 mt-1 text-[11px]">
                                {room.checkOutDate && (
                                  <div>
                                    {t('staff', 'departureLabel')}{' '}
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
                              <span>{t('staff', 'roomVacantLine')}</span>
                            </div>
                          )}
                        </div>

                        {/* Operational Action Controls */}
                        <div className="pt-3 border-t border-slate-100">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            {t('staff', 'housekeepingActions')}
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
                              title={t('staff', 'titleMarkClean')}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{t('staff', 'actionReady')}</span>
                            </button>

                            <button
                              disabled={isMutating || room.status === 'CLEANING'}
                              onClick={() => handleUpdateRoomStatus(room.id, 'CLEANING')}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                                room.status === 'CLEANING'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200 cursor-default opacity-90'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                              }`}
                              title={t('staff', 'titleSendHousekeeping')}
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>{t('staff', 'actionCleaning')}</span>
                            </button>

                            <button
                              disabled={isMutating || room.status === 'MAINTENANCE'}
                              onClick={() => handleUpdateRoomStatus(room.id, 'MAINTENANCE')}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                                room.status === 'MAINTENANCE'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200 cursor-default opacity-90'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                              }`}
                              title={t('staff', 'titleFlagMaintenance')}
                            >
                              <Wrench className="w-3 h-3" />
                              <span>{t('staff', 'actionRepair')}</span>
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
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">{t('staff', 'bookingsTitle')}</h1>
                <p className="text-[#64748B] text-sm">{t('staff', 'bookingsSubtitle', { count: bookings.length })}</p>
              </div>
              <button
                onClick={() => setWalkInModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                {t('staff', 'btnWalkInGuest')}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[#0F172A]">
                      {booking.user?.fullName || t('staff', 'walkInGuestFallback')}{' '}
                      <span className="font-mono font-normal text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatMoney(booking.totalPrice)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{booking.user?.phone || t('staff', 'directWalkIn')}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={booking.status} size="sm" />

                    <button
                      onClick={() => markCashPaid(booking.id)}
                      className="px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Banknote className="w-3.5 h-3.5" /> {t('staff', 'btnMarkCashPaid')}
                    </button>

                    {booking.status === 'CONFIRMED' && (
                      <button
                        disabled={acting === booking.id}
                        onClick={() => act(booking.id, 'check-in')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                      >
                        {t('staff', 'btnCheckIn')}
                      </button>
                    )}

                    {booking.status === 'CHECKED_IN' && (
                      <button
                        disabled={acting === booking.id}
                        onClick={() => act(booking.id, 'check-out')}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                      >
                        {t('staff', 'btnCheckOut')}
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
              <h1 className="font-bold text-[#0F172A] text-2xl mb-1">{t('staff', 'stayRequestsTitle')}</h1>
              <p className="text-[#64748B] text-sm">
                {t('staff', 'stayRequestsSubtitle')}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {stayRequests.map((req) => (
                <div key={req.id} className="p-5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-[#0F172A]">
                      {t('staff', 'stayRequestLine', {
                        type:
                          req.type === 'EARLY_CHECK_IN'
                            ? t('staff', 'earlyCheckIn')
                            : t('staff', 'lateCheckOut'),
                        time: req.requestedTime,
                      })}
                    </div>
                    <div className="text-xs text-[#64748B] mt-0.5">{t('staff', 'bookingRefLabel', { ref: req.bookingId.slice(-8) })}</div>
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
                      {statusLabel(req.status)}
                    </span>

                    {req.status === 'PENDING' && (
                      <button
                        onClick={() => {
                          setDecidingRequest(req)
                          setDecisionNote('')
                        }}
                        className="px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold"
                      >
                        {t('staff', 'btnDecide')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!stayRequests.length && (
                <div className="p-8 text-center text-sm text-[#64748B]">{t('staff', 'noStayRequests')}</div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Walk-In Booking */}
        {walkInModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">{t('staff', 'walkInModalTitle')}</h3>
                <button
                  onClick={() => setWalkInModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label={t('staff', 'closeLabel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleWalkInSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelGuestFullNameStar')}</label>
                    <input
                      required
                      value={walkInForm.guestName}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestName: e.target.value }))}
                      placeholder={t('staff', 'phGuestName')}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelPhoneNumberStar')}</label>
                    <input
                      required
                      value={walkInForm.guestPhone}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestPhone: e.target.value }))}
                      placeholder={t('staff', 'phPhone')}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelEmailOptional')}</label>
                    <input
                      type="email"
                      value={walkInForm.guestEmail}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestEmail: e.target.value }))}
                      placeholder={t('staff', 'phEmail')}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelNationalId')}</label>
                    <input
                      value={walkInForm.guestIdNumber}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, guestIdNumber: e.target.value }))}
                      placeholder={t('staff', 'phIdNumber')}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelSelectRoomStar')}</label>
                  <select
                    required
                    value={walkInForm.roomId}
                    onChange={(e) => setWalkInForm((p) => ({ ...p, roomId: e.target.value }))}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">{t('staff', 'optChooseRoom')}</option>
                    {availableRooms
                      .filter((r) => r.status === 'AVAILABLE')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {t('staff', 'roomOptionLine', {
                            number: r.roomNumber,
                            type: roomTypeLabel(r.type),
                            price: formatMoney(r.basePrice),
                          })}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelCheckIn')}</label>
                    <input
                      type="date"
                      required
                      value={walkInForm.checkIn}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, checkIn: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelCheckOut')}</label>
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
                    <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelPaymentMethod')}</label>
                    <select
                      value={walkInForm.paymentMethod}
                      onChange={(e) => setWalkInForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="CASH">{t('staff', 'optCash')}</option>
                      <option value="TELEBIRR">{t('staff', 'optTelebirr')}</option>
                      <option value="CBE_BIRR">{t('staff', 'optCbeBirr')}</option>
                      <option value="CREDIT_CARD">{t('staff', 'optCreditCard')}</option>
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
                      {t('staff', 'labelMarkPaidImmediately')}
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setWalkInModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    {t('staff', 'btnCancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={walkInSubmitting || !walkInForm.roomId}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {walkInSubmitting ? t('staff', 'registering') : t('staff', 'btnCheckInGuest')}
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
                <h3 className="font-bold text-lg text-[#0F172A]">{t('staff', 'relocateModalTitle')}</h3>
                <button
                  onClick={() => setRelocateBooking(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label={t('staff', 'closeLabel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRelocateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelTargetRoomStar')}</label>
                  <select
                    required
                    value={relocateNewRoomId}
                    onChange={(e) => setRelocateNewRoomId(e.target.value)}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">{t('staff', 'optSelectTargetRoom')}</option>
                    {availableRooms
                      .filter((r) => r.status === 'AVAILABLE')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {t('staff', 'roomOptionLineShort', {
                            number: r.roomNumber,
                            type: roomTypeLabel(r.type),
                          })}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelReasonStar')}</label>
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
                    {t('staff', 'btnCancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={relocateSubmitting || !relocateNewRoomId}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {relocateSubmitting ? t('staff', 'relocating') : t('staff', 'btnConfirmRelocation')}
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
                <h3 className="font-bold text-lg text-[#0F172A]">{t('staff', 'decideModalTitle')}</h3>
                <button
                  onClick={() => setDecidingRequest(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label={t('staff', 'closeLabel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4 text-sm text-[#334155] space-y-1">
                <p>
                  <strong>{t('staff', 'typeLabel')}</strong>{' '}
                  {decidingRequest.type === 'EARLY_CHECK_IN'
                    ? t('staff', 'earlyCheckIn')
                    : t('staff', 'lateCheckOut')}
                </p>
                <p>
                  <strong>{t('staff', 'requestedTimeLabel')}</strong> {decidingRequest.requestedTime}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">{t('staff', 'labelDecisionNote')}</label>
                  <input
                    type="text"
                    placeholder={t('staff', 'phDecisionNote')}
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
                    {t('staff', 'btnReject')}
                  </button>
                  <button
                    disabled={decidingSubmitting}
                    onClick={() => handleDecideStayRequest('APPROVED')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    {t('staff', 'btnApprove')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Guest No-Show Modal */}
        {noShowModalBooking && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#0F172A]">
                    {t('staff', 'noShowConfirmTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('staff', 'reservationRef')} <span className="font-mono font-semibold text-slate-700">{noShowModalBooking.bookingRef}</span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{t('staff', 'guestLabel')}</span>
                  <span className="font-semibold text-slate-800">
                    {noShowModalBooking.user?.fullName || noShowModalBooking.details?.[0]?.guestInfo?.name || t('staff', 'registeredGuest')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{t('staff', 'scheduledStay')}</span>
                  <span className="font-semibold text-slate-800">
                    {noShowModalBooking.checkIn?.slice?.(0, 10)} &rarr; {noShowModalBooking.checkOut?.slice?.(0, 10)}
                  </span>
                </div>
                {noShowModalBooking.details?.[0]?.room && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">{t('staff', 'assignedRoom')}</span>
                    <span className="font-semibold text-slate-800">
                      {t('staff', 'roomWithType', {
                        number: noShowModalBooking.details[0].room.roomNumber,
                        type: roomTypeLabel(noShowModalBooking.details[0].room.type),
                      })}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                {t('staff', 'noShowBodyLead')}{' '}
                <strong>{t('staff', 'noShowBodyStrong')}</strong>{' '}
                {t('staff', 'noShowBodyTail')}
              </p>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={noShowSubmitting}
                  onClick={() => setNoShowModalBooking(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {t('staff', 'btnCancel')}
                </button>
                <button
                  type="button"
                  disabled={noShowSubmitting}
                  onClick={confirmNoShow}
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {noShowSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('staff', 'updating')}
                    </>
                  ) : (
                    t('staff', 'btnConfirmNoShow')
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  )
}