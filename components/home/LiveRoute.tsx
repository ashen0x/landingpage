"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { RoutstrMark } from "@/components/RoutstrMark";
import { ModelCompanyIcon } from "@/components/stats/model-company-icon";
import { formatSats, prettyModel } from "@/lib/home/format";
import { approvedCount, pickFeatured } from "@/lib/home/featured";
import type { Market } from "@/lib/home/use-market";

const MAX_ROWS = 5;
const ROW = 46;
const GAP = 6;
const CYCLE_MS = 4600;

export function LiveRoute({ market }: { market: Market }) {
  const featured = useMemo(() => pickFeatured(market.rows), [market.rows]);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const lines = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!auto || featured.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((value) => value + 1);
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [auto, featured.length]);

  useEffect(() => {
    const svg = lines.current;
    if (!svg) return;
    const watch = new ResizeObserver(() => setWidth(svg.clientWidth));
    watch.observe(svg);
    return () => watch.disconnect();
  }, []);

  const active = featured.length ? featured[index % featured.length] : null;
  const entries = active ? active.entries.filter((entry) => entry.approved).slice(0, MAX_ROWS) : [];
  const more = active ? approvedCount(active) - entries.length : 0;
  // The map keeps one height, so the card never shifts as nodes answer or the
  // model changes; fewer rows sit centred beside the hub.
  const count = active ? entries.length : MAX_ROWS;
  const height = MAX_ROWS * ROW + (MAX_ROWS - 1) * GAP;
  const top = (height - (count * ROW + (count - 1) * GAP)) / 2;
  const source = height / 2;
  const path = (row: number) => {
    const y = top + row * (ROW + GAP) + ROW / 2;
    return `M0 ${source}C${width * 0.6} ${source} ${width * 0.4} ${y} ${width} ${y}`;
  };

  return (
    <aside className="route" aria-label="Live route">
      <header className="route-head">
        <span className="kicker">Live route</span>
        <span className="route-live">
          <i className="dot" data-on={market.nodeCount > 0 || undefined} />
          {market.nodeCount === 0
            ? "asking nodes on Nostr"
            : `${market.nodeCount} nodes ${market.loading ? "answered" : "open"}`}
        </span>
      </header>

      <div className="route-chips" role="tablist" aria-label="Model">
        {active
          ? featured.map((row, i) => {
              const on = row === active;
              return (
                <button
                  key={row.modelId}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="route-chip"
                  data-auto={(on && auto && featured.length > 1) || undefined}
                  onClick={() => {
                    setAuto(false);
                    setIndex(i);
                  }}
                >
                  <ModelCompanyIcon model={row.modelId} />
                  {prettyModel(row.modelId)}
                </button>
              );
            })
          : [88, 104, 72, 96].map((w) => <span key={w} className="route-chip is-ghost" style={{ width: w }} />)}
      </div>

      <div className="route-map" style={{ height }}>
        <div className="route-src">
          <span className="route-hub">
            <RoutstrMark />
          </span>
          <span>your app</span>
        </div>
        <svg ref={lines} className="route-lines" width="100%" height={height} aria-hidden="true">
          {width > 0 && active && (
            <g key={active.modelId}>
              {entries.map((entry, i) => (
                <path key={entry.url} d={path(i)} pathLength={1} className={i === 0 ? "is-first" : undefined} />
              ))}
              <circle r={3.5} className="route-packet">
                <animateMotion dur="2.2s" repeatCount="indefinite" path={path(0)} calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.2 1" />
              </circle>
            </g>
          )}
        </svg>
        <ol className="route-rows" key={active?.modelId ?? "wait"}>
          {active
            ? entries.map((entry, i) => (
                <li key={entry.url} className="route-row" data-first={i === 0 || undefined} style={{ ["--i" as string]: i }}>
                  <span className="route-name">{entry.name}</span>
                  {i === 0 && <span className="route-tag">first try</span>}
                  <span className="route-price">
                    {formatSats(entry.sats)}
                    <small>sats</small>
                  </span>
                </li>
              ))
            : Array.from({ length: count }, (_, i) => <li key={i} className="route-row is-ghost" />)}
        </ol>
      </div>

      <footer className="route-foot">
        <span>
          {active
            ? `Sats for one long request${more > 0 ? `, ${more} more ${more > 1 ? "nodes sell" : "node sells"} it` : ""}. The lowest price gets the first try.`
            : "Each node is asked for its own price list."}
        </span>
        <Link href={active ? `/prices?q=${encodeURIComponent(active.modelId)}` : "/prices"}>
          All prices <ArrowRight />
        </Link>
      </footer>
    </aside>
  );
}
