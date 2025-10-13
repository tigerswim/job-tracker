'use client'

import { useState, useCallback, useMemo } from 'react'
import { Interaction } from '@/lib/supabase'
import {
  Mail,
  Phone,
  Video,
  Linkedin,
  Calendar,
  MessageSquare,
  Edit,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface InteractionCardProps {
  interaction: Interaction
  onEdit: (interaction: Interaction) => void
  onDelete: (id: string) => void
  compact?: boolean
}

// Type configuration with enhanced styling
const INTERACTION_TYPE_CONFIG = {
  email: {
    icon: Mail,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    label: 'Email'
  },
  phone: {
    icon: Phone,
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
    label: 'Phone'
  },
  video_call: {
    icon: Video,
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    label: 'Video Call'
  },
  linkedin: {
    icon: Linkedin,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-600',
    label: 'LinkedIn'
  },
  meeting: {
    icon: Calendar,
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    label: 'Meeting'
  },
  other: {
    icon: MessageSquare,
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    label: 'Other'
  }
} as const

// Enhanced date formatting with caching
const dateFormatCache = new Map<string, string>()

const formatDate = (dateString: string): string => {
  if (dateFormatCache.has(dateString)) {
    return dateFormatCache.get(dateString)!
  }

  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let formatted: string
  if (date.toDateString() === today.toDateString()) {
    formatted = 'Today'
  } else if (date.toDateString() === yesterday.toDateString()) {
    formatted = 'Yesterday'
  } else {
    const diffTime = today.getTime() - date.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 7) {
      formatted = date.toLocaleDateString('en-US', { weekday: 'long' })
    } else if (date.getFullYear() === today.getFullYear()) {
      formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  dateFormatCache.set(dateString, formatted)
  return formatted
}

// Smart text truncation component
const TruncatedText = ({ 
  text, 
  maxLines = 2, 
  className = '',
  showToggle = true 
}: { 
  text: string
  maxLines?: number
  className?: string
  showToggle?: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Calculate if text needs truncation (rough estimation)
  const shouldTruncate = text.length > maxLines * 80
  
  const toggleExpansion = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }, [isExpanded])

  if (!shouldTruncate || isExpanded) {
    return (
      <div className={className}>
        <p className="whitespace-pre-wrap">{text}</p>
        {shouldTruncate && showToggle && (
          <button
            onClick={toggleExpansion}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-1 flex items-center space-x-1"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Show less</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      <p 
        className={`whitespace-pre-wrap line-clamp-${maxLines}`}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {text}
      </p>
      {showToggle && (
        <button
          onClick={toggleExpansion}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-1 flex items-center space-x-1"
        >
          <ChevronDown className="w-3 h-3" />
          <span>Show more</span>
        </button>
      )}
    </div>
  )
}

export default function InteractionCard({
  interaction,
  onEdit,
  onDelete,
  compact = false
}: InteractionCardProps) {
  const config = useMemo(() => 
    INTERACTION_TYPE_CONFIG[interaction.type as keyof typeof INTERACTION_TYPE_CONFIG] || 
    INTERACTION_TYPE_CONFIG.other
  , [interaction.type])
  
  const formattedDate = useMemo(() => formatDate(interaction.date), [interaction.date])
  const Icon = config.icon

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(interaction)
  }, [interaction, onEdit])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(interaction.id)
  }, [interaction.id, onDelete])

  if (compact) {
    return (
      <div className={`
        ${config.bg} ${config.border} border-l-4 rounded-r-lg p-3 
        group hover:shadow-sm transition-all duration-200 cursor-pointer
      `}>
        <div className="flex items-start justify-between space-x-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className={`p-1.5 rounded-md ${config.bg} ${config.border} border flex-shrink-0`}>
              <Icon size={12} className={config.text} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className={`font-medium text-sm ${config.text}`}>
                  {config.label}
                </span>
                <span className="text-xs text-slate-500 flex items-center space-x-1">
                  <Clock size={10} />
                  <span>{formattedDate}</span>
                </span>
              </div>
              <p className="text-slate-800 text-xs mt-1 line-clamp-1">
                {interaction.summary}
              </p>
            </div>
          </div>
          
          {/* Action buttons - visible on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
            <button
              onClick={handleEdit}
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
              title="Edit interaction"
            >
              <Edit size={12} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200"
              title="Delete interaction"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`
      ${config.bg} ${config.border} border-l-4 rounded-r-lg p-4 
      group hover:shadow-md transition-all duration-200 relative
    `}>
      {/* Action buttons - positioned in top right */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
        <button
          onClick={handleEdit}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
          title="Edit interaction"
        >
          <Edit size={14} />
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
          title="Delete interaction"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Header with type and date */}
      <div className="flex items-center space-x-3 mb-3 pr-16">
        <div className={`p-2 rounded-lg ${config.bg} ${config.border} border`}>
          <Icon size={16} className={config.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`font-semibold text-sm ${config.text}`}>
              {config.label}
            </span>
            <div className="flex items-center space-x-1 text-slate-500 text-xs">
              <Clock size={12} />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-3">
        <TruncatedText
          text={interaction.summary}
          maxLines={2}
          className="text-slate-800 font-medium text-sm"
        />
      </div>

      {/* Notes */}
      {interaction.notes && (
        <div className="bg-white/60 rounded-lg p-3 border border-slate-200/60">
          <TruncatedText
            text={interaction.notes}
            maxLines={3}
            className="text-slate-600 text-sm"
          />
        </div>
      )}
    </div>
  )
}