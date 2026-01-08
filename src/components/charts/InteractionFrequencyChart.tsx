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
  Legend,
} from 'recharts'
import {
  CHART_COLORS,
  CHART_THEME,
  INTERACTION_TYPE_LABELS,
  Granularity,
  TimeSeriesDataPoint,
} from './chartConfig'

interface InteractionFrequencyChartProps {
  data: TimeSeriesDataPoint[]
  granularity: Granularity
}

const INTERACTION_TYPES = ['email', 'phone', 'video_call', 'linkedin', 'meeting', 'other'] as const

export default function InteractionFrequencyChart({
  data,
  granularity,
}: InteractionFrequencyChartProps) {
  const hasData = useMemo(() => {
    return data.some((d) =>
      INTERACTION_TYPES.some((type) => (d[type] as number) > 0)
    )
  }, [data])

  if (!hasData) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400">
        <p className="text-sm">No interactions in this period</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_THEME.responsiveContainer.desktop}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          {INTERACTION_TYPES.map((type) => (
            <linearGradient
              key={type}
              id={`gradient-${type}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={CHART_COLORS[type]}
                stopOpacity={0.4}
              />
              <stop
                offset="95%"
                stopColor={CHART_COLORS[type]}
                stopOpacity={0.05}
              />
            </linearGradient>
          ))}
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
          formatter={(value: number, name: string) => [
            value,
            INTERACTION_TYPE_LABELS[name] || name,
          ]}
        />

        <Legend
          wrapperStyle={{ paddingTop: '16px' }}
          formatter={(value: string) => (
            <span className="text-xs text-slate-600">
              {INTERACTION_TYPE_LABELS[value] || value}
            </span>
          )}
        />

        {INTERACTION_TYPES.map((type) => (
          <Area
            key={type}
            type="monotone"
            dataKey={type}
            stackId="1"
            stroke={CHART_COLORS[type]}
            fill={`url(#gradient-${type})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: 'white' }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
