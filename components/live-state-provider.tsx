"use client";

/**
 * One polling loop for the whole app: board, today's board, activity,
 * takeover and site stats. Polls every 5s while the tab is visible, refreshes
 * instantly on focus, and exposes the payload via context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { StatePayload } from "@/lib/types";

const POLL_MS = 5000;

interface LiveStateValue {
  state: StatePayload | null;
  error: boolean;
  refresh: () => void;
}

const LiveStateContext = createContext<LiveStateValue>({
  state: null,
  error: false,
  refresh: () => undefined,
});

export function useLiveState(): LiveStateValue {
  return useContext(LiveStateContext);
}

export function LiveStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<StatePayload | null>(null);
  const [error, setError] = useState(false);
  const inflight = useRef(false);

  const fetchState = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as StatePayload;
      setState(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      inflight.current = false;
    }
  }, []);

  // Heartbeat drives the "online now" counter; runs on its own cadence.
  useEffect(() => {
    let alive = true;
    const ping = () => {
      fetch("/api/ping", { method: "POST", cache: "no-store" }).catch(
        () => undefined
      );
    };
    ping();
    const timer = setInterval(() => {
      if (alive && document.visibilityState === "visible") ping();
    }, 45_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    fetchState();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchState();
    }, POLL_MS);

    const onFocus = () => fetchState();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchState]);

  return (
    <LiveStateContext.Provider
      value={{ state, error, refresh: () => void fetchState() }}
    >
      {children}
    </LiveStateContext.Provider>
  );
}
