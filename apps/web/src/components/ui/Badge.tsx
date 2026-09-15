import * as React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'sapphire' | 'gold' | 'outline' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
}

export function Badge({
  className = '',
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  }[size]

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200/60',
    sapphire: 'bg-[#0F2942]/10 text-[#0F2942] border border-[#0F2942]/20',
    gold: 'bg-[#FEF9E7] text-[#92400E] border border-[#D4AF37]/35',
    outline: 'bg-white/80 text-slate-700 border border-slate-300 backdrop-blur-sm',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
  }[variant]

  return (
    <span
      className={`inline-flex items-center rounded-full uppercase tracking-wider ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
