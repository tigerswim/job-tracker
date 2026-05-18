'use client'
import { useEffect, useState } from 'react'

export function SyncSettingsPanel({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<any>(null)
  const [emails, setEmails] = useState<string>('')
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    fetch('/api/followup-settings').then(r => r.json()).then(setS)
    fetch('/api/sync-identity').then(r => r.json())
      .then(d => setEmails((d.emails ?? []).join('\n')))
  }, [])

  async function save() {
    setErr('')
    const r = await fetch('/api/followup-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s) })
    if (!r.ok) { setErr((await r.json()).error ?? 'invalid'); return }
    await fetch('/api/sync-identity', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emails.split(/\s+/).filter(Boolean) }) })
    onClose()
  }
  if (!s) return null
  const num = (k: string) => (
    <input type="number" value={s[k]} min={1} max={365}
      onChange={e => setS({ ...s, [k]: Number(e.target.value) })}
      className="border rounded p-2 w-24" />
  )
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[560px] bg-white h-full overflow-y-auto p-6 animate-slide-in-right">
        <div className="flex justify-between mb-4">
          <h3 className="text-lg font-semibold">Sync &amp; follow-up settings</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={s.enabled}
            onChange={e => setS({ ...s, enabled: e.target.checked })} />
          Auto follow-up reminders enabled
        </label>
        <div className="space-y-3 mb-6">
          <div>Remind if no reply to my note after {num('email_no_reply_days')} days</div>
          <div>Remind to follow up after a meeting after {num('meeting_no_followup_days')} days</div>
          <div>Reconnect if gone quiet after {num('gone_quiet_days')} days</div>
          <div>Max auto follow-ups per day: {num('max_auto_followups_per_day')}</div>
        </div>
        <h4 className="font-medium mb-1">My email addresses</h4>
        <p className="text-xs text-slate-500 mb-2">
          One per line. A missing address causes your own mail to be
          misclassified.
        </p>
        <textarea value={emails} onChange={e => setEmails(e.target.value)}
          rows={4} className="w-full border rounded p-2 mb-4" />
        {err && <p className="text-sm text-red-600 mb-2">Invalid: {err}</p>}
        <button onClick={save}
          className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
      </div>
    </div>
  )
}
