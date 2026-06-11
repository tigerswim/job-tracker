# n8n Security Update Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Claude Code skill (`/n8n-security-update <url>`) that fetches an n8n security advisory, assesses whether it affects Dan's Docker Compose setup, and — on confirmation — rebuilds and restarts the container.

**Architecture:** A single skill markdown file at `~/.claude/skills/n8n-security-update.md`. When invoked, Claude follows the skill's four-phase instructions: fetch advisory via WebFetch, check current container version via Bash, assess relevance against the local docker-compose.yml/Dockerfile/workflows, then prompt for confirmation before running the rebuild.

**Tech Stack:** Claude Code skill system (markdown), Docker Compose, WebFetch, Bash

---

### Task 1: Create the skill file

**Files:**
- Create: `/Users/danhoeller/.claude/skills/n8n-security-update.md`

This is the entire deliverable — one markdown file that instructs Claude how to handle the `/n8n-security-update` invocation.

- [ ] **Step 1: Verify the skills directory exists**

```bash
ls /Users/danhoeller/.claude/skills/
```

Expected: directory listing (may be empty or contain other skills). If it doesn't exist, create it:
```bash
mkdir -p /Users/danhoeller/.claude/skills/
```

- [ ] **Step 2: Write the skill file**

Create `/Users/danhoeller/.claude/skills/n8n-security-update.md` with this exact content:

```markdown
---
name: n8n-security-update
description: Assess an n8n security advisory against the local Docker Compose setup and update if needed. Pass the advisory email URL as the argument.
trigger: /n8n-security-update
---

# n8n Security Update

Assess an n8n security advisory and update the local Docker Compose instance if needed.

**Invocation:** `/n8n-security-update <advisory-url>`

The argument is the URL of the n8n security advisory email (e.g. `https://email.info.n8n.io/deliveries/...`). It is required — if not provided, ask the user to supply it before proceeding.

---

## Key paths (hardcoded for this setup)

- **Compose dir**: `/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation/`
- **Compose file**: `<compose-dir>/docker-compose.yml`
- **Dockerfile**: `<compose-dir>/Dockerfile`
- **Workflows dir**: `<compose-dir>/workflows/`
- **Container service name**: `n8n`

---

## Phase 1 — Fetch and parse the advisory

Use WebFetch on the provided URL. Extract:

1. **Affected version range** — e.g., "versions before 1.48.0" or "< 1.48.0"
2. **Fixed version** — the minimum safe version
3. **CVE identifier(s)** — if present
4. **Severity / CVSS score** — if present
5. **Affected components** — node types, features, API surface, auth, webhooks, community packages, MCP, file access, etc.

If the URL fails to load or contains no parseable advisory content, stop and report clearly. Do not proceed.

---

## Phase 2 — Detect current n8n version

Run:

```bash
docker compose -f "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation/docker-compose.yml" exec n8n n8n --version
```

Parse the version string from the output (e.g., `1.47.3`). Save it as `CURRENT_VERSION`.

**If the container is not running:** report "n8n container is not running — start it first with `docker compose up -d`" and stop.

**If the version string can't be parsed:** report the raw output and ask the user to provide the version manually before continuing.

---

## Phase 3 — Relevance assessment

Cross-reference the advisory's affected scope against the actual setup. Go as deep as the advisory details allow.

### 3a. Version check
Compare `CURRENT_VERSION` against the affected range from Phase 1.
- If current version ≥ fixed version → already patched, report and stop.
- If current version < fixed version → version is affected, continue.
- If range is ambiguous → note "version status unclear" and continue.

### 3b. Feature check
Read the docker-compose.yml at the compose path above. Check which of these features are enabled in Dan's config, and whether the advisory mentions them:

| Feature | Env var to check |
|---|---|
| MCP | `N8N_MCP_ENABLED=true` |
| Community packages | `N8N_COMMUNITY_PACKAGES_ENABLED=true` |
| File access restrictions | `N8N_RESTRICT_FILE_ACCESS_TO` |
| Node.js builtins | `NODE_FUNCTION_ALLOW_BUILTIN` |
| Filesystem binary data | `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` |
| Webhooks | `WEBHOOK_URL` |

