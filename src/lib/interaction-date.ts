/**
 * Parse an interaction `date` value into a local-time Date at midnight.
 *
 * The value may be a date-only string ("YYYY-MM-DD") or — since the
 * interactions.date column was widened from `date` to `timestamptz`
 * (migration 0001) — a full ISO timestamp ("YYYY-MM-DDTHH:MM:SS+00:00").
 * Earlier code did `dateString.split('-')` which turned the timestamp's
 * day part into "17T00:00:00+00:00" → NaN → "Invalid Date".
 *
 * We take only the leading YYYY-MM-DD and construct in local time so a
 * UTC-midnight value does not render as the previous day in negative-offset
 * timezones.
 */
export function parseInteractionDate(dateString: string): Date {
  const [year, month, day] = dateString.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}
