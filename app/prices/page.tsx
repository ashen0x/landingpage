"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { Mark } from "@/components/layout/Mark";
import { companyIn } from "@/components/stats/model-company-icon";
import { useNodeLists } from "@/lib/use-node-lists";
import { fetchListPrices, fetchModelIdMappings, fetchReviewLabels } from "@/lib/api/price-sources";
import { fetchRoutstr21ModelIds } from "@/lib/routstr21";
import {
  buildRadar,
  curatedModelIds,
  isApproved,
  standing,
  summarizeNode,
  WARM_BASKET,
  type ModelIdMappings,
  type RadarEntry,
  type RadarNode,
  type TokenRates,
} from "@/lib/price-radar";
import { nodeKey, usageKey, useModelUsage } from "@/lib/model-usage";
import { formatCompactCount } from "@/lib/number-format";
import { usePricingView } from "@/app/contexts/PricingContext";
import "@/components/layout/pages.css";
import "./prices.css";

const MY_NODE_KEY = "routstr:prices:node";

/** How many rows are shown at first, and how many more each time more are asked for. */
const FIRST_ROWS = 50;
const MORE_ROWS = 100;
/** How many nodes of the board a phone shows before it is asked for all of them. */

type View = "all" | "first" | "behind";

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();

function formatSats(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString("en-US");
  return value.toFixed(value >= 10 ? 1 : 2);
}

/** A request's price in USD: small numbers keep enough digits to tell them apart. */
function formatUsd(value: number): string {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value >= 0.00005 ? value.toFixed(4) : "<0.0001";
}

/** A node's price against OpenRouter's, as the percent it is under or over. */
function versus(multiplier: number | null | undefined): string {
  if (multiplier === null || multiplier === undefined) return "—";
  // a price above zero never reads as 100% under
  const pct = Math.max(-99, Math.round((multiplier - 1) * 100));
  return pct < 0 ? `−${-pct}%` : pct > 0 ? `+${pct}%` : "0%";
}

function writeUrl(node: string, query: string) {
  const url = new URL(window.location.href);
  for (const [key, value] of [
    ["node", node],
    ["q", query.trim()],
  ] as const) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", url);
}

