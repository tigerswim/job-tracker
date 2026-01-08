// Chart data transformation utilities

import { Granularity, TimeSeriesDataPoint } from '@/components/charts/chartConfig'

interface DateItem {
  [key: string]: unknown
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

/**
 * Format a date as a week identifier (YYYY-Www)
 */
function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date)
  const year = weekStart.getFullYear()
  const oneJan = new Date(year, 0, 1)
  const days = Math.floor((weekStart.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + oneJan.getDay() + 1) / 7)
  return `${year}-W${weekNum.toString().padStart(2, '0')}`
}

/**
 * Format a date as a month identifier (YYYY-MM)
 */
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
}

/**
 * Get a human-readable label for a period
 */
function getPeriodLabel(periodKey: string, granularity: Granularity): string {
  if (granularity === 'weekly') {
    // Parse YYYY-Www format
    const [year, weekPart] = periodKey.split('-W')
    const weekNum = parseInt(weekPart, 10)

    // Calculate the date of the week start
    const jan1 = new Date(parseInt(year, 10), 0, 1)
    const days = (weekNum - 1) * 7
    const weekStart = new Date(jan1.getTime() + days * 24 * 60 * 60 * 1000)

    // Adjust to Monday
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diff)

    return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    // Parse YYYY-MM format
    const [year, month] = periodKey.split('-')
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
}

/**
 * Get date range for a granularity
 */
export function getDateRange(granularity: Granularity): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()

  if (granularity === 'weekly') {
    start.setDate(start.getDate() - 12 * 7) // 12 weeks
  } else {
    start.setMonth(start.getMonth() - 12) // 12 months
  }

  return { start, end }
}

/**
 * Generate all period keys in a range
 */
function generatePeriodKeys(start: Date, end: Date, granularity: Granularity): string[] {
  const keys: string[] = []
  const current = new Date(start)

  while (current <= end) {
    const key = granularity === 'weekly' ? getWeekKey(current) : getMonthKey(current)
    if (!keys.includes(key)) {
      keys.push(key)
    }

    if (granularity === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else {
      current.setMonth(current.getMonth() + 1)
    }
  }

  return keys
}

/**
 * Group items by time period with category breakdown
 */
export function groupByPeriod<T extends DateItem>(
  items: T[],
  dateField: keyof T,
  categoryField: keyof T,
  granularity: Granularity,
  categories: string[]
): TimeSeriesDataPoint[] {
  const { start, end } = getDateRange(granularity)
  const periodKeys = generatePeriodKeys(start, end, granularity)

  // Initialize all periods with zero counts
  const periodMap: Record<string, Record<string, number>> = {}
  for (const key of periodKeys) {
    periodMap[key] = {}
    for (const cat of categories) {
      periodMap[key][cat] = 0
    }
  }

  // Count items
  for (const item of items) {
    const dateValue = item[dateField]
    if (!dateValue || typeof dateValue !== 'string') continue

    const date = new Date(dateValue)
    if (date < start || date > end) continue

    const key = granularity === 'weekly' ? getWeekKey(date) : getMonthKey(date)
    if (!periodMap[key]) continue

    const category = String(item[categoryField] || 'other')
    if (periodMap[key][category] !== undefined) {
      periodMap[key][category]++
    }
  }

  // Convert to array
  return periodKeys.map((period) => ({
    period,
    periodLabel: getPeriodLabel(period, granularity),
    ...periodMap[period],
  }))
}

/**
 * Group items by time period (simple count, no categories)
 */
export function groupByPeriodSimple<T extends DateItem>(
  items: T[],
  dateField: keyof T,
  granularity: Granularity
): TimeSeriesDataPoint[] {
  const { start, end } = getDateRange(granularity)
  const periodKeys = generatePeriodKeys(start, end, granularity)

  const periodMap: Record<string, number> = {}
  for (const key of periodKeys) {
    periodMap[key] = 0
  }

  for (const item of items) {
    const dateValue = item[dateField]
    if (!dateValue || typeof dateValue !== 'string') continue

    const date = new Date(dateValue)
    if (date < start || date > end) continue

    const key = granularity === 'weekly' ? getWeekKey(date) : getMonthKey(date)
    if (periodMap[key] !== undefined) {
      periodMap[key]++
    }
  }

  return periodKeys.map((period) => ({
    period,
    periodLabel: getPeriodLabel(period, granularity),
    count: periodMap[period],
  }))
}

/**
 * Calculate cumulative growth over time
 */
export function calculateCumulativeGrowth<T extends DateItem>(
  items: T[],
  dateField: keyof T,
  granularity: Granularity
): TimeSeriesDataPoint[] {
  const { start, end } = getDateRange(granularity)
  const periodKeys = generatePeriodKeys(start, end, granularity)

  // Count items before the start date (baseline)
  let baseline = 0
  for (const item of items) {
    const dateValue = item[dateField]
    if (!dateValue || typeof dateValue !== 'string') continue

    const date = new Date(dateValue)
    if (date < start) {
      baseline++
    }
  }

  // Count items per period
  const periodMap: Record<string, number> = {}
  for (const key of periodKeys) {
    periodMap[key] = 0
  }

  for (const item of items) {
    const dateValue = item[dateField]
    if (!dateValue || typeof dateValue !== 'string') continue

    const date = new Date(dateValue)
    if (date < start || date > end) continue

    const key = granularity === 'weekly' ? getWeekKey(date) : getMonthKey(date)
    if (periodMap[key] !== undefined) {
      periodMap[key]++
    }
  }

  // Calculate cumulative sum
  let cumulative = baseline
  return periodKeys.map((period) => {
    cumulative += periodMap[period]
    return {
      period,
      periodLabel: getPeriodLabel(period, granularity),
      total: cumulative,
      added: periodMap[period],
    }
  })
}
