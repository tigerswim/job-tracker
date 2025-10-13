// src/components/ContactFilter.tsx
'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'

interface ContactFilterProps {
  searchTerm: string
  onSearchChange: (term: string) => void
}

export default function ContactFilter({ searchTerm, onSearchChange }: ContactFilterProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value)
    onSearchChange(value)
  }

  const clearSearch = () => {
    setLocalSearchTerm('')
    onSearchChange('')
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60">
      <div className="relative max-w-md mx-auto">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          value={localSearchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search contacts by name, company, etc."
          className="block w-full pl-12 pr-12 py-3 border border-slate-200 rounded-lg leading-5 bg-white/80 backdrop-blur-sm placeholder-slate-400 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 hover:bg-white hover:border-slate-300"
        />
        {localSearchTerm && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <button
              onClick={clearSearch}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors duration-200"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

    </div>
  )
}