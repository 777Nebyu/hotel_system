'use client'

import React, { useRef } from 'react'

interface GlareHoverProps {
  children: React.ReactNode
  className?: string
  glareColor?: string
  glareOpacity?: number
  glareAngle?: number
  glareSize?: number
  transitionDuration?: number
}

export default function GlareHover({
  children,
  className = '',
  glareColor = '#ffffff',
  glareOpacity = 0.3,
  glareAngle = -45,
  glareSize = 250,
  transitionDuration = 600,
}: GlareHoverProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const hex = glareColor.replace('#', '')
  let rgba = glareColor
  if (/^[\dA-Fa-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    rgba = `rgba(${r}, ${g}, ${b}, ${glareOpacity})`
  }

  const animateIn = () => {
    const el = overlayRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.backgroundPosition = '-100% -100%, 0 0'
    void el.offsetWidth // force reflow
    el.style.transition = `${transitionDuration}ms ease`
    el.style.backgroundPosition = '100% 100%, 0 0'
  }

  const animateOut = () => {
    const el = overlayRef.current
    if (!el) return
    el.style.transition = `${transitionDuration}ms ease`
    el.style.backgroundPosition = '-100% -100%, 0 0'
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={animateIn}
      onMouseLeave={animateOut}
    >
      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(${glareAngle}deg, hsla(0,0%,0%,0) 60%, ${rgba} 70%, hsla(0,0%,0%,0) 100%)`,
          backgroundSize: `${glareSize}% ${glareSize}%, 100% 100%`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: '-100% -100%, 0 0',
          pointerEvents: 'none',
          zIndex: 10,
          borderRadius: 'inherit',
        }}
      />
      {children}
    </div>
  )
}
