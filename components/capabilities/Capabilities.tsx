"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getPrimaryHttpEndpoint, isOnionEndpoint, isProviderVisible } from "@/lib/api/providers";
import { useNodeLists } from "@/lib/use-node-lists";
import { CodePanel } from "@/components/routstrd/CodePanel";
import { CAPABILITIES, type Market } from "./capabilities";
import { Network, OPENING, playsFor } from "./network";

/** Core versions: "0.5.0+g2c69ba4" is at least 0.5.0. Unknown versions count as not. */
const atLeast = (version: string | undefined, want: number[]) => {
  const have = (version ?? "").match(/\d+/g)?.map(Number);
  if (!have) return false;
  for (let i = 0; i < want.length; i++) if ((have[i] ?? 0) !== want[i]) return (have[i] ?? 0) > want[i];
  return true;
};
/** One model under every spelling nodes give it: "openai/gpt-x" and "gpt-x" are the same. */
const sameModel = (id: string) =>
  id
    .toLowerCase()
    .split("/")
    .pop()!
    .replace(/:free$/, "");
/** A model that runs in a sealed enclave, by how its node names it. */
const SEALED = /tinfoil|\bTEE\b|E2EE/i;

/* The numbers under each capability, from every node's own list and from the search for nodes. */
function useMarket(): { market: Market | null; loading: boolean } {
  const { nodes, loading, discovery } = useNodeLists();
  const lists = useMemo(() => {
    // one list per address: the newest announcement wins
    const byUrl = new Map<string, (typeof nodes)[number]>();
    for (const node of nodes) {
      const url = getPrimaryHttpEndpoint(node.provider);
      if (!url || node.models.length === 0 || !isProviderVisible(node.provider)) continue;
      const had = byUrl.get(url);
      if (!had || had.provider.created_at < node.provider.created_at) byUrl.set(url, node);
    }
    return Array.from(byUrl.values());
  }, [nodes]);
  const counted = useMemo(() => {
    if (lists.length === 0) return null;
    const sellers = new Map<string, { nodes: number; spellings: Map<string, number> }>();
    const sealedNodes = new Set<number>();
    const sealed = new Set<string>();
    lists.forEach(({ models }, n) => {
      const here = new Set<string>();
      for (const model of models) {
        const key = sameModel(model.id);
        if (SEALED.test(`${model.id} ${model.name}`)) {
          sealed.add(key);
          sealedNodes.add(n);
        }
        const entry = sellers.get(key) ?? { nodes: 0, spellings: new Map<string, number>() };
        entry.spellings.set(model.id, (entry.spellings.get(model.id) ?? 0) + 1);
        if (!here.has(key)) entry.nodes++;
        here.add(key);
        sellers.set(key, entry);
      }
    });
    // the examples name the model sold most widely, as most nodes spell it
    let widest = { nodes: 0, id: "model-name" };
    for (const { nodes: count, spellings } of Array.from(sellers.values())) {
      if (count <= widest.nodes) continue;
      const id = Array.from(spellings).sort(
        ([a, n], [b, k]) => k - n || a.length - b.length || a.localeCompare(b)
      )[0][0];
      widest = { nodes: count, id };
    }
    const providers = lists.map(({ provider }) => provider);
    return {
      nodes: lists.length,
      models: sellers.size,
      backed: Array.from(sellers.values()).filter((entry) => entry.nodes > 1).length,
      lightning: providers.filter((provider) => atLeast(provider.version, [0, 4, 2])).length,
      takeOut: providers.filter((provider) => atLeast(provider.version, [0, 5, 0])).length,
      tor: providers.filter((provider) => provider.endpoint_urls.some(isOnionEndpoint)).length,
      sealed: sealed.size,
      sealedNodes: sealedNodes.size,
      model: widest.id,
    };
  }, [lists]);
  const relays = Object.values(discovery.relays).filter((state) => state === "received").length;
  return { market: counted && { ...counted, found: discovery.nodes, relays }, loading };
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
    </svg>
  );
}

/** From this width the words stand beside the light; below it the light sits above them. */
const BESIDE = "(min-width: 1000px)";

/* What Routstr can do, as a row of names; under it the one playing in words, with the live number
   that backs it and the request that does it, and beside them the light acting it out. It plays
   each in turn until one is picked. */
