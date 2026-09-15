'use client'

import * as React from 'react'
import { create } from 'zustand'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastStore {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newToast: ToastItem = { ...toast, id }

    set((state) => ({
      toasts: [...state.toasts.slice(-4), newToast], // Keep max 5 toasts
    }))

    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'success', title, message }),
  warning: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'warning', title, message }),
  error: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'error', title, message }),
  info: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'info', title, message }),
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((item) => {
        const Icon = {
          success: CheckCircle2,
          warning: AlertTriangle,
          error: AlertCircle,
          info: Info,
        }[item.type]

        const borderStyles = {
          success: 'border-emerald-300 bg-emerald-50/95 text-emerald-950',
          warning: 'border-amber-300 bg-amber-50/95 text-amber-950',
          error: 'border-red-300 bg-red-50/95 text-red-950',
          info: 'border-blue-300 bg-blue-50/95 text-blue-950',
        }[item.type]

        const iconColors = {
          success: 'text-emerald-600',
          warning: 'text-amber-600',
          error: 'text-red-600',
          info: 'text-blue-600',
        }[item.type]

        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-5 ${borderStyles}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColors}`} />
            <div className="flex-1">
              <h5 className="text-sm font-bold">{item.title}</h5>
              {item.message && (
                <p className="text-xs mt-0.5 opacity-85 leading-relaxed">
                  {item.message}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(item.id)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
