# Obsidian Sync Script — Design Spec

**Date:** 2026-04-06
**Status:** Draft

## Overview

A standalone TypeScript script (`scripts/sync-to-obsidian.ts`) that syncs Jobs, Contacts, and Interactions from Supabase into the Obsidian vault at `/Users/danhoeller/Obsidian/SecondBrain/`. The script generates markdown files with YAML frontmatter and `[[wikilinks]]` that cross-link People, Jobs, Interactions, and existing Granola meeting notes.

Job Tracker remains the system of record. Obsidian files are read-only outputs — all editing happens in Job Tracker, and the script overwrites files on each sync.

## Authentication

Uses Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`) to bypass RLS and read all data directly. No need to run the dev server.

## Vault Output Structure

```
SecondBrain/
├── People/
│   └── Lee Frohman.md
├── Conversations/
│   ├── Interactions/
│   │   └── 2026-02-25 - Lee Frohman - Video Call.md
│   └── Granola/                 ← Granola plugin reconfigured to write here
│       ├── 02.25.26 Lee Frohman (Dunwoody Group).md
│       └── Transcripts/
├── Job Search/
│   ├── Jobs/
│   │   └── VP Marketing - Acme Corp.md
│   └── _archived/              ← deleted records moved here
└── _sync-metadata.json
```

## Filename Conventions

- **People:** `{name}.md` — e.g., `Lee Frohman.md`
- **Jobs:** `{job_title} - {company}.md` — e.g., `VP Marketing - Acme Corp.md`
- **Interactions:** `{date} - {contact_name} - {type}.md` — e.g., `2026-02-25 - Lee Frohman - Video Call.md`

Filenames are sanitized (slashes, colons, special characters removed). The `_sync-metadata.json` (at vault root) maps Supabase UUIDs to filenames so renames are handled (old file archived, new file created).

## Note Formats

### People Note (`People/{name}.md`)

```markdown
---
sync_id: {uuid}
synced_from: job-tracker
company: {company}
job_title: {job_title}
location: {current_location}
linkedin: {linkedin_url}
email: {email}
phone: {phone}
updated: {updated_at date}
---
# {name}
**{company}** · {job_title} · {current_location}

## Experience
- **{title}**, {company} ({start_date} – {end_date|Present})

## Education
- {degree_and_field}, {institution} ({year})

## Mutual Connections
- [[{connection_name}]]

## Linked Jobs
- [[{job_title} - {company}]]

## Notes
{notes field from Job Tracker}
```

Empty sections (no experience, no education, no mutual connections, no linked jobs, no notes) are omitted entirely.

### Job Note (`Job Search/Jobs/{title} - {company}.md`)

```markdown
---
sync_id: {uuid}
synced_from: job-tracker
status: {status}
company: {company}
applied_date: {applied_date}
salary: {salary}
location: {location}
job_url: {job_url}
updated: {updated_at date}
---
# {job_title} - {company}
**Status:** {status} · **Applied:** {applied_date} · **Salary:** {salary}

## Contacts
- [[{contact_name}]]

## Notes
{notes field}

## Job Description
{job_description field}
```

Empty sections omitted. Reading order: header info → linked contacts → personal notes → job description (longest, least-referenced content at the bottom).

### Interaction Note (`Conversations/Interactions/{date} - {name} - {type}.md`)

```markdown
---
sync_id: {uuid}
synced_from: job-tracker
type: {type}
date: {date}
contact: "[[{contact_name}]]"
---
# {date} · {Type Label} with [[{contact_name}]]

{summary}

## Notes
{notes field}

## Related Jobs
- [[{job_title} - {company}]]
```

Related Jobs derived by looking up what jobs the interaction's contact is linked to via `job_contacts`.

### Granola Append

For each Granola summary file (not transcripts) where a contact name is found in the filename, append or update:

```markdown

## Linked Contacts
- [[{contact_name}]]
```

If `## Linked Contacts` already exists in the file, replace that section. Never duplicate.

## Sync Logic

### State Tracking (`_sync-metadata.json`)

```json
{
  "last_sync": "2026-04-06T12:00:00Z",
  "records": {
    "{uuid}": {
      "type": "contact|job|interaction",
      "filename": "People/Lee Frohman.md",
      "updated_at": "2026-03-15T10:00:00Z"
    }
  }
}
```

### Per-Record Logic

1. **New record** (UUID not in metadata) → create file
2. **Updated record** (UUID in metadata, `updated_at` newer) → overwrite file
3. **Deleted record** (UUID in metadata, not in Supabase) → move file to `_archived/`

Full overwrite on update — synced files are not meant to be edited in Obsidian.

### Cross-Linking

| Link Type | Source |
|-----------|--------|
| Contact ↔ Job | `job_contacts` join table — bidirectional wikilinks |
| Interaction → Contact | `contact_id` field on interaction |
| Interaction → Jobs | Derived: contact's linked jobs via `job_contacts` |
| Contact → Mutual Connections | `mutual_connections` array — each as `[[wikilink]]` |
| Granola → Contact | Filename substring match against full contact names |

### Granola Name Matching

- Build list of all contact full names from Supabase
- For each Granola summary file, check if any full name (first + last) appears in the filename
- Case-insensitive substring match
- Multiple matches → link all
- Never match partial/single names to avoid false positives
- Only modify summary notes (in `Conversations/Granola/`), never transcripts (in `Conversations/Granola/Transcripts/`)

## Execution

- **Command:** `npm run sync:obsidian` (runs `npx tsx scripts/sync-to-obsidian.ts`)
- **Manual invocation** — no cron, no scheduled runs
- **Config:** Vault path and Supabase credentials read from `.env.local`
- **Environment variable:** `OBSIDIAN_VAULT_PATH=/Users/danhoeller/Obsidian/SecondBrain` added to `.env.local`

## Dependencies

- `@supabase/supabase-js` (already installed)
- `tsx` (for running TypeScript directly)
- Node.js `fs` and `path` (built-in)
- No new npm packages required

## Out of Scope

- Bidirectional sync (Obsidian → Job Tracker)
- Obsidian plugin
- Automated scheduling
- Transcript modification
- Creating/modifying any Obsidian settings or plugins