export function Capabilities() {
  const { market, loading } = useMarket();
  const body = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const light = useRef<Network | null>(null);
  const [chosen, setChosen] = useState(0);
  // playing each in turn, until someone picks one; and whether it has moved on from the first yet
  const [auto, setAuto] = useState(true);
  const [moved, setMoved] = useState(false);
  const [dead, setDead] = useState(false);
  const one = CAPABILITIES[chosen];
  const model = market?.model ?? "model-name";
  const code = useMemo(() => one.examples(model), [one, model]);

  useLayoutEffect(() => {
    const el = canvas.current;
    const box = stage.current;
    const all = body.current;
    if (!el || !box || !all) return;
    const made = new Network(el);
    if (made.dead) {
      setDead(true);
      return;
    }
    light.current = made;
    // beside the words the light starts at its own left edge, level with them; above them it comes
    // in from the edge of the screen
    const place = () =>
      made.place(window.matchMedia(BESIDE).matches ? { x: el.clientWidth * 0.1, y: el.clientHeight * 0.42 } : null, 0);
    place();
    const point = (event: PointerEvent) => {
      const at = el.getBoundingClientRect();
      made.point((event.clientX - at.left) / at.width - 0.5, (event.clientY - at.top) / at.height - 0.5);
    };
    const leave = () => made.leave();
    const resize = new ResizeObserver(() => {
      place();
      made.resize();
    });
    resize.observe(box);
    // nothing is drawn, and nothing moves on, while the light is out of sight
    let inView = false;
    const show = () => {
      const seen = inView && !document.hidden;
      all.toggleAttribute("data-away", !seen);
      if (seen) made.start();
      else made.stop();
    };
    const seen = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      show();
    });
    seen.observe(box);
    box.addEventListener("pointermove", point);
    box.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", show);
    return () => {
      made.dispose();
      resize.disconnect();
      seen.disconnect();
      box.removeEventListener("pointermove", point);
      box.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", show);
      light.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    light.current?.play(one.key);
  }, [one]);

  const next = () => {
    setMoved(true);
    setChosen((k) => (k + 1) % CAPABILITIES.length);
  };
  const pick = (k: number) => {
    setAuto(false);
    setChosen(k);
  };
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const go = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!go) return;
    event.preventDefault();
    const to = (chosen + go + CAPABILITIES.length) % CAPABILITIES.length;
    pick(to);
    event.currentTarget.querySelectorAll<HTMLElement>(".cp-pick")[to]?.focus();
  };

  return (
    <div ref={body} className="cp-body" data-dead={dead || undefined}>
      <div className="cp-list" role="radiogroup" aria-label="Capability" aria-describedby="cp-about" onKeyDown={onKey}>
        {CAPABILITIES.map((each, k) => {
          const on = k === chosen;
          return (
            <button
              key={each.key}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              className="cp-pick"
              onClick={() => pick(k)}
            >
              <span>{each.name}</span>
              {/* how long until the next one plays: it waits while the names or the words are pointed at or focused */}
              {auto && on && (
                <i
                  className="cp-bar"
                  style={{ animationDuration: `${playsFor(each.key) + (moved ? 0 : OPENING)}s` }}
                  onAnimationEnd={next}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="cp-text">
        {/* every one's words lie in the same place, only the one playing in sight: the room is the
            tallest's, so the request under them never moves */}
        <div className="cp-words">
          {CAPABILITIES.map((each, k) => {
            const on = k === chosen;
            return (
              <div key={each.key} id={on ? "cp-about" : undefined} className="cp-about" data-on={on || undefined} inert={!on}>
                <h2>{each.title}</h2>
                <p className="cp-line">{each.line}</p>
                <p className="cp-stat">
                  {each.stat(market) ?? (loading ? "Asking the nodes…" : "No node has answered. Try again in a moment.")}
                </p>
                <Link href={each.link.href} className="cp-go">
                  {each.link.text} <Arrow />
                </Link>
              </div>
            );
          })}
        </div>
        <CodePanel key={`code-${one.key}`} label="Example" examples={code} />
      </div>

      <section
        ref={stage}
        className="cp-stage"
        aria-label="Routstr drawn in light: you, your key, the nodes and the models, acting out the capability picked."
      >
        <canvas ref={canvas} aria-hidden="true" />
      </section>
    </div>
  );
}
