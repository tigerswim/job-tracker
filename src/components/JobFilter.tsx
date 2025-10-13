// src/components/JobFilter.tsx - Updated to work with optimized JobList
'use client'

import { useState, memo } from 'react'

interface JobFilterProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  // Add new props for location filtering if needed
  locationOptions?: string[]
  selectedLocation?: string
  onLocationChange?: (location: string) => void
}

const JobFilter = memo(({ 
  searchTerm, 
  onSearchChange,
  locationOptions = [],
  selectedLocation = 'all',
  onLocationChange
}: JobFilterProps) => {
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
    <div className="flex items-center space-x-4">
      {/* Search Input */}
      <div className="relative flex-1 min-w-64">
        <input
          type="text"
          placeholder="Search jobs by company, title, or notes..."
          value={localSearchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {localSearchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Location Filter (if provided) */}
      {locationOptions && locationOptions.length > 0 && onLocationChange && (
        <select
          value={selectedLocation}
          onChange={(e) => onLocationChange(e.target.value)}
          className="input min-w-32"
        >
          <option value="all">All Locations</option>
          {locationOptions.map(location => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      )}
    </div>
  )
})

JobFilter.displayName = 'JobFilter'

export default JobFilter