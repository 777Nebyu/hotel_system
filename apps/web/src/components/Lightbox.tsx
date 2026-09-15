'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface LightboxProps {
  images: string[]
  startIndex?: number
  alt?: string
  onClose: () => void
}

export default function Lightbox({ images, startIndex = 0, alt = 'Hotel image', onClose }: LightboxProps) {
  const [current, setCurrent] = useState(startIndex)
  const [direction, setDirection] = useState(0)

  const prev = useCallback(() => {
    setDirection(-1)
    setCurrent(c => (c - 1 + images.length) % images.length)
  }, [images.length])

  const next = useCallback(() => {
    setDirection(1)
    setCurrent(c => (c + 1) % images.length)
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
        onClick={onClose}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 z-10" onClick={e => e.stopPropagation()}>
          <span className="text-white/60 text-sm font-medium">
            {current + 1} / {images.length}
          </span>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close lightbox"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main image */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <AnimatePresence custom={direction} mode="popLayout">
            <motion.img
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              src={images[current]}
              alt={`${alt} ${current + 1}`}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-lg select-none"
              draggable={false}
            />
          </AnimatePresence>

          {/* Prev/next buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-4 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-sm transition-all cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={next}
                className="absolute right-4 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-sm transition-all cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div
            className="flex items-center justify-center gap-2 py-4 px-6 overflow-x-auto"
            onClick={e => e.stopPropagation()}
          >
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i) }}
                className={`flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden transition-all cursor-pointer ${
                  i === current
                    ? 'ring-2 ring-[#A16207] ring-offset-1 ring-offset-black'
                    : 'opacity-50 hover:opacity-80'
                }`}
              >
                <img src={src} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
