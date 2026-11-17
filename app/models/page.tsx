"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-shell";
import { getModelNameWithoutProvider, type Model } from "@/app/data/models";
import { useNodeLists } from "@/lib/use-node-lists";
import { wholeSentences } from "@/lib/describe";
import { usePricingView } from "@/app/contexts/PricingContext";
import { ArrowDown, ArrowRight, ArrowUp, Search } from "lucide-react";
import { formatCompactContextLength, formatCompactCount, formatCompactPriceValue } from "@/lib/number-format";
import { usageKey, useModelUsage } from "@/lib/model-usage";
import { fetchListData, fetchModelIdMappings, fetchReviewLabels, type ListData } from "@/lib/api/price-sources";
import { canonicalModelId, isApproved, requestCost, type ModelIdMappings } from "@/lib/price-radar";
import { companyIn } from "@/components/stats/model-company-icon";
import { pulse } from "@/components/layout/Band";
import { Mark } from "@/components/layout/Mark";
import { Kinds } from "@/components/layout/Kinds";
import "@/components/layout/pages.css";

/** A node that sells a model, and what it asks for it. */
type Rates = { prompt: number; completion: number; input_cache_read?: number };
type Seller = {
  name: string;
  /** Sats for one request as apps price it (lib/price-radar): what nodes are ranked by.
   *  Null when the node names no price in sats. */
  cost: number | null;
  id: string;
  pubkey: string;
  endpoint: string;
  /** The model as this node lists it, and the id apps reach it by. */
  model: Model;
  as: string;
  sats: Rates;
  usd: Rates;
};
/** A seller, whether a request for the row's id reaches it, and whether apps trust it with one. */
type Offer = Seller & { route: boolean; approved: boolean };

/** What a model does, as its nodes describe it. */
const KINDS = [
  { key: "chat", label: "Chat" },
  { key: "thinks", label: "Thinks" },
  { key: "sees", label: "Sees images" },
  { key: "makes", label: "Makes images" },
  { key: "embeddings", label: "Embeddings" },
] as const;
type Kind = (typeof KINDS)[number]["key"];

/** The makers people look for first, in the order their marks are shown. The rest follow,
 *  the one with the most models first. */
const MAKERS_FIRST = ["Anthropic", "OpenAI", "Google", "xAI", "Meta", "DeepSeek", "Moonshot", "Z.ai", "MiniMax", "Alibaba", "Mistral"];
/** How many makers get a mark above the list. */
const MAKERS_SHOWN = 14;

/** Where the intelligence scores come from; they ask to be named wherever the scores show. */
const SCORES_BY = { name: "Artificial Analysis", href: "https://artificialanalysis.ai/" };

/** How many rows are shown at first, and how many more each time more are asked for. */
const FIRST_ROWS = 50;
const MORE_ROWS = 100;

const MIN_REASONABLE_CREATED = Date.UTC(2020, 0, 1) / 1000;
const MAX_FUTURE_SKEW_SECONDS = 7 * 24 * 60 * 60;

function normalizeCreated(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 0;
  // Accept both seconds and milliseconds timestamps.
  return value > 1_000_000_000_000 ? Math.floor(value / 1000) : value;
}

function inferCreatedFromModelId(modelId: string): number | null {
  const match = modelId.match(
    /(20\d{2})[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])/
  );
  if (!match) return null;
  const parsed = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function isReasonableCreated(value: number): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return (
    value >= MIN_REASONABLE_CREATED &&
    value <= nowSeconds + MAX_FUTURE_SKEW_SECONDS
  );
}

function getStableCreated(model: Model): number {
  const direct = normalizeCreated(model.created);
  const inferred = inferCreatedFromModelId(model.id);
  const candidates = [direct, inferred ?? 0].filter(
    (value) => value > 0 && isReasonableCreated(value)
  );
  if (candidates.length === 0) return 0;
  return Math.min(...candidates);
}

/** Where the nodes apps can use stand on price for one model: a tick per node, the one apps pick
 *  in gold, and OpenRouter's price as a dashed mark. `against` is the picked node's price over OpenRouter's. */
