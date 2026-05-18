-- The Google refresh token is stored as application-layer AES-256-GCM
-- ciphertext + IV. Writing these via supabase-js as Node Buffers serialized
-- to bytea as JSON ({"type":"Buffer","data":[...]}), corrupting the
-- round-trip. Store the base64 strings directly in text columns instead:
-- unambiguous, identical across Node (setup script) and Deno (edge function),
-- no bytea wire-format dependency.
--
-- Existing rows hold the corrupted JSON-Buffer representation and cannot be
-- salvaged. Delete them FIRST (the columns are NOT NULL, so the type change
-- must run against an empty table), then convert the now-empty columns.
-- NOT NULL is intentionally preserved: a token row without a token is invalid.

delete from google_oauth_tokens;

alter table google_oauth_tokens
  alter column refresh_token_encrypted type text using refresh_token_encrypted::text,
  alter column refresh_token_iv type text using refresh_token_iv::text;
