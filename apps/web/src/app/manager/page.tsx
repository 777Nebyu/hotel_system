'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hotelApi, managerApi, paymentApi } from '@/lib/services'
import { useAuth } from '@/lib/auth-store'
import AuthGate from '@/components/AuthGate'
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Users,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Star,
  Lightbulb,
  Search,
  Sparkles,
  BellRing,
  Briefcase,
  FileDown,
  FileSpreadsheet,
  BarChart3,
  Calendar,
  Banknote,
  Phone,
  RefreshCw,
  MessageSquare,
  Wrench,
  Building2,
  TrendingUp,
  CreditCard,
  Layers,
  Activity,
  Upload,
  Trash2,
  ImagePlus,
  Crown,
} from 'lucide-react'

import { ManagerAnalyticsCharts } from '@/components/manager/ManagerAnalyticsCharts'


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
  bookingRef?: string | null
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
  const [occupancy, setOccupancy] = useState<any>({ totalRooms: 0, occupiedToday: 0, occupancyRate: 0 })

  // Manager Reporting & Statement Download State
  const [reportCategory, setReportCategory] = useState<
    'overview' | 'booking' | 'revenue' | 'occupancy' | 'cancellation' | 'customer'
  >('overview')
  const [reportPeriod, setReportPeriod] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly'
  >('monthly')
  const [reportDownloading, setReportDownloading] = useState<'pdf' | 'excel' | null>(null)

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

  // Staff Management State
  const [staffModalOpen, setStaffModalOpen] = useState(false)
  const [staffModalMode, setStaffModalMode] = useState<'create' | 'assign'>('create')
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    rolePreset: 'Front Desk' as 'Front Desk' | 'Cleaner' | 'Other',
    customRole: '',
  })
  const [assignRolePreset, setAssignRolePreset] = useState<'Front Desk' | 'Cleaner' | 'Other'>('Front Desk')
  const [assignCustomRole, setAssignCustomRole] = useState('')
  const [showStaffPassword, setShowStaffPassword] = useState(false)
  const [assignEmail, setAssignEmail] = useState('')
  const [staffSaving, setStaffSaving] = useState(false)
  const [staffSearchQuery, setStaffSearchQuery] = useState('')
  const [statusTogglingId, setStatusTogglingId] = useState<string | null>(null)

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

  // No-Show Confirmation Modal
  const [noShowModalBooking, setNoShowModalBooking] = useState<ManagedBooking | null>(null)
  const [noShowSubmitting, setNoShowSubmitting] = useState(false)


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
      setStats({
        pendingApprovals: statsData.pendingApprovals ?? (statsData as any).pendingQueue ?? 0,
        todaysCheckIns: statsData.todaysCheckIns ?? (statsData as any).arrivalsToday ?? 0,
        todaysCheckOuts: statsData.todaysCheckOuts ?? (statsData as any).departuresToday ?? 0,
        activeGuests: statsData.activeGuests ?? ((statsData as any).arrivals?.length ?? 0),
      })

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
      const [hotelData, policyData, staffData, requestsData, overviewData, revenueData, trendsData, reviewsData, occupancyData] =
        await Promise.all([
          hotelApi.getById(hId).catch(() => null),
          managerApi.getPolicy(hId).catch(() => null),
          managerApi.listStaff(hId).catch(() => ({ data: [] })),
          managerApi.listStayRequests(hId).catch(() => []),
          managerApi.reportOverview(hId).catch(() => null),
          managerApi.reportRevenue(hId, 12).catch(() => []),
          managerApi.reportTrends(hId, 30).catch(() => []),
          managerApi.listReviews(hId).catch(() => null),
          managerApi.reportOccupancy(hId).catch(() => null),
        ])

      if (hotelData?.rooms) setSelectedHotelRooms(hotelData.rooms)
      if (policyData) setHotelPolicy(policyData)
      if (staffData?.data) setHotelStaff(staffData.data)
      setStayRequests(requestsData)
      setReportOverview(overviewData)
      setRevenueItems(revenueData)
      setTrendItems(trendsData)
      if (occupancyData) setOccupancy(occupancyData)
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

  const confirmNoShow = async () => {
    if (!noShowModalBooking) return
    setNoShowSubmitting(true)
    setError('')
    try {
      await managerApi.noShow(noShowModalBooking.id)
      setSuccessBanner(`Booking ${noShowModalBooking.bookingRef} successfully marked as No-Show. Room availability has been restored.`)
      setNoShowModalBooking(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to mark reservation as No-Show.')
    } finally {
      setNoShowSubmitting(false)
    }
  }

  const openNoShowModal = (booking: ManagedBooking) => {
    setNoShowModalBooking(booking)
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

  // Room Status Change
  const handleRoomStatusChange = async (roomId: string, newStatus: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE') => {
    setActing(`room-status-${roomId}`)
    setError('')
    try {
      await managerApi.updateRoomStatus(roomId, newStatus)
      setSelectedHotelRooms((prev) =>
        prev.map((rm) => (rm.id === roomId ? { ...rm, status: newStatus } : rm)),
      )
      setSuccessBanner(`Room status updated to ${newStatus}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update room status.')
    } finally {
      setActing(null)
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

  // Staff Handlers
  const handleOpenAddStaff = () => {
    setStaffForm({
      fullName: '',
      email: '',
      password: '',
      phone: '',
      rolePreset: 'Front Desk',
      customRole: '',
    })
    setAssignEmail('')
    setAssignRolePreset('Front Desk')
    setAssignCustomRole('')
    setShowStaffPassword(false)
    setStaffModalMode('create')
    setStaffModalOpen(true)
  }

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHotelId) return
    setStaffSaving(true)
    setError('')
    try {
      if (staffModalMode === 'create') {
        if (!staffForm.fullName.trim()) throw new Error('Please enter the staff member’s full name.')
        if (!staffForm.email.trim()) throw new Error('Please enter a valid email address.')
        if (!staffForm.password || staffForm.password.length < 8) {
          throw new Error('Password must be at least 8 characters long.')
        }
        const resolvedRole =
          staffForm.rolePreset === 'Other'
            ? staffForm.customRole.trim() || 'Staff'
            : staffForm.rolePreset
        await managerApi.createStaff(selectedHotelId, {
          fullName: staffForm.fullName.trim(),
          email: staffForm.email.trim(),
          password: staffForm.password,
          phone: staffForm.phone.trim() || undefined,
          role: resolvedRole,
        })
        setSuccessBanner(`Staff member (${resolvedRole}) created and assigned to hotel successfully!`)
      } else {
        if (!assignEmail.trim()) throw new Error('Please enter the email address of the staff member.')
        const resolvedRole =
          assignRolePreset === 'Other'
            ? assignCustomRole.trim() || 'Staff'
            : assignRolePreset
        await managerApi.assignStaff(selectedHotelId, {
          email: assignEmail.trim(),
          role: resolvedRole,
        })
        setSuccessBanner(`Staff member (${resolvedRole}) assigned to hotel successfully!`)
      }
      setStaffModalOpen(false)
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff member.')
    } finally {
      setStaffSaving(false)
    }
  }

  const handleToggleStaffStatus = async (staffId: string, currentActive: boolean) => {
    if (!selectedHotelId) return
    setStatusTogglingId(staffId)
    setError('')
    try {
      await managerApi.updateStaffStatus(selectedHotelId, staffId, !currentActive)
      setSuccessBanner(`Staff account ${!currentActive ? 'activated' : 'deactivated'}.`)
      setHotelStaff((prev) =>
        prev.map((item) => {
          const id = item.staffId || item.staff?.id || item.user?.id || item.id
          if (id === staffId) {
            const updatedUser = { ...(item.staff || item.user), isActive: !currentActive }
            return {
              ...item,
              staff: updatedUser,
              user: updatedUser,
            }
          }
          return item
        }),
      )
      await loadHotelDetails(selectedHotelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff status.')
    } finally {
      setStatusTogglingId(null)
    }
  }

  const handleRemoveStaff = async (staffId: string, staffName?: string) => {
    const displayName = staffName || 'this staff member'
    if (!confirm(`Are you sure you want to remove ${displayName} from this hotel?`)) return
    setError('')
    try {
      await managerApi.removeStaff(selectedHotelId, staffId)
      setSuccessBanner(`${displayName} has been removed from this hotel.`)
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
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-600 hover:text-rose-900 p-1.5 rounded-lg hover:bg-rose-100/60 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
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
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* Tab 1: Dashboard Overview */}
        {tab === 'Dashboard' && (() => {
          const hotelRevenueDisplay = reportOverview?.totalRevenue ?? 0
          const hotelBookingsDisplay = reportOverview?.totalBookings ?? bookings.length
          const hotelActiveRoomsCount = selectedHotelRooms.length || (reportOverview?.activeRooms ?? 0)

          const occupancyRateNum =
            typeof occupancy?.occupancyRate === 'number' && !isNaN(occupancy.occupancyRate)
              ? occupancy.occupancyRate
              : typeof reportOverview?.occupancyRate === 'number' && !isNaN(reportOverview.occupancyRate)
                ? reportOverview.occupancyRate
                : 0
          const occupiedRoomsCount = occupancy?.occupiedToday ?? reportOverview?.occupiedToday ?? 0

          return (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="font-serif text-3xl text-[#0F172A]">Manager Overview</h1>
                  <p className="text-[#64748B]">Live operations, revenue analytics, and occupancy for {selectedHotel?.name || 'Assigned Hotels'}.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWalkInModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    + Walk-in Guest
                  </button>
                  <button
                    onClick={() => void load()}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* 4 Primary Top Luxury Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Property Revenue', value: formatMoney(hotelRevenueDisplay), icon: CreditCard, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                  { label: "Today's Occupancy", value: `${(occupancyRateNum * 100).toFixed(1)}%`, icon: Activity, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { label: 'Total Bookings', value: hotelBookingsDisplay, icon: Calendar, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  { label: 'Room Inventory', value: `${hotelActiveRoomsCount} Rooms`, icon: Building2, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                ].map((item) => {
                  const IconComp = item.icon
                  return (
                    <div key={item.label} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${item.color}`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-[#0F172A] text-2xl">{item.value}</div>
                        <div className="text-[#64748B] text-xs mt-0.5">{item.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 4 Secondary Operational Flow Badges */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Pending approvals', value: stats.pendingApprovals, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                  { label: "Today's check-ins", value: stats.todaysCheckIns, icon: ArrowDownLeft, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { label: "Today's check-outs", value: stats.todaysCheckOuts, icon: ArrowUpRight, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                  { label: 'Active guests', value: stats.activeGuests, icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                ].map((item) => {
                  const IconComp = item.icon
                  return (
                    <div key={item.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${item.color}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-[#0F172A] text-xl">{item.value}</div>
                        <div className="text-[#64748B] text-xs">{item.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Interactive Luxury Analytics Charts */}
              <ManagerAnalyticsCharts
                hotelName={selectedHotel?.name}
                monthlyRevenue={revenueItems}
                bookingTrends={trendItems}
                rooms={selectedHotelRooms}
                occupiedToday={occupiedRoomsCount}
              />

              {/* Pending Stay Requests Alert */}
              {stayRequests.filter((r) => r.status === 'PENDING').length > 0 && (
                <div className="mb-8 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-700" />
                      <span>Pending Guest Stay Requests ({stayRequests.filter((r) => r.status === 'PENDING').length})</span>
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
                            className="px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Review & Decide
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Today's Occupancy Bar & Recent Reservations */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                  <div>
                    <h2 className="font-bold text-[#0F172A] mb-2">Today&apos;s Property Occupancy</h2>
                    <div className="text-4xl font-bold text-[#0F172A]">{(occupancyRateNum * 100).toFixed(1)}%</div>
                    <p className="text-[#64748B] text-sm mt-1">
                      {occupiedRoomsCount} occupied of {hotelActiveRoomsCount} active rooms
                    </p>
                    <div className="bg-[#F1F5F9] h-2.5 rounded-full mt-5 overflow-hidden">
                      <div
                        className="bg-[#2563EB] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, occupancyRateNum * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 mt-6 text-xs text-[#64748B] flex justify-between">
                    <span>Available: {Math.max(0, hotelActiveRoomsCount - occupiedRoomsCount)} rooms</span>
                    <span className="font-semibold text-[#2563EB]">{selectedHotel?.name}</span>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-[#F1F5F9] flex justify-between items-center">
                    <h2 className="font-bold text-[#0F172A]">Recent Reservations</h2>
                    <button onClick={() => setTab('Bookings')} className="text-sm text-[#2563EB] font-semibold cursor-pointer">
                      View All ({bookings.length}) →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {bookings.slice(0, 5).map((booking) => (
                      <div key={booking.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[#0F172A] text-sm">
                            {booking.user?.fullName || 'Walk-in Guest'}{' '}
                            <span className="font-mono font-normal text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                          </div>
                          <div className="text-[#64748B] text-xs mt-0.5">
                            {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} · {formatMoney(booking.totalPrice)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyle(booking.status)}`}>
                            {booking.status.replace(/_/g, ' ')}
                          </span>
                          {booking.status === 'PENDING' && (
                            <button
                              disabled={acting === booking.id}
                              onClick={() => act(booking.id, 'confirm')}
                              className="px-3 py-1 bg-[#2563EB] text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Confirm
                            </button>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <button
                              disabled={acting === booking.id}
                              onClick={() => act(booking.id, 'check-in')}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Check In
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {!bookings.length && <p className="p-8 text-center text-xs text-[#64748B]">No reservations recorded.</p>}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

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

                      <div className="flex items-center gap-4 mt-4 text-xs text-[#64748B]">
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{hotel.starRating} Stars</span>
                        </span>
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
        {tab === 'Pricing' && (() => {
          const allPricingRules = selectedHotelRooms.flatMap((r) =>
            ((r as any).seasonalPricing || []).map((p: any) => ({ ...p, roomNumber: r.roomNumber, roomId: r.id }))
          )

          return (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Seasonal Dynamic Pricing</h1>
                  <p className="text-[#64748B] text-sm">
                    Apply multipliers and price overrides during holidays and peak seasons for {selectedHotel?.name}.
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
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                >
                  + Add Pricing Rule
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#0F172A]">Active Pricing Rules</h3>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-[#2563EB] rounded-full">
                    {allPricingRules.length} Active Rules
                  </span>
                </div>

                {allPricingRules.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[#64748B] font-semibold">
                          <th className="pb-3">Room</th>
                          <th className="pb-3">Rule Name</th>
                          <th className="pb-3">Active Dates</th>
                          <th className="pb-3">Rate Adjustment</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allPricingRules.map((rule: any) => (
                          <tr key={rule.id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 font-bold text-[#0F172A]">Room #{rule.roomNumber}</td>
                            <td className="py-3.5 font-medium text-slate-700">{rule.name}</td>
                            <td className="py-3.5 text-[#64748B]">
                              {formatDate(rule.startDate)} → {formatDate(rule.endDate)}
                            </td>
                            <td className="py-3.5">
                              {rule.fixedPrice ? (
                                <span className="font-bold text-emerald-600">{formatMoney(rule.fixedPrice)}</span>
                              ) : (
                                <span className="font-bold text-[#2563EB]">{rule.priceMultiplier}x multiplier</span>
                              )}
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={async () => {
                                  try {
                                    await managerApi.deleteSeasonalPricing(rule.roomId, rule.id)
                                    setSuccessBanner('Pricing rule removed.')
                                    if (selectedHotelId) await loadHotelDetails(selectedHotelId)
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : 'Failed to delete pricing rule.')
                                  }
                                }}
                                className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B] py-4">
                    No active seasonal pricing rules configured for this hotel yet. Click &quot;+ Add Pricing Rule&quot; to define a custom seasonal multiplier.
                  </p>
                )}

                <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Tip:</strong> A multiplier of 1.25 increases nightly prices by 25%. Fixed price overrides
                    completely replace base pricing for the defined date window.
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

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

            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base">Room Operational Status &amp; Turnover</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Live room turnover and service availability. Rooms set to Maintenance or Cleaning are automatically blocked from guest bookings.
                  </p>
                </div>
                <div className="text-xs text-[#64748B] font-medium shrink-0">
                  Total Inventory: <span className="font-bold text-[#0F172A]">{selectedHotelRooms.length}</span> rooms
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {selectedHotelRooms.map((r) => (
                  <div key={r.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#0F172A]">Room #{r.roomNumber}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {r.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-[#64748B]">
                          Cap: {r.capacity} · {r.beds} bed(s)
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-1 font-mono">
                        Base Rate: {formatMoney(r.basePrice)}/night
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
                        <button
                          type="button"
                          disabled={acting === `room-status-${r.id}` || r.status === 'AVAILABLE'}
                          onClick={() => handleRoomStatusChange(r.id, 'AVAILABLE')}
                          className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                            r.status === 'AVAILABLE'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70'
                          }`}
                        >
                          Available
                        </button>
                        <button
                          type="button"
                          disabled={acting === `room-status-${r.id}` || r.status === 'CLEANING'}
                          onClick={() => handleRoomStatusChange(r.id, 'CLEANING')}
                          className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                            r.status === 'CLEANING'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/70'
                          }`}
                        >
                          Cleaning
                        </button>
                        <button
                          type="button"
                          disabled={acting === `room-status-${r.id}` || r.status === 'MAINTENANCE'}
                          onClick={() => handleRoomStatusChange(r.id, 'MAINTENANCE')}
                          className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                            r.status === 'MAINTENANCE'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/70'
                          }`}
                        >
                          Maintenance
                        </button>
                      </div>
                      {acting === `room-status-${r.id}` && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                      )}
                    </div>
                  </div>
                ))}

                {selectedHotelRooms.length === 0 && (
                  <div className="py-10 text-center text-sm text-[#64748B]">
                    No rooms configured for this hotel yet. Please add rooms in the Rooms tab first.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Hotel Policies */}
        {tab === 'Policies' && (() => {
          const fallbackPolicy: HotelPolicy = {
            id: '',
            hotelId: selectedHotelId,
            checkInTime: '14:00',
            checkOutTime: '11:00',
            cancellationWindowDays: 3,
            cancellationFeePercent: 0,
            earlyCheckInFee: 0,
            lateCheckOutFee: 0,
          }
          const currentPolicy = hotelPolicy || fallbackPolicy

          return (
            <div>
              <div className="mb-6">
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Hotel Policies & Rules</h1>
                <p className="text-[#64748B] text-sm">
                  Configure check-in/out hours, cancellation policies, and early/late fees for {selectedHotel?.name}.
                </p>
              </div>

              <form onSubmit={handleSavePolicy} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] uppercase tracking-wider mb-1.5">
                      Standard Check-in Time (HH:mm)
                    </label>
                    <input
                      type="time"
                      required
                      value={currentPolicy.checkInTime || '14:00'}
                      onChange={(e) =>
                        setHotelPolicy((prev) => ({ ...(prev || fallbackPolicy), checkInTime: e.target.value }))
                      }
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
                      value={currentPolicy.checkOutTime || '11:00'}
                      onChange={(e) =>
                        setHotelPolicy((prev) => ({ ...(prev || fallbackPolicy), checkOutTime: e.target.value }))
                      }
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
                      value={currentPolicy.cancellationWindowDays ?? 3}
                      onChange={(e) =>
                        setHotelPolicy((prev) => ({
                          ...(prev || fallbackPolicy),
                          cancellationWindowDays: Number(e.target.value),
                        }))
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
                      value={Number(currentPolicy.cancellationFeePercent ?? 0)}
                      onChange={(e) =>
                        setHotelPolicy((prev) => ({
                          ...(prev || fallbackPolicy),
                          cancellationFeePercent: Number(e.target.value),
                        }))
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
                      value={Number(currentPolicy.earlyCheckInFee ?? 0)}
                      onChange={(e) =>
                        setHotelPolicy((prev) => ({
                          ...(prev || fallbackPolicy),
                          earlyCheckInFee: Number(e.target.value),
                        }))
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
                      value={Number(currentPolicy.lateCheckOutFee ?? 0)}
                      onChange={(e) =>
                        setHotelPolicy((prev) => ({
                          ...(prev || fallbackPolicy),
                          lateCheckOutFee: Number(e.target.value),
                        }))
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
          )
        })()}

        {/* Tab 7: Staff Management */}
        {tab === 'Staff' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-[#0F172A] text-2xl">Hotel Staff & Operations Team</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {hotelStaff.length} {hotelStaff.length === 1 ? 'Member' : 'Members'}
                  </span>
                </div>
                <p className="text-[#64748B] text-sm mt-1">
                  Onboard front-desk personnel for <span className="font-semibold text-slate-700">{selectedHotel?.name}</span> to operate bookings, check-ins, and room availability.
                </p>
              </div>
              <button
                onClick={handleOpenAddStaff}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                <span>+</span> Add Staff Member
              </button>
            </div>

            {/* Filter and Search Toolbar */}
            {hotelStaff.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  {staffSearchQuery && (
                    <button
                      onClick={() => setStaffSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Staff Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              {hotelStaff.length === 0 ? (
                <div className="py-16 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <Users className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0F172A] mb-1">No Staff Members Assigned</h3>
                  <p className="text-sm text-[#64748B] max-w-md mx-auto mb-6">
                    Add front-desk operators to {selectedHotel?.name}. They will be able to log in with their email and password to handle daily check-ins, room relocations, and walk-ins.
                  </p>
                  <button
                    onClick={handleOpenAddStaff}
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
                  >
                    + Add Your First Staff Member
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                        <th className="py-3.5 px-4">Staff Member</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Contact</th>
                        <th className="py-3.5 px-4">Account Status</th>
                        <th className="py-3.5 px-4">Assigned On</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9] text-sm">
                      {hotelStaff
                        .filter((m) => {
                          if (!staffSearchQuery.trim()) return true
                          const q = staffSearchQuery.toLowerCase()
                          const name = (m.staff?.fullName || m.user?.fullName || '').toLowerCase()
                          const email = (m.staff?.email || m.user?.email || '').toLowerCase()
                          const phone = (m.staff?.phone || m.user?.phone || '').toLowerCase()
                          return name.includes(q) || email.includes(q) || phone.includes(q)
                        })
                        .map((member) => {
                          const userObj = member.staff || member.user
                          const staffId = member.staffId || userObj?.id || member.id
                          const fullName = userObj?.fullName || 'Staff Member'
                          const email = userObj?.email || 'N/A'
                          const phone = userObj?.phone || null
                          const isActive = userObj?.isActive !== false
                          const assignedDate = member.assignedAt || member.createdAt
                            ? new Date(member.assignedAt || member.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Active'

                          return (
                            <tr key={staffId} className="hover:bg-slate-50/75 transition-colors">
                              {/* Member Info */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-[#0F2942] text-[#D4AF37] font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                                    {fullName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-[#0F172A]">{fullName}</div>
                                    <div className="text-xs text-[#64748B]">{email}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="py-3.5 px-4">
                                {(() => {
                                  const roleName = member.role || 'Front Desk'
                                  const isCleaner =
                                    roleName.toLowerCase().includes('clean') ||
                                    roleName.toLowerCase().includes('housekeep')
                                  const isFrontDesk =
                                    roleName.toLowerCase().includes('front') ||
                                    roleName.toLowerCase().includes('desk')
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                                        isCleaner
                                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                          : isFrontDesk
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                                      }`}
                                    >
                                      {isCleaner ? (
                                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                      ) : isFrontDesk ? (
                                        <BellRing className="w-3.5 h-3.5 text-blue-600" />
                                      ) : (
                                        <Briefcase className="w-3.5 h-3.5 text-amber-700" />
                                      )}
                                      <span>{roleName}</span>
                                    </span>
                                  )
                                })()}
                              </td>

                              {/* Contact */}
                              <td className="py-3.5 px-4 text-xs text-[#475569]">
                                {phone ? (
                                  <span className="font-mono">{phone}</span>
                                ) : (
                                  <span className="text-slate-400 italic">No phone provided</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    isActive
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isActive ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                  />
                                  {isActive ? 'Active' : 'Deactivated'}
                                </span>
                              </td>

                              {/* Assigned Date */}
                              <td className="py-3.5 px-4 text-xs text-[#64748B]">
                                {assignedDate}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleToggleStaffStatus(staffId, isActive)}
                                    disabled={statusTogglingId === staffId}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                      isActive
                                        ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                        : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                    title={isActive ? 'Deactivate staff account' : 'Activate staff account'}
                                  >
                                    {statusTogglingId === staffId ? 'Updating…' : isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => handleRemoveStaff(staffId, fullName)}
                                    className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
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
                <p className="text-[#64748B] text-sm">
                  Performance metrics, audit logs, and downloadable statements for {selectedHotel?.name || 'hotel'}.
                </p>
              </div>

              {/* Download Buttons: PDF & Excel */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  disabled={reportDownloading !== null || !selectedHotelId}
                  onClick={async () => {
                    if (!selectedHotelId) return
                    setReportDownloading('pdf')
                    try {
                      await managerApi.downloadReport(selectedHotelId, reportCategory, 'pdf', reportPeriod)
                      setSuccessBanner(
                        `Downloaded ${reportCategory.toUpperCase()} PDF report for ${selectedHotel?.name || 'hotel'} (${reportPeriod}).`
                      )
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to download PDF report.')
                    } finally {
                      setReportDownloading(null)
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#0F2942] hover:bg-[#1E3E62] text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {reportDownloading === 'pdf' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                      <span>Generating PDF…</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={reportDownloading !== null || !selectedHotelId}
                  onClick={async () => {
                    if (!selectedHotelId) return
                    setReportDownloading('excel')
                    try {
                      await managerApi.downloadReport(selectedHotelId, reportCategory, 'excel', reportPeriod)
                      setSuccessBanner(
                        `Downloaded ${reportCategory.toUpperCase()} Excel spreadsheet for ${selectedHotel?.name || 'hotel'} (${reportPeriod}).`
                      )
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to download Excel report.')
                    } finally {
                      setReportDownloading(null)
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {reportDownloading === 'excel' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Excel…</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Download Excel</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Timeframe & Category Control Bar */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm mb-6 space-y-4">
              {/* Row 1: Timeframe Toggle */}
              <div>
                <div className="text-xs font-semibold text-[#64748B] mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Report Timeframe:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'daily', label: 'Daily (Today)' },
                      { id: 'weekly', label: 'Weekly (7 Days)' },
                      { id: 'monthly', label: 'Monthly (30 Days)' },
                      { id: 'yearly', label: 'Yearly (365 Days)' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setReportPeriod(p.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        reportPeriod === p.id
                          ? 'bg-[#2563EB] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Report Category */}
              <div>
                <div className="text-xs font-semibold text-[#64748B] mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Report Focus & Category:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'overview', label: 'Executive Overview' },
                      { id: 'booking', label: 'Reservations' },
                      { id: 'revenue', label: 'Financial Revenue' },
                      { id: 'occupancy', label: 'Room Occupancy' },
                      { id: 'customer', label: 'Guest Demographics' },
                      { id: 'cancellation', label: 'Cancellations' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReportCategory(t.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        reportCategory === t.id
                          ? 'bg-[#0F2942] text-[#D4AF37] shadow-sm border border-[#D4AF37]/30'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* KPI Overview Cards */}
            {reportOverview && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Total Bookings</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">{reportOverview.totalBookings ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Historical property total</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Confirmed / Active</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">
                    {reportOverview.confirmedBookings ?? reportOverview.activeBookings ?? 0}
                  </div>
                  <div className="text-[11px] text-emerald-600/80 mt-0.5">Active stays &amp; reservations</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Occupancy Rate</div>
                  <div className="text-2xl font-bold text-[#2563EB] mt-1">
                    {typeof reportOverview.occupancyRate === 'number' && !isNaN(reportOverview.occupancyRate)
                      ? `${(reportOverview.occupancyRate * 100).toFixed(1)}%`
                      : '0.0%'}
                  </div>
                  <div className="text-[11px] text-blue-500 mt-0.5">Current occupied rooms</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Total Revenue</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">
                    {formatMoney(reportOverview.totalRevenue ?? 0)}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">Completed guest payments</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Active Room Inventory</div>
                  <div className="text-2xl font-bold text-[#0F172A] mt-1">
                    {reportOverview.activeRooms ?? reportOverview.roomsCount ?? selectedHotelRooms.length}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Rooms available or occupied</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
                  <div className="text-xs text-[#64748B] font-medium">Cancellations</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{reportOverview.cancelledBookings ?? 0}</div>
                  <div className="text-[11px] text-red-500 mt-0.5">Cancelled reservation requests</div>
                </div>
              </div>
            )}

            {/* Live Data Preview Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden mb-6">
              <div className="p-5 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold text-[#0F172A] text-base">
                    Report Preview ({reportCategory.toUpperCase()} — {reportPeriod.toUpperCase()})
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Live operational records compiled for {selectedHotel?.name || 'hotel'}.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                    <tr>
                      <th className="px-5 py-3">Record / Identifier</th>
                      <th className="px-5 py-3">Detail / Guest</th>
                      <th className="px-5 py-3">Metrics / Value</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {reportCategory === 'overview' && (
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                          {selectedHotel?.name || 'Hotel Property'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#64748B]">
                          {selectedHotel?.city?.name || selectedHotel?.address || 'Property Details'}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                          {bookings.filter((b) => b.hotelId === selectedHotelId).length} Bookings • {formatMoney(reportOverview?.totalRevenue || 0)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                            {selectedHotel?.status || 'ACTIVE'}
                          </span>
                        </td>
                      </tr>
                    )}

                    {reportCategory === 'booking' &&
                      bookings
                        .filter((b) => b.hotelId === selectedHotelId)
                        .slice(0, 10)
                        .map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                              <span className="font-mono text-xs">#{b.bookingRef || b.id.slice(-8)}</span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">
                              <span className="font-semibold text-slate-800">{b.user?.fullName || 'Guest'}</span>
                              <span className="block text-[11px] text-slate-400">
                                {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                              {formatMoney(b.totalPrice)}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle(b.status)}`}>
                                {b.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}

                    {reportCategory === 'revenue' &&
                      revenueItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-medium text-[#0F172A]">{item.month}</td>
                          <td className="px-5 py-3.5 text-xs text-[#64748B]">{item.bookings} confirmed bookings</td>
                          <td className="px-5 py-3.5 text-xs font-bold text-emerald-700">{formatMoney(item.revenue)}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              Settled
                            </span>
                          </td>
                        </tr>
                      ))}

                    {reportCategory === 'occupancy' &&
                      selectedHotelRooms.slice(0, 10).map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-medium text-[#0F172A]">Room {r.roomNumber}</td>
                          <td className="px-5 py-3.5 text-xs text-[#64748B]">
                            {r.type} • Capacity: {r.capacity} guests
                          </td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                            {formatMoney(r.basePrice)} / night
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              r.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}

                    {reportCategory === 'cancellation' &&
                      bookings
                        .filter((b) => b.hotelId === selectedHotelId && b.status === 'CANCELLED')
                        .slice(0, 10)
                        .map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                              <span className="font-mono text-xs">#{b.bookingRef || b.id.slice(-8)}</span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">
                              <span className="font-semibold text-slate-800">{b.user?.fullName || 'Guest'}</span>
                              <span className="block text-[11px] text-slate-400">
                                {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                              {formatMoney(b.totalPrice)}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                                CANCELLED
                              </span>
                            </td>
                          </tr>
                        ))}

                    {reportCategory === 'customer' &&
                      Array.from(
                        new Map(
                          bookings
                            .filter((b) => b.hotelId === selectedHotelId && b.user)
                            .map((b) => [b.user!.email, b])
                        ).values()
                      )
                        .slice(0, 10)
                        .map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                              {b.user?.fullName || 'Guest'}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">
                              {b.user?.email} {b.user?.phone ? `• ${b.user.phone}` : ''}
                            </td>
                            <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                              {bookings.filter((bk) => bk.hotelId === selectedHotelId && bk.userId === b.userId).length} stays
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                Verified Guest
                              </span>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Revenue Breakdown Section */}
            {(reportCategory === 'overview' || reportCategory === 'revenue') && (
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
            )}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#0F172A]">{booking.user?.fullName || 'Walk-in Guest'}</span>
                      <span className="font-mono text-xs text-[#94A3B8]">#{booking.id.slice(-8)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle(booking.status)}`}>
                        {booking.status.replace(/_/g, ' ')}
                      </span>
                      {booking.payment && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            booking.payment.status === 'SUCCEEDED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : booking.payment.status === 'FAILED'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          Payment: {booking.payment.status}
                        </span>
                      )}
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
                        <span>{booking.user?.phone || 'Direct Walk-in'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {booking.payment?.status === 'SUCCEEDED' ? (
                      <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Paid</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => markCashPaid(booking.id)}
                        className="px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Mark Cash Paid</span>
                      </button>
                    )}

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
                          onClick={() => openNoShowModal(booking)}
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
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
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
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {reviewSummary.averageRating ? Number(reviewSummary.averageRating).toFixed(1) : '—'}
                  </p>
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
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
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                              }`}
                            />
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
                            className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Respond Publicly</span>
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
                                  className="text-[11px] bg-white border border-slate-200 hover:border-[#2563EB] px-2.5 py-1 rounded-md text-slate-600 text-left transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span>Warm Gratitude</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setResponseText(
                                      'Thank you for bringing this to our attention. We hold our guest experience to the highest standard and are actively addressing the issues you mentioned with our operations team.',
                                    )
                                  }
                                  className="text-[11px] bg-white border border-slate-200 hover:border-[#2563EB] px-2.5 py-1 rounded-md text-slate-600 text-left transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Wrench className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  <span>Service Recovery</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setResponseText(
                                      'We truly appreciate your stay and your kind review! Our team strives every day to deliver exceptional hospitality, and we look forward to hosting you on your next visit.',
                                    )
                                  }
                                  className="text-[11px] bg-white border border-slate-200 hover:border-[#2563EB] px-2.5 py-1 rounded-md text-slate-600 text-left transition-colors inline-flex items-center gap-1.5"
                                >
                                  <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>Hospitality Appreciation</span>
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
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
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
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
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
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
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
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
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

        {/* Modal: Add Staff Member */}
        {staffModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="bg-[#0F2942] px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-white">Add Staff Member</h3>
                  <p className="text-xs text-slate-300">
                    Assign front desk personnel to {selectedHotel?.name}
                  </p>
                </div>
                <button
                  onClick={() => setStaffModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-3">
                <button
                  type="button"
                  onClick={() => setStaffModalMode('create')}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                    staffModalMode === 'create'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create New Staff Account
                </button>
                <button
                  type="button"
                  onClick={() => setStaffModalMode('assign')}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                    staffModalMode === 'assign'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Assign Existing Staff by Email
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
                {staffModalMode === 'create' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={staffForm.fullName}
                          onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                          placeholder="e.g. Abebe Bekele"
                          className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={staffForm.phone}
                          onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                          placeholder="e.g. +251 91 123 4567"
                          className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#334155] mb-1">
                        Work Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={staffForm.email}
                        onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                        placeholder="e.g. abebe@grandskylight.com"
                        className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        This email will be used as their login username.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#334155] mb-1">
                        Initial Login Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showStaffPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={staffForm.password}
                          onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                          placeholder="Minimum 8 characters"
                          className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStaffPassword(!showStaffPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                          title={showStaffPassword ? 'Hide password' : 'Show password'}
                          aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                        >
                          {showStaffPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Staff will use this password along with their email to log in to the Staff Desk.
                      </p>
                    </div>

                    {/* Role Selection */}
                    <div>
                      <label className="block text-xs font-bold text-[#334155] mb-1.5">
                        Staff Role / Department <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setStaffForm({ ...staffForm, rolePreset: 'Front Desk' })}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            staffForm.rolePreset === 'Front Desk'
                              ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>Front Desk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffForm({ ...staffForm, rolePreset: 'Cleaner' })}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            staffForm.rolePreset === 'Cleaner'
                              ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500/20'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Cleaner</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffForm({ ...staffForm, rolePreset: 'Other' })}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            staffForm.rolePreset === 'Other'
                              ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm ring-1 ring-amber-500/20'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Other</span>
                        </button>
                      </div>

                      {staffForm.rolePreset === 'Other' && (
                        <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <input
                            type="text"
                            required
                            value={staffForm.customRole}
                            onChange={(e) => setStaffForm({ ...staffForm, customRole: e.target.value })}
                            placeholder="Enter custom role (e.g. Concierge, Maintenance, Security, Chef...)"
                            className="w-full border border-amber-300 bg-amber-50/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-[#334155] mb-1">
                        Staff Member's Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={assignEmail}
                        onChange={(e) => setAssignEmail(e.target.value)}
                        placeholder="e.g. staff.member@domain.com"
                        className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Assign an existing registered user to this hotel.
                      </p>
                    </div>

                    {/* Role Selection for assigned staff */}
                    <div>
                      <label className="block text-xs font-bold text-[#334155] mb-1.5">
                        Assign As Role <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setAssignRolePreset('Front Desk')}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            assignRolePreset === 'Front Desk'
                              ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>Front Desk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignRolePreset('Cleaner')}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            assignRolePreset === 'Cleaner'
                              ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500/20'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Cleaner</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignRolePreset('Other')}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            assignRolePreset === 'Other'
                              ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm ring-1 ring-amber-500/20'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Other</span>
                        </button>
                      </div>

                      {assignRolePreset === 'Other' && (
                        <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <input
                            type="text"
                            required
                            value={assignCustomRole}
                            onChange={(e) => setAssignCustomRole(e.target.value)}
                            placeholder="Enter custom role (e.g. Concierge, Maintenance, Security, Chef...)"
                            className="w-full border border-amber-300 bg-amber-50/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStaffModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] hover:text-[#0F172A] font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={staffSaving}
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {staffSaving
                      ? 'Saving…'
                      : staffModalMode === 'create'
                      ? 'Create & Assign Staff'
                      : 'Assign Staff to Hotel'}
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
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
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
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
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
                    Confirm Guest No-Show
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Reservation Ref: <span className="font-mono font-semibold text-slate-700">{noShowModalBooking.bookingRef}</span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Guest</span>
                  <span className="font-semibold text-slate-800">
                    {noShowModalBooking.user?.fullName || noShowModalBooking.details?.[0]?.guestInfo?.name || 'Registered Guest'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Scheduled Stay</span>
                  <span className="font-semibold text-slate-800">
                    {noShowModalBooking.checkIn?.slice?.(0, 10)} &rarr; {noShowModalBooking.checkOut?.slice?.(0, 10)}
                  </span>
                </div>
                {noShowModalBooking.details?.[0]?.room && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Assigned Room</span>
                    <span className="font-semibold text-slate-800">
                      Room {noShowModalBooking.details[0].room.roomNumber} ({noShowModalBooking.details[0].room.type})
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                Marking this reservation as a <strong>No-Show</strong> records that the guest did not arrive. The assigned room will be immediately released back into available inventory for new bookings.
              </p>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={noShowSubmitting}
                  onClick={() => setNoShowModalBooking(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
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
                      Updating...
                    </>
                  ) : (
                    'Confirm No-Show'
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

  // Photo management state
  const [hotelImages, setHotelImages] = useState<Array<{ id: string; url: string; isPrimary: boolean }>>(
    hotel?.images ?? []
  )
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoActionId, setPhotoActionId] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [photoSuccess, setPhotoSuccess] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-dismiss photo notifications
  useEffect(() => {
    if (!photoSuccess) return
    const t = setTimeout(() => setPhotoSuccess(''), 4000)
    return () => clearTimeout(t)
  }, [photoSuccess])
  useEffect(() => {
    if (!photoError) return
    const t = setTimeout(() => setPhotoError(''), 6000)
    return () => clearTimeout(t)
  }, [photoError])

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

  // Photo upload handler
  const handlePhotoUpload = async (files: FileList | File[]) => {
    if (!hotel?.id || !files.length) return
    setPhotoUploading(true)
    setPhotoError('')
    try {
      const fileArray = Array.from(files)
      const result = await managerApi.addHotelImages(hotel.id, fileArray)
      // The API returns the updated images array or the hotel object
      const updatedImages = Array.isArray(result) ? result : (result as any)?.images ?? (result as any)?.data
      if (updatedImages && Array.isArray(updatedImages)) {
        setHotelImages(updatedImages)
      } else {
        // Refresh by fetching the hotel
        const refreshed = await hotelApi.getById(hotel.id)
        if (refreshed?.images) setHotelImages(refreshed.images)
      }
      setPhotoSuccess(`${fileArray.length} photo${fileArray.length > 1 ? 's' : ''} uploaded successfully!`)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to upload photos.')
    } finally {
      setPhotoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Set primary image handler
  const handleSetPrimary = async (imageId: string) => {
    if (!hotel?.id) return
    setPhotoActionId(imageId)
    setPhotoError('')
    try {
      await managerApi.setPrimaryHotelImage(hotel.id, imageId)
      setHotelImages((prev) =>
        prev.map((img) => ({ ...img, isPrimary: img.id === imageId }))
      )
      setPhotoSuccess('Primary photo updated!')
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to set primary image.')
    } finally {
      setPhotoActionId(null)
    }
  }

  // Delete image handler
  const handleDeleteImage = async (imageId: string) => {
    if (!hotel?.id) return
    setPhotoActionId(imageId)
    setPhotoError('')
    try {
      await managerApi.removeHotelImage(hotel.id, imageId)
      setHotelImages((prev) => prev.filter((img) => img.id !== imageId))
      setPhotoSuccess('Photo removed successfully.')
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to delete photo.')
    } finally {
      setPhotoActionId(null)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length) void handlePhotoUpload(files)
  }

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
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full text-[#64748B] hover:bg-[#F1F5F9] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
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
                  {value} Star{value > 1 ? 's' : ''} (Rating {value}/5)
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

          {/* ──────── Property Photos Section (only when editing) ──────── */}
          {hotel && (
            <div className="sm:col-span-2 mt-2">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Property Photos
                  </span>
                </label>
                <span className="text-[10px] text-[#94A3B8] font-medium">
                  {hotelImages.length} photo{hotelImages.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Status banners */}
              {photoSuccess && (
                <div className="mb-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {photoSuccess}
                </div>
              )}
              {photoError && (
                <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {photoError}
                </div>
              )}

              {/* Thumbnail Grid */}
              {hotelImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                  {hotelImages.map((img) => (
                    <div
                      key={img.id}
                      className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                        img.isPrimary
                          ? 'border-amber-400 shadow-md shadow-amber-100'
                          : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt="Hotel photo"
                        className="w-full aspect-square object-cover"
                      />

                      {/* Primary badge */}
                      {img.isPrimary && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-400 text-white rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shadow-sm">
                          <Crown className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-bold uppercase">Primary</span>
                        </div>
                      )}

                      {/* Hover overlay with actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                        {!img.isPrimary && (
                          <button
                            type="button"
                            disabled={photoActionId === img.id}
                            onClick={() => handleSetPrimary(img.id)}
                            title="Set as Primary"
                            className="w-8 h-8 bg-white/90 hover:bg-amber-50 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
                          >
                            {photoActionId === img.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                            ) : (
                              <Crown className="w-3.5 h-3.5 text-amber-600" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={photoActionId === img.id}
                          onClick={() => handleDeleteImage(img.id)}
                          title="Delete Photo"
                          className="w-8 h-8 bg-white/90 hover:bg-red-50 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
                        >
                          {photoActionId === img.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area: drag-and-drop + file input */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !photoUploading && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[#2563EB] bg-blue-50/60'
                    : 'border-[#CBD5E1] hover:border-[#94A3B8] hover:bg-slate-50/50'
                } ${photoUploading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) void handlePhotoUpload(e.target.files)
                  }}
                />
                {photoUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
                    <span className="text-xs font-semibold text-[#2563EB]">Uploading to Cloudinary…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#334155]">Upload Photos</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        Drag & drop images here, or click to browse
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
