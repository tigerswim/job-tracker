# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with TurboNext (port 3000)
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
- Modal dialogs for data entry/editing
- Responsive design with TailwindCSS utilities

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

## Configuration Notes

### Next.js Configuration
- ESLint and TypeScript errors ignored during builds (see `next.config.js`)
- TurboNext enabled for development
- Path aliases configured in `tsconfig.json`

### Database Connection
- Dual database support: Supabase for main app, Neon for additional features
- Environment variable fallback chain: `NETLIFY_DATABASE_URL` → `DATABASE_URL` → `NEON_DATABASE_URL`

### Styling
- TailwindCSS 4.x with PostCSS configuration
- Custom gradient backgrounds and modern UI patterns
- Responsive design mobile-first approach
- Lucide React for icons

## Testing & Quality
Currently no automated testing setup. When adding tests:
- Consider Vitest for unit testing (Next.js compatible)
- Playwright for E2E testing
- Mock Supabase client for component tests
- Test database operations with test data