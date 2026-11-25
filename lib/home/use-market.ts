"use client";

import { useEffect, useMemo, useState } from "react";
import { useNodeLists } from "@/lib/use-node-lists";
import { fetchModelIdMappings, fetchReviewLabels } from "@/lib/api/price-sources";
import {
  buildRadar,
  isApproved,
  type ModelIdMappings,
  type RadarNode,
  type RadarRow,
} from "@/lib/price-radar";

export interface Market {
  /** One row per model, its nodes in the order apps try them. */
  rows: RadarRow[];
  /** Approved nodes that answered with a model list. */
  nodeCount: number;
  /** Models at least one approved node sells. */
  modelCount: number;
  /** True until every announced node has answered or timed out. */
  loading: boolean;
}

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();

/**
 * The live market, read the way the prices page reads it: node announcements
 * and reviews from Nostr, each node's own price list, ranked as apps rank them.
 * Rows fill in as nodes answer.
 */
export function useMarket(): Market {
  const { nodes, loading } = useNodeLists();
  const [labels, setLabels] = useState<Map<string, string> | null>(null);
  const [mappings, setMappings] = useState<ModelIdMappings | null>(null);

  useEffect(() => {
    let active = true;
    void fetchReviewLabels().then((found) => active && setLabels(found));
    void fetchModelIdMappings().then((found) => active && setMappings(found));
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    if (!labels || !mappings) return { rows: [], nodeCount: 0, modelCount: 0, loading };
    const keysByUrl = new Map<string, Set<string>>();
    for (const { provider } of nodes) {
      for (const url of [provider.endpoint_url, ...provider.endpoint_urls]) {
        const keys = keysByUrl.get(normalizeUrl(url)) ?? new Set<string>();
        keys.add(provider.pubkey);
        keysByUrl.set(normalizeUrl(url), keys);
      }
    }
    // Several keys can announce one URL; it is one node, named by the newest.
    const byUrl = new Map<string, RadarNode>();
    const newestFirst = [...nodes].sort(
      (a, b) => b.provider.created_at - a.provider.created_at
    );
    for (const { provider, models } of newestFirst) {
      const url = normalizeUrl(provider.endpoint_url);
      if (models.length === 0 || byUrl.has(url)) continue;
      byUrl.set(url, {
        url: provider.endpoint_url,
        name: provider.name || provider.endpoint_url,
        approved: isApproved(keysByUrl.get(url) ?? [], labels),
        models: models.map((model) =>
          model.sats_unpriced ? { ...model, sats_pricing: null } : model
        ),
      });
    }
    const radarNodes = Array.from(byUrl.values());
    const rows = buildRadar(radarNodes, { mappings }).filter((row) => row.winner);
    return {
      rows,
      nodeCount: radarNodes.filter((node) => node.approved).length,
      modelCount: rows.length,
      loading,
    };
  }, [nodes, labels, mappings, loading]);
}
