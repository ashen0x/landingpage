"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { pickFeatured } from "@/lib/home/featured";
import { useMarket } from "@/lib/home/use-market";
import { formatSats } from "@/lib/home/format";
import type { RadarRow } from "@/lib/price-radar";
import { AGENTS, INSTALL_SH } from "./install";
import { RouteLight, type Frame, type LightEvent, type Route, type Seller } from "./route-light";

/** Approved nodes and their prices as the prices page saw them on 17 Nov, for when the live list cannot be read. */
const SEEN: Route[] = (
  [
    [
      "claude-opus-5.5",
      [
        ["Happy Ending", 72.5],
        ["thefux", 76.4],
        ["Cypherpunk", 153],
        ["PPQ Mirror", 163],
        ["Privacy Maxi", 163],
        ["Non-KYC AI", 168],
        ["An OpenRouter Node", 229],
      ],
    ],
    [
      "gpt-6-luna",
      [
        ["Ashen Routstr Node", 0.2],
        ["Happy Ending", 0.2],
        ["OpenAI Models for Sat", 2.26],
        ["thefux", 2.49],
        ["PPQ Mirror", 4.82],
        ["Privacy Maxi", 4.84],
        ["Non-KYC AI", 4.97],
        ["An OpenRouter Node", 6.78],
      ],
    ],
    [
      "deepseek-v4.1-flash",
      [
        ["thefux", 5.6],
        ["Non-KYC AI", 5.6],
        ["An OpenRouter Node", 7.63],
        ["Cypherpunk", 9.47],
        ["PPQ Mirror", 9.87],
        ["Privacy Maxi", 9.91],
      ],
    ],
  ] as const
).map(([model, sellers]) => ({ model, sellers: sellers.map(([name, sats]) => ({ key: name, name, sats })) }));

/** The home page's models, the first three, each with its approved nodes in the order routstrd tries them. */
const pick = (rows: readonly RadarRow[]): Route[] =>
  pickFeatured(rows)
    .slice(0, 3)
    .map((row) => ({
      model: row.modelId,
      sellers: row.entries
        .filter((entry) => entry.approved)
        .slice(0, 9)
        .map((entry) => ({ key: entry.url, name: entry.name, sats: entry.sats })),
    }));

const call = (model: string) => `curl localhost:8008/v1/chat/completions -d '{"model": "${model}", …}'`;
const sats = (value: number) => `${formatSats(value)} sats`;
/** What the light shows once a node takes the requests. */
const inUse = (price: number, tap: boolean) => (
  <>
    Each request goes to the cheapest node that works: <i>{sats(price)}</i>. {tap ? "Tap" : "Click"} a line to cut it.
  </>
);

