"use client";

import { useEffect, useState } from "react";
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

/**
 * Every node's own model list.
 *
 * On a first visit the nodes answer one by one over a few seconds; a page that
 * rebuilt itself for each would stutter, so the answers are handed over
 * together, at most twice a second. On a later visit the lists of the last one
 * show at once, and the new ones replace them in one step when all nodes have
 * answered.
 */
export function useNodeLists(): { nodes: NodeList[]; loading: boolean; discovery: ProviderDiscoveryProgress } {
  const [nodes, setNodes] = useState<NodeList[]>([]);
  const [loading, setLoading] = useState(true);
  // how many nodes the search has found so far, and which relays have answered it
  const [discovery, setDiscovery] = useState(initialProviderDiscovery);
  useEffect(() => {
    let active = true;
    let timer = 0;
    void (async () => {
      const saved = await readSaved();
      if (!active) return;
      if (saved) {
        setNodes(saved);
        setLoading(false);
      }
      const all: NodeList[] = [];
      let waiting: NodeList[] = [];
      const handOver = () => {
        timer = 0;
        const arrived = waiting;
        waiting = [];
        if (!active || arrived.length === 0) return;
        setNodes((prev) => {
          const keys = new Set(arrived.map((node) => node.provider.pubkey));
          return [...prev.filter((node) => !keys.has(node.provider.pubkey)), ...arrived];
        });
      };
      await fetchModels((provider, models) => {
        const answer = { provider, models };
        all.push(answer);
        // with saved lists on the page, the new ones wait until they are complete
        if (saved) return;
        waiting = [...waiting.filter((node) => node.provider.pubkey !== provider.pubkey), answer];
        if (!timer) timer = window.setTimeout(handOver, HAND_OVER_MS);
      }, (progress) => {
        if (active) setDiscovery(progress);
      });
      window.clearTimeout(timer);
      handOver();
      // one answer per node, the last one given
      const latest = Array.from(new Map(all.map((node) => [node.provider.pubkey, node])).values());
      const answered = latest.some((node) => node.models.length > 0);
      if (active && saved && answered) setNodes(latest);
      if (active) setLoading(false);
      if (answered) void save(latest);
    })();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  return { nodes, loading, discovery };
}
