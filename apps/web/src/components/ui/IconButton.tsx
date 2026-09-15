import * as React from 'react'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
  variant?: 'default' | 'gold' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  icon: React.ReactNode
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      className = '',
      variant = 'default',
      size = 'md',
      icon,
      disabled,
      ...props
    },
    ref,
  ) => {
    const sizeStyles = {
      sm: 'w-9 h-9 min-w-[36px] min-h-[36px]',
      md: 'w-11 h-11 min-w-[44px] min-h-[44px]', // WCAG 2.1 AA 44px
      lg: 'w-13 h-13 min-w-[52px] min-h-[52px]',
    }[size]

    const variantStyles = {
      default:
        'bg-[#0F2942] text-white hover:bg-[#163859] shadow-sm active:bg-[#0c2236]',
      gold:
        'bg-[#D4AF37] text-[#0B0F17] hover:bg-[#C5A028] shadow-sm hover:shadow-[#D4AF37]/20 active:bg-[#b89422]',
      ghost:
        'text-[#475569] hover:text-[#0F2942] hover:bg-slate-100 active:bg-slate-200',
      outline:
        'border border-[#0F2942]/15 text-[#0F2942] bg-white/70 hover:bg-white hover:border-[#0F2942]/30 active:bg-slate-50',
    }[variant]

    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {icon}
      </button>
    )
  },
)

IconButton.displayName = 'IconButton'
