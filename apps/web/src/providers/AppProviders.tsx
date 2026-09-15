'use client'

import * as React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { useAuth } from '@/lib/auth-store'
import { ToastContainer } from '@/components/ui/Toast'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const loadFromStorage = useAuth((s) => s.loadFromStorage)
  const refreshAuth = useAuth((s) => s.refreshAuth)

  React.useEffect(() => {
    loadFromStorage()
    // Proactive refresh every 14 minutes
    const timer = window.setInterval(() => void refreshAuth(), 14 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [loadFromStorage, refreshAuth])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastContainer />
    </QueryClientProvider>
  )
}
