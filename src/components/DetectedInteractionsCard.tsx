'use client'
import { useEffect, useState } from 'react'
import { ReviewItemPanel } from './ReviewItemPanel'
import { SyncSettingsPanel } from './SyncSettingsPanel'

interface QueueItem {
  id: string; source: string; summary: string; counterparty_email: string | null
  type: string; occurred_at: string; notes: string; suggested_contact_id: string | null
}

export default function DetectedInteractionsCard() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [status, setStatus] = useState<string>('')
  const [active, setActive] = useState<QueueItem | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  async function refresh() {
    const q = await fetch('/api/review-queue').then(r => r.json())
    setItems(q.items ?? [])
    const s = await fetch('/api/sync-status').then(r => r.json())
    const last = s.runs?.[0]
    if (!last) setStatus('No sync yet')
    else if (last.status === 'failed')
      setStatus('⚠ Sync needs attention — reauthorize Google')
    else setStatus(`Last synced ${new Date(last.finished_at ?? last.started_at).toLocaleString()} · ${s.pendingCount} to review`)
  }
  useEffect(() => { refresh() }, [])

  return (
    <div className="glass-strong rounded-2xl p-6 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">
          Detected{items.length ? ` · ${items.length}` : ''}
        </h2>
        <button onClick={() => setShowSettings(true)}
          className="text-sm text-slate-500 hover:text-slate-800">Settings</button>
      </div>
      <p className="text-xs text-slate-500 mb-4">{status}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          No detected interactions — you&apos;re all caught up. New emails and
          meetings with your contacts appear here daily.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {items.map(it => (
            <li key={it.id}>
              <button onClick={() => setActive(it)}
                className="w-full text-left py-3 hover:bg-slate-50">
                <span className="text-xs uppercase text-slate-400 mr-2">{it.source}</span>
                <span className="font-medium">{it.summary}</span>
                <span className="block text-xs text-slate-500">
                  {it.counterparty_email} · {new Date(it.occurred_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {active && (
        <ReviewItemPanel item={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); refresh() }} />
      )}
      {showSettings && (
        <SyncSettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
