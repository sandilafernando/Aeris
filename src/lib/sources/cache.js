/**
 * Small server-side cache for upstream official sources.
 *
 * It deduplicates concurrent refreshes, serves a short fresh window, and
 * falls back to the last successful payload when an upstream refresh fails.
 * Failed refreshes never replace good data.
 */
export function createCachedFetcher(
  loader,
  {
    ttlMs = 5 * 60 * 1000,
    staleTtlMs = 24 * 60 * 60 * 1000,
    now = () => Date.now(),
  } = {},
) {
  let entry = null;
  let inflight = null;

  async function refresh() {
    const startedAt = now();
    try {
      const data = await loader();
      const fetchedAt = now();
      entry = { data, fetchedAt };
      return {
        data,
        fetchedAt,
        cache: "miss",
        ageMs: Math.max(0, fetchedAt - startedAt),
      };
    } catch (error) {
      const failedAt = now();
      if (entry && failedAt - entry.fetchedAt <= staleTtlMs) {
        return {
          data: entry.data,
          fetchedAt: entry.fetchedAt,
          cache: "stale",
          error,
        };
      }
      throw error;
    } finally {
      inflight = null;
    }
  }

  return {
    async get() {
      const current = now();
      if (entry && current - entry.fetchedAt < ttlMs) {
        return {
          data: entry.data,
          fetchedAt: entry.fetchedAt,
          cache: "fresh",
        };
      }
      if (inflight) return inflight;
      inflight = refresh();
      return inflight;
    },
    peek() {
      return entry;
    },
    clear() {
      entry = null;
      inflight = null;
    },
  };
}
