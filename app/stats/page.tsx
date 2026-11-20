"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { type Event } from "nostr-tools";
import { createPool } from "@/lib/relay-client";
import {
  ANALYTICS_KIND, DAY_MS, buildProviders, completedRange,
  dayKey, parseStatsEvent, reportWins, sanitizeStatsProviders, selectStats,
  type StatsDay, type StatsGrouping, type StatsProvider, type StatsReport, type WindowKey,
} from "@/lib/stats-reports";
import {
  PROVIDER_ANNOUNCEMENT_KIND, applyProviderLabels, providerLabelsFromAnnouncements,
  sanitizeProviderLabels,
} from "@/lib/provider-identity";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { SiteShell } from "@/components/layout/site-shell";
import { Mark } from "@/components/layout/Mark";
import { pulse } from "@/components/layout/Band";
import { companyIn } from "@/components/stats/model-company-icon";
import { providerShortId } from "@/components/stats/stats-chart-domain";
import { getDefaultRelays } from "@/lib/nostr";
import { fetchListData } from "@/lib/api/price-sources";
import { formatCompactCount } from "@/lib/number-format";
import { usageKey } from "@/lib/usage-count";
import "@/components/layout/pages.css";
import "./stats.css";

type RelayState = "connecting" | "active" | "done" | "no-data" | "timeout" | "error";
type ProviderTimeline = StatsProvider;
type RelayStatus = { url: string; state: RelayState };
type StatsQueryData = {
  timelines: ProviderTimeline[];
  relayStatuses: Record<string, RelayStatus>;
  emptyMessage: string | null;
  historyIncomplete: boolean;
  refreshedAt: number | null;
};
type CachedCoord = { lastObservedAtMs: number; report: StatsReport };
type StatsFetchData = { relayStatuses: Record<string, RelayStatus>; coords: Record<string, CachedCoord>; historyIncomplete: boolean };
/** Public key to display label, joined from the kind 38421 announcements. */
type ProviderLabels = Record<string, string>;

// relay.ditto.pub accepts 4 MB events, so it holds provider reports that the
// 128 KiB relays reject outright. Stats only, other features do not need it.
const configuredRelays = process.env.NEXT_PUBLIC_STATS_RELAYS?.split(",").map((url) => url.trim()).filter((url) => {
  try { return ["ws:", "wss:"].includes(new URL(url).protocol); } catch { return false; }
});
const RELAYS = Array.from(
  new Set(configuredRelays?.length ? configuredRelays : [
    ...getDefaultRelays(),
    "wss://relay.routstr.com",
    "wss://nos.lol",
    "wss://relay.ditto.pub",
  ]),
);

const STATS_CACHE_KEY = "stats_snapshots_cache_v3";
const LEGACY_STATS_CACHE_KEY = "stats_snapshots_cache_v2";
const PROVIDER_LABELS_CACHE_KEY = "stats_provider_labels_v1";
const STATS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STATS_QUERY_KEY = ["stats-snapshots"] as const;
const STATS_REFETCH_MS = 15 * 60_000;
const STATS_EMPTY_RETRY_MS = 60_000;


function normalizeRelayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

const RELAY_STATE_META: Record<
  RelayState,
  { label: string; answered: boolean }
> = {
  connecting: { label: "connecting", answered: false },
  active: { label: "receiving", answered: true },
  done: { label: "received", answered: true },
  "no-data": { label: "no reports", answered: false },
  timeout: { label: "timed out", answered: false },
  error: { label: "failed", answered: false },
};

function createInitialRelayStatuses(): Record<string, RelayStatus> {
  const next: Record<string, RelayStatus> = {};
  for (const relay of RELAYS) {
    const key = normalizeRelayUrl(relay);
    next[key] = {
      url: relay,
      state: "connecting",
    };
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatUpdatedAt(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function mergeCachedCoords(
  current: Record<string, CachedCoord>, incoming: Record<string, CachedCoord>,
): Record<string, CachedCoord> {
  const merged = { ...current };
  for (const [key, candidate] of Object.entries(incoming)) {
    const existing = merged[key];
    merged[key] = !existing ? candidate : {
      report: reportWins(candidate.report, existing.report) ? candidate.report : existing.report,
      lastObservedAtMs: Math.max(candidate.lastObservedAtMs, existing.lastObservedAtMs),
    };
  }
  return merged;
}

function retainFreshCachedCoords(coords: Record<string, CachedCoord>, now = Date.now()) {
  return Object.fromEntries(Object.entries(coords).filter(([, coord]) => coord.lastObservedAtMs >= now - STATS_CACHE_TTL_MS));
}

async function readStatsCache(): Promise<Record<string, CachedCoord>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(STATS_CACHE_KEY) ?? "null");
    if (!isRecord(raw) || !isRecord(raw.coords)) return {};
    const coords: Record<string, CachedCoord> = {};
    await Promise.all(Object.entries(raw.coords).map(async ([key, value]) => {
      if (!isRecord(value) || typeof value.lastObservedAtMs !== "number" ||
          value.lastObservedAtMs < Date.now() - STATS_CACHE_TTL_MS || value.lastObservedAtMs > Date.now()) return;
      const report = await parseStatsEvent(value.event);
      if (report?.coordinate === key) coords[key] = { report, lastObservedAtMs: value.lastObservedAtMs };
    }));
    return coords;
  } catch { return {}; }
}

