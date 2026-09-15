'use client'

import * as React from 'react'
import Link from 'next/link'
import { ShieldAlert, Home, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-store'

export interface AccessDeniedViewProps {
  requiredRoles?: string[]
}

export function AccessDeniedView({ requiredRoles = [] }: AccessDeniedViewProps) {
  const { user, logout } = useAuth()

  const userPortalPath = React.useMemo(() => {
    if (!user) return '/'
    if (user.role === 'ADMIN') return '/admin'
    if (user.role === 'MANAGER') return '/manager'
    if (user.role === 'STAFF') return '/staff'
    return '/dashboard'
  }, [user])

  const userPortalLabel = React.useMemo(() => {
    if (!user) return 'Go to Portal'
    if (user.role === 'ADMIN') return 'Go to Admin Portal'
    if (user.role === 'MANAGER') return 'Go to Manager Console'
    if (user.role === 'STAFF') return 'Go to Staff Desk'
    return 'Go to My Trips'
  }, [user])

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6 bg-[#F8FAFC]">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5 text-red-600">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
          403 Access Denied
        </span>

        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F2942] mt-4 mb-2">
          Restricted Portal
        </h1>

        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          You do not have the authorization required to access this portal.
          {requiredRoles.length > 0 && (
            <span className="block mt-2 font-medium text-slate-700">
              Required privilege:{' '}
              <span className="text-[#0F2942] font-bold">
                {requiredRoles.join(' or ')}
              </span>
            </span>
          )}
          {user && (
            <span className="block mt-1 text-xs text-slate-400">
              Signed in as: <span className="font-semibold">{user.email}</span> ({user.role})
            </span>
          )}
        </p>

        <div className="flex flex-col gap-3 justify-center">
          {user && (
            <Link href={userPortalPath} className="w-full">
              <Button variant="gold" className="w-full">
                {userPortalLabel}
              </Button>
            </Link>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/" className="w-full sm:w-1/2">
              <Button variant="primary" className="w-full" leftIcon={<Home className="w-4 h-4" />}>
                Return Home
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={logout}
              className="w-full sm:w-1/2"
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Switch Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
