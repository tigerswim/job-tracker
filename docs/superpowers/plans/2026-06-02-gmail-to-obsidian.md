# Gmail → Obsidian Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an n8n workflow that watches for Gmail threads labeled `To Obsidian` and writes them as markdown notes to `~/Obsidian/SecondBrain/Inbox/`, then swaps labels to `Obsidian/Done` as an audit trail.

**Architecture:** A Schedule Trigger polls Gmail every 5 minutes for threads labeled `To Obsidian`. For each result, a Code node formats a minimal markdown note and writes it directly to the vault via a Docker volume mount. Gmail labels are swapped after a successful write so failed writes auto-retry on the next poll.

**Tech Stack:** n8n (self-hosted Docker), Gmail OAuth2 credential, Node.js `fs` module in Code node, Docker volume mount.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `job-tracker-private/n8n-automation/docker-compose.yml` | Modify | Add vault volume mount + extend `N8N_RESTRICT_FILE_ACCESS_TO` |
| `job-tracker-private/n8n-automation/workflows/gmail-to-obsidian.json` | Create | Exported n8n workflow JSON (source-of-truth for the workflow) |

---

## Prerequisites (manual steps before starting)

- [ ] **Create Gmail labels**
  In Gmail (web), go to Settings → Labels → Create new label:
  1. `To Obsidian`
  2. `Obsidian/Done` (Gmail will nest this under `Obsidian` automatically)

- [ ] **Confirm Obsidian Inbox folder exists**
  ```bash
  ls ~/Obsidian/SecondBrain/Inbox/
  ```
  If missing, create it: `mkdir -p ~/Obsidian/SecondBrain/Inbox/`

---

## Task 1: Add vault volume mount to Docker Compose

**Files:**
- Modify: `job-tracker-private/n8n-automation/docker-compose.yml`

- [ ] **Step 1: Add the volume mount**

  In the `n8n` service `volumes` block, add the vault Inbox path:

  ```yaml
  volumes:
    - n8n_data:/home/node/.n8n
    - "./resumes:/data/resumes"
    - "/Users/danhoeller/Obsidian/SecondBrain/Inbox:/obsidian-inbox"
  ```

- [ ] **Step 2: Extend N8N_RESTRICT_FILE_ACCESS_TO**

  Update the environment variable to include the new mount:

  ```yaml
  - N8N_RESTRICT_FILE_ACCESS_TO=/home/node/.n8n-files;/data/resumes;/obsidian-inbox
  ```

- [ ] **Step 3: Restart n8n to apply changes**

  ```bash
  cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/Projects/job-tracker-private/n8n-automation"
  docker compose up -d
  ```

  Expected output: `Container n8n-automation-n8n-1 Started`

- [ ] **Step 4: Verify mount is live**

  ```bash
  docker exec n8n-automation-n8n-1 ls /obsidian-inbox
  ```

  Expected: lists the contents of `~/Obsidian/SecondBrain/Inbox/` (empty or existing files). No "No such file or directory" error.

- [ ] **Step 5: Commit**

  ```bash
  cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/Projects/job-tracker-private/n8n-automation"
  git add docker-compose.yml
  git commit -m "feat: mount Obsidian Inbox into n8n container for Gmail capture"
  ```

---

## Task 2: Build and export the n8n workflow

**Files:**
- Create: `job-tracker-private/n8n-automation/workflows/gmail-to-obsidian.json`

This task is done entirely in the n8n UI at http://localhost:5678. Build the workflow node by node, then export it.

### 2a: Set up Gmail OAuth2 credential

- [ ] **Step 1: Check for existing Google credential**

  In n8n UI → Credentials → search for "Google". If a Google OAuth2 credential exists with Gmail scope, note its name — you'll reuse it in steps below. Skip to 2b if found.