async function updateStatsCache(coords: Record<string, CachedCoord>): Promise<Record<string, CachedCoord>> {
  if (typeof window === "undefined") return coords;
  const persist = async () => {
    const merged = retainFreshCachedCoords(mergeCachedCoords(await readStatsCache(), coords));
    try {
      window.localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ coords: Object.fromEntries(
        Object.entries(merged).map(([key, value]) => [key, { lastObservedAtMs: value.lastObservedAtMs, event: value.report.event }]),
      ) }));
      window.localStorage.removeItem(LEGACY_STATS_CACHE_KEY);
    } catch { /* Relay data remains usable when browser storage is full. */ }
    return merged;
  };
  try { return await window.navigator.locks.request(STATS_CACHE_KEY, persist); }
  catch { return persist(); }
}

/**
 * Display labels come from the kind 38421 announcement, read as one bounded
 * query per refresh. It is independent of the report walk below: a report hands
 * the page only its signed node id, which is usually the public key prefix, so
 * the name and the advertised host only exist in the announcement. The walk
 * keeps paginating on its own and does not wait for this, and a relay that
 * fails here costs labels, never numbers.
 *
 * This never rejects, not even on abort: it can outlive the report walk that
 * started it, and a rejected promise nobody is left awaiting would surface as an
 * unhandled rejection over a purely cosmetic read.
 */
async function fetchProviderLabels(): Promise<ProviderLabels> {
  const pool = createPool();
  try {
    const events = await pool.querySync(
      RELAYS, { kinds: [PROVIDER_ANNOUNCEMENT_KIND], limit: 200 }, { maxWait: 8000 },
    );
    return providerLabelsFromAnnouncements(events);
  } catch { return {}; }
  finally { pool.close(RELAYS); }
}

/** Announcement labels are cached small and unsigned on read, so re-validate them. */
function readProviderLabelsCache(): ProviderLabels {
  if (typeof window === "undefined") return {};
  try { return sanitizeProviderLabels(JSON.parse(window.localStorage.getItem(PROVIDER_LABELS_CACHE_KEY) ?? "null")); }
  catch { return {}; }
}

function writeProviderLabelsCache(labels: ProviderLabels) {
  if (typeof window === "undefined" || Object.keys(labels).length === 0) return;
  try { window.localStorage.setItem(PROVIDER_LABELS_CACHE_KEY, JSON.stringify(labels)); }
  catch { /* Relay data remains usable when browser storage is full. */ }
}

function buildTimelinesFromCoords(coords: CachedCoord[], labels: ProviderLabels = {}): ProviderTimeline[] {
  return applyProviderLabels(buildProviders(coords.map((coord) => coord.report)), labels);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("Query cancelled", "AbortError");
  }
  const error = new Error("Query cancelled");
  error.name = "AbortError";
  return error;
}

