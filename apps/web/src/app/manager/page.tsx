'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hotelApi, managerApi, paymentApi } from '@/lib/services'
import { useAuth } from '@/lib/auth-store'
import AuthGate from '@/components/AuthGate'
import type {
  Booking,
  DailyBookingTrendItem,
  HotelPolicy,
  HotelReportOverview,
  HotelStaffMember,
  MonthlyRevenueItem,
  Review,
  Room,
  StayRequest,
} from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'

type Tab =
  | 'Dashboard'
  | 'Hotels'
  | 'Rooms'
  | 'Pricing'
  | 'Availability'
  | 'Policies'
  | 'Staff'
  | 'Reports'
  | 'Bookings'
  | 'Reviews'


type ManagedHotel = {
  id: string
  name: string
  description?: string | null
  address: string
  status: string
  starRating: number
  city?: { id: string; name: string; country?: { name: string } }
  images?: Array<{ id: string; url: string; isPrimary: boolean }>
  amenities?: string[]
  rooms?: Room[]
  _count?: { rooms: number; bookings: number }
}

type ManagedBooking = Booking & {
  user?: { fullName: string; email: string; phone?: string | null }
  details?: Array<{ id: string; roomId: string; room?: { id: string; roomNumber: string; type: string } }>
}

type Country = { id: string; name: string; code: string }
type City = { id: string; name: string }

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&auto=format'

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

export default function ManagerDashboardPage() {
  return (
    <AuthGate roles={['MANAGER', 'ADMIN']}>
      <ManagerDashboard />
    </AuthGate>
  )
}

