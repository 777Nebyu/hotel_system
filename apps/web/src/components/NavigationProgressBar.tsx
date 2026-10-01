'use client'

import * as React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = React.useState(0)
  const [visible, setVisible] = React.useState(false)

  // Complete progress on route change
  React.useEffect(() => {
    if (visible) {
      setProgress(100)
      const timer = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [pathname, searchParams, visible])

  // Listen to clicks on internal navigation links
  React.useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !target.getAttribute('target') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        // Only trigger if navigating to a different URL
        const currentUrl = window.location.pathname + window.location.search
        if (href !== currentUrl) {
          setVisible(true)
          setProgress(25)
          const t1 = setTimeout(() => setProgress(65), 150)
          const t2 = setTimeout(() => setProgress(85), 400)
          return () => {
            clearTimeout(t1)
            clearTimeout(t2)
          }
        }
      }
    }

    document.addEventListener('click', handleAnchorClick, { capture: true })
    return () => document.removeEventListener('click', handleAnchorClick, { capture: true })
  }, [])

  if (!visible && progress === 0) return null

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[2.5px] z-[99999] pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full bg-gradient-to-r from-[#C5A028] via-[#D4AF37] to-[#F5D77F] shadow-[0_0_8px_rgba(212,175,55,0.7)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
        }}
      />
    </div>
  )
}
