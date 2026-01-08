'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface ChartContainerProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  isLoading?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  children: ReactNode
  className?: string
}

export default function ChartContainer({
  title,
  subtitle,
  icon: Icon,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data available',
  children,
  className = '',
}: ChartContainerProps) {
  return (
    <div
      className={`bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm ${className}`}
    >
      <div className="p-4 border-b border-slate-200/60">
        <div className="flex items-center space-x-2">
          {Icon && <Icon className="w-4 h-4 text-slate-600" />}
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      <div className="p-4">
        {isLoading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <EmptyState message={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="h-[200px] flex items-end justify-between gap-2 animate-pulse">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-slate-200 rounded-t"
          style={{ height: `${Math.random() * 60 + 20}%` }}
        />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-slate-400">
      <p className="text-sm">{message}</p>
    </div>
  )
}
