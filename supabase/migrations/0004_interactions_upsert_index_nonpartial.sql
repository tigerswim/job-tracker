-- The idempotent upsert for synced interactions targets
-- ON CONFLICT (user_id, contact_id, source, external_id). Migration 0001
-- created this as a PARTIAL unique index (WHERE external_id IS NOT NULL).
-- PostgreSQL cannot use a partial index for ON CONFLICT unless the statement
-- restates the exact partial predicate, which PostgREST/supabase-js cannot
-- express. Result: every upsert (review-queue confirm AND the edge function's
-- calendar auto-write) failed with 42P10 and silently wrote nothing.
--
-- Recreate the index WITHOUT the partial predicate. Manual interactions have
-- external_id IS NULL; NULLs are distinct in a unique index, so a full index
-- introduces no false collisions for them. Correctness over the minor
-- index-size optimization the predicate provided.

drop index if exists interactions_external_uidx;

create unique index if not exists interactions_external_uidx
  on interactions (user_id, contact_id, source, external_id);
