# Obsidian Sync Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI script that syncs Jobs, Contacts, and Interactions from Supabase into an Obsidian vault as cross-linked markdown files.

**Architecture:** Single TypeScript file (`scripts/sync-to-obsidian.ts`) reads from Supabase using a service role key, generates markdown with YAML frontmatter and `[[wikilinks]]`, and writes to the Obsidian vault. A `_sync-metadata.json` file at the vault root tracks UUIDs-to-filenames for incremental updates and deletion detection.

**Tech Stack:** TypeScript, `@supabase/supabase-js` (existing), `dotenv` (new), `tsx` (available via npx), Node.js `fs/promises` and `path` (built-in).

**Spec:** `docs/superpowers/specs/2026-04-06-obsidian-sync-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/sync-to-obsidian.ts` | Main script: fetch data, generate markdown, write files, manage sync state |
| `package.json` | Add `sync:obsidian` script, add `dotenv` dependency |
| `.env.local` | Add `SUPABASE_SERVICE_ROLE_KEY` and `OBSIDIAN_VAULT_PATH` (manual step) |

This is a single-file script — no need for multiple modules. All logic lives in `scripts/sync-to-obsidian.ts`.

---

### Task 1: Project Setup

**Files:**
- Modify: `package.json`
- Create: `scripts/sync-to-obsidian.ts`

- [ ] **Step 1: Install dotenv**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/Projects/job-tracker"
npm install dotenv
```

- [ ] **Step 2: Add sync:obsidian script to package.json**

In `package.json`, add to the `"scripts"` section:

```json
"sync:obsidian": "npx tsx scripts/sync-to-obsidian.ts"
```

- [ ] **Step 3: Create the script skeleton**

Create `scripts/sync-to-obsidian.ts`:

```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import * as path from 'path'

// --- Config ---

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!VAULT_PATH || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: OBSIDIAN_VAULT_PATH, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const PEOPLE_DIR = path.join(VAULT_PATH, 'People')
const JOBS_DIR = path.join(VAULT_PATH, 'Job Search', 'Jobs')
const INTERACTIONS_DIR = path.join(VAULT_PATH, 'Conversations', 'Interactions')
const ARCHIVED_DIR = path.join(VAULT_PATH, 'Job Search', '_archived')
const GRANOLA_DIR = path.join(VAULT_PATH, 'Conversations', 'Granola')
const METADATA_PATH = path.join(VAULT_PATH, '_sync-metadata.json')

// --- Types ---

interface SyncRecord {
  type: 'contact' | 'job' | 'interaction'
  filename: string
  updated_at: string
}

interface SyncMetadata {
  last_sync: string
  records: Record<string, SyncRecord>
}

// --- Main ---

