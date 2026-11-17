"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadUsage, type Counted } from "@/lib/usage-count";

export { nodeKey, usageKey } from "@/lib/usage-count";

/* How much each model was used in the last 30 days, from the usage reports the
   nodes publish. The stats page reads the same reports from the same relays. */

const CACHE_KEY = "routstr:model-usage:v5";
/** Counts this young are shown as they are. */
const FRESH_MS = 30 * 60_000;
/** Older ones are still shown at once, and replaced when the new count is in. */
const KEEP_MS = 7 * 24 * 60 * 60_000;

export type ModelUsage = {
  [K in keyof Counted]: Counted[K] | null;
} & {
  /** False while relays are still answering: the counts can still grow. */
  done: boolean;
};

const nothing: ModelUsage = { requests: null, served: null, servedModels: null, done: false };
let state = nothing;
let started = false;
const listeners = new Set<() => void>();

function publish(next: ModelUsage) {
  state = next;
  listeners.forEach((listener) => listener());
}

function load() {
  // what the last visit counted shows at once, so the page does not rearrange itself
  let shown = false;
  try {
    const saved = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null");
    if (saved && Date.now() - saved.at < KEEP_MS) {
      publish({ requests: saved.requests, served: saved.served, servedModels: saved.servedModels, done: true });
      if (Date.now() - saved.at < FRESH_MS) return;
      shown = true;
    }
  } catch {
    // nothing saved, or storage is blocked
  }
  let latest: Counted | null = null;
  const onCount = (counted: Counted) => {
    latest = counted;
    // with older counts on the page, the new ones replace them once, when they are complete
    if (!shown) publish({ ...counted, done: false });
  };
  const onDone = () => {
    if (!latest) return publish({ ...state, done: true });
    publish({ ...latest, done: true });
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), ...latest }));
    } catch {
      // storage blocked: the counts still show for this visit
    }
  };
  try {
    const worker = new Worker(new URL("./usage.worker.ts", import.meta.url));
    worker.onmessage = ({ data }: MessageEvent<{ counted?: Counted; done?: boolean }>) => {
      if (data.counted) onCount(data.counted);
      if (data.done) {
        onDone();
        worker.terminate();
      }
    };
    worker.onerror = () => {
      worker.terminate();
      void loadUsage(onCount).finally(onDone);
    };
  } catch {
    // no worker here: the same work, on the page
    void loadUsage(onCount).finally(onDone);
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function useModelUsage(): ModelUsage {
  useEffect(() => {
    if (started) return;
    started = true;
    load();
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => nothing);
}