async function fetchStatsSnapshots(
  seedCoords: Record<string, CachedCoord>,
  signal?: AbortSignal,
  onProgress?: (data: StatsFetchData) => void,
): Promise<StatsFetchData> {
  if (signal?.aborted) throw createAbortError();
  const pool = createPool();
  const coords = { ...seedCoords };
  const relayStatuses = createInitialRelayStatuses();
  const seen = new Set<string>();
  let historyIncomplete = false;
  const now = Math.floor(Date.now() / 1000);
  const oldest = Math.floor(completedRange("365d").start / 1000) - 7 * DAY_MS / 1000;
  type Page = { count: number; fresh: number; oldest: number; failure?: "error" | "timeout" };
  const fetchPage = (url: string, until: number, known: Set<string>) => new Promise<Page>((resolve, reject) => {
    const key = normalizeRelayUrl(url);
    const page: Page = { count: 0, fresh: 0, oldest: until };
    const parsing: Promise<void>[] = [];
    let finished = false;
    const finish = async (failure?: Page["failure"]) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      subscription.close();
      await Promise.all(parsing);
      if (signal?.aborted) reject(createAbortError());
      else resolve({ ...page, failure });
    };
    const abort = () => { void finish(); };
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { void finish("timeout"); }, 7000);
    const subscription = pool.subscribeMany([url], { kinds: [ANALYTICS_KIND], since: oldest, until, limit: 1000 }, {
      // Our deadline must run before the SDK synthesizes EOSE on its own timeout.
      maxWait: 8000,
      receivedEvent(_relay, id) {
        if (finished) return;
        page.count++;
        if (!known.has(id)) page.fresh++;
        known.add(id);
        relayStatuses[key] = { url, state: "active" };
      },
      onevent(event: Event) {
        if (finished) return;
        page.oldest = Math.min(page.oldest, event.created_at);
        if (seen.has(event.id)) return;
        seen.add(event.id);
        parsing.push(parseStatsEvent(event).then((report) => {
          if (!report) return;
          const candidate = { report, lastObservedAtMs: Date.now() };
          const current = coords[report.coordinate];
          coords[report.coordinate] = current && !reportWins(report, current.report)
            ? { ...current, lastObservedAtMs: candidate.lastObservedAtMs } : candidate;
        }));
      },
      oneose() {
        // Defer completion so callbacks can finish processing this response.
        void Promise.resolve().then(() => finish());
      },
      onclose(reasons) {
        const reason = reasons[0];
        if (reason && !reason.includes("closed by caller")) void finish(/timeout|timed out/i.test(reason) ? "timeout" : "error");
      },
    });
  });
  // A relay may return fewer reports than the limit asks for, so a short page
  // proves nothing. Walk back from the oldest report seen, keeping its second.
  const walkRelay = async (url: string) => {
    const key = normalizeRelayUrl(url);
    const known = new Set<string>();
    let until = now;
    let largest = 0;
    let steppedPastTies = false;
    for (let pages = 0; until >= oldest; pages++) {
      const page = pages < 50 ? await fetchPage(url, until, known) : null;
      if (!page || page.failure) {
        historyIncomplete = true;
        if (page?.failure) relayStatuses[key] = { url, state: page.failure };
        break;
      }
      // Older reports after a page that only repeated one second mean that page
      // was cut short, so more reports from that second may exist.
      if (steppedPastTies && page.count > 0) historyIncomplete = true;
      onProgress?.({ coords: { ...coords }, relayStatuses: { ...relayStatuses }, historyIncomplete });
      if (page.count === 0) break;
      steppedPastTies = page.fresh === 0;
      if (page.fresh > 0) {
        largest = Math.max(largest, page.count);
        until = page.oldest;
        continue;
      }
      // Nothing older may exist to reveal the cut, so a repeat as large as any
      // earlier page is already suspect.
      if (page.count > 1 && page.count >= largest) historyIncomplete = true;
      until -= 1;
    }
    const state = relayStatuses[key].state;
    if (state === "active" || state === "connecting") relayStatuses[key] = { url, state: state === "active" ? "done" : "no-data" };
  };
  try {
    await Promise.all(Object.values(relayStatuses).map((relay) => walkRelay(relay.url)));
    return { coords, relayStatuses, historyIncomplete };
  } finally { pool.close(RELAYS); }
}

function queryDataFromFetch(
  data: StatsFetchData, labels: ProviderLabels, refreshedAt: number | null,
): StatsQueryData {
  const timelines = buildTimelinesFromCoords(Object.values(data.coords), labels);
  const delivered = Object.values(data.relayStatuses).some((relay) => relay.state === "active" || relay.state === "done");
  return { timelines, relayStatuses: data.relayStatuses, historyIncomplete: data.historyIncomplete, refreshedAt,
    emptyMessage: timelines.length ? null : delivered ? "No supported analytics reports found yet." : "No relay returned analytics stats. Retrying shortly." };
}

async function fetchStatsSnapshotsWithFallback(
  signal?: AbortSignal,
  onProgress?: (data: StatsQueryData) => void,
): Promise<StatsQueryData> {
  const cachedCoords = await readStatsCache();
  // Labels are read in parallel with the report walk so the extra kind costs
  // one bounded query instead of another round of pagination. Cached names are
  // the floor: a relay that answers nothing this round must not downgrade a
  // named provider back to its node id.
  const labelsPromise = fetchProviderLabels();
  const cachedLabels = readProviderLabelsCache();
  if (Object.keys(cachedCoords).length) onProgress?.(queryDataFromFetch({ coords: cachedCoords, relayStatuses: createInitialRelayStatuses(), historyIncomplete: false }, cachedLabels, null));
  try {
    const live = await fetchStatsSnapshots(cachedCoords, signal, (data) => {
      if (Object.keys(data.coords).length) onProgress?.(queryDataFromFetch(data, cachedLabels, null));
    });
    const labels = { ...cachedLabels, ...await labelsPromise };
    writeProviderLabelsCache(labels);
    return queryDataFromFetch({ ...live, coords: await updateStatsCache(live.coords) }, labels, Date.now());
  } catch (error) {
    if (isAbortError(error)) throw error;
    // Cached reports keep their labels when the network half-fails.
    if (Object.keys(cachedCoords).length) return queryDataFromFetch({ coords: cachedCoords, relayStatuses: createInitialRelayStatuses(), historyIncomplete: true }, cachedLabels, null);
    throw error;
  }
}

type Mode = "requests" | "sats" | "tokens";
type Split = "models" | "makers" | "open";
const KINDS = { open: "Open models", closed: "Closed models", unknown: "Not known" } as const;
/** One row of a list: what it adds up to, and its value in each bar of the chart. */
type Row = { requests: number; sats: number; tokens: number; bars: number[][] };

