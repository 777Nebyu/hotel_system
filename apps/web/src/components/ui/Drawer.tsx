import * as React from 'react'
import { X } from 'lucide-react'

export interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  position?: 'bottom' | 'right'
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom',
}: DrawerProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isBottom = position === 'bottom'

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B0F17]/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        className={`relative z-10 bg-white shadow-2xl transition-transform duration-300 flex flex-col ${
          isBottom
            ? 'mt-auto w-full max-h-[85vh] rounded-t-3xl border-t border-slate-200'
            : 'ml-auto w-full max-w-md h-full border-l border-slate-200'
        }`}
      >
        {/* Handle for mobile bottom sheet */}
        {isBottom && (
          <div className="pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1.5 rounded-full bg-slate-300" />
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="font-serif text-lg font-bold text-[#0F2942]">{title}</div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
