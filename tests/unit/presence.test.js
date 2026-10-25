import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRESENCE_COUNT_INTERVAL_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_MAX_EVENT_LENGTH,
  PRESENCE_MAX_RECORDS,
  PRESENCE_SSE_URL,
  PRESENCE_TOPIC,
  PRESENCE_TOPIC_URL,
  PRESENCE_WINDOW_MS,
  countActiveClients,
  createPresenceId,
  mergePresenceRecords,
  parsePresenceEvent,
  presenceHeartbeatPayload,
} from "../../src/lib/presence.js";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

test("presence constants describe one public, best-effort channel", () => {
  assert.equal(PRESENCE_TOPIC, "aeris-presence-7f4c9e2a6b");
  assert.equal(PRESENCE_TOPIC_URL, `https://ntfy.sh/${PRESENCE_TOPIC}`);
  assert.equal(PRESENCE_SSE_URL, `${PRESENCE_TOPIC_URL}/sse?since=2m`);
  assert.equal(PRESENCE_WINDOW_MS, 90_000);
  assert.equal(PRESENCE_HEARTBEAT_MS, 60_000);
  assert.equal(PRESENCE_COUNT_INTERVAL_MS, 15_000);
  assert.ok(PRESENCE_MAX_RECORDS >= 100);
});

test("createPresenceId returns a short opaque id", () => {
  const first = createPresenceId();
  const second = createPresenceId();

  assert.equal(typeof first, "string");
  assert.ok(first.length > 0);
  assert.ok(first.length <= 64);
  assert.notEqual(first, second);
});

test("parsePresenceEvent accepts direct, SSE-framed, and ntfy envelope payloads", () => {
  const payload = { id: "client-1", t: NOW };

  assert.deepEqual(parsePresenceEvent(JSON.stringify(payload)), payload);
  assert.deepEqual(parsePresenceEvent(`  ${JSON.stringify(payload)}  `), payload);
  assert.deepEqual(parsePresenceEvent(`event: message\ndata: ${JSON.stringify(payload)}\n\n`), payload);
  assert.deepEqual(
    parsePresenceEvent(
      JSON.stringify({
        id: "ntfy-message-id",
        time: 1_790_000_000,
        event: "message",
        topic: PRESENCE_TOPIC,
        message: JSON.stringify({ id: "  client-2  ", t: NOW }),
      }),
    ),
    { id: "client-2", t: NOW },
  );
});

test("parsePresenceEvent rejects malformed, oversized, and non-object input", () => {
  const invalid = [
    null,
    undefined,
    42,
    {},
    [],
    "",
    "not json",
    "{",
    JSON.stringify([{ id: "client-1", t: NOW }]),
    JSON.stringify({ id: "", t: NOW }),
    JSON.stringify({ id: "client-1" }),
    JSON.stringify({ id: "client-1", t: "123" }),
    JSON.stringify({ id: "client-1", t: null }),
    JSON.stringify({ id: "client-1", t: -1 }),
    JSON.stringify({ id: "client-1", t: 0 }),
    '{"id":"client-1","t":1e999}',
    JSON.stringify({ id: "x".repeat(65), t: NOW }),
    JSON.stringify({ message: { id: "client-1", t: NOW } }),
    JSON.stringify({ message: "not json" }),
    JSON.stringify({ message: "[]" }),
    JSON.stringify({ event: "keepalive", topic: PRESENCE_TOPIC }),
    "x".repeat(PRESENCE_MAX_EVENT_LENGTH + 1),
  ];

  for (const value of invalid) {
    assert.equal(parsePresenceEvent(value), null, `expected null for ${String(value)}`);
  }
});

test("countActiveClients de-duplicates by id and uses the latest timestamp", () => {
  const records = [
    { id: "a", t: NOW - 10_000 },
    { id: "a", t: NOW - 80_000 },
    { id: "b", t: NOW - 91_000 },
    { id: "c", t: NOW - 1_000 },
  ];

  assert.equal(countActiveClients(records, NOW), 2);

  // Order must not let an older replay overwrite a newer heartbeat.
  assert.equal(
    countActiveClients(
      [
        { id: "a", t: NOW - 80_000 },
        { id: "a", t: NOW - 10_000 },
      ],
      NOW,
    ),
    1,
  );
});

