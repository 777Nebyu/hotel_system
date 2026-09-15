'use client'

import dynamic from 'next/dynamic'
import HeroSearchBar from './HeroSearchBar'
import CountUp from '@/components/CountUp'
import { motion, type Variants } from 'framer-motion'

// Aurora uses WebGL — load client-only
const Aurora = dynamic(() => import('@/components/Aurora'), { ssr: false })

const HERO_IMG =
  'https://images.unsplash.com/photo-1677129667171-92abd8740fa3?w=1600&h=900&fit=crop&auto=format'

const STATS = [
  { value: 50000, suffix: '+', label: 'Properties' },
  { value: 120, suffix: '', label: 'Countries' },
  { value: 2, suffix: 'M+', label: 'Happy guests' },
]

const badge: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}
const headline1: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, delay: 0.2, ease: 'easeOut' } },
}
const headline2: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, delay: 0.38, ease: 'easeOut' } },
}
const sub: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.52, ease: 'easeOut' } },
}
const searchBar: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.68, ease: 'easeOut' } },
}
const trustRow: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, delay: 0.88 } },
}
const statsRow: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 1.0, ease: 'easeOut' } },
}

export default function HeroAnimated() {
  return (
    <section className="relative -mt-18 pt-18 h-[92vh] min-h-[660px] flex items-center overflow-hidden bg-[#0B1528]">
      {/* Background photo */}
      <img
        src={HERO_IMG}
        alt="Luxury hotel lobby"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/65 via-[#0F172A]/40 to-[#0F172A]/75" />

      {/* Aurora animated overlay — subtle luxury shimmer */}
      <div className="absolute inset-0 opacity-30 mix-blend-screen">
        <Aurora
          colorStops={['#1E3A8A', '#A16207', '#1E3A8A']}
          amplitude={1.0}
          blend={0.45}
          speed={0.5}
        />
      </div>

      {/* Hero content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="max-w-3xl mb-10">
          {/* Badge */}
          <motion.div
            variants={badge}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6"
          >
            <span className="w-2 h-2 bg-[#A16207] rounded-full animate-pulse" />
            <span className="text-white/90 text-sm font-medium">50,000+ properties worldwide</span>
          </motion.div>

          {/* Animated headline — line 1 */}
          <motion.h1
            variants={headline1}
            initial="hidden"
            animate="visible"
            className="font-serif text-5xl md:text-7xl text-white leading-tight mb-2"
            style={{ willChange: 'transform, filter, opacity' }}
          >
            Find Your Perfect
          </motion.h1>

          {/* Animated headline — line 2 with gold accent */}
          <motion.div
            variants={headline2}
            initial="hidden"
            animate="visible"
            className="mb-4"
            style={{ willChange: 'transform, filter, opacity' }}
          >
            <span
              className="font-serif text-5xl md:text-7xl leading-tight"
              style={{
                background: 'linear-gradient(135deg, #A16207 0%, #F59E0B 50%, #A16207 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Stay
            </span>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            variants={sub}
            initial="hidden"
            animate="visible"
            className="text-white/80 text-lg md:text-xl font-light"
          >
            Discover curated luxury hotels, boutique hideaways, and resort escapes — all in one place.
          </motion.p>
        </div>

        {/* Search bar */}
        <motion.div variants={searchBar} initial="hidden" animate="visible">
          <HeroSearchBar />
        </motion.div>

        {/* Trust signals */}
        <motion.div
          variants={trustRow}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-center gap-6 mt-6 text-white/70 text-sm"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-[#A16207]">✓</span> Free cancellation
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#A16207]">✓</span> Best price guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#A16207]">✓</span> No booking fees
          </span>
        </motion.div>

        {/* Animated stats counter */}
        <motion.div
          variants={statsRow}
          initial="hidden"
          animate="visible"
          className="flex gap-8 mt-8"
        >
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-white font-bold text-2xl flex items-center">
                <CountUp
                  to={stat.value}
                  duration={2.2}
                  delay={1.0}
                  separator=","
                  suffix={stat.suffix}
                  className="tabular-nums"
                />
              </div>
              <div className="text-white/55 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
