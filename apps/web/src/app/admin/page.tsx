'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi, reviewApi } from '@/lib/services'
import { useAuth } from '@/lib/auth-store'
import AuthGate from '@/components/AuthGate'
import type { Booking, Coupon, Hotel, Payment, PlatformSetting, Review, User } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { StatusBadge } from '@/components/ui/StatusBadge'

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
  const [overview, setOverview] = useState({ userCount: 0, hotelCount: 0, bookingCount: 0, totalRevenue: 0 })
  const [occupancy, setOccupancy] = useState({ rooms: 0, occupiedRoomsToday: 0, occupancyRate: 0 })
  const [users, setUsers] = useState<AdminUser[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successBanner, setSuccessBanner] = useState('')
  const [acting, setActing] = useState<string | null>(null)

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
      ] = await Promise.all([
        adminApi.overview().catch(() => ({ userCount: 0, hotelCount: 0, bookingCount: 0, totalRevenue: 0 })),
        adminApi.occupancy().catch(() => ({ rooms: 0, occupiedRoomsToday: 0, occupancyRate: 0 })),
        adminApi.users({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.hotels({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.bookings({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.payments({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.reviews({ pageSize: '30' }).catch(() => ({ data: [] })),
        adminApi.auditLogs({ pageSize: '30' }).catch(() => []),
        adminApi.coupons().catch(() => []),
        adminApi.settings().catch(() => []),
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load platform administration data.')
    } finally {
      setLoading(false)
    }
  }, [])

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
          <div className="text-[#64748B] text-xs">YayeTech Enterprise Admin Console</div>
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
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="font-serif text-3xl text-[#0F172A]">Platform Operations</h1>
                <p className="text-[#64748B]">Platform-wide metrics and performance indicators.</p>
              </div>
              <button
                onClick={() => void load()}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                ['Total users', overview.userCount, '👥'],
                ['Hotels listed', overview.hotelCount, '🏨'],
                ['Total bookings', overview.bookingCount, '📆'],
                ['Platform revenue', formatMoney(overview.totalRevenue), '💳'],
              ].map(([label, value, icon]) => (
                <div key={String(label)} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
                  <div className="text-2xl mb-3">{icon}</div>
                  <div className="font-bold text-[#0F172A] text-2xl">{value}</div>
                  <div className="text-[#64748B] text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
                <h2 className="font-bold text-[#0F172A] mb-2">Today&apos;s Occupancy Rate</h2>
                <div className="text-4xl font-bold text-[#0F172A]">{(occupancy.occupancyRate * 100).toFixed(1)}%</div>
                <p className="text-[#64748B] text-sm mt-1">
                  {occupancy.occupiedRoomsToday} occupied of {occupancy.rooms} active rooms
                </p>
                <div className="bg-[#F1F5F9] h-2.5 rounded-full mt-5 overflow-hidden">
                  <div
                    className="bg-[#2563EB] h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, occupancy.occupancyRate * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F1F5F9] flex justify-between items-center">
                  <h2 className="font-bold text-[#0F172A]">Latest Reservations</h2>
                  <button onClick={() => setTab('Bookings')} className="text-sm text-[#2563EB] font-semibold">
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Users Management */}
        {tab === 'Users' && (
          <div>
            <h1 className="font-bold text-[#0F172A] text-2xl mb-1">User Accounts</h1>
            <p className="text-[#64748B] text-sm mb-6">{users.length} accounts across customer, manager, and staff roles.</p>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                  <tr>
                    <th className="px-5 py-3">Name & Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Bookings</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((target) => (
                    <tr key={target.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-[#0F172A] text-sm">{target.fullName}</div>
                        <div className="text-[#64748B] text-xs">{target.email}</div>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-[#334155]">{target.role}</td>
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
                          className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] disabled:opacity-50"
                        >
                          {acting === target.id ? 'Updating…' : target.isActive ? 'Suspend' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Hotels Approval Workflow */}
        {tab === 'Hotels' && (
          <div>
            <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Hotel Properties & Approvals</h1>
            <p className="text-[#64748B] text-sm mb-6">Review pending hotel submissions, approve, or reject listings.</p>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-[#64748B] uppercase bg-[#F8FAFC]">
                  <tr>
                    <th className="px-5 py-3">Hotel Property</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Rating</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hotels.map((hotel) => (
                    <tr key={hotel.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[#0F172A] text-sm">{hotel.name}</div>
                        <div className="text-xs text-[#94A3B8] font-mono">{hotel.id}</div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[#64748B]">{hotel.city?.name || hotel.address}</td>
                      <td className="px-5 py-3 text-sm text-amber-500">★ {hotel.starRating}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={hotel.status} size="sm" />
                      </td>
                      <td className="px-5 py-3 text-right space-x-2">
                        {hotel.status === 'PENDING' || hotel.status === 'PENDING_APPROVAL' ? (
                          <>
                            <button
                              disabled={acting === hotel.id}
                              onClick={() => approveHotel(hotel)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              disabled={acting === hotel.id}
                              onClick={() => {
                                setRejectHotelTarget(hotel)
                                setRejectReason('')
                              }}
                              className="px-3 py-1 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={acting === hotel.id}
                            onClick={() => toggleHotelStatus(hotel)}
                            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                          >
                            {hotel.status === 'ACTIVE' ? 'Suspend / Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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
                    <div className="text-xs text-[#64748B] mt-0.5">
                      📅 {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
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
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((_, idx) => (
                          <span key={idx} className={`text-xs ${idx < review.rating ? 'text-amber-400' : 'text-gray-200'}`}>
                            ★
                          </span>
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

        {/* Tab 8: Platform Settings */}
        {tab === 'Settings' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-bold text-[#0F172A] text-2xl mb-1">Platform Settings</h1>
                <p className="text-[#64748B] text-sm">Dynamic key-value configuration flags and platform constants.</p>
              </div>
              <button
                onClick={() => {
                  setSettingForm({ key: '', value: '', description: '' })
                  setSettingModalOpen(true)
                }}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                + Add Setting
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-slate-100">
              {settings.map((s) => (
                <div key={s.id || s.key} className="p-5 flex items-center justify-between">
                  <div>
                    <div className="font-mono font-bold text-sm text-[#0F172A]">{s.key}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">{s.description || 'System setting'}</div>
                    <div className="mt-2 text-xs font-mono bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg inline-block text-slate-800">
                      {typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}
                    </div>
                  </div>

                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        setSettingForm({
                          key: s.key,
                          value: typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value),
                          description: s.description || '',
                        })
                        setSettingModalOpen(true)
                      }}
                      className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSetting(s.key)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!settings.length && (
                <div className="p-8 text-center text-sm text-[#64748B]">No platform settings recorded.</div>
              )}
            </div>
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

        {/* Modal: Reject Hotel */}
        {rejectHotelTarget && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-lg text-[#0F172A]">Reject Hotel Listing</h3>
                <button
                  onClick={() => setRejectHotelTarget(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
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
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
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
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
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
      </main>
    </div>
  )
}
