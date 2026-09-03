/**
 * Strip PostgREST filter metacharacters before interpolating user input into
 * an `.or()` / `.ilike()` filter string. Commas, parens and quotes can
 * otherwise escape the filter and inject arbitrary PostgREST conditions.
 *
 * Isolated in its own module (no node builtins) so client components can
 * import it without pulling server-only code into the browser bundle.
 */
export function sanitizeFilterValue(value: string): string {
  return value.replace(/[,()"\\*%]/g, '')
}
