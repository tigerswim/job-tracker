# Interaction Search — Design Spec

**Date**: 2026-04-01  
**Status**: Approved  

---

## Overview

Add the ability to search across all interactions in the database from within the Contacts tab. The primary use case is finding a contact when you remember the context of how you met (location, topic, event) but not their name.

---

## Data Layer

**New function**: `searchInteractions(searchTerm: string)` in `src/lib/interactions.ts`

- Queries Supabase with `.or()` across `summary.ilike.%term%` and `notes.ilike.%term%`
- Joins to `contacts` table to filter on `name.ilike.%term%` and `company.ilike.%term%`
- Returns augmented interaction objects including `contact_name` and `contact_company`
- Results capped at 50 (no pagination)
- Same direct Supabase client pattern used elsewhere in the app — no new API route

**Return type** extends the existing `Interaction` interface:
```typescript
interface InteractionSearchResult extends Interaction {
  contact_name: string
  contact_company: string | null
}
```

---

## UI Changes — ContactList.tsx

A **"Contacts | Interactions" pill toggle** is added just above the existing search bar.

- Switching modes clears the search term and results
- Search bar placeholder changes: `"Search contacts..."` vs `"Search interactions..."`
- In **Contacts mode**: behavior is identical to current — no changes
- In **Interactions mode**: the contact grid is hidden; interaction results replace it
- When search term is empty in Interactions mode: show a brief prompt ("Type to search your interactions") instead of the contact grid

**New state variables:**
- `searchMode: 'contacts' | 'interactions'` — controls active mode
- `interactionResults: InteractionSearchResult[]` — holds search results

The existing `debouncedSearchTerm` is reused. When it changes and mode is `'interactions'`, `searchInteractions()` is called instead of `searchContacts()`. The `allContacts` state (used for mutual connection resolution) is unaffected — loads once on mount regardless of mode.

---

## New Component — InteractionSearchResult.tsx

A lightweight card component (`src/components/InteractionSearchResult.tsx`) for displaying interaction search results. Renders in a single-column list (not the 3-column contact grid).

Each card displays:
- **Type badge** — colored, reusing existing type config from `InteractionCard.tsx`
- **Date** — relative formatting ("Today", "3 days ago", etc.) matching existing pattern
- **Contact name + company** — clicking opens the contact in the existing detail view
- **Summary** — always visible, truncated at ~2 lines
- **Expand toggle** — "Show more" reveals full summary and notes inline

Cards are **read-only** — no edit/delete actions. Editing happens in the contact view after navigating via the contact link.

Reuses styling tokens from `InteractionCard.tsx` but is a separate component due to different layout requirements.

---

## What This Does Not Include

- Filtering by interaction type (can be added later as a secondary filter)
- Pagination of interaction results (50-result cap is sufficient for search)
- Edit/delete from search results (contact view is the right place for mutations)

---

## Files Affected

| File | Change |
|------|--------|
| `src/lib/interactions.ts` | Add `searchInteractions()` function |
| `src/components/ContactList.tsx` | Add mode toggle, new state, conditional rendering |
| `src/components/InteractionSearchResult.tsx` | New component (create) |