/** A command typed out, a letter at a time. */
function Typed({ text, still }: { text: string; still: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let frame = 0;
    const from = performance.now();
    const step = (now: number) => {
      const count = Math.min(text.length, Math.floor(((now - from) / 1000) * 78));
      setShown(count);
      if (count < text.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, still]);
  return <span>{` ${text.slice(0, shown)}`}</span>;
}

/* The light, and under it what it is doing in words, with the two things you can do to it:
   pick a model, make a node fail. The light is drawn by RouteLight; this puts the names
   beside it, and says what happens as it happens. */
export function RouteStage() {
  const market = useMarket();
  const stage = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const light = useRef<RouteLight | null>(null);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [live, setLive] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [lead, setLead] = useState<string | null>(null);
  const [resting, setResting] = useState<string[]>([]);
  const [say, setSay] = useState<ReactNode>(null);
  const [cmd, setCmd] = useState("");
  const [dead, setDead] = useState(false);
  const [still, setStill] = useState(false);
  const [tap, setTap] = useState(false);

  // the model asked for, or the first one there is
  const route = routes.find((r) => r.model === model) ?? routes[0];
  const sellers = route?.sellers ?? [];
  const named = (key: string | null) => sellers.find((s) => s.key === key);
  const leader = named(lead);

  /* What the handlers below need to read, as it is now. */
  const now = useRef({ routes, route, lead, resting, tap, beat: -1, saidAt: 0, told: false, wait: 0 });
  useLayoutEffect(() => {
    Object.assign(now.current, { routes, route, lead, resting, tap });
  });

  const speak = (words: ReactNode) => {
    window.clearTimeout(now.current.wait);
    now.current.saidAt = performance.now();
    setSay(words);
  };

  /* The live prices once every node has answered. If that takes more than a few seconds,
     what has come so far (or the prices seen on 17 Nov), then the full list when it is in. */
  const found = useMemo(() => pick(market.rows), [market.rows]);
  const [late, setLate] = useState(false);
  const took = useRef<"some" | "all" | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const all = !market.loading && found.length > 0;
    // showing something already: only the full list replaces it
    if (took.current === "all" || (!all && took.current)) return;
    // still loading: wait, but not for long
    if (!all && market.loading && !late) return;
    took.current = all ? "all" : "some";
    setRoutes(found.length ? found : SEEN);
    setLive(found.length > 0);
  }, [found, market.loading, late]);

  useEffect(() => {
    // new prices: every line is whole again, the call names the model now shown, and the
    // line under it, once said, says the new price
    const at = now.current;
    const shown = at.route;
    if (!shown) return;
    at.resting = [];
    setResting([]);
    light.current?.setRoutes(routes, shown.model);
    if (at.beat >= 3) setCmd(call(shown.model));
    if (at.told) {
      window.clearTimeout(at.wait);
      setSay(inUse(shown.sellers[0].sats, at.tap));
    }
  }, [routes]);

  /* The light itself. */
  useEffect(() => {
    const el = canvas.current;
    const box = stage.current;
    const names = tags.current?.children;
    const state = now.current;
    if (!el || !box || !names) return;
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setTap(window.matchMedia("(pointer: coarse)").matches);

    let portrait: boolean | null = null;
    const onFrame = (frame: Frame) => {
      if (frame.portrait !== portrait) {
        portrait = frame.portrait;
        box.toggleAttribute("data-portrait", portrait);
      }
      // the eye shows once the install has landed, the agents once they are set up, a node once its line reaches it
      for (let i = 0; i < names.length; i++) {
        const tag = names[i] as HTMLElement;
        const { node, agent } = tag.dataset;
        const spot = node !== undefined ? frame.nodes.get(node) : agent !== undefined ? frame.agents[+agent] : frame.eye;
        const on = node !== undefined ? !!spot : frame.film > (agent !== undefined ? 2.3 : 1.35);
        tag.toggleAttribute("data-on", on);
        if (spot) tag.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px)`;
      }
    };

    const onEvent = (event: LightEvent) => {
      const at = now.current;
      const list = at.route?.sellers ?? [];
      const name = (key: string | null) => list.find((s) => s.key === key);
      if (event.kind === "beat") {
        at.beat = event.beat;
        const words = [
          "Install routstrd.",
          "Point your agent at it.",
          "Top up its wallet with sats.",
          "It finds the nodes that sell your model. Nearer is cheaper.",
        ][event.beat];
        // the call waits for the prices, if they are not in yet
        const command = [`curl -fsSL ${INSTALL_SH} | sh`, "routstrd onboard --claude-code", "routstrd receive 2100", at.route && call(at.route.model)][
          event.beat
        ];
        if (command) setCmd(command);
        speak(words);
      } else if (event.kind === "lead") {
        at.lead = event.key;
        setLead(event.key);
        const first = name(event.key);
        // the first time a node takes the requests, say so once the line before has been read
        if (first && at.beat >= 3 && !at.told) {
          at.told = true;
          const wait = Math.max(0, at.saidAt + 2600 - performance.now());
          window.clearTimeout(at.wait);
          at.wait = window.setTimeout(() => {
            at.saidAt = performance.now();
            setSay(inUse(first.sats, at.tap));
          }, wait);
        }
      } else if (event.kind === "fail") {
        const rest = (at.resting = [...at.resting, event.key]);
        setResting(rest);
        if (!name(event.key)) return;
        const next = list.find((s) => !rest.includes(s.key));
        if (at.lead !== event.key) speak("Node down. The one in use still works.");
        else if (next)
          speak(
            <>
              Node down. The next cheapest takes over at <i>{sats(next.sats)}</i>. Your agent never notices.
            </>
          );
        else speak(`Every node for ${at.route!.model} is down. Requests wait for the first one back.`);
      } else if (event.kind === "back") {
        const rest = (at.resting = at.resting.filter((key) => key !== event.key));
        setResting(rest);
        const back = name(event.key);
        if (!back) return;
        const first = list.find((s) => !rest.includes(s.key));
        speak(`A node is back.${first === back ? " It's the cheapest, so it takes over." : ""}`);
      }
    };

    const made = new RouteLight(el, { onEvent, onFrame });
    if (made.dead) {
      setDead(true);
      return;
    }
    light.current = made;
    if (state.route) made.setRoutes(state.routes, state.route.model);

    const point = (event: PointerEvent) => {
      const at = box.getBoundingClientRect();
      const x = event.clientX - at.left;
      const y = event.clientY - at.top;
      made.point(x / at.width - 0.5, y / at.height - 0.5);
      if (event.pointerType === "mouse" && !(event.target as Element).closest(".rd-tag")) {
        const key = made.hit(x, y, 16);
        made.hover(key);
        box.toggleAttribute("data-point", !!key);
        for (let i = 0; i < names.length; i++)
          names[i].toggleAttribute("data-hot", (names[i] as HTMLElement).dataset.node === key);
      }
    };
    const leave = () => {
      made.leave();
      box.removeAttribute("data-point");
      for (let i = 0; i < names.length; i++) names[i].removeAttribute("data-hot");
    };
    const click = (event: MouseEvent) => {
      if ((event.target as Element).closest(".rd-tag")) return;
      const at = box.getBoundingClientRect();
      const key = made.hit(event.clientX - at.left, event.clientY - at.top, 26);
      if (key) made.fail(key);
    };
    const resize = new ResizeObserver(() => made.resize());
    resize.observe(box);
    // nothing is drawn while the light is out of sight
    let inView = false;
    const show = () => (inView && !document.hidden ? made.start() : made.stop());
    const seen = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      show();
    });
    seen.observe(box);
    box.addEventListener("pointermove", point);
    box.addEventListener("pointerleave", leave);
    box.addEventListener("click", click);
    document.addEventListener("visibilitychange", show);
    return () => {
      made.dispose();
      resize.disconnect();
      seen.disconnect();
      box.removeEventListener("pointermove", point);
      box.removeEventListener("pointerleave", leave);
      box.removeEventListener("click", click);
      document.removeEventListener("visibilitychange", show);
      window.clearTimeout(state.wait);
      light.current = null;
    };
    // the light is made once; what it shows comes in through setRoutes
  }, []);

  /* With no WebGL there is no film: say who is in use, and list the order. */
  useEffect(() => {
    if (!dead || !route) return;
    const first = route.sellers[0];
    setLead(first.key);
    setCmd(call(route.model));
    setSay(
      <>
        Each request goes to the cheapest node that works: <i>{sats(first.sats)}</i>.
      </>
    );
  }, [dead, route]);

  const choose = (next: string) => {
    const target = routes.find((r) => r.model === next);
    if (!target || next === route?.model) return;
    setModel(next);
    setResting([]);
    if (dead) return;
    light.current?.show(next, now.current.beat >= 3);
    if (now.current.beat < 3) return;
    const first = target.sellers[0];
    now.current.told = true;
    setCmd(call(next));
    speak(
      <>
        <b>{next}</b>: {target.sellers.length} nodes. The cheapest asks <i>{sats(first.sats)}</i>.
      </>
    );
  };

  const fail = (key: string) => light.current?.fail(key);

  const onChipsKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const go = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!go || !routes.length) return;
    event.preventDefault();
    const at = routes.findIndex((r) => r === route);
    const next = routes[(at + go + routes.length) % routes.length].model;
    choose(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-model="${CSS.escape(next)}"]`)?.focus();
  };

  // every node any of the models uses gets a name tag; the light shows the ones in use
  const everyNode = useMemo(() => {
    const seen = new Map<string, Seller>();
    for (const r of routes) for (const s of r.sellers) if (!seen.has(s.key)) seen.set(s.key, s);
    return Array.from(seen.values());
  }, [routes]);

  return (
    <>
      <section
        ref={stage}
        className="rd-stage"
        aria-label="Drawn in light: your agents on one side, routstrd in the middle, and the nodes that sell the model on the other. The nearer a node, the cheaper it is."
      >
        <canvas ref={canvas} aria-hidden="true" />
        <div ref={tags} className="rd-tags" aria-hidden="true">
          <div className="rd-tag rd-eye">
            routstrd<small>localhost:8008</small>
          </div>
          {AGENTS.map(([agent], i) => (
            <div key={agent} data-agent={i} className="rd-tag rd-agent">
              {agent}
            </div>
          ))}
          {everyNode.map(({ key, name, sats: other }) => {
            // a node leaving the light keeps its last price while it fades
            const price = named(key)?.sats ?? other;
            return (
              <button
                key={key}
                data-node={key}
                type="button"
                tabIndex={-1}
                className="rd-tag rd-node"
                data-lead={key === lead || undefined}
                data-rest={resting.includes(key) || undefined}
                onClick={() => fail(key)}
                onPointerEnter={() => light.current?.hover(key)}
                onPointerLeave={() => light.current?.hover(null)}
              >
                <small>{formatSats(price)}</small>
                <span>{name}</span>
              </button>
            );
          })}
        </div>
        {dead && <p className="rd-nogl">This drawing needs WebGL 2, which this browser has turned off.</p>}
      </section>

      <div className="rd-deck">
        <div className="rd-term">
          <code>
            <span className="rd-ps">$</span>
            <Typed text={cmd} still={still || dead} />
            <span className="rd-caret" aria-hidden="true" />
          </code>
          <p aria-live="polite">{say}</p>
        </div>
        <div className="rd-controls">
          <div className="pg-chips rd-models" role="radiogroup" aria-label="Model" onKeyDown={onChipsKey}>
            {routes.map((r) => (
              <button
                key={r.model}
                type="button"
                role="radio"
                aria-checked={r === route}
                tabIndex={r === route ? 0 : -1}
                data-model={r.model}
                onClick={() => choose(r.model)}
              >
                {r.model}
              </button>
            ))}
          </div>
          {!dead && (
            <button type="button" className="rd-cut" disabled={!leader} onClick={() => leader && fail(leader.key)}>
              What if a node fails?
            </button>
          )}
        </div>
        <ol className="rd-order" data-all={dead || undefined} aria-label="The order routstrd tries the nodes">
          {sellers.map((s, n) => {
            const rest = resting.includes(s.key);
            return (
              <li key={s.key} data-lead={s.key === lead || undefined} data-rest={rest || undefined}>
                <button
                  type="button"
                  disabled={dead || rest || !leader}
                  onClick={() => fail(s.key)}
                  aria-label={`${s.name}, ${sats(s.sats)}${rest ? ", resting" : s.key === lead ? ", in use" : ""}. Make it fail.`}
                >
                  <i>{n + 1}</i>
                  <b>{s.name}</b>
                  <span>{sats(s.sats)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="rd-foot">
          {live === false ? "Prices seen on 17 Nov" : "Live prices"} for one request: 100K tokens in, 90% cached, 2K out.{" "}
          <Link href="/prices">Every model&apos;s order</Link>
        </p>
      </div>
    </>
  );
}
