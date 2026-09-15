import * as React from 'react'
import { formatEthiopianBirr } from '@/lib/currency'

export interface PriceRangeSliderProps {
  min?: number
  max?: number
  step?: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  className?: string
}

export function PriceRangeSlider({
  min = 0,
  max = 100000,
  step = 1000,
  value,
  onChange,
  className = '',
}: PriceRangeSliderProps) {
  const [minVal, maxVal] = value

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (val >= minVal) {
      onChange([minVal, val])
    }
  }

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (val <= maxVal) {
      onChange([val, maxVal])
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
          {formatEthiopianBirr(minVal)}
        </span>
        <span className="text-slate-400 font-normal">to</span>
        <span className="bg-[#FEF9E7] text-[#92400E] px-2.5 py-1 rounded-lg border border-[#D4AF37]/35 font-bold">
          {formatEthiopianBirr(maxVal)}{maxVal >= max ? '+' : ''}
        </span>
      </div>

      <div className="space-y-1">
        <label htmlFor="price-slider-max" className="sr-only">
          Maximum price per night
        </label>
        <input
          id="price-slider-max"
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          className="w-full accent-[#0F2942] cursor-pointer h-2 bg-slate-200 rounded-lg"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={maxVal}
        />
      </div>
    </div>
  )
}
