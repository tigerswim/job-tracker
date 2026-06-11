# n8n Security Update Skill — Design Spec

**Date:** 2026-06-11  
**Status:** Approved

## Problem

n8n sends periodic security advisory emails. Evaluating each one manually requires:
- Reading the advisory
- Knowing your current n8n version
- Understanding which features/nodes are affected
- Deciding whether your setup is actually vulnerable
- Running the right Docker commands if an update is needed

This is error-prone and easy to skip. A skill makes it fast and consistent.

## Goal

A Claude Code skill invoked with a security advisory URL that: assesses relevance to Dan's specific n8n setup, shows findings, and — on confirmation — pulls and rebuilds the updated container.

## Invocation

```
/n8n-security-update https://email.info.n8n.io/deliveries/<token>
```

The URL argument is required. It points to the security advisory email.

## Setup

- **n8n host**: Mac Mini, local Docker Compose
- **Compose file**: `/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker-private/n8n-automation/docker-compose.yml`
- **Workflows dir**: `.../n8n-automation/workflows/`
- **Container service name**: `n8n`
- **Image**: custom multi-stage build on `n8nio/n8n:stable` (adds `pdftotext`)
- **Key features in use**: MCP (`N8N_MCP_ENABLED=true`), community packages, `child_process` builtins, filesystem binary data, Obsidian + resume mounts

## Phases

### Phase 1 — Fetch advisory
`WebFetch` the provided URL. Extract:
- Affected version range (e.g., "< 1.48.0")
- Fixed version
- CVE identifier(s)
- Affected component(s): node types, features, API surface, auth, etc.
- Severity / CVSS if present

### Phase 2 — Current version
```bash
docker compose -f "<compose-file>" exec n8n n8n --version
```
Parse the version string. If the container isn't running, report that clearly.

### Phase 3 — Relevance assessment
Best-effort cross-reference of advisory scope against Dan's actual config:

1. **Version check**: is current version in the affected range?
2. **Feature check**: read `docker-compose.yml` env vars — does the advisory affect MCP, community packages, file access, specific builtins?
3. **Node check** (if advisory names specific nodes): grep `workflows/*.json` for matching node types
4. **Dockerfile check**: does the advisory touch anything in the base image or the pdftotext layer?

Output a structured verdict:
- `AFFECTED VERSION`: yes / no / unknown
- `AFFECTED FEATURES`: list of matching features, or "none detected"
- `RECOMMENDATION`: **Update required** / Update optional / Not applicable
- Brief plain-English reasoning

### Phase 4 — Confirm and update

If recommendation is "Update required" or "Update optional":
1. Show the exact commands to be run
2. Ask for explicit confirmation before executing
3. On approval:
   ```bash
   cd "<n8n-automation-dir>"
   docker compose build --pull --no-cache
   docker compose up -d
   ```
4. Re-run `docker compose exec n8n n8n --version` to confirm the version bumped
5. Report old version → new version

If "Not applicable": report findings and stop.

## Error handling
- Advisory URL returns non-200 or no parseable content → report clearly, stop
- Container not running → report, offer to start it first
- Version string not parseable → ask user to provide version manually
- Build or restart fails → surface the error output, do not retry automatically

## Automation level
Confirm before update. The skill never modifies the system without showing commands and receiving explicit approval.

## Skill file
`/Users/danhoeller/.claude/skills/n8n-security-update.md`

This is a local personal skill (not in the job-tracker repo). It reads files from the `job-tracker-private` directory.