function ManagerDashboard() {
  const router = useRouter()
  const logout = useAuth((state) => state.logout)
  const user = useAuth((state) => state.user)

  const [tab, setTab] = useState<Tab>('Dashboard')
  const [hotels, setHotels] = useState<ManagedHotel[]>([])
  const [selectedHotelId, setSelectedHotelId] = useState<string>('')
  const [bookings, setBookings] = useState<ManagedBooking[]>([])
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

  // Countries / Cities for hotel editing
  const [countries, setCountries] = useState<Country[]>([])

  // Modals state
  const [hotelFormOpen, setHotelFormOpen] = useState(false)
  const [editingHotel, setEditingHotel] = useState<ManagedHotel | null>(null)
  const [savingHotel, setSavingHotel] = useState(false)

  // Selected Hotel Detailed Data (Rooms, Policy, Staff, Reports, StayRequests)
  const [selectedHotelRooms, setSelectedHotelRooms] = useState<Room[]>([])
  const [hotelPolicy, setHotelPolicy] = useState<HotelPolicy | null>(null)
  const [policySaving, setPolicySaving] = useState(false)
  const [hotelStaff, setHotelStaff] = useState<HotelStaffMember[]>([])
  const [stayRequests, setStayRequests] = useState<StayRequest[]>([])
  const [reportOverview, setReportOverview] = useState<HotelReportOverview | null>(null)
  const [revenueItems, setRevenueItems] = useState<MonthlyRevenueItem[]>([])
  const [trendItems, setTrendItems] = useState<DailyBookingTrendItem[]>([])

  // Reviews & Management Responses
  const [hotelReviews, setHotelReviews] = useState<Review[]>([])
  const [reviewSummary, setReviewSummary] = useState<{
    averageRating: number | null
    reviewCount: number
    respondedCount: number
    pendingResponseCount: number
  }>({
    averageRating: 0,
    reviewCount: 0,
    respondedCount: 0,
    pendingResponseCount: 0,
  })
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'responded'>('all')
  const [respondingReviewId, setRespondingReviewId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [responseSubmitting, setResponseSubmitting] = useState(false)

  // Room CRUD Modal
  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    type: 'DELUXE',
    capacity: 2,
    beds: 1,
    bathroom: 1,
    basePrice: 1500,
    amenities: 'WiFi, TV, AC',
    description: '',
  })
  const [roomSaving, setRoomSaving] = useState(false)

  // Maintenance Block Modal
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    roomId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    reason: 'Scheduled maintenance',
  })
  const [maintenanceSaving, setMaintenanceSaving] = useState(false)

  // Seasonal Pricing Modal
  const [seasonalModalOpen, setSeasonalModalOpen] = useState(false)
  const [seasonalForm, setSeasonalForm] = useState({
    roomId: '',
    name: 'High Season Rate',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
    priceMultiplier: 1.25,
    fixedPrice: '',
  })
  const [seasonalSaving, setSeasonalSaving] = useState(false)

  // Staff Assign Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false)
  const [staffUserId, setStaffUserId] = useState('')
  const [staffSaving, setStaffSaving] = useState(false)

  // Walk-in Booking Modal
  const [walkInModalOpen, setWalkInModalOpen] = useState(false)
  const [walkInForm, setWalkInForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    guestIdNumber: '',
    roomId: '',
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    paidImmediately: true,
  })
  const [walkInSubmitting, setWalkInSubmitting] = useState(false)

  // Relocate Room Modal
  const [relocateBooking, setRelocateBooking] = useState<ManagedBooking | null>(null)
  const [relocateNewRoomId, setRelocateNewRoomId] = useState('')
  const [relocateReason, setRelocateReason] = useState('Room upgrade / maintenance')
  const [relocateSubmitting, setRelocateSubmitting] = useState(false)

  // Decide Stay Request Modal
  const [decidingRequest, setDecidingRequest] = useState<StayRequest | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [decidingSubmitting, setDecidingSubmitting] = useState(false)

  useEffect(() => {
    void hotelApi.countries().then(setCountries).catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [hotelData, bookingData, statsData] = await Promise.all([
        managerApi.hotels(),
        managerApi.bookings({ pageSize: 50 }),
        managerApi.stats().catch(() => ({
          pendingApprovals: 0,
          todaysCheckIns: 0,
          todaysCheckOuts: 0,
          activeGuests: 0,
        })),
      ])
      const hList = hotelData as unknown as ManagedHotel[]
      setHotels(hList)
      setBookings(bookingData.data as ManagedBooking[])
      setStats(statsData)

      if (hList.length > 0 && !selectedHotelId) {
        setSelectedHotelId(hList[0].id)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load manager dashboard.')
    } finally {
      setLoading(false)
    }
  }, [selectedHotelId])

  useEffect(() => {
    void load()
  }, [load])

  // When active hotel changes, load policy, rooms, staff, stay requests, reports
  const loadHotelDetails = useCallback(async (hId: string) => {
    if (!hId) return
    try {
      const [hotelData, policyData, staffData, requestsData, overviewData, revenueData, trendsData, reviewsData] =
        await Promise.all([
          hotelApi.getById(hId).catch(() => null),
          managerApi.getPolicy(hId).catch(() => null),
          managerApi.listStaff(hId).catch(() => ({ data: [] })),
          managerApi.listStayRequests(hId).catch(() => []),
          managerApi.reportOverview(hId).catch(() => null),
          managerApi.reportRevenue(hId, 6).catch(() => []),
          managerApi.reportTrends(hId, 30).catch(() => []),
          managerApi.listReviews(hId).catch(() => null),
        ])

      if (hotelData?.rooms) setSelectedHotelRooms(hotelData.rooms)
      if (policyData) setHotelPolicy(policyData)
      if (staffData?.data) setHotelStaff(staffData.data)
      setStayRequests(requestsData)
      setReportOverview(overviewData)
      setRevenueItems(revenueData)
      setTrendItems(trendsData)
      if (reviewsData?.data) {
        setHotelReviews(reviewsData.data)
        setReviewSummary(reviewsData.summary)
      }

    } catch {
      // Graceful fallback for partial tabs
    }
  }, [])

  useEffect(() => {
    if (selectedHotelId) {
      void loadHotelDetails(selectedHotelId)
    }
  }, [selectedHotelId, loadHotelDetails])

  const selectedHotel = useMemo(
    () => hotels.find((h) => h.id === selectedHotelId) || hotels[0],
    [hotels, selectedHotelId],
  )

  // Booking Actions
  const act = async (id: string, action: 'confirm' | 'reject' | 'check-in' | 'check-out') => {
    setActing(id)
    setError('')
    try {
      await managerApi.action(id, action)
      setSuccessBanner(`Booking marked as ${action.replace('-', ' ')}.`)
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
      await paymentApi.markCashPaid(bookingId, 'Cash paid at front desk')
      setSuccessBanner('Payment marked as SUCCEEDED (Cash).')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update payment.')
    }
  }

  const markNoShow = async (bookingId: string) => {
    if (!confirm('Are you sure you want to mark this guest as No-Show? Availability will be released.')) return
    setError('')
    try {
      await managerApi.noShow(bookingId)
      setSuccessBanner('Booking marked as No-Show.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to mark No-Show.')
    }
  }

  // Review Response Handlers
  const handleSaveResponse = async (reviewId: string) => {
    if (!responseText.trim() || !selectedHotelId) return
    setResponseSubmitting(true)
    setError('')
    try {
      await managerApi.respondToReview(selectedHotelId, reviewId, responseText.trim())
      setSuccessBanner('Public management response published successfully.')
      setRespondingReviewId(null)
      setResponseText('')
      const res = await managerApi.listReviews(selectedHotelId)
      if (res?.data) {
        setHotelReviews(res.data)
        setReviewSummary(res.summary)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to publish review response.')
    } finally {
      setResponseSubmitting(false)
    }
  }

  const handleDeleteResponse = async (reviewId: string) => {
    if (!selectedHotelId) return
    if (!confirm('Are you sure you want to delete this public response?')) return
    setError('')
    try {
      await managerApi.deleteReviewResponse(selectedHotelId, reviewId)
      setSuccessBanner('Public management response removed.')
      const res = await managerApi.listReviews(selectedHotelId)
      if (res?.data) {
        setHotelReviews(res.data)
        setReviewSummary(res.summary)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to remove response.')
    }
  }

  // Save Hotel

  const saveHotel = async (payload: Record<string, unknown>, hotelId?: string) => {
    setSavingHotel(true)
    setError('')
    try {
      if (hotelId) await managerApi.updateHotel(hotelId, payload)
      else await managerApi.createHotel(payload)
      setHotelFormOpen(false)
      setEditingHotel(null)
      setSuccessBanner(hotelId ? 'Hotel details updated!' : 'Hotel created successfully!')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save hotel.')
    } finally {
      setSavingHotel(false)
    }
  }

  // Room CRUD Handlers
  const handleOpenCreateRoom = () => {
    setEditingRoom(null)
    setRoomForm({
      roomNumber: '',
      type: 'DELUXE',
      capacity: 2,
      beds: 1,
      bathroom: 1,
      basePrice: 1500,
      amenities: 'WiFi, TV, AC',
      description: '',
    })
    setRoomModalOpen(true)
  }

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoom(room)
    setRoomForm({
      roomNumber: room.roomNumber,
      type: room.type,
      capacity: room.capacity,
      beds: room.beds,
      bathroom: room.bathroom,
      basePrice: Number(room.basePrice),
      amenities: (room.amenities || []).join(', '),
      description: room.description || '',
    })
    setRoomModalOpen(true)
  }

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHotelId) return
    setRoomSaving(true)
    setError('')
    try {
      const payload = {
        roomNumber: roomForm.roomNumber.trim(),
        type: roomForm.type,
        capacity: Number(roomForm.capacity),
        beds: Number(roomForm.beds),
        bathroom: Number(roomForm.bathroom),
        basePrice: Number(roomForm.basePrice),
        amenities: roomForm.amenities.split(',').map((a) => a.trim()).filter(Boolean),
        description: roomForm.description.trim() || undefined,
      }
      if (editingRoom) {
        await managerApi.updateRoom(editingRoom.id, payload)
        setSuccessBanner(`Room ${payload.roomNumber} updated!`)
      } else {
        await managerApi.createRoom(selectedHotelId, payload)
        setSuccessBanner(`Room ${payload.roomNumber} created!`)
      }
      setRoomModalOpen(false)
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save room.')
    } finally {
      setRoomSaving(false)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return
    setError('')
    try {
      await managerApi.deleteRoom(roomId)
      setSuccessBanner('Room deleted.')
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete room.')
    }
  }

  // Maintenance Block
  const handleBlockMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!maintenanceForm.roomId) return
    setMaintenanceSaving(true)
    setError('')
    try {
      await managerApi.blockMaintenance(maintenanceForm)
      setSuccessBanner('Room marked for maintenance block.')
      setMaintenanceModalOpen(false)
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to block maintenance.')
    } finally {
      setMaintenanceSaving(false)
    }
  }

  // Seasonal Pricing
  const handleSaveSeasonalPricing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!seasonalForm.roomId) return
    setSeasonalSaving(true)
    setError('')
    try {
      await managerApi.upsertSeasonalPricing(seasonalForm.roomId, {
        name: seasonalForm.name.trim(),
        startDate: seasonalForm.startDate,
        endDate: seasonalForm.endDate,
        priceMultiplier: seasonalForm.priceMultiplier ? Number(seasonalForm.priceMultiplier) : undefined,
        fixedPrice: seasonalForm.fixedPrice ? Number(seasonalForm.fixedPrice) : undefined,
      })
      setSuccessBanner('Seasonal pricing rule established!')
      setSeasonalModalOpen(false)
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set seasonal pricing.')
    } finally {
      setSeasonalSaving(false)
    }
  }

  // Policy Save
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHotelId) return
    setPolicySaving(true)
    setError('')
    try {
      const updated = await managerApi.upsertPolicy(selectedHotelId, hotelPolicy || {})
      setHotelPolicy(updated)
      setSuccessBanner('Hotel policy rules updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy.')
    } finally {
      setPolicySaving(false)
    }
  }

  // Staff Assign & Remove
  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHotelId || !staffUserId.trim()) return
    setStaffSaving(true)
    setError('')
    try {
      await managerApi.assignStaff(selectedHotelId, { userId: staffUserId.trim() })
      setSuccessBanner('Staff member assigned to hotel!')
      setStaffModalOpen(false)
      setStaffUserId('')
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign staff member.')
    } finally {
      setStaffSaving(false)
    }
  }

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm('Remove this staff member from this hotel?')) return
    setError('')
    try {
      await managerApi.removeStaff(selectedHotelId, staffId)
      setSuccessBanner('Staff member removed.')
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove staff.')
    }
  }

  // Walk-in Booking
  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHotelId || !walkInForm.roomId) return
    setWalkInSubmitting(true)
    setError('')
    try {
      await managerApi.createWalkIn({
        hotelId: selectedHotelId,
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
      setSuccessBanner('Walk-in guest checked in & reservation registered!')
      setWalkInModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create walk-in booking.')
    } finally {
      setWalkInSubmitting(false)
    }
  }

  // Relocate Room Submit
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
      setSuccessBanner('Guest relocated to new room successfully!')
      setRelocateBooking(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to relocate room.')
    } finally {
      setRelocateSubmitting(false)
    }
  }

  // Decide Stay Request Submit
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
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stay request.')
    } finally {
      setDecidingSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        Loading manager dashboard…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] hidden lg:flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-[#E2E8F0]">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {user?.fullName.charAt(0).toUpperCase() || 'M'}
          </div>
          <div className="font-semibold text-[#0F172A] mt-3">{user?.fullName || 'Manager'}</div>
          <div className="text-[#64748B] text-xs">Hotel Management Suite</div>

          {/* Hotel Selector Dropdown */}
          {hotels.length > 0 && (
            <div className="mt-4">
              <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">
                Active Property
              </label>
              <select
                value={selectedHotelId}
                onChange={(e) => setSelectedHotelId(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {(
            [
              'Dashboard',
              'Hotels',
              'Rooms',
              'Pricing',
              'Availability',
              'Policies',
              'Staff',
              'Reports',
              'Bookings',
              'Reviews',
            ] as Tab[]
          ).map((item) => (
            <button
              key={item}
              onClick={() => {
                setTab(item)
                setError('')
                setSuccessBanner('')
              }}
              className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === item ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <span>{item}</span>
              {item === 'Reviews' && reviewSummary.pendingResponseCount > 0 && (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === 'Reviews' ? 'bg-white text-[#2563EB]' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {reviewSummary.pendingResponseCount}
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

      {/* Main Panel */}
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

        {/* Tab 1: Dashboard Overview */}
        {tab === 'Dashboard' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="font-serif text-3xl text-[#0F172A]">Manager Overview</h1>
                <p className="text-[#64748B]">Live operations for {selectedHotel?.name || 'Assigned Hotels'}.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setWalkInModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  + Walk-in Guest
                </button>
                <button
                  onClick={() => void load()}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                ['Pending approvals', stats.pendingApprovals, '⏳'],
                ["Today's check-ins", stats.todaysCheckIns, '↪'],
                ["Today's check-outs", stats.todaysCheckOuts, '↩'],
                ['Active guests', stats.activeGuests, '👥'],
              ].map(([label, value, icon]) => (
                <div key={String(label)} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
                  <div className="text-2xl mb-3">{icon}</div>
                  <div className="font-bold text-[#0F172A] text-2xl">{value}</div>
                  <div className="text-[#64748B] text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Pending Stay Requests Alert */}
            {stayRequests.filter((r) => r.status === 'PENDING').length > 0 && (
              <div className="mb-8 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                    <span>🕒</span> Pending Guest Stay Requests (
                    {stayRequests.filter((r) => r.status === 'PENDING').length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {stayRequests
                    .filter((r) => r.status === 'PENDING')
                    .map((req) => (
                      <div
                        key={req.id}
                        className="bg-white rounded-xl p-3 border border-indigo-100 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-sm text-[#0F172A]">
                            {req.type === 'EARLY_CHECK_IN' ? 'Early Check-In' : 'Late Check-Out'}
                          </span>{' '}
                          <span className="text-xs text-[#64748B]">at {req.requestedTime}</span>
                          <span className="font-mono text-xs text-[#94A3B8] block">Booking #{req.bookingId.slice(-8)}</span>
                        </div>
                        <button
                          onClick={() => {
                            setDecidingRequest(req)
                            setDecisionNote('')
                          }}
                          className="px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold"
                        >
                          Review & Decide
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Reservations */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#F1F5F9] flex justify-between items-center">
                <h2 className="font-bold text-[#0F172A]">Recent Reservations</h2>
                <button onClick={() => setTab('Bookings')} className="text-sm text-[#2563EB] font-semibold">
                  View All ({bookings.length}) →
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {bookings.slice(0, 6).map((booking) => (
                  <div key={booking.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[#0F172A]">
                        {booking.user?.fullName || 'Walk-in Guest'}{' '}
                        <span className="font-mono font-normal text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                      </div>
                      <div className="text-[#64748B] text-xs mt-1">
                        {booking.hotel?.name} · {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} ·{' '}
                        {formatMoney(booking.totalPrice)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle(booking.status)}`}>
                        {booking.status.replace(/_/g, ' ')}
                      </span>
                      {booking.status === 'PENDING' && (
                        <>
                          <button
                            disabled={acting === booking.id}
                            onClick={() => act(booking.id, 'confirm')}
                            className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold"
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
          </div>
        )}

        {/* Tab 2: Hotels Management */}
        {tab === 'Hotels' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">My Hotels</h1>
                <p className="text-[#64748B] text-sm">{hotels.length} managed properties</p>
              </div>
              <button
                onClick={() => {
                  setEditingHotel(null)
                  setHotelFormOpen(true)
                }}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                + New Hotel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {hotels.map((hotel) => (
                <div key={hotel.id} className="bg-white rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-sm flex flex-col">
                  <img
                    src={hotel.images?.find((img) => img.isPrimary)?.url || hotel.images?.[0]?.url || FALLBACK_IMAGE}
                    alt={hotel.name}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between gap-3">
                        <div>
                          <h2 className="font-semibold text-[#0F172A] text-lg">{hotel.name}</h2>
                          <p className="text-[#64748B] text-xs mt-1">{hotel.city?.name || hotel.address}</p>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 h-fit font-semibold rounded-full ${
                            hotel.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {hotel.status}
                        </span>
                      </div>

                      <div className="flex gap-4 mt-4 text-xs text-[#64748B]">
                        <span>★ {hotel.starRating} Stars</span>
                        <span>{hotel._count?.rooms ?? 0} rooms</span>
                        <span>{hotel._count?.bookings ?? 0} bookings</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-5 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedHotelId(hotel.id)
                          setTab('Rooms')
                        }}
                        className="px-3 py-1.5 bg-blue-50 text-[#2563EB] rounded-lg text-xs font-semibold hover:bg-blue-100"
                      >
                        Rooms
                      </button>
                      <button
                        onClick={() => {
                          setSelectedHotelId(hotel.id)
                          setTab('Policies')
                        }}
                        className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
                      >
                        Policies
                      </button>
                      <button
                        onClick={() => {
                          setEditingHotel(hotel)
                          setHotelFormOpen(true)
                        }}
                        className="px-3 py-1.5 border border-[#E2E8F0] text-[#334155] rounded-lg text-xs font-semibold hover:border-slate-400 ml-auto"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Rooms Management */}
        {tab === 'Rooms' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Room Inventory</h1>
                <p className="text-[#64748B] text-sm">Managing rooms for {selectedHotel?.name || 'Hotel'}</p>
              </div>
              <button
                onClick={handleOpenCreateRoom}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                + Add Room
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectedHotelRooms.map((room) => (
                <div key={room.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-lg text-[#0F172A]">Room #{room.roomNumber}</span>
                        <p className="text-xs text-[#64748B] uppercase font-semibold">{room.type.replace(/_/g, ' ')}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          room.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : room.status === 'MAINTENANCE'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {room.status}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-[#0F172A] mb-3">
                      {formatMoney(room.basePrice)} <span className="font-normal text-xs text-[#64748B]">/ night</span>
                    </div>

                    <div className="text-xs text-[#64748B] space-y-1 mb-4">
                      <div>Capacity: {room.capacity} guests · {room.beds} bed(s) · {room.bathroom} bath</div>
                      {room.amenities?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {room.amenities.map((a) => (
                            <span key={a} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px]">
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEditRoom(room)}
                      className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!selectedHotelRooms.length && (
                <div className="col-span-3 p-12 text-center bg-white border border-[#E2E8F0] rounded-2xl text-[#64748B]">
                  No rooms created yet for this hotel. Click &quot;+ Add Room&quot; to configure your inventory.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Seasonal Pricing */}
        {tab === 'Pricing' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Seasonal Dynamic Pricing</h1>
                <p className="text-[#64748B] text-sm">
                  Apply multipliers and price overrides during holidays and peak seasons.
                </p>
              </div>
              <button
                onClick={() => {
                  setSeasonalForm({
                    roomId: selectedHotelRooms[0]?.id || '',
                    name: 'Peak Season Override',
                    startDate: new Date().toISOString().slice(0, 10),
                    endDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
                    priceMultiplier: 1.25,
                    fixedPrice: '',
                  })
                  setSeasonalModalOpen(true)
                }}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                + Add Pricing Rule
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
              <h3 className="font-bold text-[#0F172A] mb-4">Active Pricing Rules</h3>
              <p className="text-sm text-[#64748B] mb-4">
                Seasonal pricing rules dynamically alter the nightly rate shown on search and booking quotes.
              </p>
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 leading-relaxed">
                💡 <strong>Tip:</strong> A multiplier of 1.25 increases nightly prices by 25%. Fixed price overrides
                completely replace base pricing for the defined date window.
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Availability & Maintenance */}
        {tab === 'Availability' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Availability & Maintenance</h1>
                <p className="text-[#64748B] text-sm">Block rooms out of service for repairs or deep cleaning.</p>
              </div>
              <button
                onClick={() => {
                  setMaintenanceForm({
                    roomId: selectedHotelRooms[0]?.id || '',
                    startDate: new Date().toISOString().slice(0, 10),
                    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
                    reason: 'Plumbing / HVAC maintenance',
                  })
                  setMaintenanceModalOpen(true)
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                + Block Maintenance
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
              <h3 className="font-bold text-[#0F172A] mb-2">Room Maintenance Schedules</h3>
              <p className="text-sm text-[#64748B] mb-6">
                Rooms blocked for maintenance are immediately hidden from customer search availability.
              </p>
              <div className="divide-y divide-slate-100">
                {selectedHotelRooms.map((r) => (
                  <div key={r.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#0F172A]">Room #{r.roomNumber}</span>
                      <span className="text-xs text-[#64748B] ml-2">({r.type.replace(/_/g, ' ')})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          r.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Hotel Policies */}
        {tab === 'Policies' && (
          <div>
            <div className="mb-6">
              <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Hotel Policies & Rules</h1>
              <p className="text-[#64748B] text-sm">
                Configure check-in/out hours, cancellation policies, and early/late fees for {selectedHotel?.name}.
              </p>
            </div>

            <form onSubmit={handleSavePolicy} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1.5">
                    Standard Check-in Time (HH:mm)
                  </label>
                  <input
                    type="time"
                    required
                    value={hotelPolicy?.checkInTime || '14:00'}
                    onChange={(e) => setHotelPolicy((prev) => ({ ...prev!, checkInTime: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1.5">
                    Standard Check-out Time (HH:mm)
                  </label>
                  <input
                    type="time"
                    required
                    value={hotelPolicy?.checkOutTime || '11:00'}
                    onChange={(e) => setHotelPolicy((prev) => ({ ...prev!, checkOutTime: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1.5">
                    Cancellation Window (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={hotelPolicy?.cancellationWindowDays ?? 3}
                    onChange={(e) =>
                      setHotelPolicy((prev) => ({ ...prev!, cancellationWindowDays: Number(e.target.value) }))
                    }
                    className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                  <p className="text-[11px] text-[#94A3B8] mt-1">Full refund permitted up to this many days before check-in.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1.5">
                    Cancellation Fee Percent (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Number(hotelPolicy?.cancellationFeePercent ?? 0)}
                    onChange={(e) =>
                      setHotelPolicy((prev) => ({ ...prev!, cancellationFeePercent: Number(e.target.value) }))
                    }
                    className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1.5">
                    Early Check-in Fee (ETB)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={Number(hotelPolicy?.earlyCheckInFee ?? 0)}
                    onChange={(e) =>
                      setHotelPolicy((prev) => ({ ...prev!, earlyCheckInFee: Number(e.target.value) }))
                    }
                    className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1.5">
                    Late Check-out Fee (ETB)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={Number(hotelPolicy?.lateCheckOutFee ?? 0)}
                    onChange={(e) =>
                      setHotelPolicy((prev) => ({ ...prev!, lateCheckOutFee: Number(e.target.value) }))
                    }
                    className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={policySaving}
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  {policySaving ? 'Saving…' : 'Save Policies'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 7: Staff Management */}
        {tab === 'Staff' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Hotel Staff Team</h1>
                <p className="text-[#64748B] text-sm">Assign front desk personnel to {selectedHotel?.name}.</p>
              </div>
              <button
                onClick={() => {
                  setStaffUserId('')
                  setStaffModalOpen(true)
                }}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                + Assign Staff
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden divide-y divide-slate-100">
              {hotelStaff.map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                      {member.user?.fullName?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-[#0F172A]">{member.user?.fullName}</div>
                      <div className="text-xs text-[#64748B]">
                        {member.user?.email} · {member.user?.phone || 'No phone'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveStaff(member.id)}
                    className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!hotelStaff.length && (
                <div className="p-8 text-center text-sm text-[#64748B]">
                  No staff members currently assigned to this hotel.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 8: Reports & Analytics */}
        {tab === 'Reports' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Reports & Analytics</h1>
                <p className="text-[#64748B] text-sm">Performance metrics and audit exports for {selectedHotel?.name}.</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={managerApi.exportReportUrl(selectedHotelId, 'overview', 'pdf')}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-white shadow-sm"
                >
                  <span>📄</span> Export PDF
                </a>
                <a
                  href={managerApi.exportReportUrl(selectedHotelId, 'overview', 'excel')}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-white shadow-sm"
                >
                  <span>📊</span> Export Excel
                </a>
              </div>
            </div>

            {reportOverview && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Total Bookings</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">{reportOverview.totalBookings}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Confirmed / Active</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">{reportOverview.confirmedBookings}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Occupancy Rate</div>
                  <div className="text-2xl font-bold text-[#2563EB] mt-1">
                    {(reportOverview.occupancyRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Total Revenue</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">
                    {formatMoney(reportOverview.totalRevenue)}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Active Room Inventory</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">{reportOverview.activeRooms}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Cancellations</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{reportOverview.cancelledBookings}</div>
                </div>
              </div>
            )}

            {/* Monthly Revenue Breakdown */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm mb-6">
              <h3 className="font-bold text-[#0F172A] text-lg mb-4">Monthly Revenue Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[#64748B] text-xs">
                      <th className="pb-3">Month</th>
                      <th className="pb-3">Bookings</th>
                      <th className="pb-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenueItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 font-medium text-[#0F172A]">{item.month}</td>
                        <td className="py-3 text-[#64748B]">{item.bookings}</td>
                        <td className="py-3 text-right font-bold text-[#0F172A]">{formatMoney(item.revenue)}</td>
                      </tr>
                    ))}
                    {!revenueItems.length && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-[#94A3B8]">
                          No historical revenue recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 9: All Reservations */}
        {tab === 'Bookings' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Guest Reservations</h1>
                <p className="text-[#64748B] text-sm">{bookings.length} reservations on file</p>
              </div>
              <button
                onClick={() => setWalkInModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                + Walk-in Guest
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#0F172A]">{booking.user?.fullName || 'Walk-in Guest'}</span>
                      <span className="font-mono text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle(booking.status)}`}>
                        {booking.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 space-x-3">
                      <span>📅 {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</span>
                      <span>💰 {formatMoney(booking.totalPrice)}</span>
                      <span>📞 {booking.user?.phone || 'Direct Walk-in'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => markCashPaid(booking.id)}
                      className="px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold"
                    >
                      💵 Mark Cash Paid
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
                          Relocate Room
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!bookings.length && <p className="p-10 text-center text-[#64748B]">No reservations recorded.</p>}
            </div>
          </div>
        )}

        {/* Tab 10: Reviews & Public Responses */}
        {tab === 'Reviews' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">
                  Guest Reviews &amp; Public Responses
                </h1>
                <p className="text-[#64748B] text-sm">
                  Manage verified guest feedback for {selectedHotel?.name || 'your hotel'} and publish official responses.
                </p>
              </div>
              <button
                onClick={() => selectedHotelId && loadHotelDetails(selectedHotelId)}
                className="px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold self-start sm:self-auto flex items-center gap-1.5"
              >
                <span>🔄 Refresh</span>
              </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
                <p className="text-xs font-medium text-[#64748B]">Total Reviews</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{reviewSummary.reviewCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Verified guest stays</p>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
                <p className="text-xs font-medium text-[#64748B]">Average Rating</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {reviewSummary.averageRating ? Number(reviewSummary.averageRating).toFixed(1) : '—'}
                  </p>
                  <span className="text-amber-500 text-sm">★</span>
                  <span className="text-xs text-slate-400">/ 5.0</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Overall satisfaction</p>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
                <p className="text-xs font-medium text-[#64748B]">Responded</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{reviewSummary.respondedCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Public responses active</p>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
                <p className="text-xs font-medium text-amber-800">Needs Response</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">{reviewSummary.pendingResponseCount}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Pending management action</p>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  reviewFilter === 'all'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Reviews ({reviewSummary.reviewCount})
              </button>
              <button
                onClick={() => setReviewFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  reviewFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                }`}
              >
                Needs Response ({reviewSummary.pendingResponseCount})
              </button>
              <button
                onClick={() => setReviewFilter('responded')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  reviewFilter === 'responded'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                Responded ({reviewSummary.respondedCount})
              </button>
            </div>

            {/* Reviews List */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {hotelReviews
                .filter((r) => {
                  if (reviewFilter === 'pending') return !r.response
                  if (reviewFilter === 'responded') return !!r.response
                  return true
                })
                .map((rev) => {
                  const isResponding = respondingReviewId === rev.id
                  return (
                    <div key={rev.id} className="p-6 space-y-4">
                      {/* Review Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-[#0F172A]">
                            {rev.user?.fullName ? rev.user.fullName.charAt(0).toUpperCase() : 'G'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#0F172A]">
                                {rev.user?.fullName || 'Verified Guest'}
                              </span>
                              {rev.booking?.bookingRef && (
                                <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  Ref: {rev.booking.bookingRef}
                                </span>
                              )}
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                                Verified Stay
                              </span>
                            </div>
                            <span className="text-xs text-[#64748B]">
                              Reviewed on {formatDate(rev.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-1 text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={`text-sm ${
                                i < rev.rating ? 'text-amber-400' : 'text-slate-200'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                          <span className="text-xs font-bold text-slate-700 ml-1">
                            {rev.rating}.0
                          </span>
                        </div>
                      </div>

                      {/* Comment */}
                      <p className="text-sm text-slate-700 leading-relaxed pl-12">
                        {rev.comment}
                      </p>

                      {/* Existing Response or Response Form */}
                      <div className="pl-12">
                        {rev.response && !isResponding && (
                          <div className="p-4 rounded-xl border-l-4 border-[#2563EB] bg-slate-50 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#0F172A]">
                                  Official Management Response
                                </span>
                                {rev.respondedBy?.fullName && (
                                  <span className="text-[11px] text-[#64748B]">
                                    by {rev.respondedBy.fullName}
                                  </span>
                                )}
                                {rev.respondedAt && (
                                  <span className="text-[10px] text-slate-400">
                                    • {formatDate(rev.respondedAt)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setRespondingReviewId(rev.id)
                                    setResponseText(rev.response || '')
                                  }}
                                  className="text-xs text-[#2563EB] hover:underline font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteResponse(rev.id)}
                                  className="text-xs text-red-600 hover:underline font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-700 italic leading-relaxed">
                              &ldquo;{rev.response}&rdquo;
                            </p>
                          </div>
                        )}

                        {!rev.response && !isResponding && (
                          <button
                            onClick={() => {
                              setRespondingReviewId(rev.id)
                              setResponseText('')
                            }}
                            className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                          >
                            💬 Respond Publicly
                          </button>
                        )}

                        {/* Inline Response Composer */}
                        {isResponding && (
                          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#0F172A]">
                                {rev.response ? 'Edit Management Response' : 'Write Public Response'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {responseText.length}/2000
                              </span>
                            </div>

                            {/* Quick template buttons */}
                            <div className="space-y-1">
                              <p className="text-[11px] font-semibold text-[#64748B]">Quick Templates:</p>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setResponseText(
                                      'Thank you for your warm feedback! We are thrilled you had a memorable stay with us and hope to welcome you back again soon.',
                                    )
                                  }
                                  className="text-[11px] bg-white border border-slate-200 hover:border-[#2563EB] px-2.5 py-1 rounded-md text-slate-600 text-left transition-colors"
                                >
                                  🌟 Warm Gratitude
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setResponseText(
                                      'Thank you for bringing this to our attention. We hold our guest experience to the highest standard and are actively addressing the issues you mentioned with our operations team.',
                                    )
                                  }
                                  className="text-[11px] bg-white border border-slate-200 hover:border-[#2563EB] px-2.5 py-1 rounded-md text-slate-600 text-left transition-colors"
                                >
                                  🛠 Service Recovery
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setResponseText(
                                      'We truly appreciate your stay and your kind review! Our team strives every day to deliver exceptional hospitality, and we look forward to hosting you on your next visit.',
                                    )
                                  }
                                  className="text-[11px] bg-white border border-slate-200 hover:border-[#2563EB] px-2.5 py-1 rounded-md text-slate-600 text-left transition-colors"
                                >
                                  🏨 Hospitality Appreciation
                                </button>
                              </div>
                            </div>

                            <textarea
                              rows={3}
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Write a professional, courteous response that will be visible to all potential guests..."
                              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                            />

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRespondingReviewId(null)
                                  setResponseText('')
                                }}
                                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={responseSubmitting || responseText.trim().length < 2}
                                onClick={() => handleSaveResponse(rev.id)}
                                className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                              >
                                {responseSubmitting ? 'Publishing...' : 'Publish Response'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

              {hotelReviews.filter((r) => {
                if (reviewFilter === 'pending') return !r.response
                if (reviewFilter === 'responded') return !!r.response
                return true
              }).length === 0 && (
                <div className="p-12 text-center text-[#64748B] space-y-1">
                  <p className="text-sm font-medium">No reviews found matching this filter.</p>
                  <p className="text-xs text-slate-400">
                    {hotelReviews.length === 0
                      ? 'No guests have submitted reviews for this hotel yet.'
                      : 'All reviews have responses or none are waiting.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Modal: Hotel Form (Create / Edit) */}
        {hotelFormOpen && (
          <HotelFormModal
            countries={countries}
            hotel={editingHotel}
            saving={savingHotel}
            onCancel={() => {
              setHotelFormOpen(false)
              setEditingHotel(null)
            }}
            onSave={saveHotel}
          />
        )}

        {/* Modal: Room CRUD */}
        {roomModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">
                  {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Create Room'}
                </h3>
                <button
                  onClick={() => setRoomModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveRoom} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Room Number *</label>
                    <input
                      required
                      value={roomForm.roomNumber}
                      onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))}
                      placeholder="e.g. 101"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Room Type</label>
                    <select
                      value={roomForm.type}
                      onChange={(e) => setRoomForm((p) => ({ ...p, type: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#2563EB]"
                    >
                      <option value="SINGLE">Single</option>
                      <option value="DOUBLE">Double</option>
                      <option value="SUITE">Suite</option>
                      <option value="DELUXE">Deluxe</option>
                      <option value="PRESIDENTIAL">Presidential</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Capacity</label>
                    <input
                      type="number"
                      min={1}
                      value={roomForm.capacity}
                      onChange={(e) => setRoomForm((p) => ({ ...p, capacity: Number(e.target.value) }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Beds</label>
                    <input
                      type="number"
                      min={1}
                      value={roomForm.beds}
                      onChange={(e) => setRoomForm((p) => ({ ...p, beds: Number(e.target.value) }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Baths</label>
                    <input
                      type="number"
                      min={1}
                      value={roomForm.bathroom}
                      onChange={(e) => setRoomForm((p) => ({ ...p, bathroom: Number(e.target.value) }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Base Price (ETB / night) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={roomForm.basePrice}
                    onChange={(e) => setRoomForm((p) => ({ ...p, basePrice: Number(e.target.value) }))}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Amenities (comma separated)</label>
                  <input
                    value={roomForm.amenities}
                    onChange={(e) => setRoomForm((p) => ({ ...p, amenities: e.target.value }))}
                    placeholder="WiFi, TV, AC, Balcony"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setRoomModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={roomSaving}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {roomSaving ? 'Saving…' : 'Save Room'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Walk-in Booking */}
        {walkInModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Front Desk Walk-In Guest</h3>
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
                      placeholder="e.g. Abebe Bikila"
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
                      placeholder="ID-12345"
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
                    {selectedHotelRooms
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
                    {walkInSubmitting ? 'Registering…' : 'Register Walk-In'}
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
                <h3 className="font-bold text-lg text-[#0F172A]">Relocate Checked-In Guest</h3>
                <button
                  onClick={() => setRelocateBooking(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRelocateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Target New Room *</label>
                  <select
                    required
                    value={relocateNewRoomId}
                    onChange={(e) => setRelocateNewRoomId(e.target.value)}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">Select target room…</option>
                    {selectedHotelRooms
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
                    {relocateSubmitting ? 'Relocating…' : 'Relocate Guest'}
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
                    placeholder="e.g. Room is ready for early check-in"
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
                    Reject Request
                  </button>
                  <button
                    disabled={decidingSubmitting}
                    onClick={() => handleDecideStayRequest('APPROVED')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Approve Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Staff Assign */}
        {staffModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Assign Staff Member</h3>
                <button
                  onClick={() => setStaffModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAssignStaff} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">User ID of Staff *</label>
                  <input
                    required
                    value={staffUserId}
                    onChange={(e) => setStaffUserId(e.target.value)}
                    placeholder="Paste the user ID of the staff member"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStaffModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={staffSaving}
                    className="px-5 py-2 bg-[#2563EB] text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {staffSaving ? 'Assigning…' : 'Assign to Hotel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Maintenance Block */}
        {maintenanceModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Block Room for Maintenance</h3>
                <button
                  onClick={() => setMaintenanceModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleBlockMaintenance} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Room *</label>
                  <select
                    required
                    value={maintenanceForm.roomId}
                    onChange={(e) => setMaintenanceForm((p) => ({ ...p, roomId: e.target.value }))}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  >
                    {selectedHotelRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room #{r.roomNumber} ({r.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={maintenanceForm.startDate}
                      onChange={(e) => setMaintenanceForm((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={maintenanceForm.endDate}
                      onChange={(e) => setMaintenanceForm((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Reason</label>
                  <input
                    value={maintenanceForm.reason}
                    onChange={(e) => setMaintenanceForm((p) => ({ ...p, reason: e.target.value }))}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setMaintenanceModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={maintenanceSaving}
                    className="px-5 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {maintenanceSaving ? 'Blocking…' : 'Apply Block'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Seasonal Pricing */}
        {seasonalModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Seasonal Dynamic Pricing</h3>
                <button
                  onClick={() => setSeasonalModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSeasonalPricing} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Room *</label>
                  <select
                    required
                    value={seasonalForm.roomId}
                    onChange={(e) => setSeasonalForm((p) => ({ ...p, roomId: e.target.value }))}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  >
                    {selectedHotelRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room #{r.roomNumber} ({r.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Rule Name</label>
                  <input
                    required
                    value={seasonalForm.name}
                    onChange={(e) => setSeasonalForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Festival Season Surge"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={seasonalForm.startDate}
                      onChange={(e) => setSeasonalForm((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={seasonalForm.endDate}
                      onChange={(e) => setSeasonalForm((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Price Multiplier</label>
                    <input
                      type="number"
                      step="0.05"
                      min={0.1}
                      value={seasonalForm.priceMultiplier}
                      onChange={(e) => setSeasonalForm((p) => ({ ...p, priceMultiplier: Number(e.target.value) }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Fixed Override (Optional)</label>
                    <input
                      type="number"
                      value={seasonalForm.fixedPrice}
                      onChange={(e) => setSeasonalForm((p) => ({ ...p, fixedPrice: e.target.value }))}
                      placeholder="e.g. 2500"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setSeasonalModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={seasonalSaving}
                    className="px-5 py-2 bg-[#2563EB] text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {seasonalSaving ? 'Saving…' : 'Save Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function HotelFormModal({
  countries,
  hotel,
  saving,
  onCancel,
  onSave,
}: {
  countries: Country[]
  hotel: ManagedHotel | null
  saving: boolean
  onCancel: () => void
  onSave: (payload: Record<string, unknown>, hotelId?: string) => void
}) {
  const [name, setName] = useState(hotel?.name ?? '')
  const [suggestedCityId] = useState(hotel?.city?.id ?? '')
  const [countryId, setCountryId] = useState<string | undefined>(hotel?.city?.id ? undefined : countries[0]?.id)
  const [cityId, setCityId] = useState('')
  const [cityName, setCityName] = useState('')
  const [address, setAddress] = useState(hotel?.address ?? '')
  const [starRating, setStarRating] = useState(hotel?.starRating ?? 4)
  const [description, setDescription] = useState(hotel?.description ?? '')
  const [status, setStatus] = useState(hotel?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')
  const [amenities, setAmenities] = useState((hotel?.amenities ?? []).join(', '))
  const [cities, setCities] = useState<City[]>([])
  const [countryError, setCountryError] = useState('')

  useEffect(() => {
    if (!countryId) return
    setCountryError('')
    void hotelApi
      .cities(countryId)
      .then((items) => {
        setCities(items)
        const match = items.find((item) => item.id === suggestedCityId)
        setCityId(match?.id ?? '')
        setCityName(match ? '' : hotel?.city?.name ?? '')
      })
      .catch(() => setCountryError('Unable to load cities for this country.'))
  }, [countryId, suggestedCityId, hotel])

  const submit = () => {
    if (!name.trim() || !address.trim()) return
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      address: address.trim(),
      starRating: Number(starRating),
      status,
      ...(cityId ? { cityId } : cityName.trim() ? { cityName: cityName.trim() } : {}),
      ...(amenities.trim() ? { amenities: amenities.split(',').map((item) => item.trim()).filter(Boolean) } : {}),
    }
    onSave(payload, hotel?.id)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-center">
          <h2 className="font-bold text-[#0F172A] text-xl">{hotel ? 'Edit Hotel' : 'Create Hotel'}</h2>
          <button onClick={onCancel} className="w-8 h-8 rounded-full text-[#64748B] hover:bg-[#F1F5F9]">
            ✕
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Hotel Name *
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Grand Palace Hotel"
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Country</label>
            <select
              value={countryId ?? ''}
              onChange={(event) => setCountryId(event.target.value)}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] bg-white"
            >
              {!countryId && <option value="">Choose country…</option>}
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">City</label>
            {cities.length ? (
              <select
                value={cityId}
                onChange={(event) => setCityId(event.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] bg-white"
              >
                <option value="">Choose city…</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={cityName}
                onChange={(event) => setCityName(event.target.value)}
                placeholder={hotel?.city?.name || 'City name'}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB]"
              />
            )}
          </div>

          {countryError && <p className="sm:col-span-2 text-xs text-red-600">{countryError}</p>}

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Address *
            </label>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="e.g. Bole Road, House 104"
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Star Rating</label>
            <select
              value={starRating}
              onChange={(event) => setStarRating(Number(event.target.value))}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] bg-white"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {'★'.repeat(value)} {value}-Star
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] bg-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Amenities</label>
            <input
              value={amenities}
              onChange={(event) => setAmenities(event.target.value)}
              placeholder="Pool, Spa, High-Speed WiFi, Valet Parking"
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Describe the hotel amenities, dining, and prime location."
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-[#E2E8F0] flex justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 border border-[#E2E8F0] text-[#334155] rounded-xl text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim() || !address.trim()}
            className="px-5 py-2.5 bg-[#2563EB] disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm"
          >
            {saving ? 'Saving…' : hotel ? 'Save Changes' : 'Create Hotel'}
          </button>
        </div>
      </div>
    </div>
  )
}
