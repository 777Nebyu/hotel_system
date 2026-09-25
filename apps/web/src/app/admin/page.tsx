'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi, reviewApi, hotelApi } from '@/lib/services'
import { useAuth } from '@/lib/auth-store'
import AuthGate from '@/components/AuthGate'
import type { Booking, Coupon, Hotel, Payment, PlatformSetting, Review, User } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AdminAnalyticsCharts } from '@/components/admin/AdminAnalyticsCharts'
import {
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Building2,
  Calendar,
  CreditCard,
  Star,
  Plus,
  Search,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Mail,
  Phone,
  Hotel as HotelIcon,
  BarChart3,
  FileDown,
  FileSpreadsheet,
  Sliders,
  Shield,
  Bell,
  Wrench,
  RefreshCw,
  Lock,
  AlertTriangle,
  Check,
  RotateCcw,
  Info,
  Upload,
  MapPin,
  ExternalLink,
} from 'lucide-react'


type Tab =
  | 'Dashboard'
  | 'Users'
  | 'Hotels'
  | 'Bookings'
  | 'Payments'
  | 'Reviews'
  | 'Coupons'
  | 'Settings'
  | 'Audit Logs'
  | 'Reports'

type Country = { id: string; name: string; code: string; cities?: Array<{ id: string; name: string }> }
type AdminUser = User & { _count?: { bookings: number; reviews: number; favorites: number } }
type AuditEntry = {
  id: string
  actor?: string | { email?: string } | null
  action?: string
  resource?: string
  resourceType?: string
  metadata?: unknown
  createdAt: string
  before?: unknown
  after?: unknown
}

