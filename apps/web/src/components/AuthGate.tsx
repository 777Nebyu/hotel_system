'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-store'
import { AccessDeniedView } from './layout/AccessDeniedView'
import { Skeleton } from './ui/Skeleton'

export interface AuthGateProps {
  children: React.ReactNode
  roles?: Array<'CUSTOMER' | 'STAFF' | 'MANAGER' | 'ADMIN' | string>
}

export default function AuthGate({ children, roles }: AuthGateProps) {
  const { user, isInitialized } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (!isInitialized) return

    if (!user) {
      const returnTo = encodeURIComponent(pathname)
      router.replace(`/auth?returnTo=${returnTo}`)
    }
  }, [user, isInitialized, pathname, router])

  // Show zero-CLS skeleton placeholder during auth session rehydration
  if (!isInitialized) {
    return (
      <div className="min-h-[70vh] max-w-6xl mx-auto px-6 py-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  // Not signed in
  if (!user) {
    return null
  }

  // Signed in, but missing required role: render authoritative 403 view
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <AccessDeniedView requiredRoles={roles} />
  }

  return <>{children}</>
}