- [ ] **Step 2: Create new Gmail OAuth2 credential (if needed)**

  n8n UI → Credentials → Add Credential → "Gmail OAuth2 API":
  - Client ID: paste from Google Cloud Console (project with Gmail API enabled)
  - Client Secret: paste from Google Cloud Console
  - Click "Sign in with Google" → authorize with danhoeller@gmail.com
  - Confirm the scope includes `https://www.googleapis.com/auth/gmail.modify`
  - Save as `Gmail - Dan`

### 2b: Build the workflow nodes

- [ ] **Step 1: Create new workflow**

  n8n UI → New Workflow → name it `Gmail → Obsidian Inbox`

- [ ] **Step 2: Add Schedule Trigger node**

  - Node type: `Schedule Trigger`
  - Trigger interval: Every 5 minutes
  - Leave all other settings default

- [ ] **Step 3: Add Gmail node — Search Threads**

  - Node type: `Gmail`
  - Credential: select your Gmail OAuth2 credential
  - Resource: `Thread`
  - Operation: `Get Many`
  - Filters → Label Names: `To Obsidian`
  - Return All: OFF; Limit: `10`
  - Additional Fields → Format: `Simple`

  This returns an array of thread objects. n8n automatically branches execution for each item.

- [ ] **Step 4: Add Gmail node — Get Thread (full content)**

  - Node type: `Gmail`
  - Credential: same as above
  - Resource: `Thread`
  - Operation: `Get`
  - Thread ID: `{{ $json.id }}` (expression mode)
  - Additional Fields → Format: `Full`

  This fetches the complete thread so we can extract the email body.

- [ ] **Step 5: Add Code node — Format Note**

  - Node type: `Code`
  - Mode: `Run Once for Each Item`
  - Language: JavaScript

  Paste this complete code:

  ```javascript
  const thread = $input.item.json;

  // Get the most recent message in the thread
  const messages = thread.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) {
    throw new Error('Thread has no messages: ' + thread.id);
  }

  // Extract headers
  const headers = lastMessage.payload?.headers || [];
  const getHeader = (name) => (headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '');

  const subject = getHeader('Subject') || '(no subject)';
  const from = getHeader('From') || '';
  const dateHeader = getHeader('Date');

  // Parse date to YYYY-MM-DD
  const parsedDate = dateHeader ? new Date(dateHeader) : new Date();
  const dateStr = parsedDate.toISOString().split('T')[0];

  // Extract plain text body from the message parts
  function extractBody(payload) {
    if (!payload) return '';
    
    // Direct plain text part
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    
    // Multipart: prefer text/plain
    if (payload.parts) {
      const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        return Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
      // Fallback: recurse into first part
      for (const part of payload.parts) {
        const result = extractBody(part);
        if (result) return result;
      }
    }
    
    return '';
  }

  const body = extractBody(lastMessage.payload);

  // Sanitize subject for filename: keep alphanumeric, spaces, hyphens, underscores
  const sanitizedSubject = subject
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60);

  const filename = `${dateStr} - ${sanitizedSubject}.md`;

  // Build frontmatter + body
  const noteContent = `---
date: ${dateStr}
from: ${from}
subject: ${subject}
---

# ${subject}

${body.trim()}
`;

  return {
    json: {
      threadId: thread.id,
      filename,
      noteContent,
    }
  };
  ```

- [ ] **Step 6: Add Code node — Write File**

  - Node type: `Code`
  - Mode: `Run Once for Each Item`
  - Language: JavaScript

  Paste this complete code:

  ```javascript
  const fs = require('fs');
  const path = require('path');

  const inboxDir = '/obsidian-inbox';
  let filename = $input.item.json.filename;
  const noteContent = $input.item.json.noteContent;
  const threadId = $input.item.json.threadId;

  // Handle filename collisions
  let targetPath = path.join(inboxDir, filename);
  if (fs.existsSync(targetPath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let counter = 2;
    while (fs.existsSync(path.join(inboxDir, `${base} (${counter})${ext}`))) {
      counter++;
    }
    filename = `${base} (${counter})${ext}`;
    targetPath = path.join(inboxDir, filename);
  }

  fs.writeFileSync(targetPath, noteContent, 'utf-8');

  return {
    json: {
      threadId,
      filename,
      writtenTo: targetPath,
    }
  };
  ```

