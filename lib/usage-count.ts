import { SimplePool, type Event } from "nostr-tools";
import {
  ANALYTICS_KIND,
  DAY_MS,
  buildProviders,
  completedRange,
  parseStatsEvent,
  sanitizeStatsProviders,
  selectProviderDays,
  selectStats,
  type StatsReport,
} from "@/lib/stats-reports";

/* The usage reports the nodes publish, fetched and counted. Checking their signatures is
   slow, so this file touches nothing of the page: it runs in a worker (lib/usage.worker.ts),
   and on the page itself only where a worker cannot start. */

const RELAYS = [
  "wss://relay.routstr.com",
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://relay.ditto.pub",
];

/** Nodes name the same model in slightly different ways: "anthropic/claude-x" and "claude-x" are one. */
export const usageKey = (id: string) => id.toLowerCase().split("/").pop() ?? "";

/** A node's address as the reports and the node lists both can be matched on. */
export const nodeKey = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();

export type Counted = {
  /** Requests in the last 30 days by model. */
  requests: Record<string, number>;
  /** Requests each node reports it served in the last 30 days, by the node's address and by its key. */
  served: Record<string, number>;
  /** The same, split by model: what each node reports it served of each model. */
  servedModels: Record<string, Record<string, number>>;
};

// the same report comes from several relays: each is checked once and kept
const checked = new Map<string, StatsReport | null>();

async function count(events: Event[]): Promise<Counted | null> {
  const range = completedRange("30d");
  for (const event of events) {
    if (!checked.has(event.id)) checked.set(event.id, await parseStatsEvent(event));
  }
  const reports = events
    .map((event) => checked.get(event.id))
    .filter((report): report is StatsReport => report !== null && report !== undefined);
  const { providers } = sanitizeStatsProviders(buildProviders(reports), range);
  const all = selectStats(providers, range);
  if (!all.hasData) return null;
  const requests: Record<string, number> = {};
  for (const day of all.metrics) {
    for (const [model, value] of Object.entries(day.model_counts ?? {})) {
      const key = usageKey(model);
      if (!key || key === "unknown" || !(value > 0)) continue;
      requests[key] = (requests[key] ?? 0) + value;
    }
  }
  const served: Record<string, number> = {};
  const servedModels: Record<string, Record<string, number>> = {};
  for (const provider of providers) {
    const days = selectProviderDays(provider, range);
    const total = days.reduce((sum, day) => sum + day.total_successful, 0);
    const models: Record<string, number> = {};
    for (const day of days) {
      for (const [model, value] of Object.entries(day.model_counts ?? {})) {
        const key = usageKey(model);
        if (key && key !== "unknown" && value > 0) models[key] = (models[key] ?? 0) + value;
      }
    }
    // a report is its node's by the address it signs, and by the node's key in the provider id
    const names = provider.reports.flatMap((report) => report.endpoints.map(nodeKey));
    const key = provider.providerId.split(":").find((part) => /^[0-9a-f]{64}$/.test(part));
    for (const name of key ? [...names, key] : names) {
      served[name] = total;
      servedModels[name] = models;
    }
  }
  return { requests, served, servedModels };
}

/** Ask the relays and count. `onCount` hears the counts as they grow; the promise ends when all relays have answered. */
export async function loadUsage(onCount: (counted: Counted) => void): Promise<void> {
  const pool = new SimplePool();
  // A report is signed after the days it covers, so nothing older is needed.
  const since = Math.floor((completedRange("30d").start - DAY_MS) / 1000);
  const events = new Map<string, Event>();
  // A report already checked is not checked again when another relay sends it.
  const ask = async (relay: string) => {
    const found = await new Promise<Event[]>((resolve) => {
      const got: Event[] = [];
      const end = () => {
        clearTimeout(giveUp);
        sub.close();
        resolve(got);
      };
      const giveUp = setTimeout(end, 20000);
      const sub = pool.subscribe([relay], { kinds: [ANALYTICS_KIND], since, limit: 1000 }, {
        alreadyHaveEvent: (id) => events.has(id),
        onevent: (event) => got.push(event),
        oneose: end,
        onclose: end,
      });
    });
    const before = events.size;
    for (const event of found) events.set(event.id, event);
    if (events.size === before) return;
    const counted = await count(Array.from(events.values())).catch(() => null);
    if (counted) onCount(counted);
  };
  // Routstr's own relay holds nearly every report, so it goes first and the others then
  // have little left that is new. Asked all at once, each would check the same reports again.
  const [first, ...rest] = RELAYS;
  await ask(first);
  await Promise.all(rest.map(ask));
  pool.close(RELAYS);
}
