"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// Synced store: localStorage is the source of truth on-device
// (instant, works with no signal at the gym); the server copy in
// Postgres syncs in the background so other devices catch up.
// ─────────────────────────────────────────────────────────────

export type LoggedSession = {
  id: string;
  type: "lift" | "run";
  date: string; // YYYY-MM-DD
  day?: "A" | "B" | "C";
  label: string;
  month: string;
  week: number;
  completed: boolean;
  weights: Record<string, number>;
};

export type WeightEntry = { date: string; lb: number };

export type TrainState = {
  version: 1;
  updatedAt: string;
  oneRMs: { squat: number | null; bench: number | null; deadlift: number | null };
  sessions: LoggedSession[];
  bodyweights: WeightEntry[];
  block2Confirmed: boolean;
};

export const EMPTY_STATE: TrainState = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  oneRMs: { squat: null, bench: null, deadlift: null },
  sessions: [],
  bodyweights: [],
  block2Confirmed: false,
};

const LS_KEY = "tt_state_v1";

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadLocal(): TrainState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function saveLocal(s: TrainState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* storage full/blocked — in-memory only */
  }
}

// Union merge: log entries are append-only and merged by id/date;
// scalar settings follow the newer updatedAt.
export function mergeStates(a: TrainState, b: TrainState): TrainState {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const sessions = new Map<string, LoggedSession>();
  for (const s of [...a.sessions, ...b.sessions]) sessions.set(s.id, s);
  const weights = new Map<string, WeightEntry>();
  // older first so the newer state's entry wins a date collision
  const [older, latest] = a.updatedAt >= b.updatedAt ? [b, a] : [a, b];
  for (const w of [...older.bodyweights, ...latest.bodyweights]) weights.set(w.date, w);
  return {
    version: 1,
    updatedAt: newer.updatedAt,
    oneRMs: newer.oneRMs,
    block2Confirmed: newer.block2Confirmed,
    sessions: [...sessions.values()].sort((x, y) => (x.date < y.date ? -1 : 1)),
    bodyweights: [...weights.values()].sort((x, y) => (x.date < y.date ? -1 : 1)),
  };
}

export type SyncStatus = "local" | "syncing" | "synced" | "offline";

export function useTrainStore() {
  const [state, setState] = useState<TrainState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("local");
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // hydrate from localStorage, then reconcile with the server
  useEffect(() => {
    const local = loadLocal();
    setState(local);
    setHydrated(true);
    (async () => {
      try {
        setSync("syncing");
        const res = await fetch("/api/train/state");
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (!body.available) {
          setSync("local"); // no database provisioned yet
          return;
        }
        const remote: TrainState = body.state ? { ...EMPTY_STATE, ...body.state } : { ...EMPTY_STATE };
        const merged = mergeStates(loadLocal(), remote);
        saveLocal(merged);
        setState(merged);
        // push the merged copy back so the server has the union
        await fetch("/api/train/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        });
        setSync("synced");
      } catch {
        setSync("offline");
      }
    })();
  }, []);

  const update = useCallback((fn: (s: TrainState) => TrainState) => {
    setState((prev) => {
      const next = { ...fn(prev), updatedAt: new Date().toISOString() };
      saveLocal(next);
      // debounce the background push
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(async () => {
        try {
          setSync("syncing");
          const res = await fetch("/api/train/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateRef.current),
          });
          const body = await res.json().catch(() => ({}));
          setSync(res.ok && body.available !== false ? "synced" : "local");
        } catch {
          setSync("offline");
        }
      }, 1500);
      return next;
    });
  }, []);

  const replaceAll = useCallback((incoming: TrainState) => {
    update(() => ({ ...EMPTY_STATE, ...incoming }));
  }, [update]);

  return { state, update, replaceAll, hydrated, sync };
}