async function main() {
  console.log('Starting Obsidian sync...')

  // Ensure directories exist
  await fs.mkdir(PEOPLE_DIR, { recursive: true })
  await fs.mkdir(JOBS_DIR, { recursive: true })
  await fs.mkdir(INTERACTIONS_DIR, { recursive: true })
  await fs.mkdir(ARCHIVED_DIR, { recursive: true })

  // Load sync metadata
  const metadata = await loadMetadata()

  // Fetch all data from Supabase
  const [contacts, jobs, interactions, jobContacts] = await Promise.all([
    fetchAll('contacts'),
    fetchAll('jobs'),
    fetchAll('interactions'),
    fetchAll('job_contacts'),
  ])

  console.log(`Fetched: ${contacts.length} contacts, ${jobs.length} jobs, ${interactions.length} interactions, ${jobContacts.length} job-contact links`)

  // Build lookup maps
  const contactMap = new Map(contacts.map((c: any) => [c.id, c]))
  const jobMap = new Map(jobs.map((j: any) => [j.id, j]))

  // Build job_contacts bidirectional maps
  const jobToContacts = new Map<string, string[]>()
  const contactToJobs = new Map<string, string[]>()
  for (const jc of jobContacts) {
    const existing = jobToContacts.get(jc.job_id) || []
    existing.push(jc.contact_id)
    jobToContacts.set(jc.job_id, existing)

    const existing2 = contactToJobs.get(jc.contact_id) || []
    existing2.push(jc.job_id)
    contactToJobs.set(jc.contact_id, existing2)
  }

  // Track which UUIDs we see this run (for deletion detection)
  const seenIds = new Set<string>()

  // Sync contacts
  for (const contact of contacts) {
    seenIds.add(contact.id)
    const linkedJobIds = contactToJobs.get(contact.id) || []
    const linkedJobs = linkedJobIds.map(id => jobMap.get(id)).filter(Boolean)
    const filename = path.join('People', sanitizeFilename(contact.name) + '.md')
    const content = generateContactNote(contact, linkedJobs)
    await writeNote(path.join(VAULT_PATH, filename), content)
    metadata.records[contact.id] = { type: 'contact', filename, updated_at: contact.updated_at }
  }

  // Sync jobs
  for (const job of jobs) {
    seenIds.add(job.id)
    const linkedContactIds = jobToContacts.get(job.id) || []
    const linkedContacts = linkedContactIds.map(id => contactMap.get(id)).filter(Boolean)
    const filename = path.join('Job Search', 'Jobs', sanitizeFilename(`${job.job_title} - ${job.company}`) + '.md')
    const content = generateJobNote(job, linkedContacts)
    await writeNote(path.join(VAULT_PATH, filename), content)
    metadata.records[job.id] = { type: 'job', filename, updated_at: job.updated_at }
  }

  // Sync interactions
  for (const interaction of interactions) {
    seenIds.add(interaction.id)
    const contact = contactMap.get(interaction.contact_id)
    const contactName = contact?.name || 'Unknown'
    const contactJobIds = contactToJobs.get(interaction.contact_id) || []
    const relatedJobs = contactJobIds.map(id => jobMap.get(id)).filter(Boolean)
    const typeLabel = formatInteractionType(interaction.type)
    const filename = path.join('Conversations', 'Interactions', sanitizeFilename(`${interaction.date} - ${contactName} - ${typeLabel}`) + '.md')
    const content = generateInteractionNote(interaction, contactName, relatedJobs)
    await writeNote(path.join(VAULT_PATH, filename), content)
    metadata.records[interaction.id] = { type: 'interaction', filename, updated_at: interaction.updated_at }
  }

  // Archive deleted records
  const deletedIds = Object.keys(metadata.records).filter(id => !seenIds.has(id))
  for (const id of deletedIds) {
    const record = metadata.records[id]
    const sourcePath = path.join(VAULT_PATH, record.filename)
    const archivePath = path.join(ARCHIVED_DIR, path.basename(record.filename))
    try {
      await fs.rename(sourcePath, archivePath)
      console.log(`Archived: ${record.filename}`)
    } catch {
      // File may already be gone — that's fine
    }
    delete metadata.records[id]
  }

  // Link Granola summaries
  await linkGranolaSummaries(contacts)

  // Save metadata
  metadata.last_sync = new Date().toISOString()
  await fs.writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2))

  console.log(`Sync complete. ${contacts.length} contacts, ${jobs.length} jobs, ${interactions.length} interactions. ${deletedIds.length} archived.`)
}

main().catch(err => {
  console.error('Sync failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Verify env vars are documented**

Print a reminder to the console that the user should add to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OBSIDIAN_VAULT_PATH=/Users/danhoeller/Obsidian/SecondBrain
```

(This is just a note — the script already checks for these and exits with a clear error if missing.)

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-to-obsidian.ts package.json package-lock.json
git commit -m "feat: scaffold Obsidian sync script with config and main loop"
```

---

### Task 2: Helper Functions

**Files:**
- Modify: `scripts/sync-to-obsidian.ts`

Add these functions above `main()` in the script.

- [ ] **Step 1: Add fetchAll helper**

```typescript
async function fetchAll(table: string): Promise<any[]> {
  const allRows: any[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`)
    }
    if (!data || data.length === 0) break

    allRows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return allRows
}
```

- [ ] **Step 2: Add sanitizeFilename helper**

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}
```

- [ ] **Step 3: Add formatInteractionType helper**

```typescript
function formatInteractionType(type: string): string {
  const labels: Record<string, string> = {
    email: 'Email',
    phone: 'Phone',
    video_call: 'Video Call',
    linkedin: 'LinkedIn',
    meeting: 'Meeting',
    other: 'Other',
  }
  return labels[type] || type
}
```

- [ ] **Step 4: Add loadMetadata helper**

```typescript
async function loadMetadata(): Promise<SyncMetadata> {
  try {
    const raw = await fs.readFile(METADATA_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { last_sync: '', records: {} }
  }
}
```

- [ ] **Step 5: Add writeNote helper**