const WINDOWS: { id: WindowKey; label: string; said: string }[] = [
  { id: "7d", label: "7 days", said: "7 days" },
  { id: "30d", label: "30 days", said: "30 days" },
  { id: "90d", label: "90 days", said: "90 days" },
  { id: "365d", label: "1 year", said: "year" },
];
const MODES: { id: Mode; label: string; unit: string }[] = [
  { id: "requests", label: "Requests", unit: "requests" },
  { id: "sats", label: "Sats paid", unit: "sats" },
  { id: "tokens", label: "Tokens", unit: "tokens" },
];
const AT: Record<Mode, number> = { requests: 0, sats: 1, tokens: 2 };
/* The four largest parts of the chart each keep a colour of their own; the rest is one grey.
   These four stay apart for colour-blind readers too, and none is gold, which means sats here. */
const COLOURS = ["#3987e5", "#199e70", "#9085e9", "#d55181"];
const REST = "color-mix(in srgb, var(--foreground) 22%, transparent)";
const DIM = "color-mix(in srgb, var(--foreground) 13%, transparent)";
const PARTS = 4;
const FIRST_ROWS = 7;
const MORE_ROWS = 10;

const empty = (bars: number): Row => ({ requests: 0, sats: 0, tokens: 0, bars: Array.from({ length: bars }, () => [0, 0, 0]) });
const count = (value: number) => (value > 0 ? formatCompactCount(value) : "—");
const percent = (part: number) => (!(part > 0) ? "—" : part < 0.005 ? "<1%" : `${Math.round(part * 100)}%`);
const each = (value: number) => (value >= 10 ? Math.round(value).toString() : value >= 0.1 ? value.toFixed(1) : value > 0 ? "<0.1" : "0");

/**
 * One name for a model on this page, however a node spells it. The reports name the same model
 * with a dash for the dot ("claude-opus-5-5") and with the date of a pinned release at the end
 * ("-20260921", "-1017"); here, where only use is counted, those are one row. Names that mean
 * another product ("-flash", "tinfoil-") are left alone.
 */
