'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-store'

export default function AuthBootstrap() {
  const loadFromStorage = useAuth((s) => s.loadFromStorage)
  const refreshAuth = useAuth((s) => s.refreshAuth)

  useEffect(() => {
    loadFromStorage()
    const timer = window.setInterval(() => void refreshAuth(), 14 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [loadFromStorage, refreshAuth])

  return null
}