function Lane({ sellers, against }: { sellers: readonly Offer[]; against: number | null }) {
  const nodes = sellers.flatMap((node) =>
    node.approved && node.route && node.cost !== null ? [{ node, cost: node.cost }] : []
  );
  const best = nodes.at(0);
  // OpenRouter's price, in the sats the picked node would ask for it
  const listed = best && against ? best.cost / against : null;
  const costs = [...nodes.map(({ cost }) => cost), ...(listed ? [listed] : [])];
  if (costs.length < 2) return null;
  const low = Math.log(Math.min(...costs));
  const span = Math.log(Math.max(...costs)) - low;
  const at = (cost: number) => (span > 0 ? ((Math.log(cost) - low) / span) * 100 : 50);
  // a word starts at its tick on the left half, and ends at it on the right half
  const beside = (x: number) => (x < 50 ? { left: `${x}%` } : { right: `${100 - x}%` });
  const pct = against ? Math.max(-99, Math.round((against - 1) * 100)) : 0;
  return (
    <div className="pg-lane" data-listed={listed ? "" : undefined}>
      {listed && (
        <span className="pg-lane-top" style={beside(at(listed))}>
          OpenRouter
        </span>
      )}
      <div aria-hidden="true">
        {nodes.map(({ node, cost }) => (
          <i key={node.id} style={{ left: `${at(cost)}%` }} data-best={node === best?.node || undefined} />
        ))}
        {listed && <i data-list="" style={{ left: `${at(listed)}%` }} />}
      </div>
      {listed && best && (
        <span className="pg-lane-foot" data-under={pct < 0 || undefined} style={beside(at(best.cost))}>
          {pct === 0 ? "Same as OpenRouter" : `${Math.abs(pct)}% ${pct < 0 ? "under" : "over"} OpenRouter`}
        </span>
      )}
    </div>
  );
}

