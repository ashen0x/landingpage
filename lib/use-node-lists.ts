"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchModels, type Model, type Provider } from "@/app/data/models";
import { initialProviderDiscovery, type ProviderDiscoveryProgress } from "@/lib/api/providers";

export type NodeList = { provider: Provider; models: Model[] };

/** How often, at most, the page is handed the answers that came in. */
const HAND_OVER_MS = 500;
/** Lists from an earlier visit are shown at once if they are no older than this. */
const KEEP_MS = 7 * 24 * 60 * 60_000;

/* The lists of the last visit, kept in the browser. They are too large for
   localStorage (every node's every model), so they live in IndexedDB. Any
   failure here just means there is nothing saved. */
const STORE = "lists";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("routstr-node-lists", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readSaved(): Promise<NodeList[] | null> {
  try {
    const db = await open();
    const saved = await new Promise<{ at: number; nodes: NodeList[] } | undefined>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get("latest");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return saved && Date.now() - saved.at < KEEP_MS && saved.nodes.length > 0 ? saved.nodes : null;
  } catch {
    return null;
  }
}
async function save(nodes: NodeList[]) {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).put({ at: Date.now(), nodes }, "latest");
    db.close();
  } catch {
    // nothing is saved: the next visit loads as a first one
  }
}

/** The nodes are asked again when a page opens and the last answers are older than this. */
const ASK_AGAIN_MS = 5 * 60_000;

type Lists = { nodes: NodeList[]; loading: boolean; discovery: ProviderDiscoveryProgress };

/* One pass over the nodes serves every page of a visit: the answers live here, outside any page,
   so moving from one page to the next asks no node again. */
const NOTHING: Lists = { nodes: [], loading: true, discovery: initialProviderDiscovery() };
let lists = NOTHING;
let asking = false;
let askedAt = 0;
const watchers = new Set<() => void>();
function set(change: Partial<Lists>) {
  lists = { ...lists, ...change };
  watchers.forEach((tell) => tell());
}
function watch(tell: () => void) {
  watchers.add(tell);
  return () => {
    watchers.delete(tell);
  };
}

async function ask() {
  asking = true;
  try {
    // lists already shown (an earlier pass, or the last visit's) stay until the new ones are complete
    const kept = lists.nodes.length > 0 ? lists.nodes : await readSaved();
    if (kept && lists.nodes.length === 0) set({ nodes: kept, loading: false });
    const all: NodeList[] = [];
    let waiting: NodeList[] = [];
    let timer = 0;
    const handOver = () => {
      timer = 0;
      const arrived = waiting;
      waiting = [];
      if (arrived.length === 0) return;
      const keys = new Set(arrived.map((node) => node.provider.pubkey));
      set({ nodes: [...lists.nodes.filter((node) => !keys.has(node.provider.pubkey)), ...arrived] });
    };
    await fetchModels((provider, models) => {
      const answer = { provider, models };
      all.push(answer);
      // with lists on the page, the new ones wait until they are complete
      if (kept) return;
      waiting = [...waiting.filter((node) => node.provider.pubkey !== provider.pubkey), answer];
      if (!timer) timer = window.setTimeout(handOver, HAND_OVER_MS);
    }, (progress) => set({ discovery: progress }));
    window.clearTimeout(timer);
    handOver();
    // one answer per node, the last one given
    const latest = Array.from(new Map(all.map((node) => [node.provider.pubkey, node])).values());
    const answered = latest.some((node) => node.models.length > 0);
    if (kept && answered) set({ nodes: latest });
    if (answered) void save(latest);
  } finally {
    set({ loading: false });
    askedAt = Date.now();
    asking = false;
  }
}

/**
 * Every node's own model list.
 *
 * On a first visit the nodes answer one by one over a few seconds; a page that
 * rebuilt itself for each would stutter, so the answers are handed over
 * together, at most twice a second. On a later visit the lists of the last one
 * show at once, and the new ones replace them in one step when all nodes have
 * answered.
 */
export function useNodeLists(): Lists {
  useEffect(() => {
    if (!asking && Date.now() - askedAt > ASK_AGAIN_MS) void ask();
  }, []);
  return useSyncExternalStore(watch, () => lists, () => NOTHING);
}
