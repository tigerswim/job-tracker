// Decides what a sync run should do with a review-queue row it has just
// re-fetched. Pure so the status rules are unit-testable; the caller does the
// actual DB read/write.
//
// Why this exists: the queue is keyed per Gmail THREAD, and the old write used
// `ignoreDuplicates: true`. That made accepting a thread once permanently mute
// every later reply on it. `ignoreDuplicates` cannot express "update only when
// newer" — it is all-or-nothing — so the decision moves here.

export type QueueAction = 'insert' | 'reopen' | 'skip'

export interface QueueDecision {
  action: QueueAction
  status?: 'pending'
}

interface ExistingRow {
  status: string
  occurred_at: string
  skipped_until: string | null
}

interface IncomingItem {
  lastMessageAt: string
}

export function decideQueueWrite(
  existing: ExistingRow | null,
  incoming: IncomingItem,
  now: Date,
): QueueDecision {
  if (!existing) return { action: 'insert', status: 'pending' }

  // Dismissed is sticky forever. This is what preserves newsletter muting and
  // the blocked_senders dismiss-and-learn behaviour.
  if (existing.status === 'dismissed') return { action: 'skip' }

  // A skip is a deliberate 7-day snooze. A new message must not cancel it;
  // once the timer expires the row is eligible again.
  if (existing.status === 'skipped') {
    const until = existing.skipped_until ? Date.parse(existing.skipped_until) : 0
    if (until > now.getTime()) return { action: 'skip' }
  }

  // Only genuinely newer traffic re-opens. Without this guard every already
  // accepted thread would re-queue on the very next run.
  const isNewer = Date.parse(incoming.lastMessageAt) > Date.parse(existing.occurred_at)
  if (!isNewer) return { action: 'skip' }

  return { action: 'reopen', status: 'pending' }
}
