import * as React from 'react'
import { LucideIcon, FolderSearch } from 'lucide-react'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  children?: React.ReactNode
}

export function EmptyState({
  icon: Icon = FolderSearch,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  children,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-200 bg-white/60 backdrop-blur-sm ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-[#0F2942]/5 border border-[#0F2942]/10 flex items-center justify-center mb-4 text-[#0F2942]">
        <Icon className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h4 className="font-serif text-xl font-bold text-[#0F2942] mb-1.5">{title}</h4>
      {description && (
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="gold" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  )
}
