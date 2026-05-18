# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the job-tracker project.

## Project Overview

job-tracker is a **standalone repository** for a job application and contact management system.

- **Repository**: `https://github.com/tigerswim/job-tracker.git`
- **Deployment**: Netlify (https://job-tracker.kineticbrandpartners.com)
- **Tech Stack**: Next.js 15.5.7, React 19, TypeScript, Tailwind CSS 4, Supabase

## Development Commands

### Core Development
- `npm run dev` - Start development server (port 3001)
- `npm run build` - Build production version
- `npm start` - Start production server
- `npm run lint` - Run ESLint (note: currently ignores build errors via next.config.js)

### Environment Setup
Ensure `.env.local` contains required Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Google OAuth
- **Styling**: TailwindCSS 4.x
- **Language**: TypeScript with strict mode
- **Deployment**: Netlify (configured via netlify.toml)

### Project Structure
```
src/
├── app/                    # App Router pages and API routes
│   ├── api/               # REST API endpoints
│   │   ├── contacts/      # Contact CRUD operations  
│   │   ├── jobs/          # Job application management
│   │   ├── reminders/     # Email reminder system
│   │   └── interactions/  # Contact interaction logging
│   ├── layout.tsx         # Root layout with Geist fonts
│   └── page.tsx          # Main dashboard with tabs
├── components/            # React components
│   ├── modals/           # Modal dialogs
│   └── reminder-actions/ # Reminder-specific components
└── lib/                  # Shared utilities and types
    ├── types/           # TypeScript interfaces
    └── *.ts            # Database queries and business logic
```

### Database Schema
Core tables managed via Supabase:
- **contacts** - Professional network contacts with experience/education JSON fields
- **jobs** - Job applications with status tracking ('interested' | 'applied' | 'interviewing' | 'onhold' | 'offered' | 'rejected')
- **interactions** - Contact communication log
- **email_reminders** - Scheduled email system with timezone support
- **job_contacts** - Many-to-many relationship between jobs and contacts

### Authentication & Authorization
- Supabase middleware (`middleware.ts`) handles session refresh
- Row Level Security (RLS) enforced via `user_id` field on all tables
- Client-side auth state managed via `@supabase/auth-helpers-nextjs`
- API routes use `createRouteHandlerClient` for server-side auth

## Key Components

### Landing Page (`src/components/LandingPage.tsx`)
Marketing landing page shown to unauthenticated users:
- **Design**: Split-screen layout with Montserrat Black headlines and Manrope Regular body text
- **Copy**: Tweet-sized (under 280 chars), personality-driven messaging
- **CTA**: "See Who Can Help You in 30 Seconds" - transformational value proposition
- **Preview**: Accurate 3-column grid showing Network tab with 6 anonymized contact cards
- **Authentication**: Modal with Google OAuth (primary) + email/password (secondary)
- **Fonts**: Custom font pairing for impact and readability

### Main Application (`src/app/page.tsx`)
Shows landing page for unauthenticated users, dashboard for authenticated users.

Tab-based dashboard with four main sections:
- **Job Pipeline**: Job application tracking with status filters
- **Network**: Contact management with pagination and search (3-column grid layout)
- **Reporting**: Analytics and insights dashboard
- **Data Hub**: CSV import/export functionality

### API Patterns
All API routes follow consistent patterns:
- User authentication check via Supabase client
- Graceful handling of unauthenticated requests (return empty data vs 401)
- Pagination with offset/limit parameters
- Search functionality via Supabase `ilike` queries
- Proper TypeScript typing for request/response objects

### n8n Automation Integration
**Contact Update via PDF Processing** (`/api/n8n/contacts`):
- **Automated workflow**: PDFs dropped in `/data/resumes/incoming/` are processed every 5 minutes
- **LinkedIn URL matching**: Primary method for identifying existing contacts
  - If LinkedIn URL matches existing contact → **UPDATE** with new data
  - If no match found → **CREATE** new contact
- **Smart data merging**:
  - PDF data takes priority (all fields replaced with new data)
  - Historical data preserved in `notes` field with timestamps
  - Old experience/education entries archived in JSON format
  - User-entered notes preserved after historical data
- **Authentication**: API key-based (`x-api-key` header with `N8N_API_KEY` env var)
- **Cost**: ~$0.02-0.03 per resume (Claude API for data extraction)
- **Workflow**: PDF → pdfjs-dist extraction → Claude API → POST to endpoint → Move to processed folder

### n8n Docker Image Notes
- Pull from `docker.n8n.io/n8nio/n8n` (current registry) — `n8nio/n8n` on Docker Hub may lag months behind
- Latest n8n image is **distroless** (no shell, no package manager) — installing tools requires multi-stage Docker build; see `../job-tracker-private/n8n-automation/Dockerfile` for pattern
- When rebuilding custom image after base image update: `docker compose build --pull --no-cache`

### n8n 2.x Breaking Changes (upgraded March 2026)
- **`executeCommand` node removed** — replaced with Code node using Node.js child_process execSync
- **Code node requires env var** to use built-in modules: `NODE_FUNCTION_ALLOW_BUILTIN=child_process` in docker-compose
- **File access restricted by default** — set `N8N_RESTRICT_FILE_ACCESS_TO=/home/node/.n8n-files;/data/resumes` (semicolon-separated) in docker-compose
- **Node name references in Code nodes** — after replacing old `Execute Command` nodes, update any references to `$('Execute Command')` to match the new node names

### Component Architecture
- Client components use `'use client'` directive
- Supabase client created via `createClientComponentClient()`
- Form handling with controlled components
- Modal dialogs for data entry/editing using right-slide panel design
- Responsive design with TailwindCSS utilities

### Modal Design Pattern
All modals use a consistent right-slide panel pattern:
- **Slide-in animation**: Smooth 300ms transition from right edge
- **Backdrop**: Subtle 20% opacity backdrop (clickable to close)
- **Sizing**: 700-800px wide on desktop, full width on mobile
- **Layout**: Flex-based with fixed header and scrollable content
- **Mobile optimization**: Two-row header layout for better button fit
- **Background visibility**: Main content remains visible during modal interaction

Modal components implementing this pattern:
- `ContactForm.tsx` - Contact creation/editing
- `JobForm.tsx` - Job application management
- `CreateReminderModal.tsx` - Email reminder scheduling
- `ReminderDetailsModal.tsx` - Reminder detail view
- `ContactModal` (in ContactList.tsx) - Contact quick view
- `JobContactManager.tsx` - Job-contact relationship management

### Opening a Contact Detail Modal Programmatically
- Use `getContactById(id)` → `setEditingContact()` → `setShowForm(true)` — do NOT try to select a contact in the grid
- `displayedContactsCount` starts at 20 (paginated); contacts beyond the first page won't be highlighted/visible if selected via `setSelectedContactId`
- On mobile, interactions bottom sheet requires `setShowMobileInteractions(true)` separately from `setSelectedContactId`

## Development Patterns

### TypeScript Usage
- Strict TypeScript configuration with path aliases (`@/*` maps to `./src/*`)
- Comprehensive type definitions in `src/lib/types/`
- Interface-driven development with proper type exports
- Database types mirror Supabase table schemas

### State Management
- React hooks for local state (useState, useEffect)
- Supabase real-time subscriptions for live data
- Auth state managed globally via Supabase context
- No external state management library (Redux, Zustand) used

### Error Handling
- API routes return appropriate HTTP status codes
- Client-side error boundaries for component failures
- Graceful degradation for authentication failures
- Console logging for debugging (should be replaced with proper logging in production)

### Email Reminders System
Sophisticated scheduling system with:
- Timezone-aware scheduling with user preference storage
- Rate limiting (max 100 active, 15 daily reminders)
- Status tracking (pending/sent/failed/cancelled)
- Integration with jobs and contacts for contextual reminders
- Supabase Edge Functions for email processing

### Gmail/Calendar Auto-Sourced Interactions
Auto-creates interactions from Gmail threads and Calendar events, with a
confidence-gated review queue, learned email aliases, and self-cancelling
follow-up reminders.

- **Edge Function** `sync-google-interactions` runs **daily at 09:00 UTC**
  (`0 9 * * *` = 05:00 ET), scheduled via `pg_cron` + `net.http_post` (same
  mechanism as `process-email-reminders`; the cron SQL is migration
  `0002_sync_google_interactions_cron.sql`, run in the Supabase SQL editor).
- **One-time setup**: `npm run oauth:setup` (interactive; needs
  `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_TOKEN_ENC_KEY` 32-byte hex,
  `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_USER_ID`). Obtains the Google refresh
  token, encrypts it (AES-256-GCM), seeds `sync_identity`.
- **Token security**: refresh token is AES-256-GCM encrypted at rest;
  `GOOGLE_TOKEN_ENC_KEY` lives only in the Edge Function secret + local setup
  env, never in DB/repo. Rotating the key requires re-running setup.
- **Routing**: Calendar events with a confidently-matched contact auto-write
  as interactions; Gmail (always) and any low/no-confidence go to the review
  queue (Network tab → "Detected" card → edit-before-commit panel).
- **Identity matching**: `sync_identity` holds the user's own addresses;
  matching resolves counterparty email → `contacts.email` →
  `contact_email_aliases` (learned on manual assignment) → review.
- **Follow-up rule engine**: tiered open-loop detection (no-reply / post-
  meeting / gone-quiet), thresholds user-editable via the Settings panel
  (`followup_settings`), with a **separate daily budget**
  (`max_auto_followups_per_day`) so automation can't starve manual reminders.
  Auto-followups self-cancel when the contact replies.
- **Observability**: every run records a `sync_runs` row (counts, watermark,
  status); the Detected card surfaces last-sync status / failures.
- **Pure logic** lives in `src/lib/google-sync/` (unit-tested with Vitest)
  and is **vendored** into the Edge Function's `_shared/` dir. The two copies
  must stay byte-identical (modulo `.ts` import suffixes);
  `scripts/check-vendored-sync.sh` enforces this and runs as part of
  `npm test`.
- **Migrations**: new convention — timestamped SQL in `supabase/migrations/`
  (`0001` schema, `0002` cron). Applied via `supabase db push`.
- **Tests**: `npm test` (Vitest; runs the vendored-drift check first).
- **Known v1 limitations**: single Google account; self-cancellation has up
  to one daily-run latency; name-only calendar invites are review-only;
  nullable `interactions.user_id` + partial unique index means a soft-deleted
  synced row could re-create (not exercised in single-user use).

### Form Validation & Auto-Formatting
- **LinkedIn URL auto-prefixing**: Automatically adds `https://` to LinkedIn URLs without protocol
  - Handles n8n-automation workflow compatibility
  - Applied in `ContactForm.tsx` via `handleChange` function
  - Regex check: `/^https?:\/\//i`
- Form fields use controlled components with real-time validation
- Date pickers with month/year selectors for experience and education
- Array fields (experience, education, mutual connections) support dynamic add/remove

## Configuration Notes

### Next.js Configuration
- ESLint and TypeScript errors ignored during builds (see `next.config.ts`)
- Webpack file watching optimized for macOS (native watching, not polling)
- Path aliases configured in `tsconfig.json`
- Incremental TypeScript compilation disabled for better memory efficiency

### Performance Optimizations (2025-11)
The following optimizations have been implemented to reduce CPU and memory usage:
- **Removed Turbopack**: Uses standard webpack bundler for better stability and lower CPU usage
- **Native file watching**: Optimized webpack watchOptions for macOS (ignores node_modules, .git, .next)
- **Memory leak fix**: ExtensionAuthSync component reuses Supabase client instead of creating new instances
- **Disabled incremental compilation**: Prevents TypeScript memory accumulation during development
- **Next.js 15.5.6**: Latest version with memory leak fixes and performance improvements

### Performance Optimizations (2026-02)
Additional runtime and load-time improvements:
- **Image optimization re-enabled**: Removed `images: { unoptimized: true }` from `next.config.ts` — Next.js now serves WebP/AVIF, generates responsive sizes, and lazy-loads images automatically
- **Supabase client moved to module scope** (`src/app/page.tsx`): `createClientComponentClient()` is no longer called inside the component body on every render, eliminating redundant client re-creation
- **Server-side contact search** (`src/components/ContactList.tsx`): Search now delegates to `searchContacts()` (Supabase query with `ilike`) instead of filtering all contacts in JavaScript; debounced search term triggers a fresh server fetch, replacing a 50-line O(n×m) client-side filter across nested arrays

### Bug Fixes (2026-03)
- **Mutual connection link/suggest fix** (`src/components/ContactList.tsx`): Added separate `allContacts` state holding the full unfiltered contact list. Previously `contactNameMap` and the `allContacts` prop to `ContactForm` were built from the search-filtered `contacts` state — when searching for a specific contact, only that contact was in the list, so mutual connection names couldn't be resolved (no blue clickable links) and the auto-suggest dropdown showed no results. Now both use the full list, which is populated on initial load and refreshed after saves/deletes.

### Chrome Extension — LinkedIn DOM Changes (2026-03)
LinkedIn migrated to **fully obfuscated CSS class names** (e.g. `_486a7ca9`). All prior selector-based scraping broke. Files affected: `extension/content/profile.js`.

#### How to diagnose when LinkedIn breaks the extension again
Open DevTools Console on the LinkedIn page and run:
```javascript
// Find the element containing the person's name
document.querySelectorAll('*').forEach(function(el) {
  if (el.children.length === 0 && el.textContent.trim() === 'THEIR NAME HERE') {
    console.log(el.tagName, el.className.substring(0,80));
  }
});
```
Then check the parent chain for any stable `data-*` attributes or IDs to target.

#### Profile name (`getProfileName`)
- LinkedIn dropped `h1` entirely — name now lives in an `h2` (or sometimes `p`) with hashed classes.
- **Fix**: Removed all class-based selectors. Instead, scan all `h1` then `h2` elements and match against a name regex: `^[A-Z][a-zA-ZÀ-ÖØ-öø-ÿ'\-]+(?: [A-Z][a-zA-ZÀ-ÖØ-öø-ÿ'\-]+){1,3}$` (2–4 capitalized words, under 60 chars).
- If this breaks again, run the DevTools snippet above to find what tag/attributes the name now uses.

#### Search results / mutual connections (`extractMutualConnections`)
- LinkedIn dropped all stable `li`/class selectors for search result cards.
- **Fix (Strategy 0)**: Select all `a[href*="/in/"]` links whose **direct parent is a `DIV`** — these are always the card-subject name links. Links with `P` parents are duplicates or mutual-connection previews inside other cards.
- Name is embedded in the link's full text as `"Name • 1stHeadline..."` — split on ` • ` (unicode bullet U+2022) and take the first part.
- If this breaks again, run in DevTools:
  ```javascript
  document.querySelectorAll('a[href*="/in/"]').forEach(function(a, i) {
    if (i > 10) return;
    console.log('a[' + i + '] parent=' + a.parentElement.tagName + ' text="' + a.textContent.trim().substring(0,60) + '"');
  });
  ```
  Then identify which parent tag reliably marks the card-subject link vs. duplicates/previews.

**Expected dev server performance:**
- CPU: 10-20% idle, 30-40% during file edits
- Memory: 400-600 MB (previously 1.09 GB)

### Database Connection
- Dual database support: Supabase for main app, Neon for additional features
- Environment variable fallback chain: `NETLIFY_DATABASE_URL` → `DATABASE_URL` → `NEON_DATABASE_URL`

### Styling
- TailwindCSS 4.x with PostCSS configuration
- Custom gradient backgrounds and modern UI patterns
- Responsive design mobile-first approach
- Lucide React for icons
- Custom animations in `globals.css`:
  - `animate-slide-in-right` - Modal slide-in from right
  - `animate-fade-in` - Fade in effect
  - `animate-slide-up` - Slide up effect
  - `animate-scale-in` - Scale in effect

## Testing & Quality
Currently no automated testing setup. When adding tests:
- Consider Vitest for unit testing (Next.js compatible)
- Playwright for E2E testing
- Mock Supabase client for component tests
- Test database operations with test data