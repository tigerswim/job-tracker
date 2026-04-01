'use client'

import { useState, useMemo } from 'react'
import {
  Mail, Phone, Video, Linkedin, Calendar, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react'
import { InteractionSearchResult as InteractionSearchResultType } from '@/lib/interactions'

interface InteractionSearchResultProps {
  result: InteractionSearchResultType
  onOpenContact: (contactId: string) => void
}

const INTERACTION_TYPE_CONFIG = {
  email:      { icon: Mail,         bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'Email'      },
  phone:      { icon: Phone,        bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Phone'      },
  video_call: { icon: Video,        bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Video Call' },
  linkedin:   { icon: Linkedin,     bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'LinkedIn'   },
  meeting:    { icon: Calendar,     bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Meeting'    },
  other:      { icon: MessageSquare,bg: 'bg-slate-50',  text: 'text-slate-700',  border: 'border-slate-200',  label: 'Other'      },
} as const

const dateFormatCache = new Map<string, string>()

function formatDate(dateString: string): string {
  const today = new Date()
  const cacheKey = `${today.toDateString()}|${dateString}`
  if (dateFormatCache.has(cacheKey)) return dateFormatCache.get(cacheKey)!

  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let formatted: string
  if (date.toDateString() === today.toDateString()) {
    formatted = 'Today'
  } else if (date.toDateString() === yesterday.toDateString()) {
    formatted = 'Yesterday'
  } else {
    const diffDays = Math.ceil((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 7) {
      formatted = date.toLocaleDateString('en-US', { weekday: 'long' })
    } else if (date.getFullYear() === today.getFullYear()) {
      formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
  dateFormatCache.set(cacheKey, formatted)
  return formatted
}

export default function InteractionSearchResult({ result, onOpenContact }: InteractionSearchResultProps) {
  const [expanded, setExpanded] = useState(false)
  const config = INTERACTION_TYPE_CONFIG[result.type] ?? INTERACTION_TYPE_CONFIG.other
  const Icon = config.icon
  const formattedDate = useMemo(() => formatDate(result.date), [result.date])
  const hasMore = result.notes || result.summary.length > 120

  return (
    <div className={`rounded-xl border-2 ${config.border} ${config.bg} p-4 space-y-2`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.text} ${config.bg} border ${config.border} shrink-0`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
          <span className="text-xs text-slate-500 shrink-0">{formattedDate}</span>
        </div>
        <button
          onClick={() => onOpenContact(result.contact_id)}
          className="text-sm font-semibold text-slate-700 hover:text-blue-600 hover:underline truncate text-right transition-colors"
          title="Open contact"
        >
          {result.contact_name}
          {result.contact_company && (
            <span className="font-normal text-slate-500"> · {result.contact_company}</span>
          )}
        </button>
      </div>

      {/* Summary */}
      <p className={`text-sm text-slate-800 ${!expanded ? 'line-clamp-2' : ''}`}>
        {result.summary}
      </p>

      {/* Expanded notes */}
      {expanded && result.notes && (
        <p className="text-sm text-slate-600 whitespace-pre-wrap border-t border-slate-200 pt-2 mt-1">
          {result.notes}
        </p>
      )}

      {/* Expand toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
        </button>
      )}
    </div>
  )
}