const formatMoney = (value: number | string | null | undefined) =>
  value === null || value === undefined ? '—' : formatEthiopianBirr(value)

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const badge = (value: string) => {
  if (value === 'ACTIVE' || value === 'SUCCEEDED' || value === 'CHECKED_OUT') return 'bg-green-50 text-green-700'
  if (value === 'INACTIVE' || value === 'FAILED' || value === 'CANCELLED' || value === 'REJECTED')
    return 'bg-red-50 text-red-600'
  if (value === 'PENDING') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

export default function AdminDashboardPage() {
  return (
    <AuthGate roles={['ADMIN']}>
      <AdminDashboard />
    </AuthGate>
  )
}

function AdminDashboard() {
  const router = useRouter()
  const logout = useAuth((state) => state.logout)
  const user = useAuth((state) => state.user)

  const [tab, setTab] = useState<Tab>('Dashboard')
  const [overview, setOverview] = useState<any>({ userCount: 0, hotelCount: 0, bookingCount: 0, totalRevenue: 0 })
  const [occupancy, setOccupancy] = useState<any>({ rooms: 0, occupiedRoomsToday: 0, occupancyRate: 0, breakdown: [] })
  const [users, setUsers] = useState<AdminUser[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])

  // Analytics Charts State
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<Array<{ month: string; revenue: number }>>([])
  const [bookingTrendsData, setBookingTrendsData] = useState<Array<{ date: string; bookings: number }>>([])
  const [mostBookedHotelsData, setMostBookedHotelsData] = useState<Array<{ hotelId: string; name: string; bookings: number }>>([])

  // Category Settings State Defaults
  const defaultCommission = {
    platformFeePercent: 10,
    vatRate: 15,
    defaultCurrency: 'ETB',
    minPayoutAmount: 5000,
    payoutSchedule: 'WEEKLY',
  }
  const defaultBooking = {
    holdDurationMinutes: 30,
    cancellationGraceHours: 24,
    maxRoomsPerBooking: 10,
    autoConfirmBookings: true,
    allowEarlyCheckIn: true,
  }
  const defaultSecurity = {
    passwordMinLength: 8,
    require2FAForStaff: false,
    sessionTimeoutHours: 72,
    maxLoginAttempts: 5,
    enableAuditLogging: true,
  }
  const defaultNotifications = {
    supportEmail: 'support@luxstay.com',
    smsProvider: 'MOCK',
    emailDispatchMode: 'SMTP',
    notifyOnBooking: true,
    notifyOnCancellation: true,
  }
  const defaultOperations = {
    maintenanceMode: false,
    maintenanceMessage: 'LuxStay is currently undergoing scheduled platform optimization.',
    autoApproveHotels: false,
    maxUploadSizeMb: 15,
  }

  const [commissionSettings, setCommissionSettings] = useState(defaultCommission)
  const [bookingSettings, setBookingSettings] = useState(defaultBooking)
  const [securitySettings, setSecuritySettings] = useState(defaultSecurity)
  const [notificationSettings, setNotificationSettings] = useState(defaultNotifications)
  const [operationSettings, setOperationSettings] = useState(defaultOperations)
  const [savingCategory, setSavingCategory] = useState<string | null>(null)
  const [rawSettingsOpen, setRawSettingsOpen] = useState(false)

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

  // Load countries and cities for hotel provisioning
  useEffect(() => {
    hotelApi
      .countries()
      .then((data) => {
        if (Array.isArray(data)) {
          setCountries(data)
        }
      })
      .catch((err) => {
        console.warn('Failed to load countries for admin hotel creation:', err)
      })
  }, [])

  // Reject Hotel Modal
  const [rejectHotelTarget, setRejectHotelTarget] = useState<Hotel | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingSubmitting, setRejectingSubmitting] = useState(false)

  // Coupon Form Modal
  const [couponModalOpen, setCouponModalOpen] = useState(false)
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    value: 15,
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
    usageLimit: 100,
    minBookingAmount: '',
  })
  const [couponSaving, setCouponSaving] = useState(false)

  // Setting Upsert Modal
  const [settingModalOpen, setSettingModalOpen] = useState(false)
  const [settingForm, setSettingForm] = useState({
    key: '',
    value: '',
    description: '',
  })
  const [settingSaving, setSettingSaving] = useState(false)

  // Create User Modal (Managers / Staff / Users)
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false)
  const [createUserForm, setCreateUserForm] = useState<{
    fullName: string
    email: string
    password: string
    phone: string
    role: 'CUSTOMER' | 'MANAGER' | 'STAFF' | 'ADMIN'
    hotelId: string
  }>({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'MANAGER',
    hotelId: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [userCreating, setUserCreating] = useState(false)
  const [createUserError, setCreateUserError] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'MANAGER' | 'STAFF' | 'CUSTOMER' | 'ADMIN'>('ALL')
  const [userSearch, setUserSearch] = useState('')

  // Reassign Manager Modal
  const [assignManagerHotel, setAssignManagerHotel] = useState<Hotel | null>(null)
  const [selectedManagerUserId, setSelectedManagerUserId] = useState('')
  const [assigningManager, setAssigningManager] = useState(false)

  // Create Hotel Modal & Hotel Filter State
  const [createHotelModalOpen, setCreateHotelModalOpen] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [createHotelForm, setCreateHotelForm] = useState({
    name: '',
    description: '',
    countryId: '',
    cityId: '',
    address: '',
    starRating: 4,
    status: 'ACTIVE' as 'ACTIVE' | 'PENDING_APPROVAL',
    managerId: '',
  })
  const [hotelImagesFiles, setHotelImagesFiles] = useState<File[]>([])
  const [createHotelError, setCreateHotelError] = useState('')
  const [creatingHotel, setCreatingHotel] = useState(false)
  const [hotelSearch, setHotelSearch] = useState('')
  const [hotelStatusFilter, setHotelStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ALL')
  const [hotelManagerMode, setHotelManagerMode] = useState<'EXISTING' | 'CREATE_NEW'>('EXISTING')
  const [newHotelManagerForm, setNewHotelManagerForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
  })
  const [showNewHotelManagerPassword, setShowNewHotelManagerPassword] = useState(false)

  // Platform Reports State
  const [reportType, setReportType] = useState<
    'overview' | 'booking' | 'revenue' | 'occupancy' | 'customer' | 'cancellation'
  >('overview')
  const [reportPeriod, setReportPeriod] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly'
  >('monthly')
  const [reportDownloading, setReportDownloading] = useState<'pdf' | 'excel' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [
        overviewData,
        occupancyData,
        usersData,
        hotelsData,
        bookingsData,
        paymentsData,
        reviewsData,
        auditData,
        couponsData,
        settingsData,
        monthlyRevData,
        trendsData,
        topHotelsData,
      ] = await Promise.all([
        adminApi.overview().catch(() => ({ userCount: 0, hotelCount: 0, bookingCount: 0, totalRevenue: 0 })),
        adminApi.occupancy().catch(() => ({ rooms: 0, occupiedRoomsToday: 0, occupancyRate: 0, breakdown: [] })),
        adminApi.users({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.hotels({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.bookings({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.payments({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.reviews({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.auditLogs({ pageSize: '30' }).catch(() => []),
        adminApi.coupons().catch(() => []),
        adminApi.settings().catch(() => []),
        adminApi.monthlyRevenue(12).catch(() => []),
        adminApi.bookingTrends(30).catch(() => []),
        adminApi.mostBookedHotels(5).catch(() => []),
      ])

      setOverview(overviewData)
      setOccupancy(occupancyData)
      setUsers(usersData.data)
      setHotels(hotelsData.data)
      setBookings(bookingsData.data)
      setPayments(paymentsData.data)
      setReviews(reviewsData.data)
      setAuditLogs(Array.isArray(auditData) ? (auditData as AuditEntry[]) : (auditData?.data ?? []))
      setCoupons(couponsData)
      setSettings(settingsData)
      setMonthlyRevenueData(monthlyRevData)
      setBookingTrendsData(trendsData)
      setMostBookedHotelsData(topHotelsData)

      // Hydrate category settings from loaded platform settings
      const comm = settingsData.find((s) => s.key === 'COMMISSION_AND_TAX')?.value
      if (comm && typeof comm === 'object') setCommissionSettings((p) => ({ ...p, ...comm }))
      const book = settingsData.find((s) => s.key === 'BOOKING_POLICIES')?.value
      if (book && typeof book === 'object') setBookingSettings((p) => ({ ...p, ...book }))
      const sec = settingsData.find((s) => s.key === 'SECURITY_AND_AUTH')?.value
      if (sec && typeof sec === 'object') setSecuritySettings((p) => ({ ...p, ...sec }))
      const notif = settingsData.find((s) => s.key === 'NOTIFICATIONS_GATEWAY')?.value
      if (notif && typeof notif === 'object') setNotificationSettings((p) => ({ ...p, ...notif }))
      const ops = settingsData.find((s) => s.key === 'PLATFORM_OPERATIONS')?.value
      if (ops && typeof ops === 'object') setOperationSettings((p) => ({ ...p, ...ops }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load platform administration data.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSaveCategory = async (key: string, value: any, label: string) => {
    setSavingCategory(key)
    setError('')
    try {
      await adminApi.upsertSetting(key, { value })
      setSuccessBanner(`${label} updated successfully!`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${label}.`)
    } finally {
      setSavingCategory(null)
    }
  }

  const handleResetCategory = async (key: string, defaultVal: any, label: string) => {
    if (!confirm(`Reset ${label} to standard platform defaults?`)) return
    setSavingCategory(key)
    setError('')
    try {
      await adminApi.upsertSetting(key, { value: defaultVal })
      setSuccessBanner(`${label} reset to standard defaults!`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to reset ${label}.`)
    } finally {
      setSavingCategory(null)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  // Toggle User Active
  const toggleUser = async (target: AdminUser) => {
    setActing(target.id)
    setError('')
    try {
      await adminApi.setUserActive(target.id, !target.isActive)
      setSuccessBanner(`User ${target.fullName} ${target.isActive ? 'suspended' : 'restored'}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update user status.')
    } finally {
      setActing(null)
    }
  }

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserCreating(true)
    setCreateUserError('')
    try {
      const res = await adminApi.createUser({
        fullName: createUserForm.fullName.trim(),
        email: createUserForm.email.trim().toLowerCase(),
        password: createUserForm.password,
        phone: createUserForm.phone.trim() || undefined,
        role: createUserForm.role,
        hotelId: createUserForm.hotelId || undefined,
      })
      const assignedHotel = hotels.find((h) => h.id === createUserForm.hotelId)
      const hotelMsg = assignedHotel ? ` and assigned to manage "${assignedHotel.name}"` : ''
      setSuccessBanner(`Account for ${res.fullName} (${res.role}) created successfully${hotelMsg}!`)
      setCreateUserModalOpen(false)
      setCreateUserForm({
        fullName: '',
        email: '',
        password: '',
        phone: '',
        role: 'MANAGER',
        hotelId: '',
      })
      setShowPassword(false)
      await load()
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : 'Failed to create user account.')
    } finally {
      setUserCreating(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter
    const q = userSearch.trim().toLowerCase()
    const matchesSearch =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    return matchesRole && matchesSearch
  })

  // Reassign Hotel Manager Flow
  const handleAssignManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignManagerHotel) return
    setAssigningManager(true)
    setError('')
    try {
      await adminApi.reassignManager(assignManagerHotel.id, selectedManagerUserId)
      const newManager = users.find((u) => u.id === selectedManagerUserId)
      setSuccessBanner(
        `Hotel "${assignManagerHotel.name}" manager updated${newManager ? ` to ${newManager.fullName}` : ''}!`
      )
      setAssignManagerHotel(null)
      setSelectedManagerUserId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign hotel manager.')
    } finally {
      setAssigningManager(false)
    }
  }

  // Hotel Approval Flow
  const approveHotel = async (hotel: Hotel) => {
    setActing(hotel.id)
    setError('')
    try {
      await adminApi.approveHotel(hotel.id)
      setSuccessBanner(`Hotel ${hotel.name} approved and activated!`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve hotel.')
    } finally {
      setActing(null)
    }
  }

  const handleRejectHotelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectHotelTarget || !rejectReason.trim()) return
    setRejectingSubmitting(true)
    setError('')
    try {
      await adminApi.rejectHotel(rejectHotelTarget.id, rejectReason.trim())
      setSuccessBanner(`Hotel ${rejectHotelTarget.name} rejected.`)
      setRejectHotelTarget(null)
      setRejectReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject hotel.')
    } finally {
      setRejectingSubmitting(false)
    }
  }

  const toggleHotelStatus = async (hotel: Hotel) => {
    setActing(hotel.id)
    setError('')
    try {
      const nextStatus = hotel.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await adminApi.setHotelStatus(hotel.id, nextStatus)
      setSuccessBanner(`Hotel status updated to ${nextStatus}.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change hotel status.')
    } finally {
      setActing(null)
    }
  }

  const handleCountryChange = (countryId: string) => {
    const selected = countries.find((c) => c.id === countryId)
    const firstCityId = selected?.cities?.[0]?.id || ''
    setCreateHotelForm((prev) => ({
      ...prev,
      countryId,
      cityId: firstCityId,
    }))
  }

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    let pwd = ''
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewHotelManagerForm((prev) => ({ ...prev, password: pwd }))
    setShowNewHotelManagerPassword(true)
  }

  const handleCreateHotelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateHotelError('')

    const trimmedName = createHotelForm.name.trim()
    const trimmedAddress = createHotelForm.address.trim()
    const trimmedDesc = createHotelForm.description.trim()

    if (!trimmedName || trimmedName.length < 2) {
      setCreateHotelError('Hotel name must be at least 2 characters.')
      return
    }
    if (!createHotelForm.cityId) {
      setCreateHotelError('Please select a valid city for the hotel location.')
      return
    }
    if (!trimmedAddress || trimmedAddress.length < 3) {
      setCreateHotelError('Street address must be at least 3 characters.')
      return
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setCreateHotelError('Please provide a descriptive overview of at least 10 characters.')
      return
    }

    if (hotelManagerMode === 'CREATE_NEW') {
      const mgrName = newHotelManagerForm.fullName.trim()
      const mgrEmail = newHotelManagerForm.email.trim().toLowerCase()
      const mgrPassword = newHotelManagerForm.password

      if (!mgrName || mgrName.length < 2) {
        setCreateHotelError('New manager full name must be at least 2 characters.')
        return
      }
      if (!mgrEmail || !/^\S+@\S+\.\S+$/.test(mgrEmail)) {
        setCreateHotelError('Please provide a valid work email address for the new manager.')
        return
      }
      if (!mgrPassword || mgrPassword.length < 8) {
        setCreateHotelError('Manager account password must be at least 8 characters.')
        return
      }
    }

    setCreatingHotel(true)
    try {
      let assignedManagerId: string | undefined = undefined

      if (hotelManagerMode === 'CREATE_NEW') {
        const newMgr = await adminApi.createUser({
          fullName: newHotelManagerForm.fullName.trim(),
          email: newHotelManagerForm.email.trim().toLowerCase(),
          password: newHotelManagerForm.password,
          phone: newHotelManagerForm.phone.trim() || undefined,
          role: 'MANAGER',
        })
        assignedManagerId = newMgr.id
      } else if (createHotelForm.managerId) {
        assignedManagerId = createHotelForm.managerId
      }

      const payload: Record<string, unknown> = {
        name: trimmedName,
        description: trimmedDesc,
        cityId: createHotelForm.cityId,
        address: trimmedAddress,
        starRating: Number(createHotelForm.starRating),
        status: createHotelForm.status,
      }
      if (assignedManagerId) {
        payload.managerId = assignedManagerId
      }

      const created = await adminApi.createHotel(payload)

      if (hotelImagesFiles.length > 0 && created?.id) {
        try {
          await adminApi.addHotelImages(created.id, hotelImagesFiles)
        } catch (imgErr) {
          console.warn('Hotel created but image upload encountered an issue:', imgErr)
        }
      }

      const successMsg =
        hotelManagerMode === 'CREATE_NEW'
          ? `Hotel "${trimmedName}" created and new Manager account provisioned for "${newHotelManagerForm.fullName.trim()}" (${newHotelManagerForm.email.trim().toLowerCase()})!`
          : `Hotel property "${trimmedName}" created and listed successfully!`

      setSuccessBanner(successMsg)
      setCreateHotelModalOpen(false)
      setHotelImagesFiles([])
      setHotelManagerMode('EXISTING')
      setNewHotelManagerForm({
        fullName: '',
        email: '',
        password: '',
        phone: '',
      })
      setShowNewHotelManagerPassword(false)
      const defaultCountry = countries[0]
      setCreateHotelForm({
        name: '',
        description: '',
        countryId: defaultCountry?.id || '',
        cityId: defaultCountry?.cities?.[0]?.id || '',
        address: '',
        starRating: 4,
        status: 'ACTIVE',
        managerId: '',
      })
      await load()
    } catch (err) {
      setCreateHotelError(err instanceof Error ? err.message : 'Failed to create hotel property.')
    } finally {
      setCreatingHotel(false)
    }
  }

  const filteredHotels = hotels.filter((h) => {
    const q = hotelSearch.toLowerCase().trim()
    const matchesSearch =
      !q ||
      h.name.toLowerCase().includes(q) ||
      (h.city?.name && h.city.name.toLowerCase().includes(q)) ||
      h.address.toLowerCase().includes(q) ||
      h.id.toLowerCase().includes(q)

    if (!matchesSearch) return false

    if (hotelStatusFilter === 'ALL') return true
    if (hotelStatusFilter === 'PENDING') {
      return h.status === 'PENDING' || h.status === 'PENDING_APPROVAL'
    }
    return h.status === hotelStatusFilter
  })

  const removeReview = async (target: Review) => {
    setActing(target.id)
    setError('')
    try {
      await reviewApi.remove(target.id)
      setSuccessBanner('Review deleted.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete review.')
    } finally {
      setActing(null)
    }
  }

  // Coupon Handlers
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    setCouponSaving(true)
    setError('')
    try {
      await adminApi.createCoupon({
        code: couponForm.code.trim().toUpperCase(),
        discountType: couponForm.discountType,
        value: Number(couponForm.value),
        validFrom: new Date(couponForm.validFrom).toISOString(),
        validTo: new Date(couponForm.validTo).toISOString(),
        usageLimit: Number(couponForm.usageLimit),
        minBookingAmount: couponForm.minBookingAmount ? Number(couponForm.minBookingAmount) : undefined,
      })
      setSuccessBanner(`Coupon ${couponForm.code.toUpperCase()} created!`)
      setCouponModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create coupon.')
    } finally {
      setCouponSaving(false)
    }
  }

  const toggleCouponActive = async (coupon: Coupon) => {
    setActing(coupon.id)
    setError('')
    try {
      await adminApi.updateCoupon(coupon.id, { isActive: !coupon.isActive })
      setSuccessBanner(`Coupon ${coupon.code} updated.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coupon.')
    } finally {
      setActing(null)
    }
  }

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return
    setError('')
    try {
      await adminApi.deleteCoupon(couponId)
      setSuccessBanner('Coupon deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete coupon.')
    }
  }

  // Setting Handlers
  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault()
    setSettingSaving(true)
    setError('')
    try {
      let parsedValue: any = settingForm.value
      try {
        parsedValue = JSON.parse(settingForm.value)
      } catch {
        // Keep as string if not valid JSON
      }
      await adminApi.upsertSetting(settingForm.key.trim(), {
        value: parsedValue,
        description: settingForm.description.trim() || undefined,
      })
      setSuccessBanner(`Setting "${settingForm.key}" saved!`)
      setSettingModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setting.')
    } finally {
      setSettingSaving(false)
    }
  }

  const handleDeleteSetting = async (key: string) => {
    if (!confirm(`Delete setting "${key}"?`)) return
    setError('')
    try {
      await adminApi.deleteSetting(key)
      setSuccessBanner(`Setting "${key}" removed.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete setting.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        Loading admin console…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] hidden lg:flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-[#E2E8F0]">
          <div className="w-12 h-12 rounded-full bg-[#0F172A] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {user?.fullName.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="font-semibold text-[#0F172A] mt-3">{user?.fullName || 'Administrator'}</div>
          <div className="text-[#64748B] text-xs">LuxStay Enterprise Admin Console</div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {(
            [
              'Dashboard',
              'Users',
              'Hotels',
              'Bookings',
              'Payments',
              'Reviews',
              'Coupons',
              'Settings',
              'Audit Logs',
              'Reports',
            ] as Tab[]
          ).map((item) => (
            <button
              key={item}
              onClick={() => {
                setTab(item)
                setError('')
                setSuccessBanner('')
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === item ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              {item}
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
          const userCountDisplay = overview?.userCount ?? overview?.users?.total ?? users.length
          const hotelCountDisplay = overview?.hotelCount ?? overview?.hotels?.total ?? hotels.length
          const bookingCountDisplay = overview?.bookingCount ?? overview?.bookings?.total ?? bookings.length
          const revenueDisplay = overview?.totalRevenue ?? overview?.revenue?.total ?? 0

          const occupancyRateNum =
            typeof occupancy?.occupancyRate === 'number' && !isNaN(occupancy.occupancyRate)
              ? occupancy.occupancyRate
              : 0
          const occupiedRoomsCount = occupancy?.occupiedRoomsToday ?? occupancy?.occupiedToday ?? 0
          const activeRoomsCount = occupancy?.rooms ?? occupancy?.totalRooms ?? 0

          return (
            <div>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="font-serif text-3xl text-[#0F172A]">Platform Operations</h1>
                  <p className="text-[#64748B]">Platform-wide metrics, analytics curves, and performance indicators.</p>
                </div>
                <button
                  onClick={() => void load()}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer transition-colors"
                >
                  Refresh
                </button>
              </div>

              {/* 4 Primary Top Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total users', value: userCountDisplay, icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { label: 'Hotels listed', value: hotelCountDisplay, icon: Building2, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                  { label: 'Total bookings', value: bookingCountDisplay, icon: Calendar, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  { label: 'Platform revenue', value: formatMoney(revenueDisplay), icon: CreditCard, color: 'text-purple-600 bg-purple-50 border-purple-100' },
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

              {/* Interactive Luxury Analytics Charts */}
              <AdminAnalyticsCharts
                monthlyRevenue={monthlyRevenueData}
                bookingTrends={bookingTrendsData}
                topHotels={mostBookedHotelsData}
                occupancyBreakdown={occupancy?.breakdown}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
                  <h2 className="font-bold text-[#0F172A] mb-2">Today&apos;s Occupancy Rate</h2>
                  <div className="text-4xl font-bold text-[#0F172A]">{(occupancyRateNum * 100).toFixed(1)}%</div>
                  <p className="text-[#64748B] text-sm mt-1">
                    {occupiedRoomsCount} occupied of {activeRoomsCount} active rooms
                  </p>
                  <div className="bg-[#F1F5F9] h-2.5 rounded-full mt-5 overflow-hidden">
                    <div
                      className="bg-[#2563EB] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, occupancyRateNum * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-[#F1F5F9] flex justify-between items-center">
                    <h2 className="font-bold text-[#0F172A]">Latest Reservations</h2>
                    <button onClick={() => setTab('Bookings')} className="text-sm text-[#2563EB] font-semibold cursor-pointer">
                      View all →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {bookings.slice(0, 5).map((b) => (
                      <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1">
                          <div className="font-medium text-[#0F172A] text-sm">{b.hotel?.name || 'Hotel stay'}</div>
                          <div className="text-[#64748B] text-xs">{formatDate(b.createdAt)}</div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge(b.status)}`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                    {!bookings.length && (
                      <p className="py-8 text-center text-xs text-slate-400">No reservations recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Tab 2: Users Management */}
        {tab === 'Users' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">User Accounts</h1>
                <p className="text-[#64748B] text-sm">
                  {users.length} registered accounts across customer, manager, and staff roles.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreateUserError('')
                  setCreateUserForm({
                    fullName: '',
                    email: '',
                    password: '',
                    phone: '',
                    role: 'MANAGER',
                    hotelId: '',
                  })
                  setShowPassword(false)
                  setCreateUserModalOpen(true)
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Manager / User</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(['ALL', 'MANAGER', 'STAFF', 'CUSTOMER', 'ADMIN'] as const).map((r) => {
                  const count = r === 'ALL' ? users.length : users.filter((u) => u.role === r).length
                  const active = userRoleFilter === r
                  return (
                    <button
                      key={r}
                      onClick={() => setUserRoleFilter(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-white text-[#0F172A] shadow-sm'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      <span>{r === 'ALL' ? 'All Roles' : r.charAt(0) + r.slice(1).toLowerCase()}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                          active ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                  <tr>
                    <th className="px-5 py-3">Name & Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Assigned Hotel</th>
                    <th className="px-5 py-3">Bookings</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((target) => {
                    const managedHotel = hotels.find((h) => h.managerId === target.id || h.manager?.id === target.id)
                    return (
                      <tr key={target.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-[#0F172A] text-sm">{target.fullName}</div>
                          <div className="text-[#64748B] text-xs flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{target.email}</span>
                          </div>
                          {target.phone && (
                            <div className="text-[#94A3B8] text-[11px] flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span>{target.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                              target.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                                : target.role === 'MANAGER'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                : target.role === 'STAFF'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {target.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-[#475569]">
                          {managedHotel ? (
                            <div className="flex items-center gap-1 text-slate-700 font-medium">
                              <HotelIcon className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                              <span className="truncate max-w-[160px]" title={managedHotel.name}>
                                {managedHotel.name}
                              </span>
                            </div>
                          ) : target.role === 'MANAGER' ? (
                            <span className="text-amber-600 italic">Unassigned</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-[#64748B]">{target._count?.bookings ?? 0}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              target.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {target.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            disabled={acting === target.id}
                            onClick={() => void toggleUser(target)}
                            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                          >
                            {acting === target.id ? 'Updating…' : target.isActive ? 'Suspend' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!filteredUsers.length && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[#64748B] text-sm">
                        No users matching the selected filter or search term.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Hotels Approval Workflow */}
        {tab === 'Hotels' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Hotel Properties & Approvals</h1>
                <p className="text-[#64748B] text-sm">
                  Review pending hotel submissions, approve, reject, or provision new properties.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateHotelError('')
                  const defaultCountry = countries[0]
                  setCreateHotelForm({
                    name: '',
                    description: '',
                    countryId: defaultCountry?.id || '',
                    cityId: defaultCountry?.cities?.[0]?.id || '',
                    address: '',
                    starRating: 4,
                    status: 'ACTIVE',
                    managerId: '',
                  })
                  setHotelImagesFiles([])
                  setHotelManagerMode('EXISTING')
                  setNewHotelManagerForm({
                    fullName: '',
                    email: '',
                    password: '',
                    phone: '',
                  })
                  setShowNewHotelManagerPassword(false)
                  setCreateHotelModalOpen(true)
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Hotel</span>
              </button>
            </div>

            {/* Filter and Search Bar for Hotels */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(
                  [
                    { id: 'ALL', label: 'All Hotels', count: hotels.length },
                    {
                      id: 'PENDING',
                      label: 'Pending',
                      count: hotels.filter(
                        (h) => h.status === 'PENDING' || h.status === 'PENDING_APPROVAL'
                      ).length,
                    },
                    {
                      id: 'ACTIVE',
                      label: 'Active',
                      count: hotels.filter((h) => h.status === 'ACTIVE').length,
                    },
                    {
                      id: 'INACTIVE',
                      label: 'Inactive',
                      count: hotels.filter((h) => h.status === 'INACTIVE').length,
                    },
                    {
                      id: 'SUSPENDED',
                      label: 'Suspended',
                      count: hotels.filter((h) => h.status === 'SUSPENDED').length,
                    },
                  ] as const
                ).map((item) => {
                  const active = hotelStatusFilter === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setHotelStatusFilter(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-white text-[#2563EB] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          active
                            ? 'bg-blue-50 text-[#2563EB]'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search hotels by name, city, address..."
                  value={hotelSearch}
                  onChange={(e) => setHotelSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-[#E2E8F0] rounded-xl text-xs bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                {hotelSearch && (
                  <button
                    type="button"
                    onClick={() => setHotelSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                  <tr>
                    <th className="px-5 py-3">Hotel Property</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Rating</th>
                    <th className="px-5 py-3">General Manager</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHotels.map((hotel) => (
                    <tr key={hotel.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {hotel.images && hotel.images.length > 0 ? (
                            <img
                              src={hotel.images[0]?.url}
                              alt={hotel.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-sm shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-[#0F172A] text-sm flex items-center gap-1.5">
                              <span>{hotel.name}</span>
                              <a
                                href={`/hotel/${hotel.id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Preview hotel page"
                                className="text-slate-400 hover:text-[#2563EB] transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <div className="text-xs text-[#94A3B8] font-mono">{hotel.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[#64748B]">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{hotel.city?.name || 'City'}</span>
                          {hotel.city?.country && (
                            <span className="text-slate-400 text-xs">({hotel.city.country.name})</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{hotel.address}</div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex items-center gap-1 text-amber-600 font-semibold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{hotel.starRating}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {hotel.manager ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-[#0F172A]">{hotel.manager.fullName}</span>
                            <span className="text-[#64748B] text-[11px]">{hotel.manager.email}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAssignManagerHotel(hotel)
                                setSelectedManagerUserId(hotel.managerId || '')
                              }}
                              className="text-[11px] font-semibold text-[#2563EB] hover:underline text-left cursor-pointer mt-0.5"
                            >
                              Change Manager
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-600 italic">Unassigned</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAssignManagerHotel(hotel)
                                setSelectedManagerUserId('')
                              }}
                              className="px-2 py-0.5 bg-blue-50 text-[#2563EB] hover:bg-blue-100 rounded text-[11px] font-semibold cursor-pointer"
                            >
                              Assign
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={hotel.status} size="sm" />
                      </td>
                      <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                        {hotel.status === 'PENDING' || hotel.status === 'PENDING_APPROVAL' ? (
                          <>
                            <button
                              disabled={acting === hotel.id}
                              onClick={() => approveHotel(hotel)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              disabled={acting === hotel.id}
                              onClick={() => {
                                setRejectHotelTarget(hotel)
                                setRejectReason('')
                              }}
                              className="px-3 py-1 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={acting === hotel.id}
                            onClick={() => toggleHotelStatus(hotel)}
                            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
                          >
                            {hotel.status === 'ACTIVE' ? 'Suspend / Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredHotels.length && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-[#64748B]">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-3">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <h4 className="font-semibold text-slate-800 text-base mb-1">
                            {hotelSearch || hotelStatusFilter !== 'ALL'
                              ? 'No hotels match your filters'
                              : 'No hotel properties listed'}
                          </h4>
                          <p className="text-xs text-slate-500 mb-4 text-center">
                            {hotelSearch || hotelStatusFilter !== 'ALL'
                              ? 'Try adjusting your search query or switching the status filter tab.'
                              : 'Get started by creating and onboarding the first hotel listing.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setCreateHotelError('')
                              const defaultCountry = countries[0]
                              setCreateHotelForm({
                                name: '',
                                description: '',
                                countryId: defaultCountry?.id || '',
                                cityId: defaultCountry?.cities?.[0]?.id || '',
                                address: '',
                                starRating: 4,
                                status: 'ACTIVE',
                                managerId: '',
                              })
                              setHotelImagesFiles([])
                              setHotelManagerMode('EXISTING')
                              setNewHotelManagerForm({
                                fullName: '',
                                email: '',
                                password: '',
                                phone: '',
                              })
                              setShowNewHotelManagerPassword(false)
                              setCreateHotelModalOpen(true)
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add New Hotel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: All Bookings */}
        {tab === 'Bookings' && (
          <div>
            <h1 className="font-bold text-[#0F172A] text-2xl mb-6">Platform Bookings</h1>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {bookings.map((b) => (
                <div key={b.id} className="p-5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A] text-sm">
                      {b.hotel?.name || 'Hotel Booking'} <span className="text-xs text-[#94A3B8] font-mono">#{b.id.slice(-8)}</span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatDate(b.checkIn)} → {formatDate(b.checkOut)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-[#0F172A]">{formatMoney(b.totalPrice)}</div>
                    <div className="mt-1 flex justify-end">
                      <StatusBadge status={b.status} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
              {!bookings.length && <p className="p-10 text-center text-[#64748B]">No reservations found.</p>}
            </div>
          </div>
        )}

        {/* Tab 5: Payments */}
        {tab === 'Payments' && (
          <div>
            <h1 className="font-bold text-[#0F172A] text-2xl mb-6">Payment Transactions</h1>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {payments.map((p) => (
                <div key={p.id} className="p-5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0F172A] text-sm">{p.booking?.hotel?.name || 'Booking Payment'}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">
                      {formatDate(p.createdAt)} · {p.method.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-[#0F172A]">{formatMoney(p.amount)}</div>
                    <div className="mt-1 flex justify-end">
                      <StatusBadge status={p.status} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
              {!payments.length && <p className="p-10 text-center text-[#64748B]">No payment records found.</p>}
            </div>
          </div>
        )}

        {/* Tab 6: Reviews */}
        {tab === 'Reviews' && (
          <div>
            <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Customer Reviews</h1>
            <p className="text-[#64748B] text-sm mb-6">Moderate feedback submitted across all properties.</p>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {reviews.map((review) => (
                <div key={review.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#0F172A] text-sm">{review.user?.fullName || 'Guest'}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((_, idx) => (
                          <Star
                            key={idx}
                            className={`w-3.5 h-3.5 ${
                              idx < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-[#334155] text-sm">{review.comment}</p>
                    <p className="text-[#64748B] text-xs mt-1">
                      {review.hotel?.name || 'Hotel'} · {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <button
                    disabled={acting === review.id}
                    onClick={() => void removeReview(review)}
                    className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {!reviews.length && <p className="p-10 text-center text-[#64748B]">No reviews recorded.</p>}
            </div>
          </div>
        )}

        {/* Tab 7: Coupons Management */}
        {tab === 'Coupons' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Promotional Coupons</h1>
                <p className="text-[#64748B] text-sm">Create and manage checkout discount codes for guests.</p>
              </div>
              <button
                onClick={() => setCouponModalOpen(true)}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                + Create Coupon
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                  <tr>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Discount</th>
                    <th className="px-5 py-3">Validity Window</th>
                    <th className="px-5 py-3">Usage</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono font-bold text-[#0F172A]">{coupon.code}</td>
                      <td className="px-5 py-3 text-sm text-[#334155]">
                        {coupon.discountType === 'PERCENTAGE'
                          ? `${coupon.value ?? coupon.discountValue}% Off`
                          : `${formatMoney(coupon.value ?? coupon.discountValue)} Off`}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#64748B]">
                        {coupon.validFrom ? formatDate(coupon.validFrom) : 'Now'} →{' '}
                        {coupon.validTo ? formatDate(coupon.validTo) : 'Indefinite'}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#64748B]">
                        {coupon.timesUsed ?? coupon.usageCount ?? 0} / {coupon.usageLimit ?? '∞'}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            coupon.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {coupon.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right space-x-2">
                        <button
                          onClick={() => toggleCouponActive(coupon)}
                          className="text-xs font-semibold text-[#2563EB]"
                        >
                          {coupon.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="text-xs font-semibold text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!coupons.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#94A3B8] text-sm">
                        No coupons created yet. Click &quot;+ Create Coupon&quot; to issue promotions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 8: Platform Settings & Governance */}
        {tab === 'Settings' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Platform Settings & Governance</h1>
                <p className="text-[#64748B] text-sm">
                  System configurations, financial rules, security policies, gateways, and maintenance controls.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRawSettingsOpen((p) => !p)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-white shadow-xs cursor-pointer transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>{rawSettingsOpen ? 'Hide Raw Store' : 'Raw Database Explorer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingForm({ key: '', value: '', description: '' })
                    setSettingModalOpen(true)
                  }}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Key</span>
                </button>
              </div>
            </div>

            {/* Maintenance Mode Banner Alert if Enabled */}
            {operationSettings.maintenanceMode && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-sm text-amber-950">Platform Maintenance Mode is Currently Active</div>
                  <p className="mt-0.5 text-amber-800">
                    Guests and public visitors will see the maintenance broadcast message: &quot;{operationSettings.maintenanceMessage}&quot;.
                  </p>
                </div>
              </div>
            )}

            {/* 5 Functional Settings Category Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category 1: Financial & Commission Governance */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-base">Commission & Financials</h3>
                      <p className="text-xs text-slate-500">Revenue sharing, taxation, and payout thresholds</p>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Platform Commission Fee (%)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={commissionSettings.platformFeePercent}
                        onChange={(e) =>
                          setCommissionSettings((p) => ({ ...p, platformFeePercent: Number(e.target.value) }))
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Percentage deducted from completed reservations</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">VAT / Tax Rate (%)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="50"
                          value={commissionSettings.vatRate}
                          onChange={(e) =>
                            setCommissionSettings((p) => ({ ...p, vatRate: Number(e.target.value) }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Default Currency</label>
                        <select
                          value={commissionSettings.defaultCurrency}
                          onChange={(e) =>
                            setCommissionSettings((p) => ({ ...p, defaultCurrency: e.target.value }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        >
                          <option value="ETB">ETB (Ethiopian Birr)</option>
                          <option value="USD">USD (US Dollar)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Payout Schedule</label>
                        <select
                          value={commissionSettings.payoutSchedule}
                          onChange={(e) =>
                            setCommissionSettings((p) => ({ ...p, payoutSchedule: e.target.value }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        >
                          <option value="WEEKLY">Weekly Disbursal</option>
                          <option value="BI_WEEKLY">Bi-Weekly</option>
                          <option value="MONTHLY">Monthly Disbursal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Min Payout (ETB)</label>
                        <input
                          type="number"
                          step="500"
                          min="500"
                          value={commissionSettings.minPayoutAmount}
                          onChange={(e) =>
                            setCommissionSettings((p) => ({ ...p, minPayoutAmount: Number(e.target.value) }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-5 mt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleResetCategory('COMMISSION_AND_TAX', defaultCommission, 'Commission Settings')}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Defaults</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingCategory !== null}
                    onClick={() => handleSaveCategory('COMMISSION_AND_TAX', commissionSettings, 'Commission Settings')}
                    className="px-4 py-2 bg-[#0F2942] hover:bg-[#1E3E62] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingCategory === 'COMMISSION_AND_TAX' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Save Financials</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Category 2: Booking Policies & Reservation Defaults */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-base">Booking & Stay Policies</h3>
                      <p className="text-xs text-slate-500">Hold timers, cancellation grace windows, and stay parameters</p>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Hold Timeout (Minutes)
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="180"
                          value={bookingSettings.holdDurationMinutes}
                          onChange={(e) =>
                            setBookingSettings((p) => ({ ...p, holdDurationMinutes: Number(e.target.value) }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Temporary hold for pending payment</p>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Free Cancellation (Hours)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="168"
                          value={bookingSettings.cancellationGraceHours}
                          onChange={(e) =>
                            setBookingSettings((p) => ({ ...p, cancellationGraceHours: Number(e.target.value) }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Full refund window before check-in</p>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Max Rooms Per Booking
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={bookingSettings.maxRoomsPerBooking}
                        onChange={(e) =>
                          setBookingSettings((p) => ({ ...p, maxRoomsPerBooking: Number(e.target.value) }))
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>

                    <div className="pt-2 space-y-3">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-800">Auto-Confirm Bookings</div>
                          <div className="text-[11px] text-slate-400">Instantly confirm upon payment success</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={bookingSettings.autoConfirmBookings}
                          onChange={(e) =>
                            setBookingSettings((p) => ({ ...p, autoConfirmBookings: e.target.checked }))
                          }
                          className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-800">Allow Early Check-In Requests</div>
                          <div className="text-[11px] text-slate-400">Permit guests to submit early check-in requests</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={bookingSettings.allowEarlyCheckIn}
                          onChange={(e) =>
                            setBookingSettings((p) => ({ ...p, allowEarlyCheckIn: e.target.checked }))
                          }
                          className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-5 mt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleResetCategory('BOOKING_POLICIES', defaultBooking, 'Booking Policies')}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Defaults</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingCategory !== null}
                    onClick={() => handleSaveCategory('BOOKING_POLICIES', bookingSettings, 'Booking Policies')}
                    className="px-4 py-2 bg-[#0F2942] hover:bg-[#1E3E62] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingCategory === 'BOOKING_POLICIES' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Save Booking Policies</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Category 3: Security & Access Controls */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-base">Security & Authentication</h3>
                      <p className="text-xs text-slate-500">Password complexity, session durations, and lockout policies</p>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Min Password Length
                        </label>
                        <select
                          value={securitySettings.passwordMinLength}
                          onChange={(e) =>
                            setSecuritySettings((p) => ({ ...p, passwordMinLength: Number(e.target.value) }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        >
                          <option value={6}>6 Characters</option>
                          <option value={8}>8 Characters (Recommended)</option>
                          <option value={10}>10 Characters</option>
                          <option value={12}>12 Characters</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Session Timeout (Hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={securitySettings.sessionTimeoutHours}
                          onChange={(e) =>
                            setSecuritySettings((p) => ({ ...p, sessionTimeoutHours: Number(e.target.value) }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Max Failed Login Attempts
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="20"
                        value={securitySettings.maxLoginAttempts}
                        onChange={(e) =>
                          setSecuritySettings((p) => ({ ...p, maxLoginAttempts: Number(e.target.value) }))
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Triggers temporary account lockout protection</p>
                    </div>

                    <div className="pt-2 space-y-3">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-800">Enforce 2FA for Staff / Managers</div>
                          <div className="text-[11px] text-slate-400">Require multi-factor verification on admin sign-in</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={securitySettings.require2FAForStaff}
                          onChange={(e) =>
                            setSecuritySettings((p) => ({ ...p, require2FAForStaff: e.target.checked }))
                          }
                          className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-800">Immutable Audit Logging</div>
                          <div className="text-[11px] text-slate-400">Record actor IDs and diffs on all state changes</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={securitySettings.enableAuditLogging}
                          onChange={(e) =>
                            setSecuritySettings((p) => ({ ...p, enableAuditLogging: e.target.checked }))
                          }
                          className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-5 mt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleResetCategory('SECURITY_AND_AUTH', defaultSecurity, 'Security Settings')}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Defaults</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingCategory !== null}
                    onClick={() => handleSaveCategory('SECURITY_AND_AUTH', securitySettings, 'Security Settings')}
                    className="px-4 py-2 bg-[#0F2942] hover:bg-[#1E3E62] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingCategory === 'SECURITY_AND_AUTH' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Save Security Controls</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Category 4: Notifications & Communication Gateways */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-base">Notification Gateways</h3>
                      <p className="text-xs text-slate-500">Email dispatch modes, SMS providers, and alerts</p>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Primary System Support Email
                      </label>
                      <input
                        type="email"
                        value={notificationSettings.supportEmail}
                        onChange={(e) =>
                          setNotificationSettings((p) => ({ ...p, supportEmail: e.target.value }))
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">SMS Gateway Provider</label>
                        <select
                          value={notificationSettings.smsProvider}
                          onChange={(e) =>
                            setNotificationSettings((p) => ({ ...p, smsProvider: e.target.value }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        >
                          <option value="MOCK">MOCK (Simulation Mode)</option>
                          <option value="TWILIO">Twilio Global</option>
                          <option value="ETHIOTELECOM">EthioTelecom Gateway</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Email Dispatcher</label>
                        <select
                          value={notificationSettings.emailDispatchMode}
                          onChange={(e) =>
                            setNotificationSettings((p) => ({ ...p, emailDispatchMode: e.target.value }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        >
                          <option value="SMTP">SMTP Production Mailer</option>
                          <option value="SES">Amazon SES</option>
                          <option value="SIMULATED">Simulated / Local Mock</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 space-y-3">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-800">Booking Confirmation Emails</div>
                          <div className="text-[11px] text-slate-400">Send instant voucher receipt upon booking</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={notificationSettings.notifyOnBooking}
                          onChange={(e) =>
                            setNotificationSettings((p) => ({ ...p, notifyOnBooking: e.target.checked }))
                          }
                          className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-800">Cancellation Alert Emails</div>
                          <div className="text-[11px] text-slate-400">Dispatch cancellation confirmation to guest</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={notificationSettings.notifyOnCancellation}
                          onChange={(e) =>
                            setNotificationSettings((p) => ({ ...p, notifyOnCancellation: e.target.checked }))
                          }
                          className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-5 mt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleResetCategory('NOTIFICATIONS_GATEWAY', defaultNotifications, 'Notification Settings')}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Defaults</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingCategory !== null}
                    onClick={() => handleSaveCategory('NOTIFICATIONS_GATEWAY', notificationSettings, 'Notification Settings')}
                    className="px-4 py-2 bg-[#0F2942] hover:bg-[#1E3E62] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingCategory === 'NOTIFICATIONS_GATEWAY' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Save Gateways</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Category 5: Operations & Platform Maintenance (Spans Full Width on Small, 2 Cols on Large) */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between lg:col-span-2">
                <div>
                  <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-base">Platform Operations & Maintenance</h3>
                      <p className="text-xs text-slate-500">System broadcast messaging, maintenance mode, and listing governance</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div>
                            <div className="font-bold text-sm text-slate-900">Platform Maintenance Mode</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              When enabled, restricts public booking and displays maintenance banner
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={operationSettings.maintenanceMode}
                            onChange={(e) =>
                              setOperationSettings((p) => ({ ...p, maintenanceMode: e.target.checked }))
                            }
                            className="w-5 h-5 text-rose-600 rounded cursor-pointer"
                          />
                        </label>
                      </div>

                      <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-800">Auto-Approve Hotel Listings</div>
                          <div className="text-[11px] text-slate-400">If disabled, newly created properties require manual review</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={operationSettings.autoApproveHotels}
                          onChange={(e) =>
                            setOperationSettings((p) => ({ ...p, autoApproveHotels: e.target.checked }))
                          }
                          className="w-4 h-4 text-[#2563EB] rounded cursor-pointer"
                        />
                      </label>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Guest Maintenance Notice Broadcast
                        </label>
                        <textarea
                          rows={2}
                          value={operationSettings.maintenanceMessage}
                          onChange={(e) =>
                            setOperationSettings((p) => ({ ...p, maintenanceMessage: e.target.value }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Maximum Media Upload Size (MB)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={operationSettings.maxUploadSizeMb}
                          onChange={(e) =>
                            setOperationSettings((p) => ({ ...p, maxUploadSizeMb: Number(e.target.value) }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-5 mt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleResetCategory('PLATFORM_OPERATIONS', defaultOperations, 'Operation Settings')}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Defaults</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingCategory !== null}
                    onClick={() => handleSaveCategory('PLATFORM_OPERATIONS', operationSettings, 'Operation Settings')}
                    className="px-5 py-2.5 bg-[#0F2942] hover:bg-[#1E3E62] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {savingCategory === 'PLATFORM_OPERATIONS' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        <span>Saving Operational Controls…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Save Operational Controls</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Section: Raw Key-Value Database Explorer */}
            {rawSettingsOpen && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden p-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-base text-[#0F172A]">Raw Key-Value Database Explorer</h3>
                    <p className="text-xs text-slate-500">Inspect, edit, or remove low-level system records directly</p>
                  </div>
                  <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded-lg text-slate-600">
                    {settings.length} total keys
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {settings.map((s) => (
                    <div key={s.id || s.key} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-xs text-[#0F172A]">{s.key}</div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">{s.description || 'System property'}</div>
                        <div className="mt-1.5 text-[11px] font-mono bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg inline-block text-slate-700 max-w-md truncate">
                          {typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSettingForm({
                              key: s.key,
                              value: typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value),
                              description: s.description || '',
                            })
                            setSettingModalOpen(true)
                          }}
                          className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Edit Raw
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSetting(s.key)}
                          className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {!settings.length && (
                    <div className="p-8 text-center text-xs text-slate-400">No raw platform settings recorded.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 9: Audit Logs */}
        {tab === 'Audit Logs' && (
          <div>
            <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Audit Trail</h1>
            <p className="text-[#64748B] text-sm mb-6">Immutable record of admin actions and critical system events.</p>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Resource Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">
                        {log.createdAt ? formatDateTime(log.createdAt) : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#334155]">
                        {typeof log.actor === 'string'
                          ? log.actor
                          : (log.actor as { email?: string })?.email || 'Administrator'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#334155]">
                          {log.action || (log.resourceType || 'event').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#64748B] font-mono">{log.resource || log.resourceType || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!auditLogs.length && <p className="p-10 text-center text-[#64748B]">No audit events logged.</p>}
            </div>
          </div>
        )}

        {/* Tab 10: Platform Reports & Analytics */}
        {tab === 'Reports' && (
          <div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Platform Reports & Analytics</h1>
                <p className="text-[#64748B] text-sm">
                  Executive analytics, financial audit logs, and downloadable statements for all properties.
                </p>
              </div>

              {/* Action Buttons: Download PDF & Excel */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  disabled={reportDownloading !== null}
                  onClick={async () => {
                    setReportDownloading('pdf')
                    try {
                      await adminApi.downloadReport(reportType, 'pdf', reportPeriod)
                      setSuccessBanner(`Downloaded ${reportType.toUpperCase()} PDF report (${reportPeriod}).`)
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
                  disabled={reportDownloading !== null}
                  onClick={async () => {
                    setReportDownloading('excel')
                    try {
                      await adminApi.downloadReport(reportType, 'excel', reportPeriod)
                      setSuccessBanner(`Downloaded ${reportType.toUpperCase()} Excel spreadsheet (${reportPeriod}).`)
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
                      onClick={() => setReportType(t.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        reportType === t.id
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

            {/* Live KPI Overview Preview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
                <div className="text-xs text-[#64748B] font-medium">Gross Revenue</div>
                <div className="text-2xl font-bold text-[#0F172A] mt-1">{formatMoney(overview.totalRevenue)}</div>
                <div className="text-[11px] text-emerald-600 mt-0.5">Succeeded payments</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
                <div className="text-xs text-[#64748B] font-medium">Total Reservations</div>
                <div className="text-2xl font-bold text-[#0F172A] mt-1">{overview.bookingCount}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">All booking states</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
                <div className="text-xs text-[#64748B] font-medium">Active Hotel Listings</div>
                <div className="text-2xl font-bold text-[#0F172A] mt-1">{hotels.length}</div>
                <div className="text-[11px] text-blue-600 mt-0.5">{occupancy.rooms} active rooms</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
                <div className="text-xs text-[#64748B] font-medium">System Occupancy Rate</div>
                <div className="text-2xl font-bold text-indigo-600 mt-1">{(occupancy.occupancyRate * 100).toFixed(1)}%</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{occupancy.occupiedRoomsToday} rooms occupied</div>
              </div>
            </div>

            {/* Live Preview Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold text-[#0F172A] text-base">
                    Report Preview ({reportType.toUpperCase()} — {reportPeriod.toUpperCase()})
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Records that will be compiled into the downloaded statement.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                    <tr>
                      <th className="px-5 py-3">Property / Entity</th>
                      <th className="px-5 py-3">Location / Detail</th>
                      <th className="px-5 py-3">Metrics / Value</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {reportType === 'overview' &&
                      hotels.map((h) => {
                        const hBookings = bookings.filter((b) => b.hotelId === h.id)
                        const hPayments = payments.filter((p) => p.booking?.hotel?.id === h.id && p.status === 'SUCCEEDED')
                        const hRevenue = hPayments.reduce((s, p) => s + Number(p.amount), 0)
                        return (
                          <tr key={h.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3.5 font-medium text-[#0F172A]">{h.name}</td>
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">{h.city?.name || h.address}</td>
                            <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                              {hBookings.length} Bookings &bull; {formatMoney(hRevenue)}
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusBadge status={h.status} size="sm" />
                            </td>
                          </tr>
                        )
                      })}

                    {reportType === 'booking' &&
                      bookings.slice(0, 10).map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                            <span className="font-mono text-xs">{b.id.slice(-8)}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-[#64748B]">
                            {formatDate(b.checkIn)} &rarr; {formatDate(b.checkOut)}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">{formatMoney(b.totalPrice)}</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={b.status} size="sm" />
                          </td>
                        </tr>
                      ))}

                    {reportType === 'revenue' &&
                      payments.slice(0, 10).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                            <span className="font-mono text-xs">{p.providerRef || p.id.slice(-8)}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-[#64748B]">{p.method}</td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">{formatMoney(p.amount)}</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={p.status} size="sm" />
                          </td>
                        </tr>
                      ))}

                    {(reportType === 'occupancy' || reportType === 'customer' || reportType === 'cancellation') &&
                      hotels.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-medium text-[#0F172A]">{h.name}</td>
                          <td className="px-5 py-3.5 text-xs text-[#64748B]">{h.city?.name || h.address}</td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">{h.starRating} Stars</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={h.status} size="sm" />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Reject Hotel */}
        {rejectHotelTarget && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Reject Hotel Listing</h3>
                <button
                  onClick={() => setRejectHotelTarget(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#64748B] mb-4">
                Specify the compliance or documentation reason for rejecting &quot;{rejectHotelTarget.name}&quot;. The hotel
                manager will receive this feedback.
              </p>

              <form onSubmit={handleRejectHotelSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Rejection Reason *</label>
                  <textarea
                    required
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Missing commercial operating license or invalid property images."
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectHotelTarget(null)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejectingSubmitting || !rejectReason.trim()}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {rejectingSubmitting ? 'Rejecting…' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Coupon */}
        {couponModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Create Coupon</h3>
                <button
                  onClick={() => setCouponModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCoupon} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Coupon Promo Code *</label>
                  <input
                    required
                    value={couponForm.code}
                    onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. LUXSTAY20"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm uppercase font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Discount Type</label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm((p) => ({ ...p, discountType: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED_AMOUNT">Fixed Amount (ETB)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Value *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={couponForm.discountType === 'PERCENTAGE' ? 100 : 100000}
                      value={couponForm.value}
                      onChange={(e) => setCouponForm((p) => ({ ...p, value: Number(e.target.value) }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Valid From</label>
                    <input
                      type="date"
                      required
                      value={couponForm.validFrom}
                      onChange={(e) => setCouponForm((p) => ({ ...p, validFrom: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Valid To</label>
                    <input
                      type="date"
                      required
                      min={couponForm.validFrom}
                      value={couponForm.validTo}
                      onChange={(e) => setCouponForm((p) => ({ ...p, validTo: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Usage Limit</label>
                    <input
                      type="number"
                      min={1}
                      value={couponForm.usageLimit}
                      onChange={(e) => setCouponForm((p) => ({ ...p, usageLimit: Number(e.target.value) }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Min Spend (ETB)</label>
                    <input
                      type="number"
                      value={couponForm.minBookingAmount}
                      onChange={(e) => setCouponForm((p) => ({ ...p, minBookingAmount: e.target.value }))}
                      placeholder="Optional"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setCouponModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={couponSaving}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {couponSaving ? 'Creating…' : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Upsert Platform Setting */}
        {settingModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Platform Setting</h3>
                <button
                  onClick={() => setSettingModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveSetting} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Setting Key *</label>
                  <input
                    required
                    value={settingForm.key}
                    onChange={(e) => setSettingForm((p) => ({ ...p, key: e.target.value.toUpperCase() }))}
                    placeholder="e.g. PLATFORM_FEE_PERCENT"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Value (String or JSON) *</label>
                  <textarea
                    required
                    rows={3}
                    value={settingForm.value}
                    onChange={(e) => setSettingForm((p) => ({ ...p, value: e.target.value }))}
                    placeholder="e.g. 0.05 or { &quot;enabled&quot;: true }"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Description (Optional)</label>
                  <input
                    value={settingForm.description}
                    onChange={(e) => setSettingForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="What this setting controls"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setSettingModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={settingSaving}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    {settingSaving ? 'Saving…' : 'Save Setting'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Manager / User */}
        {createUserModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#0F172A]">Create User Account</h3>
                    <p className="text-xs text-[#64748B]">Provision manager, staff, or platform credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => setCreateUserModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createUserError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{createUserError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Full Name *</label>
                  <input
                    required
                    value={createUserForm.fullName}
                    onChange={(e) => setCreateUserForm((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="e.g. Dawit Tadesse"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Work Email *</label>
                    <input
                      required
                      type="email"
                      value={createUserForm.email}
                      onChange={(e) => setCreateUserForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="manager@luxstay.com"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={createUserForm.phone}
                      onChange={(e) => setCreateUserForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+251 91 234 5678"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Initial Password *</label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      minLength={6}
                      value={createUserForm.password}
                      onChange={(e) => setCreateUserForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Minimum 6 characters"
                      className="w-full border border-[#CBD5E1] rounded-xl pl-3 pr-10 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Account will be created as pre-verified with immediate sign-in capability.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">Role *</label>
                    <select
                      value={createUserForm.role}
                      onChange={(e) =>
                        setCreateUserForm((p) => ({
                          ...p,
                          role: e.target.value as 'CUSTOMER' | 'MANAGER' | 'STAFF' | 'ADMIN',
                        }))
                      }
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      <option value="MANAGER">Manager (Hotel General Manager)</option>
                      <option value="STAFF">Staff (Hotel Operations)</option>
                      <option value="CUSTOMER">Customer (Guest)</option>
                      <option value="ADMIN">Admin (Platform Staff)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      Assign Hotel {createUserForm.role === 'MANAGER' && <span className="text-[#2563EB] font-normal">(Primary)</span>}
                    </label>
                    <select
                      value={createUserForm.hotelId}
                      onChange={(e) => setCreateUserForm((p) => ({ ...p, hotelId: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      <option value="">-- No Hotel Assigned --</option>
                      {hotels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} {h.city?.name ? `(${h.city.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCreateUserModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userCreating}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {userCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating…</span>
                      </>
                    ) : (
                      <span>Create Account</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reassign / Assign Hotel Manager Modal */}
        {assignManagerHotel && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#0F172A]">Assign General Manager</h3>
                    <p className="text-xs text-slate-500">{assignManagerHotel.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAssignManagerHotel(null)
                    setSelectedManagerUserId('')
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAssignManagerSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Select User to Assign as Manager *
                  </label>
                  <select
                    required
                    value={selectedManagerUserId}
                    onChange={(e) => setSelectedManagerUserId(e.target.value)}
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="">-- Choose an account --</option>
                    {users
                      .filter((u) => u.isActive)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email}) — [{u.role}]
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    If this user does not yet have the Manager role, their role will automatically be elevated to Manager.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignManagerHotel(null)
                      setSelectedManagerUserId('')
                    }}
                    className="px-4 py-2 text-sm text-[#64748B] font-semibold hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigningManager || !selectedManagerUserId}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {assigningManager ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Assigning…</span>
                      </>
                    ) : (
                      <span>Save Assignment</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal: Create Hotel Property */}
        {createHotelModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 border border-slate-100">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#0F172A]">Add New Hotel Property</h3>
                    <p className="text-xs text-[#64748B]">Provision and publish a new hotel listing on the platform</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateHotelModalOpen(false)
                    setCreateHotelError('')
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateHotelSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
                {createHotelError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{createHotelError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Hotel Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={createHotelForm.name}
                    onChange={(e) => setCreateHotelForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Ethiopian Skylight Hotel"
                    className="w-full border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      Country *
                    </label>
                    <select
                      required
                      value={createHotelForm.countryId}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      City *
                    </label>
                    <select
                      required
                      value={createHotelForm.cityId}
                      onChange={(e) => setCreateHotelForm((p) => ({ ...p, cityId: e.target.value }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      <option value="">-- Select City --</option>
                      {(
                        countries.find((c) => c.id === createHotelForm.countryId)?.cities || []
                      ).map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      Street Address *
                    </label>
                    <input
                      required
                      type="text"
                      value={createHotelForm.address}
                      onChange={(e) => setCreateHotelForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="e.g. Airport Road, Bole Sub-City"
                      className="w-full border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      Star Rating
                    </label>
                    <select
                      value={createHotelForm.starRating}
                      onChange={(e) => setCreateHotelForm((p) => ({ ...p, starRating: Number(e.target.value) }))}
                      className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      <option value={5}>5 Stars ★★★★★</option>
                      <option value={4}>4 Stars ★★★★</option>
                      <option value={3}>3 Stars ★★★</option>
                      <option value={2}>2 Stars ★★</option>
                      <option value={1}>1 Star ★</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Initial Status
                  </label>
                  <select
                    value={createHotelForm.status}
                    onChange={(e) =>
                      setCreateHotelForm((p) => ({
                        ...p,
                        status: e.target.value as 'ACTIVE' | 'PENDING_APPROVAL',
                      }))
                    }
                    className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="ACTIVE">ACTIVE (Published Immediately & Bookable)</option>
                    <option value="PENDING_APPROVAL">PENDING_APPROVAL (Pending Verification)</option>
                  </select>
                </div>

                {/* General Manager Assignment & Credential Creation */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                      <label className="text-xs font-bold text-[#0F172A] tracking-tight">
                        General Manager & Access Credentials
                      </label>
                    </div>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-200/90 rounded-lg text-xs font-semibold shrink-0">
                      <button
                        type="button"
                        onClick={() => setHotelManagerMode('EXISTING')}
                        className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                          hotelManagerMode === 'EXISTING'
                            ? 'bg-white text-[#2563EB] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Existing Account
                      </button>
                      <button
                        type="button"
                        onClick={() => setHotelManagerMode('CREATE_NEW')}
                        className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                          hotelManagerMode === 'CREATE_NEW'
                            ? 'bg-white text-[#2563EB] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        + Create New Manager
                      </button>
                    </div>
                  </div>

                  {hotelManagerMode === 'EXISTING' ? (
                    <div>
                      <label className="block text-xs font-semibold text-[#334155] mb-1">
                        Select Registered Manager
                      </label>
                      <select
                        value={createHotelForm.managerId}
                        onChange={(e) => setCreateHotelForm((p) => ({ ...p, managerId: e.target.value }))}
                        className="w-full border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      >
                        <option value="">-- Unassigned (Assign Later) --</option>
                        {users
                          .filter((u) => u.isActive && (u.role === 'MANAGER' || u.role === 'ADMIN'))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName} ({u.email}) [{u.role}]
                            </option>
                          ))}
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Choose an existing manager account or leave unassigned to link a manager later.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <p className="text-[11px] text-slate-600">
                        Provision brand-new login credentials for this hotel's General Manager. The account will be activated and assigned immediately.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#334155] mb-1">
                            Manager Full Name *
                          </label>
                          <input
                            required={hotelManagerMode === 'CREATE_NEW'}
                            type="text"
                            value={newHotelManagerForm.fullName}
                            onChange={(e) => setNewHotelManagerForm((p) => ({ ...p, fullName: e.target.value }))}
                            placeholder="e.g. Dawit Haile"
                            className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#334155] mb-1">
                            Manager Work Email *
                          </label>
                          <input
                            required={hotelManagerMode === 'CREATE_NEW'}
                            type="email"
                            value={newHotelManagerForm.email}
                            onChange={(e) => setNewHotelManagerForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="manager@hotel.com"
                            className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-semibold text-[#334155]">
                              Account Password *
                            </label>
                            <button
                              type="button"
                              onClick={generateRandomPassword}
                              className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                            >
                              Generate Password
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              required={hotelManagerMode === 'CREATE_NEW'}
                              type={showNewHotelManagerPassword ? 'text' : 'password'}
                              value={newHotelManagerForm.password}
                              onChange={(e) => setNewHotelManagerForm((p) => ({ ...p, password: e.target.value }))}
                              placeholder="Min. 8 characters"
                              className="w-full border border-[#CBD5E1] rounded-xl pl-3 pr-10 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewHotelManagerPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              aria-label={showNewHotelManagerPassword ? 'Hide password' : 'Show password'}
                            >
                              {showNewHotelManagerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#334155] mb-1">
                            Phone Number (Optional)
                          </label>
                          <input
                            type="tel"
                            value={newHotelManagerForm.phone}
                            onChange={(e) => setNewHotelManagerForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+251 91 123 4567"
                            className="w-full border border-[#CBD5E1] rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-[#334155]">
                      Description & Overview *
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {createHotelForm.description.length} / 2000 chars (min 10)
                    </span>
                  </div>
                  <textarea
                    required
                    rows={3}
                    value={createHotelForm.description}
                    onChange={(e) => setCreateHotelForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Enter an inviting description of the hotel property, key amenities, and surrounding highlights..."
                    className="w-full border border-[#CBD5E1] rounded-xl p-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Property Photos (Optional)
                  </label>
                  <div className="border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] rounded-2xl p-4 text-center transition-colors">
                    <input
                      type="file"
                      id="admin-hotel-photos"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          const newFiles = Array.from(e.target.files)
                          setHotelImagesFiles((prev) => [...prev, ...newFiles])
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="admin-hotel-photos"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                    >
                      <Upload className="w-6 h-6 text-[#2563EB]" />
                      <span className="text-xs font-semibold text-slate-700">
                        Click to select hotel images or drag and drop
                      </span>
                      <span className="text-[11px] text-slate-400">PNG, JPG, WEBP up to 10MB each</span>
                    </label>

                    {hotelImagesFiles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 justify-center">
                        {hotelImagesFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800"
                          >
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setHotelImagesFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-blue-500 hover:text-blue-800 font-bold ml-1 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateHotelModalOpen(false)
                      setCreateHotelError('')
                    }}
                    className="px-4 py-2.5 text-sm text-[#64748B] font-semibold hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingHotel}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {creatingHotel ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Property…</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Create Hotel</span>
                      </>
                    )}
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
