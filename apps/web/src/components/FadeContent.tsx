'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

interface FadeContentProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  blur?: boolean
  direction?: 'up' | 'down' | 'none'
  distance?: number
}

export default function FadeContent({
  children,
  className = '',
  delay = 0,
  duration = 0.6,
  blur = false,
  direction = 'up',
  distance = 24,
}: FadeContentProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px 0px -80px 0px' })

  const initialY =
    direction === 'up' ? distance : direction === 'down' ? -distance : 0

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        y: initialY,
        filter: blur ? 'blur(8px)' : 'blur(0px)',
      }}
      animate={isInView ? {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
      } : undefined}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
