'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  CHART_COLORS,
  CHART_THEME,
  Granularity,
  TimeSeriesDataPoint,
} from './chartConfig'

interface JobPipelineChartProps {
  data: TimeSeriesDataPoint[]
  granularity: Granularity
}

export default function JobPipelineChart({
  data,
  granularity,
}: JobPipelineChartProps) {
  const hasData = useMemo(() => {
    return data.some((d) => (d.count as number) > 0)
  }, [data])

  if (!hasData) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400">
        <p className="text-sm">No jobs added in this period</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_THEME.responsiveContainer.desktop}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradient-jobs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray={CHART_THEME.cartesianGrid.strokeDasharray}
          stroke={CHART_THEME.cartesianGrid.stroke}
          horizontal={CHART_THEME.cartesianGrid.horizontal}
          vertical={CHART_THEME.cartesianGrid.vertical}
        />

        <XAxis
          dataKey="periodLabel"
          tickLine={CHART_THEME.axis.tickLine}
          axisLine={CHART_THEME.axis.axisLine}
          tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
          interval="preserveStartEnd"
        />

        <YAxis
          tickLine={CHART_THEME.axis.tickLine}
          axisLine={CHART_THEME.axis.axisLine}
          tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
          width={35}
          allowDecimals={false}
        />

        <Tooltip
          contentStyle={CHART_THEME.tooltip.contentStyle}
          labelStyle={CHART_THEME.tooltip.labelStyle}
          itemStyle={CHART_THEME.tooltip.itemStyle}
          formatter={(value: number) => [value, 'Jobs Added']}
        />

        <Area
          type="monotone"
          dataKey="count"
          stroke="#0ea5e9"
          fill="url(#gradient-jobs)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'white' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
