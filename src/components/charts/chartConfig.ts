// Chart configuration with design system integration

export const CHART_COLORS = {
  // Interaction types
  email: '#3b82f6',      // blue-500
  phone: '#22c55e',      // green-500
  video_call: '#a855f7', // purple-500
  linkedin: '#1d4ed8',   // blue-700
  meeting: '#f97316',    // orange-500
  other: '#64748b',      // slate-500

  // Job statuses
  interested: '#10b981',  // emerald-500
  applied: '#0ea5e9',     // sky-500
  interviewing: '#8b5cf6', // violet-500
  onhold: '#f59e0b',      // amber-500
  offered: '#22c55e',     // green-500
  rejected: '#64748b',    // slate-500

  // Chart elements
  gridLine: '#e2e8f0',    // slate-200
  axisText: '#64748b',    // slate-500
  primaryGradientStart: '#3b82f6',
  primaryGradientEnd: '#dbeafe',

  // Network growth
  contacts: '#8b5cf6',    // violet-500
  contactsLight: '#c4b5fd', // violet-300
} as const

export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  video_call: 'Video Call',
  linkedin: 'LinkedIn',
  meeting: 'Meeting',
  other: 'Other',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  interested: 'Interested',
  applied: 'Applied',
  interviewing: 'Interviewing',
  onhold: 'On Hold',
  offered: 'Offered',
  rejected: 'Rejected',
}

export const CHART_THEME = {
  fontSize: 12,
  fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',

  axis: {
    tickLine: false,
    axisLine: { stroke: CHART_COLORS.gridLine },
  },

  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(226, 232, 240, 0.6)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      padding: '12px 16px',
    },
    labelStyle: {
      color: '#1e293b',
      fontWeight: 600,
      marginBottom: '8px',
    },
    itemStyle: {
      color: '#475569',
      fontSize: '13px',
    },
  },

  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: CHART_COLORS.gridLine,
    horizontal: true,
    vertical: false,
  },

  responsiveContainer: {
    desktop: 250,
    tablet: 220,
    mobile: 180,
  },
} as const

export type Granularity = 'weekly' | 'monthly'

export interface TimeSeriesDataPoint {
  period: string
  periodLabel: string
  [key: string]: string | number
}
