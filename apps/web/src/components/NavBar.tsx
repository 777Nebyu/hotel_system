'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-store'
import {
  Hotel,
  Search,
  Home,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  CalendarCheck,
  Shield,
  Briefcase,
  Sliders,
  ChevronDown,
} from 'lucide-react'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const userMenuRef = React.useRef<HTMLDivElement>(null)

  const isHomePage = pathname === '/'

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close user menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Permanent luxury dark sapphire liquid glass navbar styling across all pages
  const navBackground = scrolled
    ? 'bg-[#0F2942]/95 backdrop-blur-2xl border-white/15 shadow-xl shadow-black/20'
    : 'bg-[#0F2942]/85 backdrop-blur-2xl border-white/10 shadow-lg shadow-black/10'

  const brandTextColor = 'text-white'
  const linkTextColor = 'text-white/85 hover:text-white hover:bg-white/10'

  const dashboardPath = React.useMemo(() => {
    if (!user) return '/auth'
    if (user.role === 'ADMIN') return '/admin'
    if (user.role === 'MANAGER') return '/manager'
    if (user.role === 'STAFF') return '/staff'
    return '/dashboard'
  }, [user])

  const roleLabel = React.useMemo(() => {
    if (!user) return ''
    if (user.role === 'ADMIN') return 'System Admin'
    if (user.role === 'MANAGER') return 'Hotel Manager'
    if (user.role === 'STAFF') return 'Front Desk Staff'
    return 'Customer'
  }, [user])

  const handleSignOut = () => {
    logout()
    setUserMenuOpen(false)
    setMobileOpen(false)
    router.push('/')
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${navBackground}`}
      aria-label="Primary navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B38F46] flex items-center justify-center shadow-md shadow-[#D4AF37]/25 group-hover:scale-105 transition-transform duration-200">
            <Hotel className="w-5 h-5 text-[#0B0F17]" />
          </div>
          <div className="flex flex-col">
            <span
              className={`font-serif text-xl sm:text-2xl font-bold tracking-tight transition-colors ${brandTextColor}`}
            >
              YayeTech
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] -mt-1">
              Luxury Stays
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${linkTextColor} ${
              pathname === '/'
                ? 'bg-white/15 text-white font-semibold shadow-sm border border-white/10'
                : ''
            }`}
          >
            Home
          </Link>
          <Link
            href="/search"
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${linkTextColor} ${
              pathname.startsWith('/search')
                ? 'bg-white/15 text-white font-semibold shadow-sm border border-white/10'
                : ''
            }`}
          >
            Explore Hotels
          </Link>

          {/* Role-scoped Portal Links */}
          {user && (
            <Link
              href={dashboardPath}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${linkTextColor} ${
                pathname.startsWith('/dashboard') ||
                pathname.startsWith('/admin') ||
                pathname.startsWith('/manager') ||
                pathname.startsWith('/staff')
                  ? 'bg-white/15 text-white font-semibold shadow-sm border border-white/10'
                  : ''
              }`}
            >
              {user.role === 'ADMIN'
                ? 'Admin Portal'
                : user.role === 'MANAGER'
                ? 'Manager Console'
                : user.role === 'STAFF'
                ? 'Staff Desk'
                : 'My Trips'}
            </Link>
          )}
        </div>

        {/* Desktop User Section */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#0F2942] flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                  {user.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.profilePhotoUrl}
                      alt={user.fullName || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.fullName ? user.fullName[0].toUpperCase() : 'U'
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-tight truncate max-w-[120px] text-white">
                    {user.fullName || user.email}
                  </span>
                  <span className="text-[10px] text-[#D4AF37] font-semibold uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/70 ml-1" />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0F2942]/95 backdrop-blur-2xl border border-white/15 text-white shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-2.5 border-b border-white/10 mb-1">
                    <p className="text-sm font-bold text-white truncate">{user.fullName}</p>
                    <p className="text-xs text-white/60 truncate">{user.email}</p>
                    <div className="mt-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                        {roleLabel}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={dashboardPath}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#D4AF37]" />
                    <span>Dashboard</span>
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-300 hover:bg-red-500/15 rounded-xl transition-colors mt-1 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-300" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/auth?mode=login"
                className="inline-flex items-center justify-center text-xs sm:text-sm font-medium h-9 px-4 rounded-xl border border-white/25 bg-white/5 backdrop-blur-sm text-white hover:text-white hover:bg-white/15 active:scale-[0.98] transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              >
                Sign In
              </Link>
              <Link
                href="/auth?mode=register"
                className="inline-flex items-center justify-center text-xs sm:text-sm font-semibold h-9 px-4.5 rounded-xl bg-[#D4AF37] text-[#0B0F17] hover:bg-[#C5A028] shadow-md shadow-[#D4AF37]/25 active:scale-[0.98] transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="p-2.5 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0F2942]/95 backdrop-blur-2xl px-6 py-6 space-y-4 shadow-2xl text-white">
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-white/15 text-white font-semibold border border-white/10'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Home className="w-5 h-5 text-[#D4AF37]" />
              <span>Home</span>
            </Link>
            <Link
              href="/search"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                pathname.startsWith('/search')
                  ? 'bg-white/15 text-white font-semibold border border-white/10'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Search className="w-5 h-5 text-[#D4AF37]" />
              <span>Explore Hotels</span>
            </Link>

            {user && (
              <Link
                href={dashboardPath}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  pathname.startsWith('/dashboard') ||
                  pathname.startsWith('/admin') ||
                  pathname.startsWith('/manager') ||
                  pathname.startsWith('/staff')
                    ? 'bg-white/15 text-white font-semibold border border-white/10'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 text-[#D4AF37]" />
                <span>{roleLabel}</span>
              </Link>
            )}
          </div>

          <div className="pt-4 border-t border-white/10">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-[#0F2942] flex items-center justify-center font-bold">
                    {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{user.fullName}</p>
                    <p className="text-xs text-white/60">{user.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full text-red-300 border-red-400/30 bg-red-500/10 hover:bg-red-500/20"
                  leftIcon={<LogOut className="w-4 h-4 text-red-300" />}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/auth?mode=login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center h-11 px-4 rounded-xl text-sm font-medium text-white border border-white/20 bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth?mode=register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center h-11 px-4 rounded-xl text-sm font-semibold bg-[#D4AF37] text-[#0B0F17] hover:bg-[#C5A028] shadow-md shadow-[#D4AF37]/25 active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
