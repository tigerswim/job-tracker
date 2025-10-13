// src/components/InteractionList.tsx - Enhanced with InteractionCard component

'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Interaction } from '@/lib/supabase'
import { getInteractions, deleteInteraction, clearInteractionsCache } from '@/lib/interactions'
import {
  Plus,
  MessageSquare,
  User
} from 'lucide-react'
import InteractionForm from './InteractionForm'
import InteractionCard from './InteractionCard'

interface InteractionListProps {
  contactId: string
  compact?: boolean
}

// InteractionItem component is now replaced by InteractionCard

// Memoized loading skeleton
const LoadingSkeleton = memo(() => (
  <div className="space-y-3">
    {[...Array(2)].map((_, i) => (
      <div key={i} className="card p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-slate-200 rounded-lg loading-skeleton"></div>
          <div className="flex-1">
            <div className="h-4 bg-slate-200 rounded loading-skeleton mb-1"></div>
            <div className="h-3 bg-slate-200 rounded loading-skeleton w-20"></div>
          </div>
        </div>
        <div className="h-4 bg-slate-200 rounded loading-skeleton mb-2"></div>
        <div className="h-16 bg-slate-200 rounded loading-skeleton"></div>
      </div>
    ))}
  </div>
))

LoadingSkeleton.displayName = 'LoadingSkeleton'

// Memoized empty state
const EmptyState = memo(({ onAddInteraction }: { onAddInteraction: () => void }) => (
  <div className="text-center py-12">
    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <MessageSquare size={32} className="text-slate-400" />
    </div>
    <p className="text-slate-500 mb-4">No interactions recorded yet</p>
    <button onClick={onAddInteraction} className="btn-primary">
      Add First Interaction
    </button>
  </div>
))

EmptyState.displayName = 'EmptyState'

export default function InteractionList({ contactId, compact = false }: InteractionListProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null)

  // Memoized sorted interactions to prevent re-sorting on every render
  const sortedInteractions = useMemo(() => {
    return [...interactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [interactions])

  // Optimized load function with better error handling
  const loadInteractions = useCallback(async () => {
    if (!contactId) return

    console.log('InteractionList: Loading interactions for contact:', contactId)
    setLoading(true)
    try {
      const data = await getInteractions(contactId)
      console.log('InteractionList: Received interactions:', data?.length || 0, 'for contact:', contactId)
      setInteractions(data)
    } catch (error) {
      console.error('Error loading interactions:', error)
      // Don't show empty state on error, keep existing data
    } finally {
      setLoading(false)
    }
  }, [contactId])

  // Load interactions when contactId changes
  useEffect(() => {
    loadInteractions()
  }, [loadInteractions])

  // Memoized callbacks to prevent child re-renders
  const handleDelete = useCallback(async (id: string) => {
    if (confirm('Are you sure you want to delete this interaction?')) {
      const success = await deleteInteraction(id)
      if (success) {
        // Optimistic update - remove from local state immediately
        setInteractions(prev => prev.filter(interaction => interaction.id !== id))
      }
    }
  }, [])

  const handleFormSuccess = useCallback(() => {
    setShowForm(false)
    setEditingInteraction(null)
    loadInteractions()
  }, [loadInteractions])

  const handleShowForm = useCallback(() => {
    setShowForm(true)
  }, [])

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setEditingInteraction(null)
  }, [])

  const handleEdit = useCallback((interaction: Interaction) => {
    setEditingInteraction(interaction)
    setShowForm(true)
  }, [])

  // Early returns for different states
  if (loading) {
    return <LoadingSkeleton />
  }

  if (showForm) {
    return (
      <InteractionForm
        contactId={contactId}
        interaction={editingInteraction}
        onSuccess={handleFormSuccess}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Header - Enhanced for mobile */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold text-slate-800 ${compact ? 'text-base' : 'text-sm'}`}>Recent Activity</h3>
          <span className={`bg-slate-100 text-slate-600 px-2 py-1 rounded-full ${compact ? 'text-sm' : 'text-xs'}`}>
            {interactions.length}
          </span>
        </div>
        <button 
          onClick={handleShowForm} 
          className={`btn-primary flex items-center gap-2 ${
            compact ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-sm ml-6'
          }`}
        >
          <Plus size={compact ? 16 : 14} />
          Add
        </button>
      </div>

      {/* Content */}
      {sortedInteractions.length === 0 ? (
        <EmptyState onAddInteraction={handleShowForm} />
      ) : (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          {sortedInteractions.map((interaction) => (
            <InteractionCard
              key={interaction.id}
              interaction={interaction}
              onEdit={handleEdit}
              onDelete={handleDelete}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  )
}