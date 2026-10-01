'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

export default function NotFound() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-6xl font-bold text-[#2563EB] mb-4">404</div>
        <h1 className="font-serif text-3xl text-[#0F172A] mb-3">{t('home', 'notFoundTitle')}</h1>
        <p className="text-[#64748B] mb-8">{t('home', 'notFoundDescription')}</p>
        <Link
          href="/"
          className="px-6 py-3 bg-[#2563EB] text-white rounded-xl font-semibold text-sm hover:bg-[#1D4ED8] transition-colors inline-block"
        >
          {t('home', 'notFoundBackHome')}
        </Link>
      </div>
    </div>
  )
}
