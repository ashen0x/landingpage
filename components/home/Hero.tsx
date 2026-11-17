"use client";

import { ArrowDown, ArrowUpRight } from "lucide-react";
import { CHAT_URL } from "@/components/Header";
import { LiveRoute } from "@/components/home/LiveRoute";
import { useMarket } from "@/lib/home/use-market";

export function Hero() {
  const market = useMarket();
  const open = market.nodeCount > 0;

  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <p className="hero-status">
          <i className="dot" data-on={open || undefined} />
          {open
            ? `Market open · ${market.nodeCount} nodes · ${market.modelCount.toLocaleString("en-US")} models`
            : "Reading the market"}
        </p>
        <h1 className="d1">
          <span className="d1-a">
            <span>Ask any model.</span>
          </span>
          <span className="d1-b">
            <span>
              <em>Pay in sats.</em>
            </span>
          </span>
        </h1>
        <div className="hero-copy">
          <p className="lede">
            Routstr is an open market for AI. Independent nodes sell the models, your app sends
            each request to the best price, and you pay per answer in bitcoin.
          </p>
          <div className="hero-cta">
            <a href={CHAT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-tint">
              Open the chat <ArrowUpRight />
            </a>
            <a href="#ways-in" className="btn btn-quiet">
              Use it in your tools <ArrowDown />
            </a>
          </div>
          <p className="hero-note">No account. No card. No subscription.</p>
        </div>
        <LiveRoute market={market} />
      </div>
    </section>
  );
}
