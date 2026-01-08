'use client'

import { useState, useMemo, useCallback } from 'react'
import { Activity, TrendingUp, Users } from 'lucide-react'
import { Granularity } from './chartConfig'
import ChartContainer from './ChartContainer'
import TimeGranularityToggle from './TimeGranularityToggle'
import InteractionFrequencyChart from './InteractionFrequencyChart'
import JobPipelineChart from './JobPipelineChart'
import NetworkGrowthChart from './NetworkGrowthChart'
import { groupByPeriod, groupByPeriodSimple, calculateCumulativeGrowth } from '@/lib/chartUtils'
import type { Interaction, Job, Contact } from '@/lib/supabase'

interface ChartsSectionProps {
  interactions: Array<Interaction & { contact?: unknown }>
  jobs: Job[]
  contacts: Contact[]
  isLoading?: boolean
}

const INTERACTION_TYPES = ['email', 'phone', 'video_call', 'linkedin', 'meeting', 'other']
const JOB_STATUSES = ['interested', 'applied', 'interviewing', 'onhold', 'offered', 'rejected']

export default function ChartsSection({
  interactions,
  jobs,
  contacts,
  isLoading = false,
}: ChartsSectionProps) {
  const [granularity, setGranularity] = useState<Granularity>('monthly')

  const handleGranularityChange = useCallback((value: Granularity) => {
    setGranularity(value)
  }, [])

  // Transform interaction data for chart
  const interactionData = useMemo(() => {
    return groupByPeriod(
      interactions,
      'date',
      'type',
      granularity,
      INTERACTION_TYPES
    )
  }, [interactions, granularity])

  // Transform job data for chart - simple count of jobs added over time
  const jobData = useMemo(() => {
    return groupByPeriodSimple(jobs, 'created_at', granularity)
  }, [jobs, granularity])

  // Transform contact data for cumulative growth chart
  const networkData = useMemo(() => {
    return calculateCumulativeGrowth(contacts, 'created_at', granularity)
  }, [contacts, granularity])

  return (
    <div className="space-y-4">
      {/* Granularity Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Progress Over Time</h3>
        <TimeGranularityToggle
          value={granularity}
          onChange={handleGranularityChange}
        />
      </div>

      {/* Interaction Frequency - Full Width */}
      <ChartContainer
        title="Interaction Frequency"
        subtitle={`Your outreach activity by type (${granularity === 'weekly' ? 'last 12 weeks' : 'last 12 months'})`}
        icon={Activity}
        isLoading={isLoading}
        isEmpty={interactions.length === 0}
        emptyMessage="No interactions recorded yet"
      >
        <InteractionFrequencyChart data={interactionData} granularity={granularity} />
      </ChartContainer>

      {/* Two-column grid for Pipeline and Network Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Jobs Added */}
        <ChartContainer
          title="Jobs Added"
          subtitle="Jobs added to tracker over time"
          icon={TrendingUp}
          isLoading={isLoading}
          isEmpty={jobs.length === 0}
          emptyMessage="No jobs tracked yet"
        >
          <JobPipelineChart data={jobData} granularity={granularity} />
        </ChartContainer>

        {/* Contacts Added */}
        <ChartContainer
          title="Contacts Added"
          subtitle="Contacts added to network over time"
          icon={Users}
          isLoading={isLoading}
          isEmpty={contacts.length === 0}
          emptyMessage="No contacts added yet"
        >
          <NetworkGrowthChart data={networkData} granularity={granularity} />
        </ChartContainer>
      </div>
    </div>
  )
}
