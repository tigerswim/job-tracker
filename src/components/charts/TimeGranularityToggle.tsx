'use client'

import { useEffect, useState } from 'react'
import { Granularity } from './chartConfig'

interface TimeGranularityToggleProps {
  value: Granularity
  onChange: (value: Granularity) => void
}

const STORAGE_KEY = 'reporting-chart-granularity'

export default function TimeGranularityToggle({
  value,
  onChange,
}: TimeGranularityToggleProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY) as Granularity | null
    if (saved && (saved === 'weekly' || saved === 'monthly')) {
      onChange(saved)
    }
  }, [onChange])

  const handleChange = (newValue: Granularity) => {
    onChange(newValue)
    localStorage.setItem(STORAGE_KEY, newValue)
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="inline-flex items-center bg-slate-100/80 rounded-lg p-1">
      <button
        onClick={() => handleChange('weekly')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          value === 'weekly'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-800'
        }`}
      >
        Weekly
      </button>
      <button
        onClick={() => handleChange('monthly')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          value === 'monthly'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-800'
        }`}
      >
        Monthly
      </button>
    </div>
  )
}