```typescript
async function writeNote(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}
```

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-to-obsidian.ts
git commit -m "feat: add helper functions for Obsidian sync"
```

---

### Task 3: Markdown Generators

**Files:**
- Modify: `scripts/sync-to-obsidian.ts`

Add these functions above `main()`.

- [ ] **Step 1: Add generateContactNote**

```typescript
function generateContactNote(contact: any, linkedJobs: any[]): string {
  const fm: Record<string, string> = {
    sync_id: contact.id,
    synced_from: 'job-tracker',
  }
  if (contact.company) fm.company = contact.company
  if (contact.job_title) fm.job_title = contact.job_title
  if (contact.current_location) fm.location = contact.current_location
  if (contact.linkedin_url) fm.linkedin = contact.linkedin_url
  if (contact.email) fm.email = contact.email
  if (contact.phone) fm.phone = contact.phone
  fm.updated = contact.updated_at?.split('T')[0] || ''

  let md = frontmatter(fm)
  md += `# ${contact.name}\n`

  const tagline = [contact.company, contact.job_title, contact.current_location].filter(Boolean).join(' · ')
  if (tagline) md += `**${tagline}**\n`

  // Experience
  const experience = contact.experience as any[] | undefined
  if (experience && experience.length > 0) {
    md += `\n## Experience\n`
    for (const exp of experience) {
      const end = exp.is_current ? 'Present' : (exp.end_date || '')
      md += `- **${exp.title}**, ${exp.company} (${exp.start_date} – ${end})\n`
      if (exp.description) md += `  ${exp.description}\n`
    }
  }

  // Education
  const education = contact.education as any[] | undefined
  if (education && education.length > 0) {
    md += `\n## Education\n`
    for (const edu of education) {
      md += `- ${edu.degree_and_field}, ${edu.institution} (${edu.year})\n`
      if (edu.notes) md += `  ${edu.notes}\n`
    }
  }

  // Mutual connections
  const mutuals = contact.mutual_connections as string[] | undefined
  if (mutuals && mutuals.length > 0) {
    md += `\n## Mutual Connections\n`
    for (const name of mutuals) {
      md += `- [[${name}]]\n`
    }
  }

  // Linked jobs
  if (linkedJobs.length > 0) {
    md += `\n## Linked Jobs\n`
    for (const job of linkedJobs) {
      md += `- [[${job.job_title} - ${job.company}]]\n`
    }
  }

  // Notes
  if (contact.notes) {
    md += `\n## Notes\n${contact.notes}\n`
  }

  return md
}
```

- [ ] **Step 2: Add generateJobNote**

```typescript
function generateJobNote(job: any, linkedContacts: any[]): string {
  const fm: Record<string, string> = {
    sync_id: job.id,
    synced_from: 'job-tracker',
    status: job.status,
  }
  if (job.company) fm.company = job.company
  if (job.applied_date) fm.applied_date = job.applied_date
  if (job.salary) fm.salary = job.salary
  if (job.location) fm.location = job.location
  if (job.job_url) fm.job_url = job.job_url
  fm.updated = job.updated_at?.split('T')[0] || ''

  let md = frontmatter(fm)
  md += `# ${job.job_title} - ${job.company}\n`

  const details = [
    `**Status:** ${job.status}`,
    job.applied_date ? `**Applied:** ${job.applied_date}` : null,
    job.salary ? `**Salary:** ${job.salary}` : null,
  ].filter(Boolean).join(' · ')
  md += `${details}\n`

  // Contacts
  if (linkedContacts.length > 0) {
    md += `\n## Contacts\n`
    for (const contact of linkedContacts) {
      md += `- [[${contact.name}]]\n`
    }
  }

  // Notes
  if (job.notes) {
    md += `\n## Notes\n${job.notes}\n`
  }

  // Job description
  if (job.job_description) {
    md += `\n## Job Description\n${job.job_description}\n`
  }

  return md
}
```

- [ ] **Step 3: Add generateInteractionNote**

```typescript
function generateInteractionNote(interaction: any, contactName: string, relatedJobs: any[]): string {
  const typeLabel = formatInteractionType(interaction.type)

  const fm: Record<string, string> = {
    sync_id: interaction.id,
    synced_from: 'job-tracker',
    type: interaction.type,
    date: interaction.date,
    contact: `"[[${contactName}]]"`,
  }

  let md = frontmatter(fm)
  md += `# ${interaction.date} · ${typeLabel} with [[${contactName}]]\n\n`
  md += `${interaction.summary}\n`

  // Notes
  if (interaction.notes) {
    md += `\n## Notes\n${interaction.notes}\n`
  }

  // Related jobs
  if (relatedJobs.length > 0) {
    md += `\n## Related Jobs\n`
    for (const job of relatedJobs) {
      md += `- [[${job.job_title} - ${job.company}]]\n`
    }
  }

  return md
}
```

- [ ] **Step 4: Add frontmatter helper**

```typescript
function frontmatter(fields: Record<string, string>): string {
  let yaml = '---\n'
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      // Quote values that contain colons, brackets, or start with special chars
      const needsQuoting = /[:#\[\]{}|>!@`]/.test(value) || value.startsWith('"')
      if (needsQuoting && !value.startsWith('"')) {
        yaml += `${key}: "${value.replace(/"/g, '\\"')}"\n`
      } else {
        yaml += `${key}: ${value}\n`
      }
    }
  }
  yaml += '---\n'
  return yaml
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-to-obsidian.ts
git commit -m "feat: add markdown generators for contacts, jobs, and interactions"
```

---

### Task 4: Granola Linking

**Files:**
- Modify: `scripts/sync-to-obsidian.ts`

- [ ] **Step 1: Add linkGranolaSummaries function**

```typescript
async function linkGranolaSummaries(contacts: any[]): Promise<void> {
  // Check if Granola dir exists
  try {
    await fs.access(GRANOLA_DIR)
  } catch {
    console.log('Granola directory not found, skipping Granola linking.')
    return
  }

  // Build list of full names (first + last, minimum 2 words)
  const contactNames = contacts
    .map(c => c.name as string)
    .filter(name => name.split(' ').length >= 2)

  // Read Granola summary files (not Transcripts subfolder)
  const entries = await fs.readdir(GRANOLA_DIR, { withFileTypes: true })
  const summaryFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)

  let linkedCount = 0

  for (const filename of summaryFiles) {
    const matchedNames: string[] = []
    const lowerFilename = filename.toLowerCase()

    for (const name of contactNames) {
      if (lowerFilename.includes(name.toLowerCase())) {
        matchedNames.push(name)
      }
    }

    if (matchedNames.length === 0) continue

    const filePath = path.join(GRANOLA_DIR, filename)
    let content = await fs.readFile(filePath, 'utf-8')

    // Build the linked contacts section
    const section = '\n## Linked Contacts\n' + matchedNames.map(n => `- [[${n}]]\n`).join('')

    // Replace existing section or append
    const sectionRegex = /\n## Linked Contacts\n[\s\S]*?(?=\n## |\n---|$)/
    if (sectionRegex.test(content)) {
      content = content.replace(sectionRegex, section)
    } else {
      content = content.trimEnd() + '\n' + section
    }

    await fs.writeFile(filePath, content, 'utf-8')
    linkedCount++
  }

  console.log(`Linked ${linkedCount} Granola summaries to contacts.`)
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/sync-to-obsidian.ts
git commit -m "feat: add Granola summary linking to contacts"
```

---

### Task 5: dotenv Config and First Run

**Files:**
- Modify: `.env.local` (manual)

- [ ] **Step 1: Verify dotenv loads .env.local**

The `import 'dotenv/config'` at the top of the script loads `.env` by default. We need it to load `.env.local`. Update the top of `scripts/sync-to-obsidian.ts`:

Replace:
```typescript
import 'dotenv/config'
```

With:
```typescript
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
```

- [ ] **Step 2: Add env vars to .env.local**

Manually add to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard → Settings → API → service_role key>
OBSIDIAN_VAULT_PATH=/Users/danhoeller/Obsidian/SecondBrain
```

