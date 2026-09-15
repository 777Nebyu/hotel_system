'use client'

import { useInView, useMotionValue, useSpring } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'

interface CountUpProps {
  to: number
  from?: number
  duration?: number
  delay?: number
  className?: string
  separator?: string
  suffix?: string
  prefix?: string
}

export default function CountUp({
  to,
  from = 0,
  duration = 2,
  delay = 0,
  className = '',
  separator = ',',
  suffix = '',
  prefix = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(from)
  const damping = 20 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)
  const springValue = useSpring(motionValue, { damping, stiffness })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  const getDecimalPlaces = (num: number) => {
    const str = num.toString()
    if (str.includes('.')) {
      const d = str.split('.')[1]
      if (parseInt(d) !== 0) return d.length
    }
    return 0
  }
  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to))

  const formatValue = useCallback(
    (latest: number) => {
      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: maxDecimals > 0 ? maxDecimals : 0,
        maximumFractionDigits: maxDecimals > 0 ? maxDecimals : 0,
      }
      const formatted = Intl.NumberFormat('en-US', options).format(latest)
      return `${prefix}${separator ? formatted.replace(/,/g, separator) : formatted}${suffix}`
    },
    [maxDecimals, separator, prefix, suffix]
  )

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(from)
  }, [from, formatValue])

  useEffect(() => {
    if (!isInView) return
    const timeout = setTimeout(() => motionValue.set(to), delay * 1000)
    return () => clearTimeout(timeout)
  }, [isInView, motionValue, to, delay])

  useEffect(() => {
    const unsub = springValue.on('change', (latest: number) => {
      if (ref.current) ref.current.textContent = formatValue(latest)
    })
    return unsub
  }, [springValue, formatValue])

  return <span ref={ref} className={className} />
}
