// src/components/JobStatusFilter.tsx - Updated for optimized JobList
'use client'

import { memo, useMemo } from 'react'
import { Job } from '@/lib/supabase'
import { Filter } from 'lucide-react'

interface JobStatusFilterProps {
  jobs?: Job[]
  selectedStatus: string | null
  onStatusChange: (status: string | null) => void
}

// Status configuration for tabs - Updated to match database values
const statusConfig = {
  all: { label: 'All Jobs', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  interested: { label: 'Interested', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  applied: { label: 'Applied', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  interviewing: { label: 'Interviewing', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  onhold: { label: 'On Hold', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  offered: { label: 'Offered', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  rejected: { label: 'Rejected', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  bookmarked: { label: 'Bookmarked', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  withdrawn: { label: 'Withdrawn', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  noresponse: { label: 'No Response', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-gray-100 text-gray-600 hover:bg-gray-200' }
}

const JobStatusFilter = memo(({ jobs = [], selectedStatus, onStatusChange }: JobStatusFilterProps) => {
  // Memoize status counts to avoid recalculating on every render
  const statusCounts = useMemo(() => {
    if (!jobs || !Array.isArray(jobs)) return {}
    
    const counts: Record<string, number> = {}
    jobs.forEach(job => {
      if (job && job.status) {
        counts[job.status] = (counts[job.status] || 0) + 1
      }
    })
    return counts
  }, [jobs])

  return (
    <div className="flex items-center space-x-2">
      <Filter className="w-4 h-4 text-gray-400" />
      <select
        value={selectedStatus || 'all'}
        onChange={(e) => onStatusChange(e.target.value === 'all' ? null : e.target.value)}
        className="input min-w-32"
      >
        <option value="all">All Status ({jobs?.length || 0})</option>
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = statusCounts[status] || 0
          if (count === 0) return null
          return (
            <option key={status} value={status}>
              {config.label} ({count})
            </option>
          )
        })}
      </select>
    </div>
  )
})

JobStatusFilter.displayName = 'JobStatusFilter'

export default JobStatusFilter