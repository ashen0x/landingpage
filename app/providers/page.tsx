"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { fetchReviewLabels } from "@/lib/api/price-sources";
import { isApproved } from "@/lib/price-radar";
import { nodeKey, useModelUsage } from "@/lib/model-usage";
import { useNodeLists } from "@/lib/use-node-lists";
import { formatCompactCount } from "@/lib/number-format";
import "@/components/layout/pages.css";
import "./providers.css";

type Kind = "approved" | "tor";

export default function ProvidersPage() {
  const { nodes, loading } = useNodeLists();
  const usage = useModelUsage();
  const [labels, setLabels] = useState<Map<string, string>>(() => new Map());
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [quietOpen, setQuietOpen] = useState(false);
  const searchBox = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    void fetchReviewLabels().then((found) => active && setLabels(found));
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

  /* One line per node: what it says of itself, whether apps send it requests, and the
     requests it reports it served. Approved nodes first, then the busiest. */
  const served = usage.served;
  const lines = useMemo(() => {
    // several keys can announce one address; it is one node, approved if one key is and none is blocked
    const keysAt = new Map<string, Set<string>>();
    for (const { provider } of nodes) {
      const at = nodeKey(provider.endpoint_url);
      keysAt.set(at, (keysAt.get(at) ?? new Set()).add(provider.pubkey));
    }
    return nodes
      .map(({ provider, models }) => {
        const onion = provider.endpoint_urls.find((url) => url.includes(".onion")) ?? null;
        const web = [provider.endpoint_url, ...provider.endpoint_urls].find((url) => /^https:\/\//.test(url)) ?? null;
        return {
          provider,
          models: models.length,
          web,
          onion,
          mints: provider.mint_urls && provider.mint_urls.length > 0 ? provider.mint_urls : provider.mint_url ? [provider.mint_url] : [],
          approved: labels.size > 0 && isApproved(keysAt.get(nodeKey(provider.endpoint_url)) ?? [provider.pubkey], labels),
          served: served?.[nodeKey(provider.endpoint_url)] ?? served?.[provider.pubkey] ?? null,
        };
      })
      .sort(
        (a, b) =>
          Number(b.approved) - Number(a.approved) ||
          (b.served ?? -1) - (a.served ?? -1) ||
          b.models - a.models ||
          a.provider.name.localeCompare(b.provider.name)
      );
  }, [nodes, labels, served]);

  const selling = lines.filter((line) => line.models > 0);
  const quiet = lines.filter((line) => line.models === 0);
  const approved = selling.filter((line) => line.approved).length;
  const overTor = selling.filter((line) => line.onion).length;

  const needle = search.trim().toLowerCase();
  const shown = selling.filter(
    (line) =>
      (kind !== "approved" || line.approved) &&
      (kind !== "tor" || line.onion) &&
      (!needle ||
        line.provider.name.toLowerCase().includes(needle) ||
        line.provider.description.toLowerCase().includes(needle) ||
        (line.web ?? "").toLowerCase().includes(needle) ||
        line.provider.pubkey.toLowerCase().includes(needle))
  );
  const open = shown.find((line) => line.provider.pubkey === picked) ?? shown[0];
  const openKey = open?.provider.pubkey;
  useEffect(() => {
    card.current?.scrollTo({ top: 0 });
  }, [openKey]);

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked: the text is still selectable
    }
  };
  const showAll = () => {
    setSearch("");
    setKind(null);
  };
  const cols = {
    ["--cols" as string]: "minmax(0, 1fr) 7.4rem 6rem 4.4rem 4.6rem",
    ["--cols-tight" as string]: "minmax(0, 1fr) 7.4rem 6rem 4.4rem",
    ["--cols-mid" as string]: "minmax(0, 1fr) 7.4rem 6rem 4.4rem 4.6rem",
    ["--cols-mid-tight" as string]: "minmax(0, 1fr) 7.4rem 6rem 4.4rem",
    ["--cols-narrow" as string]: "minmax(0, 1fr) 6.6rem",
  };
  /** What is known of a node: shown in the card beside the list, or under its row where there is no card. */
  const about = (line: (typeof lines)[number]) => (
    <>
      {line.provider.description && <p className="pg-about">{line.provider.description}</p>}
      <dl className="pv-facts">
        {line.web && (
          <div>
            <dt>Address</dt>
            <dd>{line.web}</dd>
            <button type="button" onClick={() => copy("web", line.web ?? "")}>
              {copied === "web" ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        {line.onion && (
          <div>
            <dt>Over Tor</dt>
            <dd>{line.onion}</dd>
            <button type="button" onClick={() => copy("onion", line.onion ?? "")}>
              {copied === "onion" ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        {line.mints.length > 0 && (
          <div>
            <dt>Pays with</dt>
            <dd title={line.mints.join("\n")}>
              {line.mints[0].replace(/^https?:\/\//, "")}
              {line.mints.length > 1 && ` and ${line.mints.length - 1} more`}
            </dd>
          </div>
        )}
        <div>
          <dt>Served</dt>
          <dd>{line.served === null ? "no usage report" : `${formatCompactCount(line.served)} requests in 30 days`}</dd>
        </div>
        <div>
          <dt>Sells</dt>
          <dd>
            {line.models} {line.models === 1 ? "model" : "models"}
          </dd>
        </div>
        {line.provider.version && (
          <div>
            <dt>Software</dt>
            <dd>{line.provider.version}</dd>
          </div>
        )}
      </dl>
      <p className="pv-why">
        <b>What &ldquo;approved&rdquo; means.</b> A reviewer checked this node and signed a label for it. Apps send
        requests only to approved nodes. The others still work if you pick them by hand.
      </p>
      <Link href={`/prices?node=${encodeURIComponent(line.provider.endpoint_url)}`} className="pg-more">
        Its prices against other nodes <ArrowRight strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </>
  );
  const row = (line: (typeof lines)[number]) => (
    <Fragment key={line.provider.pubkey}>
      <button
        type="button"
        className="pg-row"
        data-on={line === open || undefined}
        aria-expanded={picked === line.provider.pubkey}
        // a second click closes it again where its facts open under the row
        onClick={() => setPicked(picked === line.provider.pubkey ? null : line.provider.pubkey)}
      >
        <span className="pg-name">
          <b>{line.provider.name}</b>
          {line.provider.description && <code>{line.provider.description}</code>}
        </span>
        <span className="pv-review" data-ok={line.approved || undefined}>
          {line.approved ? "approved" : "not approved"}
        </span>
        <span className="pg-num pg-end pg-hide" data-quiet>
          {line.served === null ? "—" : formatCompactCount(line.served)}
        </span>
        <span className="pg-num pg-end pg-hide">{line.models}</span>
        <span className="pg-num pg-end pg-hide pg-hide-tight" data-quiet>
          {line.provider.version ? line.provider.version.split("+")[0] : "—"}
        </span>
      </button>
      {picked === line.provider.pubkey && <div className="pv-under">{about(line)}</div>}
    </Fragment>
  );

  return (
    <SiteShell>
      <section className="pg">
        <p className="pg-label">Providers</p>
        <h1 className="pg-title">
          <span>
            <i>The nodes</i>
          </span>
          <span>
            <i style={{ ["--i" as string]: 1 }}>behind it.</i>
          </span>
        </h1>
        <p className="pg-lede">
          {selling.length > 0 ? (
            <>
              <b>{selling.length}</b> nodes sell models here. Anyone can run one. Apps only send requests to the{" "}
              <b>{approved}</b> a reviewer has approved.
            </>
          ) : loading ? (
            "Asking the nodes who is there."
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
              placeholder={selling.length > 0 ? `Search ${selling.length} nodes` : "Search nodes"}
              aria-label="Search nodes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")}>
                Clear
              </button>
            ) : (
              <kbd className="pg-key" aria-hidden="true">
                /
              </kbd>
            )}
          </label>
        </div>
        {selling.length > 0 && (
          <div className="pg-sift">
            <div className="pg-chips" role="group" aria-label="Kind of node">
              <button type="button" aria-pressed={!kind} onClick={() => setKind(null)}>
                All <i>{selling.length}</i>
              </button>
              <button type="button" aria-pressed={kind === "approved"} onClick={() => setKind(kind === "approved" ? null : "approved")}>
                Approved <i>{approved}</i>
              </button>
              {overTor > 0 && (
                <button type="button" aria-pressed={kind === "tor"} onClick={() => setKind(kind === "tor" ? null : "tor")}>
                  Reachable over Tor <i>{overTor}</i>
                </button>
              )}
            </div>
          </div>
        )}

        <div className={open ? "pg-two" : undefined}>
          <div className="pg-list pv-list" style={cols}>
            <div className="pg-cols">
              <span>Node</span>
              <span>Review</span>
              <span className="pg-end pg-hide" title="Requests the node reports it served in the last 30 days">
                Served<small>30d</small>
              </span>
              <span className="pg-end pg-hide">Models</span>
              <span className="pg-end pg-hide pg-hide-tight">Version</span>
            </div>
            {selling.length === 0 && !loading ? (
              <p className="pg-none">
                No node answered.
                <button type="button" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </p>
            ) : selling.length === 0 ? (
              [...Array(8)].map((_, i) => (
                <div key={i} className="pg-row pg-ghost" style={{ ["--i" as string]: i }}>
                  <span style={{ width: `${40 + ((i * 17) % 30)}%` }} />
                </div>
              ))
            ) : shown.length === 0 ? (
              <p className="pg-none">
                {search ? <>No node matches &ldquo;{search}&rdquo;.</> : "No node here."}
                <button type="button" onClick={showAll}>
                  Show all nodes
                </button>
              </p>
            ) : (
              shown.map(row)
            )}
            {quiet.length > 0 && !needle && !kind && (
              <>
                <button type="button" className="pv-fold" aria-expanded={quietOpen} onClick={() => setQuietOpen(!quietOpen)}>
                  {quiet.length} more {quiet.length === 1 ? "node lists" : "nodes list"} no models right now
                </button>
                {quietOpen && quiet.map(row)}
              </>
            )}
          </div>

          {open && (
            <aside ref={card} className="pg-panel" aria-label={`About ${open.provider.name}`}>
              <h2>{open.provider.name}</h2>
              <p className="pv-review" data-ok={open.approved || undefined} style={{ margin: "10px 0 0" }}>
                {open.approved ? "approved" : "not approved"}
              </p>
              {about(open)}
            </aside>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