const family = (model: string) =>
  model
    .replace(/-20\d{2}-?(0[1-9]|1[0-2])-?(0[1-9]|[12]\d|3[01])$/, "")
    .replace(/-(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/, "")
    .replace(/(\d)-(\d)(?![\da-z.])/g, "$1.$2");

/** What the bars add up to, and the same split by model or by maker. */
function tally(metrics: StatsDay[], split: Split, open?: Map<string, boolean>) {
  const rows = new Map<string, Row>();
  // whose mark stands before a row: found from the model's name, and kept for the maker's row too
  const marks = new Map<string, ReturnType<typeof companyIn>>();
  const totals = empty(metrics.length);
  metrics.forEach((bar, index) => {
    const whole = [bar.total_successful, bar.total_revenue_msats / 1000, bar.total_tokens];
    totals.requests += whole[0];
    totals.sats += whole[1];
    totals.tokens += whole[2];
    totals.bars[index] = whole;
    const names = Array.from(new Set([...Object.keys(bar.model_counts ?? {}), ...Object.keys(bar.model_revenue_msats ?? {}), ...Object.keys(bar.model_tokens ?? {})]));
    for (const name of names) {
      const model = family(usageKey(name));
      if (!model || model === "unknown") continue;
      const known = open?.get(model);
      const company = companyIn(model);
      const key = split === "models" ? model
        : split === "makers" ? (company?.name ?? "Other makers")
        : known === undefined ? KINDS.unknown : known ? KINDS.open : KINDS.closed;
      const row = rows.get(key) ?? empty(metrics.length);
      const values = [bar.model_counts?.[name] ?? 0, (bar.model_revenue_msats?.[name] ?? 0) / 1000, bar.model_tokens?.[name] ?? 0];
      row.requests += values[0];
      row.sats += values[1];
      row.tokens += values[2];
      values.forEach((value, at) => (row.bars[index][at] += value));
      rows.set(key, row);
      if (split !== "open") marks.set(key, company);
    }
  });
  return { rows, totals, marks };
}

function StatsPageContent() {
  const [selectedWindow, setSelectedWindow] = useState<WindowKey>("30d");
  const [mode, setMode] = useState<Mode>("sats");
  const [split, setSplit] = useState<Split>("models");
  const [lit, setLit] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [shownParts, setShownParts] = useState(FIRST_ROWS);
  const [shownNodes, setShownNodes] = useState(FIRST_ROWS);
  const queryClient = useQueryClient();
  const emptyTimelines = useMemo<ProviderTimeline[]>(() => [], []);
  const { data, error: queryError, isPending } = useQuery({
    queryKey: STATS_QUERY_KEY,
    // A refresh keeps the last checked result on screen, not unchecked progress.
    queryFn: ({ signal }) => fetchStatsSnapshotsWithFallback(signal, queryClient.getQueryData(STATS_QUERY_KEY)
      ? undefined : (progress) => { queryClient.setQueryData(STATS_QUERY_KEY, progress); }),
    placeholderData: (previousData) => previousData,
    gcTime: STATS_CACHE_TTL_MS,
    refetchInterval: (query) => ((query.state.data?.timelines?.length ?? 0) > 0 ? STATS_REFETCH_MS : STATS_EMPTY_RETRY_MS),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
  const timelines = data?.timelines ?? emptyTimelines;
  const loading = isPending && !data;
  const error = timelines.length > 0 ? null
    : (data?.emptyMessage ?? (loading ? null : queryError instanceof Error ? queryError.message : queryError ? "Unable to load analytics snapshots." : null));

  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(dayKey(Date.now()));
    const timer = window.setInterval(() => setToday(dayKey(Date.now())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const range = useMemo(() => completedRange(selectedWindow, today ? Date.parse(`${today}T00:00:00Z`) : 0), [selectedWindow, today]);
  const grouping: StatsGrouping = selectedWindow === "365d" ? "weekly" : "daily";
  // Reports are signed but self-reported. Drop staging hosts, known test signers
  // and provider-days whose revenue is orders of magnitude off the window
  // median before anything is counted, so totals and shares agree.
  const { providers: visible, sanity } = useMemo(() => sanitizeStatsProviders(timelines, range), [timelines, range]);

  // A node's name comes with its report: the loader joins it from the node's announcement.
  // Two nodes can carry the same name, so those rows also show the start of their key.
  const nameOf = useMemo(() => new Map(visible.map((provider) => [provider.providerId, provider.providerLabel])), [visible]);
  const sameName = useMemo(() => {
    const seen = new Map<string, number>();
    for (const provider of visible) seen.set(provider.providerLabel, (seen.get(provider.providerLabel) ?? 0) + 1);
    return new Set(Array.from(seen.entries()).filter(([, count]) => count > 1).map(([label]) => label));
  }, [visible]);

  const node = nodeId ? (visible.find((provider) => provider.providerId === nodeId) ?? null) : null;
  const all = useMemo(() => selectStats(visible, range, grouping), [visible, range, grouping]);
  const mine = useMemo(() => (node ? selectStats([node], range, grouping) : null), [node, range, grouping]);
  const selection = mine ?? all;
  /* Whether a model's weights are public comes from OpenRouter's list, under the names this page
     gives models. A model the list does not know is not guessed at. */
  const [open, setOpen] = useState<Map<string, boolean>>(() => new Map());
  useEffect(() => {
    let alive = true;
    void fetchListData().then((list) => {
      if (!alive) return;
      const byName = new Map<string, boolean>();
      list.open.forEach((isOpen, id) => {
        const name = family(usageKey(id));
        byName.set(name, (byName.get(name) ?? false) || isOpen);
      });
      setOpen(byName);
    });
    return () => { alive = false; };
  }, []);
  const { rows, totals, marks } = useMemo(() => tally(selection.metrics, split, open), [selection.metrics, split, open]);
  const at = AT[mode];
  const value = (row: Row) => (mode === "requests" ? row.requests : mode === "sats" ? row.sats : row.tokens);
  const ranked = useMemo(
    () => Array.from(rows.entries()).sort((a, b) => (mode === "requests" ? b[1].requests - a[1].requests : mode === "sats" ? b[1].sats - a[1].sats : b[1].tokens - a[1].tokens)),
    [rows, mode],
  );
  const partsKey = ranked.filter(([name]) => name !== "Other makers").slice(0, PARTS).map(([name]) => name).join("\n");
  const parts = useMemo(() => (partsKey ? partsKey.split("\n") : []), [partsKey]);

  /* A part keeps its colour while it stays among the largest, whatever the chart is drawing:
     colour follows the model, not its place in the list. */
  const [held, setHeld] = useState<Record<string, number>>({});
  const slots = useMemo(() => {
    const next: Record<string, number> = {};
    for (const name of parts) if (held[name] !== undefined && !Object.values(next).includes(held[name])) next[name] = held[name];
    for (const name of parts) {
      if (next[name] !== undefined) continue;
      next[name] = COLOURS.findIndex((_, index) => !Object.values(next).includes(index));
    }
    return next;
  }, [parts, held]);
  useEffect(() => {
    if (JSON.stringify(slots) !== JSON.stringify(held)) setHeld(slots);
  }, [slots, held]);
  const colour = (name: string) => (slots[name] !== undefined ? COLOURS[slots[name]] : REST);

  const nodeRows = useMemo(() => visible
    .map((provider) => {
      const own = selectStats([provider], range, grouping);
      if (!own.hasData) return null;
      const sum = tally(own.metrics, "makers").totals;
      return { id: provider.providerId, requests: sum.requests, sats: sum.sats, tokens: sum.tokens };
    })
    .filter((row): row is { id: string; requests: number; sats: number; tokens: number } => row !== null && (row.requests > 0 || row.sats > 0)),
  [visible, range, grouping]);
  const network = useMemo(() => tally(all.metrics, "makers").totals, [all.metrics]);
  const nodesRanked = [...nodeRows].sort((a, b) => (mode === "requests" ? b.requests - a.requests : mode === "sats" ? b.sats - a.sats : b.tokens - a.tokens));

  // what is picked must still be there after the period or the split changes
  const litRow = lit ? (rows.get(lit) ?? null) : null;
  const pick = (name: string) => { setLit((now) => (now === name ? null : name)); pulse(); };
  const pickNode = (id: string | null) => { setNodeId((now) => (now === id ? null : id)); setLit(null); pulse(); };

  // the chart: a bar for each day (each week over a year), cut into its parts
  const heights = totals.bars.map((bar) => bar[at]);
  const max = Math.max(0, ...heights);
  const pow = max > 0 ? 10 ** Math.floor(Math.log10(max)) : 1;
  const step = [0.25, 0.5, 1, 2, 2.5, 5].map((m) => m * pow).find((size) => max / size <= 4) ?? pow;
  const lines: number[] = [];
  for (let line = step; line < max * 0.98; line += step) lines.push(line);
  const top = Math.max((lines.at(-1) ?? 0) + step * 0.35, max * 1.05, 1);
  const cut = (index: number) => {
    const whole = heights[index];
    if (litRow && lit) {
      const part = Math.min(whole, litRow.bars[index][at]);
      return [{ name: lit, value: part, fill: slots[lit] !== undefined ? colour(lit) : mode === "sats" ? "var(--gold)" : "var(--ink)" }, { name: "Everything else", value: whole - part, fill: DIM }];
    }
    const list = parts.map((name) => ({ name, value: rows.get(name)?.bars[index][at] ?? 0, fill: colour(name) }));
    if (split !== "open") list.push({ name: split === "models" ? "All other models" : "All other makers", value: Math.max(0, whole - list.reduce((sum, part) => sum + part.value, 0)), fill: REST });
    return list;
  };
  const date = (index: number) => {
    const bar = selection.metrics[index];
    const from = new Date(bar.timestamp).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
    if (grouping !== "weekly" || !bar.period_end) return from;
    return `${from} to ${new Date(Date.parse(bar.period_end) - DAY_MS).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  };
  const ticks = selection.metrics.length > 1 ? [0, Math.round((selection.metrics.length - 1) / 3), Math.round(((selection.metrics.length - 1) * 2) / 3), selection.metrics.length - 1] : [0];
  const unit = MODES.find((option) => option.id === mode)!.unit;
  const said = WINDOWS.find((option) => option.id === selectedWindow)!.said;
  const nodeName = node ? nameOf.get(node.providerId) : null;
  const hasPartialCoverage = selection.reportedProviderDays < selection.expectedProviderDays || selection.completeProviderDays < selection.reportedProviderDays;
  const relays = Object.values(data?.relayStatuses ?? {});

  const share = (row: { requests: number; sats: number }, of: { requests: number; sats: number }) => (
    <>
      <span className="st-share" data-by={mode === "requests" || undefined}>
        <u><i style={{ width: `${of.requests > 0 ? (row.requests / of.requests) * 100 : 0}%` }} /></u>
        <b>{count(row.requests)}</b>
        <em>{percent(row.requests / of.requests)}</em>
      </span>
      <span className="st-share" data-sats data-by={mode === "sats" || undefined}>
        <u><i style={{ width: `${of.sats > 0 ? (row.sats / of.sats) * 100 : 0}%` }} /></u>
        <b>{count(row.sats)}</b>
        <em>{percent(row.sats / of.sats)}</em>
      </span>
    </>
  );
  // Every reported token over every completed request; a request whose provider sent no usage adds nothing.
  const tokensEach = totals.requests > 0 ? totals.tokens / totals.requests : null;
  const leftRows = ranked.slice(0, shownParts);
  const rightRows = nodesRanked.slice(0, shownNodes);
  const answered = relays.filter((relay) => RELAY_STATE_META[relay.state].answered).length;

  return (
    <SiteShell>
      <section className="pg st">
        <p className="pg-label">Stats</p>
        <h1 className="pg-title">
          <span><i>What runs</i></span>
          <span><i style={{ "--i": 1 } as CSSProperties}>through it.</i></span>
        </h1>
        <p className="pg-lede">
          {all.hasData ? <><b>{all.reportingProviders}</b> nodes published what they served in the last {said}, each signed with its own key. This is their count, added up.</>
            : "Nodes can publish what they served, each signed with its own key. This is their count, added up."}
        </p>
        <div className="pg-tools st-tools">
          <div className="pg-switch" role="group" aria-label="Period">
            {WINDOWS.map((option) => (
              <button key={option.id} type="button" aria-pressed={selectedWindow === option.id} onClick={() => { setSelectedWindow(option.id); setOver(null); }}>{option.label}</button>
            ))}
          </div>
          {nodeName ? (
            <p className="st-only">Showing only <b>{nodeName}</b><button type="button" onClick={() => pickNode(null)}>Show all nodes</button></p>
          ) : null}
          {relays.length > 0 ? (
            <p className="pg-relays pg-far" role="img" aria-label={`${answered} of ${relays.length} relays answered`}>
              {relays.map((relay) => (
                <i key={relay.url} data-on={RELAY_STATE_META[relay.state].answered || undefined} title={`${relay.url.replace(/^wss:\/\//, "").replace(/\/$/, "")}: ${RELAY_STATE_META[relay.state].label}`} />
              ))}
              <span>{answered} of {relays.length} relays</span>
            </p>
          ) : null}
        </div>

        {loading ? (
          <p className="pg-none">Reading the reports from the relays…</p>
        ) : error ? (
          <p className="pg-none">{error}</p>
        ) : !selection.hasData ? (
          <p className="pg-none">No report covers this period. A missing report does not mean nothing was served.</p>
        ) : (
          <>
            <div className="st-nums" role="group" aria-label="What the chart draws">
              <button type="button" className="st-num" aria-pressed={mode === "requests"} onClick={() => setMode("requests")}>
                <b>{count(totals.requests)}</b><span>Requests</span>
                <small>{count(totals.requests / range.days)} a day</small>
              </button>
              <button type="button" className="st-num" aria-pressed={mode === "sats"} onClick={() => setMode("sats")}>
                <b>{count(totals.sats)}</b><span>Sats paid to {node ? "this node" : "nodes"}</span>
                <small>{totals.requests > 0 ? `${each(totals.sats / totals.requests)} sats a request` : " "}</small>
              </button>
              <button type="button" className="st-num" aria-pressed={mode === "tokens"} onClick={() => setMode("tokens")}>
                <b>{count(totals.tokens)}</b><span>Tokens</span>
                <small>{tokensEach === null ? " " : `${count(tokensEach)} a request`}</small>
              </button>
            </div>

            <div className="st-chart">
              <div className="st-cap">
                {litRow && lit ? (
                  <>
                    <p><u className="st-chip" style={{ background: cut(0)[0].fill }} /><b>{lit}</b> · {count(value(litRow))} {unit} · {percent(value(litRow) / value(totals))} of all</p>
                    <p className="st-quiet">{litRow.requests > 0 ? `${each(litRow.sats / litRow.requests)} sats a request` : ""}</p>
                  </>
                ) : (
                  <>
                    <p><b>{MODES.find((option) => option.id === mode)!.label} a {grouping === "weekly" ? "week" : "day"}</b></p>
                    <p className="st-key">
                      {cut(0).map((part) => <span key={part.name}><u className="st-chip" style={{ background: part.fill }} />{part.name}</span>)}
                    </p>
                  </>
                )}
              </div>
              <div className="st-plot" onPointerLeave={() => setOver(null)}>
                {lines.map((line) => <div key={line} className="st-line" style={{ bottom: `${(line / top) * 100}%` }}><em>{formatCompactCount(line)}</em></div>)}
                <div className="st-line" style={{ bottom: 0 }} />
                {heights.map((height, index) => (
                  <button
                    key={selection.metrics[index].timestamp}
                    type="button"
                    className="st-slot"
                    data-over={over === index || undefined}
                    aria-label={`${date(index)}: ${count(height)} ${unit}`}
                    onPointerEnter={() => setOver(index)}
                    onFocus={() => setOver(index)}
                    onBlur={() => setOver(null)}
                    onClick={() => setOver(index)}
                  >
                    <span className="st-bar" style={{ height: `${(height / top) * 100}%` }}>
                      {cut(index).map((part) => (part.value > 0 ? <i key={part.name} style={{ flex: `${part.value} 0 0`, background: part.fill }} /> : null))}
                    </span>
                  </button>
                ))}
                {over !== null && over < heights.length ? (
                  <div className="st-tip" data-left={over > heights.length / 2 || undefined} style={{ "--at": (over + 0.5) / heights.length } as CSSProperties}>
                    <h3>{date(over)} · {count(heights[over])} {unit}</h3>
                    <p>{selection.metrics[over].coverage === "missing" ? "No node reported" : `${visible.filter((provider) => (node ? provider === node : true) && selectStats([provider], range, grouping).metrics[over]?.coverage !== "missing").length} ${node ? "node" : "nodes"} reported`}</p>
                    {cut(over).map((part) => (
                      <div key={part.name}><u className="st-chip" style={{ background: part.fill }} /><span>{part.name}</span><b>{count(part.value)}</b><em>{percent(part.value / heights[over])}</em></div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="st-days">{ticks.map((index) => <span key={index}>{date(index).split(" to ")[0]}</span>)}</div>
            </div>

            <div className="st-two">
              <div>
                <div className="st-head">
                  <h2>{node ? "What it served" : "What was asked for"}</h2>
                  <div className="pg-switch" role="group" aria-label="Split by">
                    <button type="button" aria-pressed={split === "models"} onClick={() => { setSplit("models"); setLit(null); setShownParts(FIRST_ROWS); }}>Models</button>
                    <button type="button" aria-pressed={split === "makers"} onClick={() => { setSplit("makers"); setLit(null); setShownParts(FIRST_ROWS); }}>Makers</button>
                    {open.size > 0 ? <button type="button" aria-pressed={split === "open"} onClick={() => { setSplit("open"); setLit(null); setShownParts(FIRST_ROWS); }}>Open or closed</button> : null}
                  </div>
                </div>
                <div className="st-cols"><span>{split === "models" ? "Model" : split === "makers" ? "Maker" : "Weights"}</span><span className="st-over" data-by={mode === "requests" || undefined}><b>Requests</b><em>share</em></span><span className="st-over" data-by={mode === "sats" || undefined}><b>Sats paid</b><em>share</em></span></div>
                {leftRows.map(([name, row], index) => (
                  <button key={name} type="button" className="st-row" style={{ "--n": Math.max(0, index - Math.max(FIRST_ROWS, shownParts - MORE_ROWS)) } as CSSProperties} data-on={lit === name || undefined} aria-pressed={lit === name} onClick={() => pick(name)}>
                    <span className="st-name">
                      <u className="st-chip" style={{ background: colour(name) }} />
                      {split === "open" ? null : <Mark company={marks.get(name)} />}
                      <span>{name}</span>
                    </span>
                    {share(row, totals)}
                  </button>
                ))}
                {ranked.length > FIRST_ROWS ? (
                  <p className="pg-rest">
                    <span className="pg-count">{leftRows.length} of {ranked.length}</span>
                    {shownParts < ranked.length ? <button type="button" onClick={() => setShownParts(shownParts + MORE_ROWS)}>Show {Math.min(MORE_ROWS, ranked.length - shownParts)} more</button> : null}
                    {shownParts > FIRST_ROWS ? <button type="button" onClick={() => setShownParts(FIRST_ROWS)}>Show fewer</button> : null}
                  </p>
                ) : null}
              </div>
              <div>
                <div className="st-head"><h2>Which nodes served it</h2></div>
                <div className="st-cols"><span>Node</span><span className="st-over" data-by={mode === "requests" || undefined}><b>Requests</b><em>share</em></span><span className="st-over" data-by={mode === "sats" || undefined}><b>Sats paid</b><em>share</em></span></div>
                {rightRows.map((row, index) => (
                  <button key={row.id} type="button" className="st-row" style={{ "--n": Math.max(0, index - Math.max(FIRST_ROWS, shownNodes - MORE_ROWS)) } as CSSProperties} data-on={nodeId === row.id || undefined} aria-pressed={nodeId === row.id} onClick={() => pickNode(row.id)}>
                    <span className="st-name"><span>{nameOf.get(row.id)}{sameName.has(nameOf.get(row.id) ?? "") ? <small> {providerShortId(row.id)}</small> : null}</span></span>
                    {share(row, network)}
                  </button>
                ))}
                {nodesRanked.length > FIRST_ROWS ? (
                  <p className="pg-rest">
                    <span className="pg-count">{rightRows.length} of {nodesRanked.length}</span>
                    {shownNodes < nodesRanked.length ? <button type="button" onClick={() => setShownNodes(shownNodes + MORE_ROWS)}>Show {Math.min(MORE_ROWS, nodesRanked.length - shownNodes)} more</button> : null}
                    {shownNodes > FIRST_ROWS ? <button type="button" onClick={() => setShownNodes(FIRST_ROWS)}>Show fewer</button> : null}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="st-foot">Whole UTC days, today left out. A node that sends no report adds nothing, so real use is higher.</p>
            <details className="st-how">
              <summary>How this is counted</summary>
              <p>{dayKey(range.start)} to {dayKey(range.end - DAY_MS)} UTC. {data?.refreshedAt ? `Checked ${formatUpdatedAt(data.refreshedAt / 1000)} UTC.` : "Showing saved reports the relays have not confirmed yet."}</p>
              {grouping === "weekly" ? <p>Over a year the bars are weeks, Thursday to Wednesday, so that older reports fit. They can hold older totals that have no daily split.</p> : null}
              {hasPartialCoverage ? <p>Some nodes have no report for parts of this period. Totals and shares use the reports received. Nothing missing is filled in.</p> : null}
              {sanity.hiddenProviders > 0 ? <p>{sanity.hiddenProviders === 1 ? "One node is" : `${sanity.hiddenProviders} nodes are`} left out: test or staging nodes.</p> : null}
              {sanity.droppedBuckets > 0 ? <p>{sanity.droppedBuckets === 1 ? "One report is" : `${sanity.droppedBuckets} reports are`} left out: the sats they claim are far above every other report.</p> : null}
              {data?.historyIncomplete ? <p>Some reports could not be fetched.</p> : null}
              {relays.length > 0 ? <p>Relays: {relays.map((relay) => `${relay.url.replace(/^wss:\/\//, "").replace(/\/$/, "")} ${RELAY_STATE_META[relay.state].label}`).join(", ")}.</p> : null}
            </details>
          </>
        )}
      </section>
    </SiteShell>
  );
}



export default function StatsPage() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StatsPageContent />
    </QueryClientProvider>
  );
}
