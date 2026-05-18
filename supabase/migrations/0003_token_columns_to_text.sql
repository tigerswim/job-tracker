-- The Google refresh token is stored as application-layer AES-256-GCM
-- ciphertext + IV. Writing these via supabase-js as Node Buffers serialized
-- to bytea as JSON ({"type":"Buffer","data":[...]}), corrupting the
-- round-trip. Store the base64 strings directly in text columns instead:
-- unambiguous, identical across Node (setup script) and Deno (edge function),
-- no bytea wire-format dependency.
--
-- Existing rows hold the corrupted JSON-Buffer representation and cannot be
-- salvaged; they are cleared so `npm run oauth:setup` re-populates cleanly.

alter table google_oauth_tokens
  alter column refresh_token_encrypted type text
    using null,
  alter column refresh_token_iv type text
    using null;

-- Force a fresh OAuth setup run (old ciphertext was unrecoverable anyway).
delete from google_oauth_tokens;
