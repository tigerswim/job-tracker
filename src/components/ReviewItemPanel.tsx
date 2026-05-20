'use client'
import { useEffect, useState } from 'react'

interface Props {
  item: { id: string; type: string; summary: string; notes: string
    occurred_at: string; counterparty_email: string | null
    suggested_contact_id: string | null; suggested_contact_name: string | null }
  onClose: () => void
  onDone: () => void
}
interface ContactLite { id: string; name: string; email?: string }

export function ReviewItemPanel({ item, onClose, onDone }: Props) {
  const [contactId, setContactId] = useState(item.suggested_contact_id ?? '')
  const [type, setType] = useState(item.type)
  const [date, setDate] = useState(item.occurred_at.slice(0, 10))
  const [summary, setSummary] = useState(item.summary)
  const [notes, setNotes] = useState(item.notes)
  const [search, setSearch] = useState(item.suggested_contact_name ?? '')
  const [results, setResults] = useState<ContactLite[]>([])

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/contacts?search=${encodeURIComponent(search)}`)
        .then(x => x.json())
      setResults(r.contacts ?? r ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  async function confirm() {
    await fetch(`/api/review-queue/${item.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId, type, date, summary, notes,
        learn_alias: !!item.counterparty_email,
      }),
    })
    onDone()
  }
  async function dismiss() {
    await fetch(`/api/review-queue/${item.id}`, { method: 'DELETE' })
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[760px] bg-white h-full overflow-y-auto p-6 animate-slide-in-right">
        <div className="flex justify-between mb-4">
          <h3 className="text-lg font-semibold">Review detected interaction</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <label className="block text-sm font-medium">Contact</label>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts…" className="w-full border rounded p-2 mb-1" />
        {results.length > 0 && (
          <ul className="border rounded mb-2 max-h-40 overflow-y-auto">
            {results.map(c => (
              <li key={c.id}>
                <button className="w-full text-left p-2 hover:bg-slate-50"
                  onClick={() => { setContactId(c.id); setSearch(c.name); setResults([]) }}>
                  {c.name} {c.email ? `· ${c.email}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!contactId && <p className="text-xs text-amber-600 mb-2">No contact selected — required to confirm.</p>}

        <label className="block text-sm font-medium mt-3">Type</label>
        <select value={type} onChange={e => setType(e.target.value)}
          className="w-full border rounded p-2 mb-3">
          {['email','phone','video_call','linkedin','meeting','other']
            .map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="block text-sm font-medium">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border rounded p-2 mb-3" />

        <label className="block text-sm font-medium">Summary</label>
        <input value={summary} onChange={e => setSummary(e.target.value)}
          className="w-full border rounded p-2 mb-3" />

        <label className="block text-sm font-medium">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={6} className="w-full border rounded p-2 mb-4" />

        <div className="flex gap-2">
          <button disabled={!contactId} onClick={confirm}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-40">
            Confirm
          </button>
          <button onClick={dismiss}
            className="border px-4 py-2 rounded">Dismiss</button>
        </div>
      </div>
    </div>
  )
}
