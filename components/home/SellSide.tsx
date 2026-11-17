"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { compact } from "@/lib/home/format";
import { usePulse } from "@/lib/home/use-pulse";

const PROVIDER_GUIDE = "https://docs.routstr.com/provider/quickstart/";

const facts = [
  ["Any OpenAI-compatible API", "Your own GPUs, Ollama, vLLM, or a hosted endpoint behind it."],
  ["Your prices", "Set them per model. Apps compare you with every other node."],
  ["Paid per request", "Ecash lands as you serve, and pays out to your Lightning address."],
];

export function SellSide() {
  const root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const { pulse } = usePulse(near);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        watch.disconnect();
      },
      { rootMargin: "600px" }
    );
    watch.observe(element);
    return () => watch.disconnect();
  }, []);

  const top = pulse?.earners.slice(0, 5) ?? [];
  const most = top[0]?.sats ?? 1;

  return (
    <section ref={root} id="sell" className="wrap">
      <div className="sheet slab sell">
        <div className="sell-copy">
          <div data-rise>
            <p className="kicker">03 &middot; Sell on it</p>
            <h2 className="d2">
              Spare AI capacity? <em>Sell it for sats.</em>
            </h2>
          </div>
          <p className="lede" data-rise style={{ ["--i" as string]: 1 }}>
            Routstr Core is a payment proxy. Put it in front of a model API, set your prices, and
            it announces your node on Nostr and collects the sats for every request.
          </p>
          <ul className="sell-facts">
            {facts.map(([title, text], i) => (
              <li key={title} data-rise style={{ ["--i" as string]: i + 1 }}>
                <b>{title}</b>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="hero-cta" data-rise>
            <a href={PROVIDER_GUIDE} target="_blank" rel="noopener noreferrer" className="btn btn-on-slab">
              Run a node <ArrowUpRight />
            </a>
            <Link href="/prices" className="btn btn-slab-quiet">
              See what nodes charge <ArrowRight />
            </Link>
          </div>
        </div>

        <div className="board" data-rise style={{ ["--i" as string]: 2 }}>
          <div className="board-head">
            <span className="kicker">Earned in the last 30 days</span>
            <span className="mono">sats</span>
          </div>
          <ol>
            {(top.length ? top : Array.from({ length: 5 }, () => null)).map((earner, i) => (
              <li key={earner?.label ?? i} data-wait={!earner || undefined}>
                <span className="board-name">{earner?.label ?? " "}</span>
                <span className="board-sats mono">{earner ? compact(earner.sats) : ""}</span>
                <i style={{ ["--w" as string]: earner ? Math.max(0.03, earner.sats / most) : 0 }} />
              </li>
            ))}
          </ol>
          <div className="board-foot">
            <span>
              {pulse
                ? `${compact(pulse.sats)} sats across ${pulse.nodes} nodes, as they report it.`
                : "Reading the nodes' own reports."}
            </span>
            <Link href="/stats">
              Stats <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
