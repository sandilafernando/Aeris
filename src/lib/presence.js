/*
 * Best-effort "here now" presence over the public ntfy.sh relay.
 *
 * The topic below is fixed so every Aeris tab shares one channel. It is NOT a
 * secret: ntfy.sh topics are public, and anyone who knows (or guesses) the
 * topic can read messages or publish to it. Presence payloads therefore carry
 * only a random, non-identifying client id and a timestamp. Never send an
 * account, location, or any other personal data through this channel.
 *
 * ntfy.sh's public relay has a free daily message allowance (historically
 * ~250 messages/day). Presence is deliberately best-effort: the UI says so,
 * and it degrades to "unavailable" rather than inventing a number.
 */

export const PRESENCE_TOPIC = "aeris-presence-7f4c9e2a6b";
export const PRESENCE_TOPIC_URL = `https://ntfy.sh/${PRESENCE_TOPIC}`;
export const PRESENCE_SSE_URL = `${PRESENCE_TOPIC_URL}/sse?since=2m`;

export const PRESENCE_WINDOW_MS = 90_000;
export const PRESENCE_HEARTBEAT_MS = 60_000;
export const PRESENCE_COUNT_INTERVAL_MS = 15_000;
export const PRESENCE_MAX_RECORDS = 500;
export const PRESENCE_MAX_EVENT_LENGTH = 2_048;
export const PRESENCE_ID_MAX_LENGTH = 64;
export const PRESENCE_MAX_RECONNECT_ATTEMPTS = 5;
export const PRESENCE_RECONNECT_BASE_MS = 2_000;
export const PRESENCE_RECONNECT_MAX_MS = 30_000;

export const PRESENCE_DISCLOSURE =
  "Best-effort count of Aeris tabs seen in the last 90 seconds. No account or personal data.";

/*
 * The ntfy message id and the presence client id are different things. The
 * envelope's id identifies a relay message; the JSON inside `message` carries
 * our random client id. Values outside these bounds are treated as junk.
 */
const MAX_TIMESTAMP = 8_640_000_000_000_000; // ECMAScript maximum Date value.

function isRecordObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeSseData(raw) {
  if (!/^data:/m.test(raw)) return raw;

  const dataLines = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  return dataLines.length ? dataLines.join("\n") : raw;
}

function normalizeClientId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > PRESENCE_ID_MAX_LENGTH) return null;
  return id;
}

function normalizeTimestamp(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const timestamp = Math.trunc(value);
  if (timestamp <= 0 || timestamp > MAX_TIMESTAMP) return null;
  return timestamp;
}

/**
 * Generate an opaque per-tab client id. crypto.randomUUID is preferred, with
 * getRandomValues and finally Math.random as safe fallbacks for older or
 * non-secure-context browsers. The id is not a secret and is never persisted.
 */
export function createPresenceId() {
  const cryptoApi =
    typeof globalThis !== "undefined" && globalThis.crypto ? globalThis.crypto : null;

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    try {
      const id = cryptoApi.randomUUID();
      if (typeof id === "string" && id.length > 0 && id.length <= PRESENCE_ID_MAX_LENGTH) {
        return id;
      }
    } catch {
      // Fall through to the next source of randomness.
    }
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    try {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to the last-resort fallback.
    }
  }

  return `presence-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Defensive parser for one ntfy SSE message. EventSource already removes the
 * `data:` prefix, but accepting a raw SSE block makes this helper easy to test
 * and tolerant of callers that do their own framing.
 *
 * Returns `{ id, t }` or null. The ntfy envelope form
 * `{ ..., message: "{\"id\":\"...\",\"t\":123}" }` is supported alongside a
 * direct payload.
 */
export function parsePresenceEvent(raw) {
  if (typeof raw !== "string") return null;
  if (!raw || raw.length > PRESENCE_MAX_EVENT_LENGTH) return null;

  const jsonText = normalizeSseData(raw.trim());
  if (!jsonText || jsonText.length > PRESENCE_MAX_EVENT_LENGTH) return null;

  let value;
  try {
    value = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!isRecordObject(value)) return null;

  let payload = value;
  if ("message" in value) {
    if (typeof value.message !== "string") return null;
    if (!value.message || value.message.length > PRESENCE_MAX_EVENT_LENGTH) return null;
    try {
      payload = JSON.parse(value.message);
    } catch {
      return null;
    }
    if (!isRecordObject(payload)) return null;
  }

  const id = normalizeClientId(payload.id);
  const timestamp = normalizeTimestamp(payload.t);
  if (!id || timestamp === null) return null;

  return { id, t: timestamp };
}

function normalizeRecords(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Merge records from the stream with records already seen. Replays and older
 * duplicates are collapsed to the latest timestamp per id, the result is
 * sorted newest-first, and the list is capped so a busy public topic cannot
 * grow memory without bound.
 */
export function mergePresenceRecords(existing, incoming) {
  const latestById = new Map();

  for (const record of [...normalizeRecords(existing), ...normalizeRecords(incoming)]) {
    if (!isRecordObject(record)) continue;
    const id = normalizeClientId(record.id);
    const timestamp = normalizeTimestamp(record.t);
    if (!id || timestamp === null) continue;

    const previous = latestById.get(id);
    if (previous === undefined || timestamp > previous) {
      latestById.set(id, timestamp);
    }
  }

  return Array.from(latestById, ([id, t]) => ({ id, t }))
    .sort(
      (left, right) =>
        right.t - left.t || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    )
    .slice(0, PRESENCE_MAX_RECORDS);
}

/**
 * Count unique clients whose latest heartbeat falls inside the active window.
 * Future timestamps are ignored until the local clock reaches them. Invalid
 * input always produces a non-negative integer, never NaN or a negative count.
 */
export function countActiveClients(records, now, windowMs = PRESENCE_WINDOW_MS) {
  if (!Array.isArray(records)) return 0;

  const current = Number(now);
  if (!Number.isFinite(current)) return 0;

  const window = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : PRESENCE_WINDOW_MS;
  const earliest = current - window;
  const latestById = new Map();

  for (const record of records) {
    if (!isRecordObject(record)) continue;
    const id = normalizeClientId(record.id);
    const timestamp = normalizeTimestamp(record.t);
    if (!id || timestamp === null) continue;

    const previous = latestById.get(id);
    if (previous === undefined || timestamp > previous) {
      latestById.set(id, timestamp);
    }
  }

  let count = 0;
  for (const timestamp of latestById.values()) {
    if (timestamp >= earliest && timestamp <= current) count += 1;
  }

  return count > 0 ? count : 0;
}

/**
 * Build the tiny JSON message published to ntfy. Returns null for an invalid
 * id or clock so a caller can never accidentally publish malformed presence.
 */
export function presenceHeartbeatPayload(id, now = Date.now()) {
  const clientId = normalizeClientId(id);
  const timestamp = normalizeTimestamp(now);
  if (!clientId || timestamp === null) return null;
  return { id: clientId, t: timestamp };
}