- [ ] **Step 3: Move existing Granola folder**

Before running the script, move the Granola folder to its new location:

```bash
mv "/Users/danhoeller/Obsidian/SecondBrain/Granola" "/Users/danhoeller/Obsidian/SecondBrain/Conversations/Granola"
```

Then reconfigure the Granola Obsidian plugin to write to `Conversations/Granola`.

- [ ] **Step 4: Run the sync**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/Projects/job-tracker"
npm run sync:obsidian
```

Expected output:
```
Starting Obsidian sync...
Fetched: N contacts, N jobs, N interactions, N job-contact links
Linked N Granola summaries to contacts.
Sync complete. N contacts, N jobs, N interactions. 0 archived.
```

- [ ] **Step 5: Verify in Obsidian**

Open the vault in Obsidian and check:
- `People/` has one `.md` file per contact
- `Job Search/Jobs/` has one `.md` file per job
- `Conversations/Interactions/` has one `.md` file per interaction
- `[[wikilinks]]` are clickable between People ↔ Jobs ↔ Interactions
- Granola summaries have `## Linked Contacts` sections appended
- Backlinks panel shows cross-references when viewing any note

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-to-obsidian.ts
git commit -m "feat: complete Obsidian sync script with dotenv and Granola linking"
```

---

### Task 6: Test Incremental Sync and Archiving

- [ ] **Step 1: Run sync a second time**

```bash
npm run sync:obsidian
```

Expected: completes without errors, overwrites files with same content. No duplicates.

- [ ] **Step 2: Test archiving**

To test deletion detection, temporarily note a contact's UUID from `_sync-metadata.json`, then:

1. Run sync — all files present
2. Manually add a fake entry to `_sync-metadata.json` with a UUID that doesn't exist in Supabase
3. Create a matching fake `.md` file at the path in the metadata entry
4. Run sync again — the fake file should be moved to `Job Search/_archived/`

- [ ] **Step 3: Verify archived file**

Check that `Job Search/_archived/` contains the fake file. Clean up the fake entry.

- [ ] **Step 4: Final commit**

```bash
git add scripts/sync-to-obsidian.ts package.json package-lock.json
git commit -m "feat: Obsidian sync script — initial release"
```