export default function ModelsPage() {
  const { currency, setCurrency } = usePricingView();
  const [searchTerm, setSearchTerm] = useState("");
  const [shown, setShown] = useState(FIRST_ROWS);
  const searchBox = useRef<HTMLInputElement>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: "name" | "context" | "created" | "input" | "output" | "used" | "against" | "score";
    direction: "asc" | "desc";
  }>({ key: "used", direction: "desc" });
  const [kind, setKind] = useState<Kind | null>(null);
  const [maker, setMaker] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const usage = useModelUsage();
  const [mappings, setMappings] = useState<ModelIdMappings>({});
  const [labels, setLabels] = useState<Map<string, string>>(() => new Map());
  const [list, setList] = useState<ListData>(() => ({ prices: new Map(), scores: new Map(), open: new Map() }));
  useEffect(() => {
    let active = true;
    void fetchModelIdMappings().then((found) => active && setMappings(found));
    void fetchReviewLabels().then((found) => active && setLabels(found));
    void fetchListData().then((found) => active && setList(found));
    return () => {
      active = false;
    };
  }, []);

  // each node's own list, as the nodes answer
  const { nodes, loading: isLoading } = useNodeLists();

  const isUnknownProvider = (name: string) => name.trim().toLowerCase() === "unknown";

  /* One row per model, under the id apps ask for it by. Ids that differ only by a vendor in
     front share a row. Two models that only share a display name do not: a request for one
     never reaches the other. */
  const entries = useMemo(() => {
    type Entry = {
      key: string;
      id: string;
      spellings: string[];
      sellers: Seller[];
      created: number;
      context: number;
      /** The fullest description a node gives of it. */
      about: string;
    };
    // Apps only send requests to nodes with an approving review. Several keys can
    // announce one address; it is one node, approved if one key is and none is blocked.
    const place = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();
    const keysAt = new Map<string, Set<string>>();
    for (const { provider } of nodes) {
      const at = place(provider.endpoint_url);
      keysAt.set(at, (keysAt.get(at) ?? new Set()).add(provider.pubkey));
    }
    const reviewed = labels.size > 0;
    const approved = (seller: Seller) =>
      !reviewed || isApproved(keysAt.get(place(seller.endpoint)) ?? [seller.pubkey], labels);
    const rates = (from: Rates | undefined): Rates => ({
      prompt: from?.prompt ?? 0,
      completion: from?.completion ?? 0,
      input_cache_read: from?.input_cache_read,
    });

    const byKey = new Map<string, Entry>();
    for (const { provider, models } of nodes) {
      for (const model of models) {
        const id = canonicalModelId(model, mappings);
        const key = usageKey(id);
        const entry = byKey.get(key) ?? { key, id, spellings: [], sellers: [], created: 0, context: 0, about: "" };
        // the shorter id is the one without a vendor in front
        if (id.length < entry.id.length) entry.id = id;
        entry.spellings.push(model.name, model.id, ...(model.alias_ids ?? []));
        entry.sellers.push({
          name: provider.name,
          cost: model.sats_unpriced ? null : requestCost(model.sats_pricing),
          id: provider.id,
          pubkey: provider.pubkey,
          endpoint: provider.endpoint_url,
          model,
          as: id,
          sats: rates(model.sats_pricing),
          usd: rates(model.pricing),
        });
        const created = getStableCreated(model) || normalizeCreated(model.created);
        if (created > 0 && (entry.created === 0 || created < entry.created)) entry.created = created;
        entry.context = Math.max(entry.context, model.context_length || 0);
        const told = wholeSentences(model.description ?? "");
        if (told.length > entry.about.length) entry.about = told;
        byKey.set(key, entry);
      }
    }
    return Array.from(byKey.values(), (entry) => {
      // a request for this id reaches a node that serves it under this id, for a price in sats
      const route = (seller: Seller) => seller.as === entry.id && seller.cost !== null && seller.cost > 0;
      const cost = (seller: Seller) => (route(seller) && seller.cost !== null ? seller.cost : Infinity);
      // one line per node. Where a node lists the model twice, apps take the one under this very id.
      const perNode = new Map<string, Seller>();
      const exactFirst = [...entry.sellers].sort(
        (a, b) => Number(b.model.id === entry.id) - Number(a.model.id === entry.id) || cost(a) - cost(b) || 0
      );
      for (const seller of exactFirst) if (!perNode.has(seller.id)) perNode.set(seller.id, seller);
      // approved nodes first, since that is where a request can go; a node that is no route
      // for this id sells nothing here, so it comes last, with the unnamed
      const rank = (seller: Seller) =>
        isUnknownProvider(seller.name) ? 3 : !route(seller) ? 2 : approved(seller) ? 0 : 1;
      // the order apps try nodes in: by the cost of one request, ties by address
      const sellers: Offer[] = Array.from(perNode.values(), (seller) => ({
        ...seller,
        route: route(seller),
        approved: approved(seller),
      })).sort((a, b) => rank(a) - rank(b) || cost(a) - cost(b) || a.endpoint.localeCompare(b.endpoint));
      const cheapest = sellers[0];
      // the readable name most nodes give it, and of those the shortest
      const heard = new Map<string, number>();
      for (const name of entry.spellings.map(getModelNameWithoutProvider)) {
        if (/[A-Z ]/.test(name) && !name.includes("/")) heard.set(name, (heard.get(name) ?? 0) + 1);
      }
      const names = Array.from(heard.keys()).sort(
        (a, b) => (heard.get(b) ?? 0) - (heard.get(a) ?? 0) || a.length - b.length || a.localeCompare(b)
      );
      // requests for it under any id a node serves it by (not its aliases: those are other rows)
      const counted = new Set([entry.id, ...entry.sellers.map((seller) => seller.model.id)].map(usageKey));
      const requests = Array.from(counted).reduce((sum, key) => sum + (usage.requests?.[key] ?? 0), 0);
      // the node apps pick, against OpenRouter, both in USD for the same request
      const mine = cheapest.approved && cheapest.route ? requestCost(cheapest.usd) : null;
      const theirs = requestCost(list.prices.get(entry.id));
      return {
        ...entry,
        // the model as the cheapest node sells it
        model: cheapest.model,
        sellers,
        name: names[0] ?? entry.id,
        company: companyIn(entry.spellings.join(" ")),
        against: mine && theirs ? mine / theirs : null,
        score: list.scores.get(entry.id) ?? null,
        thinks: entry.sellers.some((seller) => seller.model.reasons),
        requests,
        sats: cheapest.sats,
        usd: cheapest.usd,
        unknown: isUnknownProvider(cheapest.name),
      };
    });
  }, [nodes, mappings, labels, list, usage.requests]);

  // going up in price, a model with no price comes last, not first
  const asked = (value: number) => (value > 0 || sortConfig.direction === "desc" ? value : Infinity);
  const needle = searchTerm.trim().toLowerCase();

  const does = (entry: (typeof entries)[number], which: Kind) => {
    const gives = entry.model.architecture?.output_modalities ?? [];
    const takes = entry.model.architecture?.input_modalities ?? [];
    return which === "chat"
      ? gives.includes("text")
      : which === "thinks"
        ? entry.thinks
        : which === "sees"
          ? gives.includes("text") && takes.includes("image")
          : which === "makes"
            ? gives.includes("image")
            : gives.some((kind) => kind.startsWith("embedding"));
  };
  const makers = useMemo(() => {
    const found = new Map<string, { company: NonNullable<ReturnType<typeof companyIn>>; count: number }>();
    for (const { company } of entries) {
      if (company) found.set(company.name, { company, count: (found.get(company.name)?.count ?? 0) + 1 });
    }
    const place = (name: string) => (MAKERS_FIRST.includes(name) ? MAKERS_FIRST.indexOf(name) : MAKERS_FIRST.length);
    return Array.from(found.values())
      .sort(
        (a, b) =>
          place(a.company.name) - place(b.company.name) ||
          b.count - a.count ||
          a.company.name.localeCompare(b.company.name)
      )
      .slice(0, MAKERS_SHOWN);
  }, [entries]);

  // only as many marks as the row has room for, so none is cut in half
  const rail = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(MAKERS_SHOWN);
  const hasRail = entries.length > 0;
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const fit = new ResizeObserver(([box]) => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const mark = el.firstElementChild?.getBoundingClientRect().width ?? 0;
      if (mark > 0) setRoom(Math.max(1, Math.floor((box.contentRect.width + gap) / (mark + gap))));
    });
    fit.observe(el);
    return () => fit.disconnect();
  }, [hasRail]);

  const filteredModels = entries
    .filter(
      (entry) =>
        (!kind || does(entry, kind)) &&
        (!maker || entry.company?.name === maker) &&
        (!needle || entry.spellings.some((spelling) => spelling.toLowerCase().includes(needle)))
    )
    .sort((a, b) => {
      if (a.unknown !== b.unknown) return a.unknown ? 1 : -1;
      const rates = (entry: typeof a) => (currency === "sats" ? entry.sats : entry.usd);
      let comparison = 0;
      switch (sortConfig.key) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "created":
          comparison = a.created - b.created;
          break;
        case "context":
          comparison = a.context - b.context;
          break;
        case "input":
          comparison = asked(rates(a).prompt) - asked(rates(b).prompt) || 0;
          break;
        case "output":
          comparison = asked(rates(a).completion) - asked(rates(b).completion) || 0;
          break;
        case "used":
          // the most used first; among the unused, the newest
          comparison = a.requests - b.requests || a.created - b.created;
          break;
        case "against": {
          // a model OpenRouter does not list comes last either way
          const last = sortConfig.direction === "asc" ? Infinity : -Infinity;
          comparison = (a.against ?? last) - (b.against ?? last) || 0;
          break;
        }
        case "score": {
          // so does a model without a score; where scores are level, the most used first
          const last = sortConfig.direction === "asc" ? Infinity : -Infinity;
          comparison =
            (a.score ?? last) - (b.score ?? last) ||
            (a.requests - b.requests) * (sortConfig.direction === "asc" ? -1 : 1);
          break;
        }
      }
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });

  const table = useRef<HTMLDivElement>(null);
  const handleSort = (key: typeof sortConfig.key) => {
    setShown(FIRST_ROWS);
    // the names of the columns stay in sight far down the list: a new order is read from its top
    if ((table.current?.getBoundingClientRect().top ?? 0) < 0) table.current?.scrollIntoView();
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "created" || key === "used" || key === "score" ? "desc" : "asc",
      };
    });
  };
  /** The ready-made orders above the list. */
  const orders = [
    { label: "Most used", key: "used", direction: "desc" },
    { label: "Newest", key: "created", direction: "desc" },
    // only while the list OpenRouter publishes carries scores
    ...(list.scores.size > 0 ? [{ label: "Smartest", key: "score", direction: "desc" } as const] : []),
    { label: "Cheapest", key: "output", direction: "asc" },
    // its column has no room on a phone, so neither has the order
    { label: "Under OpenRouter", key: "against", direction: "asc", wide: true },
  ] as const;
  const showAll = () => {
    setSearchTerm("");
    setKind(null);
    setMaker(null);
    setShown(FIRST_ROWS);
  };

  const nodeCount = useMemo(
    () => new Set(nodes.filter((node) => node.models.length > 0).map((node) => node.provider.name)).size,
    [nodes]
  );

  // "/" puts the cursor in the search field; the arrows move the pick up and down the list
  const panel = useRef<HTMLElement>(null);
  const drawn = useRef<{ keys: string[]; at: number }>({ keys: [], at: 0 });
  const byKeys = useRef(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable]");
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchBox.current?.focus();
      }
      const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      // only where the picked model shows beside the list; in the search field the arrows have no other use
      if (!step || (typing && target !== searchBox.current) || !window.matchMedia("(min-width: 1200px)").matches) return;
      const { keys, at } = drawn.current;
      const next = keys[Math.min(keys.length - 1, Math.max(0, at + step))];
      if (!next) return;
      event.preventDefault();
      byKeys.current = true;
      setPicked(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // the list is long: it shows its first rows, and more only when asked
  const left = filteredModels.length - shown;

  const price = (value: number) =>
    !(value > 0)
      ? "—"
      : value * 1_000_000 < 0.005
        ? "<0.01"
        : currency === "sats"
        ? formatCompactPriceValue(value * 1_000_000)
        : formatCompactPriceValue(value * 1_000_000, { fixedSmallDecimals: true });

  /** The picked node's price against OpenRouter's, as the percent it is under or over. */
  const versus = (against: number | null) => {
    if (against === null) return "—";
    // a price above zero never reads as 100% under
    const pct = Math.max(-99, Math.round((against - 1) * 100));
    return pct < 0 ? `−${-pct}%` : pct > 0 ? `+${pct}%` : "0%";
  };

  const sortBy = (column: typeof sortConfig.key, label: ReactNode) => {
    const on = sortConfig.key === column;
    return (
      <button type="button" data-sort={on ? sortConfig.direction : undefined} onClick={() => handleSort(column)}>
        {label}
        {on && (sortConfig.direction === "asc" ? <ArrowUp /> : <ArrowDown />)}
      </button>
    );
  };

  // the columns beside the card (on a wide screen, and a tighter one), without it (and tighter), and on a phone
  const cols = {
    ["--cols" as string]: "minmax(0, 1fr) 7rem 4.6rem 4.6rem 7.6rem",
    ["--cols-tight" as string]: "minmax(0, 1fr) 4.6rem 4.6rem 7.6rem",
    ["--cols-mid" as string]: "minmax(0, 1fr) 7rem 4.6rem 4.6rem 7.6rem 1rem",
    ["--cols-mid-tight" as string]: "minmax(0, 1fr) 4.6rem 4.6rem 7.6rem 1rem",
    ["--cols-narrow" as string]: "minmax(0, 1fr) 3.9rem 3.9rem",
  };
  const sifted = Boolean(searchTerm || kind || maker);
  // the first column of numbers shows what the list is ordered by: requests, unless it is the date or the score
  const lead = sortConfig.key === "created" || sortConfig.key === "score" ? sortConfig.key : "used";
  const released = (created: number) =>
    created > 0
      ? new Date(created * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
      : "—";
  const total = entries.length.toLocaleString("en-US");
  const sats = currency === "sats";

  // the model shown on the right: the one clicked, or the first of the list
  const open = filteredModels.slice(0, shown).find((entry) => entry.key === picked) ?? filteredModels[0];
  const sellers = open?.sellers ?? [];
  useEffect(() => {
    drawn.current = {
      keys: filteredModels.slice(0, shown).map((entry) => entry.key),
      at: open ? filteredModels.indexOf(open) : 0,
    };
  });
  // another model in the card: it shows from its top, wherever the last one was scrolled to
  const openKey = open?.key;
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [openKey]);
  // a pick sends one lane of the light at the top of the page gold for a moment
  useEffect(() => {
    if (!picked) return;
    pulse();
    if (byKeys.current) document.querySelector(".pg-row[data-on]")?.scrollIntoView({ block: "nearest" });
    byKeys.current = false;
  }, [picked]);
  const door = sellers.find((node) => /^https:\/\/[^/]+/.test(node.endpoint) && !node.endpoint.includes(".onion"));
  const base = door ? door.endpoint.replace(/\/+$/, "").replace(/\/v1$/, "") : "https://your-node.example";
  const copyId = async () => {
    if (!open) return;
    try {
      await navigator.clipboard.writeText(open.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the id is still selectable
    }
  };

  return (
    <SiteShell>
      <section className="pg">
        <p className="pg-label">Models</p>
        <h1 className="pg-title">
          <span>
            <i>Every model,</i>
          </span>
          <span>
            <i style={{ ["--i" as string]: 1 }}>one market.</i>
          </span>
        </h1>
        <p className="pg-lede">
          {entries.length > 0 ? (
            <>
              <b>{total}</b> models from <b>{nodeCount}</b> nodes. Each request goes to the cheapest approved node
              that has the model you pick.
            </>
          ) : isLoading ? (
            "Asking the nodes what they sell."
          ) : (
            "No node answered just now."
          )}
        </p>

        <div className="pg-tools">
          <label className="pg-search">
            <Search aria-hidden="true" />
            <input
              ref={searchBox}
              type="search"
              placeholder={entries.length > 0 ? `Search ${total} models` : "Search models"}
              aria-label="Search models"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setShown(FIRST_ROWS);
              }}
            />
            {searchTerm ? (
              <button type="button" onClick={() => setSearchTerm("")}>
                Clear
              </button>
            ) : (
              <kbd className="pg-key" aria-hidden="true">
                /
              </kbd>
            )}
          </label>
          <div className="pg-switch" role="group" aria-label="Order">
            {orders.map((order) => (
              <button
                key={order.key}
                type="button"
                className={"wide" in order ? "pg-hide" : undefined}
                aria-pressed={sortConfig.key === order.key && sortConfig.direction === order.direction}
                onClick={() => {
                  setShown(FIRST_ROWS);
                  setSortConfig({ key: order.key, direction: order.direction });
                }}
              >
                {order.label}
              </button>
            ))}
          </div>
          {sifted && entries.length > 0 && (
            <span className="pg-count">
              {filteredModels.length.toLocaleString("en-US")} of {total}
            </span>
          )}
          <div className="pg-switch pg-far" role="group" aria-label="Show prices in">
            <button type="button" aria-pressed={sats} onClick={() => setCurrency("sats")}>
              sats
            </button>
            <button type="button" aria-pressed={!sats} onClick={() => setCurrency("usd")}>
              USD
            </button>
            <span>per 1M tokens</span>
          </div>
        </div>

        {hasRail && (
          <div className="pg-sift">
            <div className="pg-chips" role="group" aria-label="Kind of model">
              <button
                type="button"
                aria-pressed={!kind}
                onClick={() => {
                  setKind(null);
                  setShown(FIRST_ROWS);
                }}
              >
                All <i>{total}</i>
              </button>
              {KINDS.map((one) => {
                const count = entries.filter((entry) => does(entry, one.key)).length;
                return (
                  count > 0 && (
                    <button
                      key={one.key}
                      type="button"
                      aria-pressed={kind === one.key}
                      onClick={() => {
                        setKind(kind === one.key ? null : one.key);
                        setShown(FIRST_ROWS);
                      }}
                    >
                      {one.label} <i>{count.toLocaleString("en-US")}</i>
                    </button>
                  )
                );
              })}
            </div>
            <div ref={rail} className="pg-makers" role="group" aria-label="Maker">
              {makers.slice(0, room).map(({ company }) => (
                <button
                  key={company.name}
                  type="button"
                  title={company.name}
                  aria-label={company.name}
                  aria-pressed={maker === company.name}
                  onClick={() => {
                    setMaker(maker === company.name ? null : company.name);
                    setShown(FIRST_ROWS);
                  }}
                >
                  <company.icon aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={open ? "pg-two" : undefined}>
          <div ref={table} className="pg-list" style={cols}>
            <div className="pg-cols">
              {sortBy("name", "Model")}
              <span
                className="pg-end pg-hide pg-hide-tight"
                title={
                  lead === "used"
                    ? "Requests in the last 30 days, as the nodes report them"
                    : lead === "score"
                      ? `${SCORES_BY.name} Intelligence Index, as OpenRouter lists it`
                      : "When the model came out"
                }
              >
                {sortBy(
                  lead,
                  lead === "used" ? (
                    <>
                      Requests<small>30d</small>
                    </>
                  ) : lead === "score" ? (
                    "Intelligence"
                  ) : (
                    "Released"
                  )
                )}
              </span>
              <span className="pg-end">{sortBy("input", "Input")}</span>
              <span className="pg-end">{sortBy("output", "Output")}</span>
              <span
                className="pg-end pg-hide"
                title="One typical request at the cheapest approved node, against OpenRouter's price for it"
              >
                {sortBy("against", "vs OpenRouter")}
              </span>
              <span className="pg-only-mid" />
            </div>

            {lead === "score" && (
              <p className="pg-note">
                Intelligence Index by <a href={SCORES_BY.href}>{SCORES_BY.name}</a>, as OpenRouter lists it.{" "}
                {entries.filter((entry) => entry.score !== null).length} of {total} models have a score.
              </p>
            )}
            {entries.length === 0 && !isLoading ? (
              <p className="pg-none">
                No node answered.
                <button type="button" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </p>
            ) : entries.length === 0 ? (
              [...Array(9)].map((_, i) => (
                <div key={i} className="pg-row pg-ghost" style={{ ["--i" as string]: i }}>
                  <span style={{ width: `${46 + ((i * 17) % 34)}%` }} />
                  <span className="pg-end pg-hide pg-hide-tight" style={{ width: "50%" }} />
                  <span className="pg-end" style={{ width: "70%" }} />
                  <span className="pg-end" style={{ width: "70%" }} />
                  <span className="pg-end pg-hide" style={{ width: "40%" }} />
                  <span className="pg-only-mid" />
                </div>
              ))
            ) : filteredModels.length > 0 ? (
              <>
                {filteredModels.slice(0, shown).map((entry) => (
                  <Link
                    key={entry.key}
                    href={`/models/${entry.model.id}`}
                    className="pg-row"
                    data-on={entry === open || undefined}
                    onClick={(event) => {
                      // with room for two sides, a click shows the model beside the list
                      const plain = !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0;
                      if (plain && window.matchMedia("(min-width: 1200px)").matches) {
                        event.preventDefault();
                        setPicked(entry.key);
                      }
                    }}
                  >
                    <span className="pg-name pg-marked">
                      <Mark company={entry.company} />
                      <b>{entry.name}</b>
                      {entry.id !== entry.name && <code>{entry.id}</code>}
                    </span>
                    <span className="pg-num pg-end pg-hide pg-hide-tight" data-quiet>
                      {lead === "created"
                        ? released(entry.created)
                        : lead === "score"
                          ? (entry.score?.toFixed(1) ?? "—")
                          : entry.requests > 0
                            ? formatCompactCount(entry.requests)
                            : usage.requests || usage.done
                              ? "—"
                              : "·"}
                    </span>
                    <span className="pg-num pg-end">{price(sats ? entry.sats.prompt : entry.usd.prompt)}</span>
                    <span className="pg-num pg-end">{price(sats ? entry.sats.completion : entry.usd.completion)}</span>
                    <span
                      className="pg-num pg-end pg-hide"
                      data-quiet
                      data-under={(entry.against !== null && entry.against < 0.995) || undefined}
                    >
                      {versus(entry.against)}
                    </span>
                    <ArrowRight className="pg-go pg-only-mid" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                ))}
                {left > 0 && (
                  <p className="pg-rest">
                    <span className="pg-count">
                      {shown} of {filteredModels.length.toLocaleString("en-US")}
                    </span>
                    <button type="button" onClick={() => setShown((count) => count + MORE_ROWS)}>
                      Show {Math.min(MORE_ROWS, left)} more
                    </button>
                  </p>
                )}
              </>
            ) : (
              <p className="pg-none">
                {searchTerm ? <>No model matches &ldquo;{searchTerm}&rdquo;.</> : "No model matches."}
                <button type="button" onClick={showAll}>
                  Show all models
                </button>
              </p>
            )}
          </div>

          {open && (
            <aside ref={panel} className="pg-panel" aria-label={`About ${open.name}`}>
              <div className="pg-head">
                <Mark company={open.company} />
                <h2>{open.name}</h2>
              </div>
              <p className="pg-id">
                <code>{open.id}</code>
                <button type="button" onClick={copyId}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </p>
              {open.about.length > open.name.length + 20 && <p className="pg-about">{open.about}</p>}
              <dl className="pg-facts">
                <div>
                  <dd>{formatCompactContextLength(open.context)}</dd>
                  <dt>context</dt>
                </div>
                {open.model.architecture?.input_modalities?.length > 0 && (
                  <div>
                    <dd>
                      <Kinds list={open.model.architecture.input_modalities} />
                    </dd>
                    <dt>takes in</dt>
                  </div>
                )}
                {open.requests > 0 && (
                  <div>
                    <dd>{formatCompactCount(open.requests)}</dd>
                    <dt>requests, 30 days</dt>
                  </div>
                )}
                {open.score !== null && (
                  <div>
                    <dd>{open.score.toFixed(1)}</dd>
                    <dt>
                      intelligence, <a href={SCORES_BY.href}>{SCORES_BY.name}</a>
                    </dt>
                  </div>
                )}
              </dl>

              <h3>
                Sold by {sellers.length} {sellers.length === 1 ? "node" : "nodes"}
                <small>{`${sats ? "sats" : "USD"} per 1M · input / output`}</small>
              </h3>
              <Lane sellers={sellers} against={open.against} />
              <ul className="pg-sellers">
                {sellers.map((node, i) => (
                  <li
                    key={`${node.id}-${node.name}`}
                    data-best={(i === 0 && node.route && node.approved) || undefined}
                    data-off={!node.approved || undefined}
                  >
                    <Link href={`/providers/${encodeURIComponent(node.id)}`}>
                      {node.name}
                      {!node.approved && <i>not approved</i>}
                    </Link>
                    <span>{price(sats ? node.sats.prompt : node.usd.prompt)}</span>
                    <span>{price(sats ? node.sats.completion : node.usd.completion)}</span>
                  </li>
                ))}
              </ul>

              <pre className="pg-code">
                <i>$ </i>
                {`curl ${base}/v1/chat/completions \\\n    -H "x-cashu: cashuBo2F..." \\\n    -d '{"model": "${door?.model.id ?? open.id}", "messages": [{"role": "user", "content": "hello"}]}'`}
              </pre>
              <Link href={`/models/${open.model.id}`} className="pg-more">
                Open the full page <ArrowRight strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </aside>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