export default function PricesPage() {
  const { nodes, loading: loadingNodes, discovery } = useNodeLists();
  const [labels, setLabels] = useState<Map<string, string> | null>(null);
  const [mappings, setMappings] = useState<ModelIdMappings | null>(null);
  const [listPrices, setListPrices] = useState<Map<string, TokenRates>>(() => new Map());
  const [curatedIds, setCuratedIds] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [myNode, setMyNode] = useState("");
  const [openModel, setOpenModel] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [shown, setShown] = useState(FIRST_ROWS);
  const [othersOpen, setOthersOpen] = useState(false);
  const searchBox = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const usage = useModelUsage();
  const { currency, setCurrency } = usePricingView();
  const sats = currency === "sats";
  /** What a node asks for one request, in the money the page is set to. */
  const money = (entry: RadarEntry | null | undefined) =>
    !entry ? "—" : sats ? formatSats(entry.sats) : entry.usd === null ? "—" : formatUsd(entry.usd);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    setSearch(params.get("q") ?? "");
    try {
      setMyNode(params.get("node") ?? localStorage.getItem(MY_NODE_KEY) ?? "");
    } catch {
      // storage blocked: start with no node picked
    }
    void fetchRoutstr21ModelIds().then((ids) => active && setCuratedIds(ids));
    void fetchReviewLabels().then((found) => active && setLabels(found));
    void fetchModelIdMappings().then((found) => active && setMappings(found));
    void fetchListPrices().then((found) => active && setListPrices(found));
    return () => {
      active = false;
    };
  }, []);

  // "/" puts the cursor in the search field
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchBox.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pickNode(url: string) {
    setMyNode(url);
    setView("all");
    setShown(FIRST_ROWS);
    writeUrl(url, search);
    try {
      localStorage.setItem(MY_NODE_KEY, url);
    } catch {
      // storage blocked: the pick lasts for this visit
    }
    // where the list is under the board, not beside it, a pick brings the list into sight
    if (url && !window.matchMedia("(min-width: 1360px)").matches) list.current?.scrollIntoView();
  }

  const radarNodes = useMemo(() => {
    if (!labels) return [];
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
    const newestFirst = [...nodes].sort((a, b) => b.provider.created_at - a.provider.created_at);
    for (const { provider, models } of newestFirst) {
      const url = normalizeUrl(provider.endpoint_url);
      if (models.length === 0 || byUrl.has(url)) continue;
      byUrl.set(url, {
        url: provider.endpoint_url,
        name: provider.name || provider.endpoint_url,
        approved: isApproved(keysByUrl.get(url) ?? [], labels),
        models: models.map((model) => (model.sats_unpriced ? { ...model, sats_pricing: null } : model)),
      });
    }
    return Array.from(byUrl.values());
  }, [nodes, labels]);

  const rows = useMemo(
    () => buildRadar(radarNodes, { listPrices, mappings: mappings ?? {} }),
    [radarNodes, listPrices, mappings]
  );

  /* The usage reports count a model under its name alone, whatever a node puts in front of
     it. So the requests go to the spelling most approved nodes sell; a rarer spelling of the
     same model shows none, instead of the same number twice. */
  const counts = usage.requests;
  const requests = useMemo(() => {
    const approvedCount = (entries: readonly RadarEntry[]) => entries.filter((entry) => entry.approved).length;
    const main = new Map<string, { id: string; nodes: number }>();
    for (const row of rows) {
      const key = usageKey(row.modelId);
      const seen = main.get(key);
      const nodes = approvedCount(row.entries);
      if (!seen || nodes > seen.nodes || (nodes === seen.nodes && row.modelId.length < seen.id.length)) {
        main.set(key, { id: row.modelId, nodes });
      }
    }
    const byModel = new Map<string, number>();
    main.forEach(({ id }, key) => byModel.set(id, counts?.[key] ?? 0));
    return byModel;
  }, [rows, counts]);

  /* The board: every node with the requests it reports it served in the last 30 days, the
     busiest first. A node that publishes no report has no number. The nodes apps do not use
     come after. */
  const reported = usage.served;
  /** Under which name the usage reports know a node: its address, or else one of its keys. */
  const reportName = useMemo(() => {
    const keysAt = new Map<string, string[]>();
    for (const { provider } of nodes) {
      const at = normalizeUrl(provider.endpoint_url);
      keysAt.set(at, [...(keysAt.get(at) ?? []), provider.pubkey]);
    }
    return (url: string) =>
      [nodeKey(url), ...(keysAt.get(normalizeUrl(url)) ?? [])].find((name) => reported?.[name] !== undefined) ?? null;
  }, [nodes, reported]);
  const board = useMemo(() => {
    // a report is matched to its node by the address it signs, or else by the node's key
    const served = (url: string) => {
      const name = reportName(url);
      return name === null ? null : (reported?.[name] ?? null);
    };
    return (
      radarNodes
        .map((node) => ({ node, ...summarizeNode(rows, node.url), served: served(node.url) }))
        .filter((line) => line.models > 0)
        .sort(
          (a, b) =>
            Number(b.node.approved) - Number(a.node.approved) ||
            (b.served ?? -1) - (a.served ?? -1) ||
            b.models - a.models ||
            a.node.name.localeCompare(b.node.name)
        )
    );
  }, [radarNodes, rows, reported, reportName]);
  const inUse = board.filter((line) => line.node.approved);
  const others = board.filter((line) => !line.node.approved);
  const most = Math.max(1, ...inUse.map((line) => line.served ?? 0));
  const won = rows.filter((row) => row.winner).length;

  const picked = board.some((line) => line.node.url === myNode) ? myNode : "";
  const mine = board.find((line) => line.node.url === picked);

  // with a node picked, the requests shown are the ones that node served, model by model
  const mineName = picked ? reportName(picked) : null;
  const mineModels = mineName === null ? null : (usage.servedModels?.[mineName] ?? null);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const asked = (modelId: string) =>
      picked ? (mineModels?.[usageKey(modelId)] ?? 0) : (requests.get(modelId) ?? 0);
    const approvedCount = (entries: readonly RadarEntry[]) => entries.filter((entry) => entry.approved).length;
    return rows
      .filter((row) => !term || row.modelId.toLowerCase().includes(term))
      .filter((row) => {
        if (!picked) return true;
        const entry = row.entries.find((e) => e.url === picked);
        if (!entry) return false;
        const place = standing(entry);
        return view === "all" || (view === "behind" ? place !== "first" : place === "first");
      })
      // the models people ask for most come first: that is where a place matters
      .sort(
        (a, b) =>
          asked(b.modelId) - asked(a.modelId) ||
          approvedCount(b.entries) - approvedCount(a.entries) ||
          a.modelId.localeCompare(b.modelId)
      );
  }, [rows, search, picked, view, requests, mineModels]);

  // Routstr's own list of models (kind 38423) leads, in the order it publishes. The same models
  // stand in the full list below as well, so nothing is hidden by being on it.
  const curated = useMemo(() => curatedModelIds(curatedIds ?? [], mappings ?? {}), [curatedIds, mappings]);
  const curatedRows = useMemo(
    () =>
      visibleRows
        .filter((row) => curated.has(row.modelId))
        .sort((a, b) => (curated.get(a.modelId) ?? 0) - (curated.get(b.modelId) ?? 0)),
    [visibleRows, curated]
  );

  // Wait for that list too: drawn without it, every row would stand under "All models" and the
  // listed ones would then jump up.
  const loading = !labels || !mappings || curatedIds === null || (loadingNodes && rows.length === 0);
  // how the search for nodes went: found, answered with models, and which relays took part
  const relayWords: Record<string, string> = { "no-events": "no events returned", timeout: "timed out" };
  const relays = Object.entries(discovery.relays);
  const relaysOn = relays.filter(([, state]) => state === "received" || state === "connected").length;
  const left = visibleRows.length - shown;
  const showAll = () => {
    setSearch("");
    setView("all");
    setShown(FIRST_ROWS);
    writeUrl(myNode, "");
  };
  const views = mine?.node.approved
    ? ([
        ["all", "All", mine.models],
        ["first", "First", mine.first],
        ["behind", "Not first", mine.models - mine.first],
      ] as const)
    : [];
  /** One model's row. It opens on its own in each part of the list, so `openKey` tells the parts apart. */
  const modelRow = (row: (typeof rows)[number], openKey: string) => {
    const entry = row.entries.find((e) => e.url === picked);
    const shownEntry = entry ?? row.winner;
    const isOpen = openModel === openKey;
    const asked = picked ? (mineModels?.[usageKey(row.modelId)] ?? 0) : (requests.get(row.modelId) ?? 0);
    return (
      <Fragment key={openKey}>
        <button
          type="button"
          className="pg-row"
          aria-expanded={isOpen}
          onClick={() => setOpenModel(isOpen ? null : openKey)}
        >
          <span className="pg-name pg-marked pr-opens">
            <Mark company={companyIn(row.modelId)} />
            <b className="pr-id">{row.modelId}</b>
            <ChevronDown className="pr-arrow" aria-hidden="true" />
          </span>
          <span className="pg-num pg-end pr-asked" data-quiet>
            {asked > 0 ? formatCompactCount(asked) : usage.requests || usage.done ? "—" : "·"}
          </span>
          {!picked && <span className="pg-one pr-winner">{row.winner?.name ?? "—"}</span>}
          <span className="pg-num pg-end">{money(shownEntry)}</span>
          {picked && (
            <span className="pg-num pg-end pr-cut" data-quiet>
              {money(row.winner)}
            </span>
          )}
          {picked && (
            <span className="pg-num pg-end" data-quiet data-under={entry?.rank === 1 || undefined}>
              {entry?.rank === 1 ? "first" : entry?.rank ? `#${entry.rank}` : "—"}
            </span>
          )}
          <span className="pg-num pg-end pr-nodes-col" data-quiet>
            {row.entries.filter((e) => e.approved).length}
          </span>
          <span
            className="pg-num pg-end pr-vs"
            data-quiet
            data-under={
              (shownEntry?.multiplier !== null && shownEntry?.multiplier !== undefined && shownEntry.multiplier < 0.995) ||
              undefined
            }
          >
            {versus(shownEntry?.multiplier)}
          </span>
        </button>

        {isOpen && (
          <ol className="pr-open">
            {row.entries.map((line) => (
              <li
                key={line.url}
                data-first={line.rank === 1 || undefined}
                data-mine={line.url === picked || undefined}
                data-off={!line.approved || undefined}
              >
                <span>{line.rank ?? "—"}</span>
                <span>
                  {line.name}
                  {!line.approved && <i>not approved</i>}
                </span>
                <span>{money(line)}</span>
                <span className="pr-vs">{versus(line.multiplier)}</span>
              </li>
            ))}
          </ol>
        )}
      </Fragment>
    );
  };

  const nodeLine = (line: (typeof board)[number], lead: boolean) => (
    <button
      key={line.node.url}
      type="button"
      className="pr-node"
      aria-pressed={picked === line.node.url}
      data-lead={lead || undefined}
      data-off={!line.node.approved || undefined}
      onClick={() => pickNode(picked === line.node.url ? "" : line.node.url)}
    >
      <b>{line.node.name}</b>
      {line.node.approved ? (
        <>
          <em>{line.served === null ? "—" : formatCompactCount(line.served)}</em>
          <small>
            sells {line.models} models · cheapest on {line.first}
          </small>
          <span className="pr-bar" aria-hidden="true">
            <i style={{ width: `${((line.served ?? 0) / most) * 100}%` }} />
          </span>
        </>
      ) : (
        <small>{line.models} models</small>
      )}
    </button>
  );

  return (
    <SiteShell>
      <section className="pg">
        <p className="pg-label">Prices</p>
        <h1 className="pg-title">
          <span>
            <i>Who wins</i>
          </span>{" "}
          <span>
            <i style={{ ["--i" as string]: 1 }}>the route.</i>
          </span>
        </h1>
        <p className="pg-lede">
          {inUse.length > 0 ? (
            <>
              Apps send each request to the cheapest approved node. <b>{inUse.length}</b> nodes compete for{" "}
              <b>{won.toLocaleString("en-US")}</b> models. Pick one to see where it stands.
            </>
          ) : loading ? (
            "Asking the nodes what they charge."
          ) : (
            "No node answered just now."
          )}
        </p>
        <p className="pr-found">
          <span title="Nodes found in Nostr announcements and in the HTTP directory, each key counted once">
            {discovery.nodes ?? "…"} nodes found
          </span>
          <span title="Nodes that answered with a list of models">
            {nodes.filter((node) => node.models.length > 0).length} with models{loadingNodes ? ", still asking" : ""}
          </span>
          <span className="pg-relays" role="img" aria-label={`${relaysOn} of ${relays.length} relays answered the search for nodes`}>
            {relays.map(([url, state]) => (
              <i
                key={url}
                data-on={state === "received" || state === "connected" || undefined}
                title={`${url.replace(/^wss:\/\//, "")}: ${relayWords[state] ?? state}`}
              />
            ))}
            <span>
              {relaysOn} of {relays.length} relays
            </span>
          </span>
        </p>

        <div className="pr-sides">
          <div className="pr-board">
            <div className="pr-cap">
              <span>Node</span>
              <span title="Requests the node reports it served in the last 30 days">
                Requests served<small>30d</small>
              </span>
            </div>
            {loading ? (
              [...Array(6)].map((_, i) => <div key={i} className="pr-node pr-wait" style={{ ["--i" as string]: i }} />)
            ) : (
              <>
                <div className="pr-nodes pr-in-use">
                  {inUse.map((line, i) => nodeLine(line, i === 0 && (line.served ?? 0) > 0))}
                </div>
                {others.length > 0 && (
                  <>
                    <button type="button" className="pr-fold" aria-expanded={othersOpen} onClick={() => setOthersOpen(!othersOpen)}>
                      {others.length} more {others.length === 1 ? "node is" : "nodes are"} not approved
                      <ChevronDown aria-hidden="true" />
                    </button>
                    {othersOpen && (
                      <>
                        <p className="pr-why">Apps do not send requests to a node until a reviewer approves it.</p>
                        <div className="pr-nodes">{others.map((line) => nodeLine(line, false))}</div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div ref={list} className="pr-list" data-picked={picked ? "" : undefined}>
            <div className="pr-head">
              <h2>{mine ? mine.node.name : "Every model"}</h2>
              <p>
                {!mine
                  ? "and the node that wins it"
                  : !mine.node.approved
                    ? "is not approved, so apps do not send it requests"
                    : mine.served === null
                      ? `is the cheapest on ${mine.first} of its ${mine.models} models`
                      : `served ${formatCompactCount(mine.served)} requests in 30 days, and is the cheapest on ${mine.first} of its ${mine.models} models`}
              </p>
              {!loading && (search || view !== "all") && (
                <span className="pg-count">
                  {visibleRows.length.toLocaleString("en-US")} {visibleRows.length === 1 ? "model" : "models"}
                </span>
              )}
            </div>

            <div className="pg-tools pr-tools">
              <label className="pg-search">
                <Search aria-hidden="true" />
                <input
                  ref={searchBox}
                  type="search"
                  placeholder={mine ? `Search its ${mine.models} models` : "Search models"}
                  aria-label="Search models"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setShown(FIRST_ROWS);
                    writeUrl(myNode, event.target.value);
                  }}
                />
                {search ? (
                  <button type="button" onClick={() => {
                      setSearch("");
                      setShown(FIRST_ROWS);
                      writeUrl(myNode, "");
                    }}>
                    Clear
                  </button>
                ) : (
                  <kbd className="pg-key" aria-hidden="true">
                    /
                  </kbd>
                )}
              </label>
              {board.length > 0 && (
                <label className="pr-pick">
                  <span>Node</span>
                  <select value={picked} onChange={(event) => pickNode(event.target.value)} aria-label="Show one node's prices">
                    <option value="">All nodes</option>
                    {inUse.map((line) => (
                      <option key={line.node.url} value={line.node.url}>
                        {line.node.name}
                      </option>
                    ))}
                    {others.length > 0 && (
                      <optgroup label="Not approved">
                        {others.map((line) => (
                          <option key={line.node.url} value={line.node.url}>
                            {line.node.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <ChevronDown aria-hidden="true" />
                </label>
              )}
              {views.length > 0 && (
                <div className="pg-chips" role="group" aria-label="Its place">
                  {views.map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={view === key}
                      onClick={() => {
                        setView(key);
                        setShown(FIRST_ROWS);
                      }}
                    >
                      {label} <i>{count}</i>
                    </button>
                  ))}
                </div>
              )}
              <div className="pg-switch pg-far" role="group" aria-label="Show prices in">
                <button type="button" aria-pressed={sats} onClick={() => setCurrency("sats")}>
                  sats
                </button>
                <button type="button" aria-pressed={!sats} onClick={() => setCurrency("usd")}>
                  USD
                </button>
                <span>for a request</span>
              </div>
            </div>

            <div className="pg-list">
              <div className="pg-cols">
                <span>Model</span>
                <span
                  className="pg-end pr-asked"
                  title={
                    picked
                      ? "Requests this node reports it served in the last 30 days"
                      : "Requests in the last 30 days at all nodes, as they report them"
                  }
                >
                  {picked ? "Served" : "Requests"}
                  <small>30d</small>
                </span>
                {!picked && <span className="pr-winner">Cheapest node</span>}
                <span className="pg-end">
                  {picked ? "Its price" : sats ? "Sats" : "USD"}
                  {!picked && <span className="pr-wide"> a request</span>}
                </span>
                {picked && <span className="pg-end pr-cut">Cheapest</span>}
                {picked && <span className="pg-end">Place</span>}
                <span className="pg-end pr-nodes-col">Nodes</span>
                <span className="pg-end pr-vs">vs OpenRouter</span>
              </div>
              <p className="pg-note">
                A request is {WARM_BASKET.promptTokens / 1000}K tokens in, {WARM_BASKET.cacheHitRate * 100}% of them from
                cache, and {WARM_BASKET.outputTokens / 1000}K out. Apps rank nodes on its price.
                {picked && " Requests are the ones this node served."}
              </p>

              {loading ? (
                [...Array(9)].map((_, i) => (
                  <div key={i} className="pg-row pg-ghost" style={{ ["--i" as string]: i }}>
                    <span style={{ width: `${46 + ((i * 17) % 34)}%` }} />
                  </div>
                ))
              ) : rows.length === 0 ? (
                <p className="pg-none">
                  No node answered.
                  <button type="button" onClick={() => window.location.reload()}>
                    Try again
                  </button>
                </p>
              ) : visibleRows.length === 0 ? (
                <p className="pg-none">
                  {search ? <>No model matches &ldquo;{search}&rdquo;.</> : "No model here."}
                  <button type="button" onClick={showAll}>
                    Show all models
                  </button>
                </p>
              ) : (
                <>
                  {curatedRows.length > 0 && (
                    <>
                      <div className="pr-part">
                        <h3>Routstr&rsquo;s picks</h3>
                        <p>The models the chat app lists, in its order.</p>
                      </div>
                      {curatedRows.map((row) => modelRow(row, `picks:${row.modelId}`))}
                      <div className="pr-part">
                        <h3>All models</h3>
                        <p>Every model, the picks too. Most asked first.</p>
                      </div>
                    </>
                  )}
                  {visibleRows.slice(0, shown).map((row) => modelRow(row, row.modelId))}
                  {left > 0 && (
                    <p className="pg-rest">
                      <span className="pg-count">
                        {shown} of {visibleRows.length.toLocaleString("en-US")}
                      </span>
                      <button type="button" onClick={() => setShown((count) => count + MORE_ROWS)}>
                        Show {Math.min(MORE_ROWS, left)} more
                      </button>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
