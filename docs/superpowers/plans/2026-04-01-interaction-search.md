# Interaction Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mode toggle to the Contacts tab that lets users search all interactions by summary, notes, and contact name/company — returning inline-expandable result cards with a link to open the matched contact.

**Architecture:** A `searchInteractions()` function queries Supabase with an `or()` across interaction fields and a join to contacts. A `'Contacts | Interactions'` pill toggle in `ContactList.tsx` switches between the existing contact grid and a new single-column `InteractionSearchResult` card list. State is local to `ContactList`; no new API routes are needed.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase client (`createClientComponentClient`), TailwindCSS 4

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/interactions.ts` | Modify | Add `searchInteractions()` and `InteractionSearchResult` type |
| `src/components/InteractionSearchResult.tsx` | Create | Read-only card for a single interaction search result |
| `src/components/ContactList.tsx` | Modify | Mode toggle state, conditional rendering, call `searchInteractions` |

---

### Task 1: Add `searchInteractions()` to the data layer

**Files:**
- Modify: `src/lib/interactions.ts`

- [ ] **Step 1: Add the `InteractionSearchResult` type**

Open `src/lib/interactions.ts`. After the existing imports at the top, add the type (after the `import { Interaction } from './supabase'` line):

```typescript
export interface InteractionSearchResult extends Interaction {
  contact_name: string
  contact_company: string | null
}
```

- [ ] **Step 2: Add the `searchInteractions` function**

At the bottom of `src/lib/interactions.ts`, add:

```typescript
export async function searchInteractions(searchTerm: string): Promise<InteractionSearchResult[]> {
  if (!searchTerm.trim()) return []

  try {
    const supabase = createClientComponentClient()
    const term = searchTerm.trim()

    const { data, error } = await supabase
      .from('interactions')
      .select(`
        id, contact_id, type, date, summary, notes, user_id, created_at, updated_at,
        contacts!inner(name, company)
      `)
      .or(`summary.ilike.%${term}%,notes.ilike.%${term}%,contacts.name.ilike.%${term}%,contacts.company.ilike.%${term}%`)
      .order('date', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error searching interactions:', error)
      return []
    }

    return (data || []).map((row: {
      id: string
      contact_id: string
      type: 'email' | 'phone' | 'video_call' | 'linkedin' | 'meeting' | 'other'
      date: string
      summary: string
      notes?: string
      user_id: string
      created_at: string
      updated_at: string
      contacts: { name: string; company: string | null }
    }) => ({
      id: row.id,
      contact_id: row.contact_id,
      type: row.type,
      date: row.date,
      summary: row.summary,
      notes: row.notes,
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      contact_name: row.contacts.name,
      contact_company: row.contacts.company ?? null,
    }))
  } catch (err) {
    console.error('Exception in searchInteractions:', err)
    return []
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/danhoeller/Website Development/kineticbrandpartners/job-tracker" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
cd "/Users/danhoeller/Website Development/kineticbrandpartners/job-tracker"
git add src/lib/interactions.ts
git commit -m "feat: add searchInteractions() with InteractionSearchResult type"
```

---

### Task 2: Create `InteractionSearchResult` component

**Files:**
- Create: `src/components/InteractionSearchResult.tsx`

This component renders a single interaction result card. It reuses `INTERACTION_TYPE_CONFIG` styling logic (copied inline — the config is not exported from `InteractionCard.tsx`). Cards are read-only; clicking the contact name/company sets the selected contact in the parent.

- [ ] **Step 1: Create the file**

Create `src/components/InteractionSearchResult.tsx` with the following content:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/danhoeller/Website Development/kineticbrandpartners/job-tracker" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors).

- [ ] **Step 3: Commit**

```bash
cd "/Users/danhoeller/Website Development/kineticbrandpartners/job-tracker"
git add src/components/InteractionSearchResult.tsx
git commit -m "feat: add InteractionSearchResult card component"
```

---

### Task 3: Wire up the mode toggle and search in `ContactList.tsx`

**Files:**
- Modify: `src/components/ContactList.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/ContactList.tsx`, add two imports alongside the existing ones:

```typescript
import { searchInteractions, InteractionSearchResult } from '@/lib/interactions'
import InteractionSearchResultCard from '@/components/InteractionSearchResult'
```

- [ ] **Step 2: Add state variables**

In the `ContactList` component body, near the other `useState` declarations (around line 708), add:

```typescript
const [searchMode, setSearchMode] = useState<'contacts' | 'interactions'>('contacts')
const [interactionResults, setInteractionResults] = useState<InteractionSearchResult[]>([])
const [interactionSearchLoading, setInteractionSearchLoading] = useState(false)
```

- [ ] **Step 3: Add the interaction search effect**

After the existing `useEffect` that calls `loadContacts(debouncedSearchTerm)` (around line 809), add a new effect:

```typescript
useEffect(() => {
  if (searchMode !== 'interactions') return
  if (!debouncedSearchTerm.trim()) {
    setInteractionResults([])
    return
  }
  setInteractionSearchLoading(true)
  searchInteractions(debouncedSearchTerm).then(results => {
    setInteractionResults(results)
    setInteractionSearchLoading(false)
  })
}, [debouncedSearchTerm, searchMode])
```

- [ ] **Step 4: Add the mode toggle UI — desktop**

In the desktop search bar section (the `hidden lg:flex` div, around line 1003), add the pill toggle **above** the search input `<div className="relative flex-1 max-w-2xl">`. Insert it as a sibling before that div, wrapping both in a flex-col container:

Replace the block starting with:
```typescript
          {/* Search Bar - V2 Style */}
          <div className="relative flex-1 max-w-2xl">
```

With:
```typescript
          {/* Search mode toggle + bar */}
          <div className="flex flex-col gap-2 flex-1 max-w-2xl">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 self-start bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button
                onClick={() => { setSearchMode('contacts'); setSearchTerm(''); setInteractionResults([]) }}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-all duration-150 ${searchMode === 'contacts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${dmSans.className}`}
              >
                Contacts
              </button>
              <button
                onClick={() => { setSearchMode('interactions'); setSearchTerm(''); setInteractionResults([]) }}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-all duration-150 ${searchMode === 'interactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${dmSans.className}`}
              >
                Interactions
              </button>
            </div>
            {/* Search Bar - V2 Style */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder={searchMode === 'contacts' ? 'Search contacts by name, company, email, experience, education, or connections...' : 'Search interactions by summary, notes, or contact name...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-3 pl-12 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-colors ${dmSans.className}`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
```

- [ ] **Step 5: Add the mode toggle UI — mobile**

In the mobile section (the `lg:hidden` div), similarly wrap the existing `{/* Search Bar - Full width on mobile */}` div. Add the toggle above the search bar:

Replace the block starting with:
```typescript
          {/* Search Bar - Full width on mobile */}
          <div className="relative w-full">
```

With:
```typescript
          {/* Mode toggle */}
          <div className="flex items-center gap-1 mb-2 bg-slate-100 rounded-lg p-1 border border-slate-200 self-start">
            <button
              onClick={() => { setSearchMode('contacts'); setSearchTerm(''); setInteractionResults([]) }}
              className={`px-3 py-1 rounded-md text-sm font-semibold transition-all duration-150 ${searchMode === 'contacts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${dmSans.className}`}
            >
              Contacts
            </button>
            <button
              onClick={() => { setSearchMode('interactions'); setSearchTerm(''); setInteractionResults([]) }}
              className={`px-3 py-1 rounded-md text-sm font-semibold transition-all duration-150 ${searchMode === 'interactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${dmSans.className}`}
            >
              Interactions
            </button>
          </div>

          {/* Search Bar - Full width on mobile */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder={searchMode === 'contacts' ? 'Search contacts...' : 'Search interactions...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-4 py-3 pl-12 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-colors ${dmSans.className}`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
```

- [ ] **Step 6: Add the interaction results panel**

In the contact list main content area, find the `{/* Hybrid Main Content Layout */}` div. The contact grid is in `<div className="flex-1 min-w-0 contacts-main-area px-4 sm:px-0">`. Wrap its contents with a condition on `searchMode`, and add the interaction results below it.

Find the opening of the contacts-main-area div and wrap the inner content:

The area currently starts with `{displayedContacts.length === 0 ? ...}`. Wrap the entire inner content so it only shows when `searchMode === 'contacts'`, and add interaction results otherwise:

Locate the `<div className="flex-1 min-w-0 contacts-main-area px-4 sm:px-0">` and change its inner contents to:

```tsx
{searchMode === 'contacts' ? (
  <>
    {/* existing contacts rendering — no changes */}
    {displayedContacts.length === 0 ? (
      // ... keep everything from here through the end of this contacts block unchanged
    ) : (
      // ... keep existing contact cards block unchanged
    )}
  </>
) : (
  /* Interaction search results */
  <div className="space-y-3">
    {!debouncedSearchTerm.trim() ? (
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className={`text-slate-400 ${dmSans.className}`}>Type to search your interactions</p>
      </div>
    ) : interactionSearchLoading ? (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    ) : interactionResults.length === 0 ? (
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className={`text-slate-500 ${dmSans.className}`}>No interactions found for &ldquo;{debouncedSearchTerm}&rdquo;</p>
      </div>
    ) : (
      <>
        <p className={`text-sm text-slate-500 ${dmSans.className}`}>{interactionResults.length} result{interactionResults.length !== 1 ? 's' : ''}</p>
        {interactionResults.map(result => (
          <InteractionSearchResultCard
            key={result.id}
            result={result}
            onOpenContact={(contactId) => {
              setSearchMode('contacts')
              setSearchTerm('')
              setInteractionResults([])
              setSelectedContactId(contactId)
            }}
          />
        ))}
      </>
    )}
  </div>
)}
```

> **Note:** `MessageSquare` needs to be imported from `lucide-react` in `ContactList.tsx` if it isn't already. Check the import block at the top and add it if missing.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "/Users/danhoeller/Website Development/kineticbrandpartners/job-tracker" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors).

- [ ] **Step 8: Manual smoke test**

```bash
cd "/Users/danhoeller/Website Development/kineticbrandpartners/job-tracker" && npm run dev
```

1. Open http://localhost:3001 and log in
2. Navigate to the Contacts tab
3. Verify the "Contacts | Interactions" pill toggle appears above the search bar
4. Click "Interactions" — verify the contact grid is replaced by the empty-state prompt
5. Type a word that appears in an interaction summary — verify results appear
6. Expand a result with "Show more" — verify notes appear
7. Click a contact name — verify it navigates back to Contacts mode and opens that contact
8. Switch back to "Contacts" mode — verify the contact grid returns and search works normally

- [ ] **Step 9: Commit**

```bash
cd "/Users/danhoeller/Website Development/kineticbrandpartners/job-tracker"
git add src/components/ContactList.tsx
git commit -m "feat: add interaction search mode toggle to Contacts tab"
```
