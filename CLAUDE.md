# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the job-tracker project.

## Project Overview

job-tracker is a **standalone repository** for a job application and contact management system.

- **Repository**: `https://github.com/tigerswim/job-tracker.git`
- **Deployment**: Netlify (https://job-tracker.kineticbrandpartners.com)
- **Tech Stack**: Next.js 15.5.6, React 19, TypeScript, Tailwind CSS 4, Supabase

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

### Main Application (`src/app/page.tsx`)
Tab-based dashboard with four main sections:
- **Job Pipeline**: Job application tracking with status filters
- **Network**: Contact management with pagination and search
- **Reporting**: Analytics and insights dashboard
- **Data Hub**: CSV import/export functionality

### API Patterns
All API routes follow consistent patterns:
- User authentication check via Supabase client
- Graceful handling of unauthenticated requests (return empty data vs 401)
- Pagination with offset/limit parameters
- Search functionality via Supabase `ilike` queries
- Proper TypeScript typing for request/response objects

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