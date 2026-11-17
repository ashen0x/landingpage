"use client";

import { useEffect, useSyncExternalStore } from "react";
import { readBucketTotal } from "@/components/stats/top-models-usage-chart";
import type { Event } from "nostr-tools";
import { createPool, getDefaultRelays } from "@/lib/nostr";
import {
  ANALYTICS_KIND,
  DAY_MS,
  buildProviders,
  completedRange,
  parseStatsEvent,
  sanitizeStatsProviders,
  selectStats,
  type StatsReport,
} from "@/lib/stats-reports";

// The relays the stats page reads usage reports from.
const RELAYS = Array.from(
  new Set([
    ...getDefaultRelays(),
    "wss://relay.routstr.com",
    "wss://nos.lol",
    "wss://relay.ditto.pub",
  ])
);

export interface Pulse {
  requests: number;
  tokens: number;
  sats: number;
  /** Nodes that shared a report for the period. */
  nodes: number;
  /** Nodes by sats earned, largest first. */
  earners: { label: string; sats: number }[];
}

const CACHE_KEY = "routstr:pulse:v1";
const CACHE_MS = 30 * 60_000;

export interface PulseState {
  pulse: Pulse | null;
  /** False while relays are still answering: the totals can still grow. */
  done: boolean;
}

let state: PulseState = { pulse: null, done: false };
let started = false;
const listeners = new Set<() => void>();

function publish(next: PulseState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function readCache(): Pulse | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null");
    return saved && Date.now() - saved.at < CACHE_MS ? (saved.pulse as Pulse) : null;
  } catch {
    return null;
  }
}

async function summarize(events: Iterable<Event>): Promise<Pulse | null> {
  const range = completedRange("30d");
  const parsed = await Promise.all(Array.from(events, (event) => parseStatsEvent(event)));
  const reports = parsed.filter((report): report is StatsReport => report !== null);
  const { providers } = sanitizeStatsProviders(buildProviders(reports), range);
  const all = selectStats(providers, range);
  if (!all.hasData) return null;
  const sum = (kind: "requests" | "tokens" | "revenue", metrics = all.metrics) =>
    metrics.reduce((total, day) => total + readBucketTotal(day, kind), 0);
  return {
    requests: sum("requests"),
    tokens: sum("tokens"),
    sats: sum("revenue") / 1000,
    nodes: all.reportingProviders,
    earners: providers
      .map((provider) => ({
        label: provider.providerLabel,
        sats: sum("revenue", selectStats([provider], range).metrics) / 1000,
      }))
      .filter((earner) => earner.sats > 0)
      .sort((a, b) => b.sats - a.sats)
      .slice(0, 8),
  };
}

async function load() {
  const cached = readCache();
  if (cached) return publish({ pulse: cached, done: true });
  const pool = createPool();
  // A report is signed after the days it covers, so nothing older is needed.
  const since = Math.floor((completedRange("30d").start - DAY_MS) / 1000);
  const events = new Map<string, Event>();
  // Each relay is asked on its own: the largest reports sit on the slowest
  // one, so the totals grow as relays answer and are final when all have.
  await Promise.all(
    RELAYS.map(async (relay) => {
      const found = await pool
        .querySync([relay], { kinds: [ANALYTICS_KIND], since, limit: 1000 }, { maxWait: 20000 })
        .catch(() => []);
      const before = events.size;
      for (const event of found) events.set(event.id, event);
      if (events.size === before) return;
      const pulse = await summarize(events.values()).catch(() => null);
      if (pulse) publish({ pulse, done: false });
    })
  );
  pool.close(RELAYS);
  publish({ pulse: state.pulse, done: true });
  if (!state.pulse) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), pulse: state.pulse }));
  } catch {
    // storage blocked: the numbers still show for this visit
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => state;

/**
 * The last 30 completed days of usage, summed from the reports nodes sign and
 * publish on Nostr, with the same cleaning the stats page applies. Loaded once
 * for the page and kept for half an hour, as the reports are a few megabytes.
 */
export function usePulse(enabled: boolean): PulseState {
  useEffect(() => {
    if (!enabled || started) return;
    started = true;
    void load();
  }, [enabled]);
  return useSyncExternalStore(subscribe, read, read);
}
