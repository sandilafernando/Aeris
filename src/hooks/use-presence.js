"use client";

import { useEffect, useRef, useState } from "react";
import {
  PRESENCE_COUNT_INTERVAL_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_MAX_RECORDS,
  PRESENCE_MAX_RECONNECT_ATTEMPTS,
  PRESENCE_RECONNECT_BASE_MS,
  PRESENCE_RECONNECT_MAX_MS,
  PRESENCE_SSE_URL,
  PRESENCE_TOPIC_URL,
  countActiveClients,
  createPresenceId,
  mergePresenceRecords,
  parsePresenceEvent,
  presenceHeartbeatPayload,
} from "@/lib/presence";

const INITIAL_STATE = Object.freeze({
  count: null,
  status: "connecting",
  supported: true,
});

const PUBLISH_TIMEOUT_MS = 10_000;

/*
 * ntfy.sh's public relay has a free daily message allowance (historically
 * ~250 messages/day). One heartbeat per minute per visible tab can exhaust
 * that during long sessions, so this feature is explicitly best-effort. We
 * never publish on the 15-second count tick, and hidden tabs pause their
 * heartbeat. One SSE connection per tab is the only subscription cost.
 */
export function usePresence() {
  const [state, setState] = useState(INITIAL_STATE);
  const idRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const id = idRef.current || createPresenceId();
    idRef.current = id;

    if (typeof window.EventSource !== "function") {
      const unsupportedTimer = window.setTimeout(() => {
        setState({ count: null, status: "unavailable", supported: false });
      }, 0);
      return () => window.clearTimeout(unsupportedTimer);
    }

    const records = new Map();
    let source = null;
    let streamOpen = false;
    let publishing = false;
    let publishController = null;
    let heartbeatTimer = null;
    let countTimer = null;
    let reconnectTimer = null;
    let offlineTimer = null;
    let reconnectAttempt = 0;
    let disposed = false;
    let online = window.navigator.onLine;

    const recordList = () => Array.from(records, ([recordId, t]) => ({ id: recordId, t }));

    const trimRecords = () => {
      if (records.size <= PRESENCE_MAX_RECORDS) return;
      const merged = mergePresenceRecords(recordList());
      records.clear();
      for (const record of merged) records.set(record.id, record.t);
    };

    const update = (status) => {
      if (disposed) return;
      const count =
        status === "live" && records.size > 0
          ? countActiveClients(recordList(), Date.now())
          : null;

      setState((previous) => {
        if (
          previous.status === status &&
          previous.count === count &&
          previous.supported === true
        ) {
          return previous;
        }
        return { count, status, supported: true };
      });
    };

    const applyRecord = (record) => {
      if (!record) return false;
      const previous = records.get(record.id);
      if (previous !== undefined && previous >= record.t) return false;
      records.set(record.id, record.t);
      trimRecords();
      return true;
    };

    const clearReconnect = () => {
      if (reconnectTimer === null) return;
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const clearHeartbeat = () => {
      if (heartbeatTimer === null) return;
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    };

    const closeSource = () => {
      streamOpen = false;
      if (!source) return;
      source.close();
      source = null;
    };

    const publishHeartbeat = async () => {
      if (disposed || publishing || !online) return;
      if (document.visibilityState !== "visible") return;

      const payload = presenceHeartbeatPayload(id, Date.now());
      if (!payload) return;

      publishing = true;
      // Track this tab locally even before the relay acknowledges it. If the
      // SSE stream is open, the chip can then show an honest count of at least
      // one instead of flashing a fake zero.
      applyRecord(payload);
      if (streamOpen) update("live");

      const controller = new AbortController();
      publishController = controller;
      const timeout = window.setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);

      try {
        const response = await fetch(PRESENCE_TOPIC_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: controller.signal,
        });

        if (disposed) return;
        if (!response.ok) {
          if (online && !streamOpen && document.visibilityState === "visible") {
            update("unavailable");
          }
          return;
        }
        if (streamOpen) update("live");
      } catch {
        // CORS, offline, timeouts, and relay outages are expected. Stay quiet
        // in the console; the chip is the only user-facing signal.
        if (
          !disposed &&
          online &&
          !streamOpen &&
          document.visibilityState === "visible"
        ) {
          update("unavailable");
        }
      } finally {
        window.clearTimeout(timeout);
        if (publishController === controller) publishController = null;
        publishing = false;
      }
    };

    const startHeartbeat = () => {
      clearHeartbeat();
      if (disposed || !online || document.visibilityState !== "visible") return;
      void publishHeartbeat();
      heartbeatTimer = window.setInterval(() => {
        void publishHeartbeat();
      }, PRESENCE_HEARTBEAT_MS);
    };

    const scheduleReconnect = () => {
      if (disposed || !online) return;
      if (reconnectAttempt >= PRESENCE_MAX_RECONNECT_ATTEMPTS) {
        update("unavailable");
        return;
      }

      reconnectAttempt += 1;
      const delay = Math.min(
        PRESENCE_RECONNECT_MAX_MS,
        PRESENCE_RECONNECT_BASE_MS * 2 ** (reconnectAttempt - 1),
      );
      update("connecting");
      clearReconnect();
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    function connect() {
      if (disposed || !online) return;
      if (source) {
        if (source.readyState !== window.EventSource.CLOSED) return;
        source.close();
        source = null;
      }

      clearReconnect();
      streamOpen = false;

      let nextSource;
      try {
        nextSource = new window.EventSource(PRESENCE_SSE_URL);
      } catch {
        scheduleReconnect();
        return;
      }
      source = nextSource;

      nextSource.onopen = () => {
        if (disposed || source !== nextSource) return;
        streamOpen = true;
        reconnectAttempt = 0;
        update("live");
      };

      nextSource.onmessage = (event) => {
        if (disposed || source !== nextSource) return;
        const record = parsePresenceEvent(event?.data);
        if (!record) return;
        const changed = applyRecord(record);
        if (changed && streamOpen) update("live");
      };

      nextSource.onerror = () => {
        if (disposed || source !== nextSource) return;
        streamOpen = false;

        if (nextSource.readyState === window.EventSource.CLOSED) {
          nextSource.close();
          source = null;
          scheduleReconnect();
          return;
        }

        // CONNECTING means the browser will retry by itself. Show that state
        // without piling a second reconnect loop on top of it.
        update("connecting");
      };
    }

    const handleVisibilityChange = () => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        clearHeartbeat();
        if (publishController) publishController.abort();
        return;
      }

      startHeartbeat();
      if (online && (!source || source.readyState === window.EventSource.CLOSED)) {
        reconnectAttempt = 0;
        update("connecting");
        connect();
      }
    };

    const handleOffline = () => {
      online = false;
      clearHeartbeat();
      clearReconnect();
      if (publishController) publishController.abort();
      closeSource();
      update("offline");
    };

    const handleOnline = () => {
      if (disposed) return;
      online = true;
      reconnectAttempt = 0;
      update(streamOpen ? "live" : "connecting");
      connect();
      startHeartbeat();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (online) {
      connect();
      startHeartbeat();
    } else {
      // Deferred so the first paint/hydration is not changed synchronously
      // inside this effect.
      offlineTimer = window.setTimeout(() => {
        offlineTimer = null;
        if (!disposed && !online) update("offline");
      }, 0);
    }

    countTimer = window.setInterval(() => {
      if (disposed) return;
      // Recompute the active window even when no SSE event arrived, so stale
      // tabs age out on schedule.
      if (streamOpen) update("live");
    }, PRESENCE_COUNT_INTERVAL_MS);

    return () => {
      disposed = true;
      clearHeartbeat();
      clearReconnect();
      if (countTimer !== null) window.clearInterval(countTimer);
      if (offlineTimer !== null) window.clearTimeout(offlineTimer);
      if (publishController) publishController.abort();
      closeSource();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return state;
}
