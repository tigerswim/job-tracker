# Gmail → Obsidian Inbox: Design Spec

**Date:** 2026-06-02  
**Status:** Approved

## Context

Dan occasionally receives emails he wants to capture in Obsidian for later reference or action. The goal is a zero-friction capture mechanism: apply a Gmail label on any device, and the email appears as a markdown note in the Obsidian Inbox within 5 minutes — no copy/paste, no desktop required.

Notes land in `Inbox/` as standalone captures. Dan moves them to the appropriate vault folder manually. This deliberately bypasses Supabase and the contact graph; it's a general-purpose email capture tool, not an interaction logger.

---

## Architecture

```
Gmail (label: "To Obsidian")
        │
        │  poll every 5 min
        ▼
   n8n workflow
        │
        ├─ format markdown note
        ├─ write file → /obsidian-inbox/{date} - {subject}.md
        └─ swap labels: remove "To Obsidian", add "Obsidian/Done"
        
/obsidian-inbox  ←→  Docker volume mount  ←→  ~/Obsidian/SecondBrain/Inbox/
```

---

## Components

### 1. Gmail Labels

Two labels to create manually in Gmail before first use:

| Label | Purpose |
|-------|---------|
| `To Obsidian` | Applied by Dan to trigger capture |
| `Obsidian/Done` | Applied by n8n after successful capture; provides audit trail |

### 2. n8n Workflow

**Nodes (in order):**

1. **Schedule Trigger** — every 5 minutes
2. **Gmail: Search Threads** — query `label:To Obsidian`, max 10 results
3. **Gmail: Get Thread** — fetch full thread content (to get email body)
4. **Code node: Format Note** — builds frontmatter + body markdown
5. **Code node: Write File** — `fs.writeFileSync` to `/obsidian-inbox/{filename}`
6. **Gmail: Remove Label** — removes `To Obsidian` from thread
7. **Gmail: Add Label** — adds `Obsidian/Done` to thread

The workflow processes one thread per execution branch (n8n splits the search results automatically).

### 3. Note Format

```markdown
---
date: YYYY-MM-DD
from: sender@example.com
subject: Email subject here
---

# Email subject here

{plain text body of most recent message in thread}
```

- **Filename:** `YYYY-MM-DD - {sanitized subject}.md`
  - Sanitization: strip characters not in `[a-zA-Z0-9 \-_]`, collapse whitespace, truncate to 60 chars
  - Date: date the email was received (not today's date)
  - If a file with the same name already exists, append ` (2)`, ` (3)`, etc.

### 4. Docker Volume Mount

In `job-tracker-private/n8n-automation/docker-compose.yml`, add to the n8n service volumes:

```yaml
- /Users/danhoeller/Obsidian/SecondBrain/Inbox:/obsidian-inbox
```

Update `N8N_RESTRICT_FILE_ACCESS_TO` to include the new path:

```
N8N_RESTRICT_FILE_ACCESS_TO=/home/node/.n8n-files;/data/resumes;/obsidian-inbox
```

### 5. Gmail Credentials in n8n

Use a Google OAuth2 credential in n8n scoped to Gmail. If a Google credential already exists in n8n (from other workflows), it can be reused provided it has the `https://www.googleapis.com/auth/gmail.modify` scope (needed to add/remove labels).

---

## Error Handling

- If the file write fails (e.g., vault not mounted), the Gmail label swap nodes are not reached — `To Obsidian` label remains, so the email will be retried on the next poll cycle.
- If Gmail API returns no results, the workflow exits cleanly with no action.
- n8n's built-in execution log captures any node-level errors for manual review.

---

## Verification

1. Create both Gmail labels (`To Obsidian`, `Obsidian/Done`)
2. Add the vault volume mount to `docker-compose.yml` and restart n8n (`docker compose up -d`)
3. Import and activate the n8n workflow
4. Apply `To Obsidian` to a real email in Gmail
5. Within 5 minutes: verify the note appears in `~/Obsidian/SecondBrain/Inbox/`
6. Verify the note has correct frontmatter (date, from, subject) and body
7. Verify `To Obsidian` label is removed and `Obsidian/Done` is applied in Gmail
8. Apply the label to a second email; verify a second distinct file is created (no overwrite)
