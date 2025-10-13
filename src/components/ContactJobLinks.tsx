// src/components/ContactJobLinks.tsx - Fixed to avoid unnecessary loading states

'use client'

import { useState, useEffect } from 'react'
import { getContactJobs } from '@/lib/jobContacts'
import { Briefcase, ExternalLink } from 'lucide-react'

interface Job {
  id: string
  job_title: string
  company: string
  status: string
  location: string
}

interface ContactJobLinksProps {
  contactId: string
  compact?: boolean
  onJobClick?: (jobId: string) => void
  prefetchedJobs?: Job[]
}

export default function ContactJobLinks({
  contactId,
  compact = true,
  onJobClick,
  prefetchedJobs
}: ContactJobLinksProps) {
  const [linkedJobs, setLinkedJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false) // Changed to false initially
  const [hasCheckedJobs, setHasCheckedJobs] = useState(false)

  useEffect(() => {
    if (prefetchedJobs) {
      setLinkedJobs(prefetchedJobs)
      setHasCheckedJobs(true)
      setLoading(false)
    } else {
      loadLinkedJobs()
    }
  }, [contactId, prefetchedJobs])

  const loadLinkedJobs = async () => {
    try {
      setLoading(true)
      const jobs = await getContactJobs(contactId)
      setLinkedJobs(jobs)
      setHasCheckedJobs(true)
    } catch (error) {
      console.error('Error loading linked jobs:', error)
      setLinkedJobs([])
      setHasCheckedJobs(true)
    } finally {
      setLoading(false)
    }
  }

  const handleJobClick = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    if (onJobClick) {
      onJobClick(jobId)
    }
  }

  // Don't show anything while loading initially
  if (loading && !hasCheckedJobs) {
    return null
  }

  // Don't show anything if no jobs are linked
  if (hasCheckedJobs && linkedJobs.length === 0) {
    return null
  }

  if (compact) {
    return (
      <div className="mt-2">
        <div className="text-xs text-slate-500 mb-1">Applied to:</div>
        <div className="flex flex-wrap gap-1">
          {linkedJobs.slice(0, 3).map((job) => (
            <button
              key={job.id}
              onClick={(e) => handleJobClick(e, job.id)}
              className={`px-2 py-1 rounded-full text-xs transition-all duration-200 ${
                onJobClick
                  ? 'bg-blue-100 text-blue-700 border border-blue-300 cursor-pointer hover:bg-blue-200 hover:scale-105 font-medium'
                  : 'bg-blue-100 text-blue-700'
              }`}
              title={onJobClick ? 'Click to view job details' : `${job.job_title} at ${job.company}`}
            >
              <Briefcase className="w-3 h-3 inline mr-1" />
              {job.job_title} at {job.company}
              {onJobClick && (
                <ExternalLink className="w-3 h-3 inline ml-1" />
              )}
            </button>
          ))}
          {linkedJobs.length > 3 && (
            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
              +{linkedJobs.length - 3} more
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700 flex items-center">
        <Briefcase className="w-4 h-4 mr-2" />
        Associated Job Applications ({linkedJobs.length})
      </div>
      {linkedJobs.length > 0 ? (
        <div className="space-y-2">
          {linkedJobs.map((job) => (
            <div
              key={job.id}
              onClick={onJobClick ? (e) => handleJobClick(e, job.id) : undefined}
              className={`flex items-center justify-between space-x-3 p-3 rounded-lg border transition-all duration-200 ${
                onJobClick
                  ? 'border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100 hover:border-blue-300'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex-1">
                <div className="font-medium text-slate-900">{job.job_title}</div>
                <div className="text-sm text-slate-600">
                  {job.company} • {job.location} • {job.status}
                </div>
              </div>
              {onJobClick && <ExternalLink className="w-4 h-4 text-blue-500" />}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