### 3c. Node check (if advisory names specific node types)
If the advisory mentions specific n8n node types (e.g., "HTTP Request node", "Execute Command node"), grep the workflows directory:

```bash
grep -r "<node-type-name>" "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation/workflows/" 2>/dev/null
```

Report whether matching nodes are found.

### 3d. Dockerfile check
Read the Dockerfile and note whether the advisory touches anything related to the base image (`n8nio/n8n:stable`) or the pdftotext layer (Alpine build, `pdftotext` binary, shared libs).

### Output a structured verdict:

```
ADVISORY SUMMARY
  CVE: <identifier or "not specified">
  Severity: <severity or "not specified">
  Affected versions: <range>
  Fixed in: <version>
  Affected components: <list>

SETUP ASSESSMENT
  Current version: <version>
  Version affected: YES / NO / UNCLEAR
  Affected features in use: <list, or "none detected">
  Affected nodes in use: <list, or "none found" or "not checked">

RECOMMENDATION: Update required / Update optional / Not applicable
REASON: <one or two plain-English sentences>
```

---

## Phase 4 — Confirm and update

**If recommendation is "Not applicable":** report and stop. No further action.

**If recommendation is "Update required" or "Update optional":**

Show the user the exact commands that will be run:

```
The following commands will be run to update n8n:

  cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation"
  docker compose build --pull --no-cache
  docker compose up -d

This will rebuild the custom Docker image (pulling the latest n8nio/n8n:stable base)
and restart the container. n8n will be unavailable for ~2-3 minutes during the rebuild.

Proceed? (yes/no)
```

Wait for explicit confirmation. If the user says anything other than yes/proceed/y, stop.

**On confirmation — run each command and report output:**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation" && docker compose build --pull --no-cache
```

Then:

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation" && docker compose up -d
```

**Verify the update:**

```bash
docker compose -f "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation/docker-compose.yml" exec n8n n8n --version
```

Report: `Updated: <old-version> → <new-version>`

**If build or restart fails:** surface the full error output. Do not retry automatically. Suggest checking Docker logs:
```bash
docker compose -f "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation/docker-compose.yml" logs n8n --tail 50
```
```

- [ ] **Step 3: Verify the file was created correctly**

```bash
head -5 /Users/danhoeller/.claude/skills/n8n-security-update.md
```

Expected: the frontmatter block starting with `---` and `name: n8n-security-update`.

- [ ] **Step 4: Commit the spec and plan docs**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker"
git add docs/superpowers/specs/2026-06-11-n8n-security-update-skill-design.md
git add docs/superpowers/plans/2026-06-11-n8n-security-update-skill.md
git commit -m "docs: n8n security update skill spec and plan"
```

---

### Task 2: Smoke-test the skill

**Files:**
- Read: `/Users/danhoeller/.claude/skills/n8n-security-update.md` (verify parseable)
- Bash: docker commands against the running container

- [ ] **Step 1: Test version detection**

Verify the version-check command works against the running container:

```bash
docker compose -f "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation/docker-compose.yml" exec n8n n8n --version
```

Expected: a version string like `1.xx.x`. If the container isn't running, start it first:
```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation" && docker compose up -d
```

- [ ] **Step 2: Invoke the skill with the example URL**

Run:
```
/n8n-security-update https://email.info.n8n.io/deliveries/dgSi2gUCANjYnQLX2J0CAZ6x5dZLFxFdkzGcaWz8Jg==
```

Verify:
- Phase 1 fetches and summarizes the advisory
- Phase 2 reports the correct current version
- Phase 3 outputs the structured verdict with all four sub-checks
- Phase 4 shows the commands and asks for confirmation (does NOT execute automatically)

- [ ] **Step 3: Confirm it stops at confirmation prompt**

At the confirmation step, respond "no" and verify the skill stops without running any Docker commands.