test("countActiveClients ages records out at the window boundary", () => {
  assert.equal(countActiveClients([{ id: "edge", t: NOW - PRESENCE_WINDOW_MS }], NOW), 1);
  assert.equal(countActiveClients([{ id: "old", t: NOW - PRESENCE_WINDOW_MS - 1 }], NOW), 0);
  assert.equal(
    countActiveClients([{ id: "short", t: NOW - 20_000 }], NOW, 10_000),
    0,
  );
  assert.equal(countActiveClients([{ id: "future", t: NOW + 1 }], NOW), 0);
});

test("countActiveClients handles invalid input without returning NaN or a negative", () => {
  assert.equal(countActiveClients(null, NOW), 0);
  assert.equal(countActiveClients(undefined, NOW), 0);
  assert.equal(countActiveClients([], NaN), 0);
  assert.equal(countActiveClients([], Infinity), 0);
  assert.equal(countActiveClients([{ id: "a", t: NOW }], "not-a-clock"), 0);

  const junk = [
    null,
    {},
    { id: "", t: NOW },
    { id: "a", t: "123" },
    { id: "a", t: NaN },
    { id: "a", t: Infinity },
    { id: "a", t: -1 },
    { id: "a", t: 0 },
  ];
  assert.equal(countActiveClients(junk, NOW), 0);
  assert.equal(countActiveClients([{ id: "a", t: NOW }], NOW, Number.NaN), 1);
  assert.equal(countActiveClients([{ id: "a", t: NOW }], NOW, -5), 1);
});

test("mergePresenceRecords keeps the latest record per id and a bounded list", () => {
  const merged = mergePresenceRecords(
    [
      { id: "a", t: NOW - 2_000 },
      { id: "b", t: NOW - 3_000 },
    ],
    [
      { id: "a", t: NOW },
      { id: "c", t: NOW - 1_000 },
      { id: "a", t: NOW - 4_000 },
    ],
  );

  assert.deepEqual(merged, [
    { id: "a", t: NOW },
    { id: "c", t: NOW - 1_000 },
    { id: "b", t: NOW - 3_000 },
  ]);

  const many = Array.from({ length: PRESENCE_MAX_RECORDS + 50 }, (_, index) => ({
    id: `client-${index}`,
    t: NOW + index,
  }));
  const bounded = mergePresenceRecords([], many);

  assert.equal(bounded.length, PRESENCE_MAX_RECORDS);
  assert.equal(bounded[0].id, `client-${many.length - 1}`);
  assert.equal(bounded.some((record) => record.id === "client-0"), false);

  assert.deepEqual(
    mergePresenceRecords(
      [{ id: "a", t: NOW }],
      [
        { id: "a", t: NOW },
        { id: "a", t: NOW - 1 },
        { id: "", t: NOW },
        { id: "b", t: Number.NaN },
      ],
    ),
    [{ id: "a", t: NOW }],
  );
  assert.deepEqual(mergePresenceRecords(null, null), []);
});

test("presenceHeartbeatPayload produces the relay payload and rejects junk", () => {
  assert.deepEqual(presenceHeartbeatPayload("client-1", NOW), { id: "client-1", t: NOW });
  assert.deepEqual(presenceHeartbeatPayload("  client-2  ", NOW), { id: "client-2", t: NOW });

  const generated = presenceHeartbeatPayload("client-3");
  assert.equal(generated.id, "client-3");
  assert.equal(typeof generated.t, "number");
  assert.ok(Number.isFinite(generated.t));

  assert.equal(presenceHeartbeatPayload("", NOW), null);
  assert.equal(presenceHeartbeatPayload(null, NOW), null);
  assert.equal(presenceHeartbeatPayload("x".repeat(65), NOW), null);
  assert.equal(presenceHeartbeatPayload("client-1", Number.NaN), null);
  assert.equal(presenceHeartbeatPayload("client-1", Infinity), null);
  assert.equal(presenceHeartbeatPayload("client-1", -1), null);
  assert.equal(presenceHeartbeatPayload("client-1", "now"), null);
});