- [ ] **Step 7: Add Gmail node — Remove Label**

  - Node type: `Gmail`
  - Credential: same as above
  - Resource: `Thread`
  - Operation: `Remove Label`
  - Thread ID: `{{ $json.threadId }}` (expression mode)
  - Labels: `To Obsidian`

- [ ] **Step 8: Add Gmail node — Add Label**

  - Node type: `Gmail`
  - Credential: same as above
  - Resource: `Thread`
  - Operation: `Add Label`
  - Thread ID: `{{ $json.threadId }}` (expression mode)
  - Labels: `Obsidian/Done`

- [ ] **Step 9: Connect the nodes in order**

  Schedule Trigger → Search Threads → Get Thread → Format Note → Write File → Remove Label → Add Label

- [ ] **Step 10: Activate the workflow**

  Toggle the workflow to Active (top-right switch in n8n UI).

### 2c: Export and commit the workflow

- [ ] **Step 1: Export workflow JSON**

  In n8n UI → open the workflow → three-dot menu → Download. Save the file as:
  ```
  job-tracker-private/n8n-automation/workflows/gmail-to-obsidian.json
  ```

- [ ] **Step 2: Create workflows directory if needed**

  ```bash
  mkdir -p "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/Projects/job-tracker-private/n8n-automation/workflows"
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/Projects/job-tracker-private/n8n-automation"
  git add workflows/gmail-to-obsidian.json
  git commit -m "feat: add Gmail → Obsidian Inbox n8n workflow"
  ```

---

## Task 3: Verify end-to-end

- [ ] **Step 1: Apply `To Obsidian` label to a real email in Gmail**

  Open any email in Gmail (web or mobile) → label it `To Obsidian`.

- [ ] **Step 2: Wait up to 5 minutes, then check the Inbox**

  ```bash
  ls -lt ~/Obsidian/SecondBrain/Inbox/ | head -5
  ```

  Expected: a new `.md` file with today's date prefix.

- [ ] **Step 3: Verify note content**

  ```bash
  cat ~/Obsidian/SecondBrain/Inbox/<filename>.md
  ```

  Expected: YAML frontmatter with `date`, `from`, `subject` fields, followed by `# Subject` heading and email body.

- [ ] **Step 4: Verify label swap in Gmail**

  Open the email in Gmail. Confirm:
  - `To Obsidian` label is **gone**
  - `Obsidian/Done` label is **present**

- [ ] **Step 5: Test collision handling**

  Apply `To Obsidian` to a second email that produces the same filename (same date + same subject). Wait for the next poll cycle. Confirm two distinct files exist:
  - `2026-06-02 - Subject.md`
  - `2026-06-02 - Subject (2).md`

- [ ] **Step 6: Check n8n execution log for any errors**

  n8n UI → Executions → review the last few runs. All nodes should show green. If any node is red, click it to see the error message.

---

## Troubleshooting Reference

| Symptom | Check |
|---------|-------|
| File not written, `To Obsidian` label still present | Write File node failed — check n8n execution log; confirm `/obsidian-inbox` is mounted (`docker exec n8n-automation-n8n-1 ls /obsidian-inbox`) |
| File written but label not swapped | Remove Label / Add Label node failed — confirm Gmail credential has `gmail.modify` scope |
| Note body is empty | Email may be HTML-only — the Format Note code extracts `text/plain` parts; HTML-only emails will produce an empty body (acceptable for v1) |
| Workflow not triggering | Confirm workflow is Active (toggle in n8n UI); confirm Schedule Trigger is set to 5-minute interval |
| `N8N_RESTRICT_FILE_ACCESS_TO` error in logs | Confirm `/obsidian-inbox` is in the env var and container was restarted after the change |
