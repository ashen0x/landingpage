"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { compact } from "@/lib/home/format";
import { usePulse } from "@/lib/home/use-pulse";

function Count({ value }: { value: number | null }) {
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(0);
  useEffect(() => {
    if (value === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    // counts on from wherever it stands, as more nodes' reports arrive
    const base = from.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 1300);
      from.current = base + (value - base) * (1 - Math.pow(1 - t, 4));
      setShown(from.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown === null ? "\u2014" : compact(shown)}</>;
}

export function Pulse() {
  const root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const { pulse, done } = usePulse(near);

  // The reports are a few megabytes: ask for them only when the strip is near.
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

  const stats = [
    { value: pulse?.requests ?? null, label: "requests answered" },
    { value: pulse?.tokens ?? null, label: "tokens" },
    { value: pulse?.sats ?? null, label: "sats paid to nodes" },
    { value: pulse?.nodes ?? null, label: "nodes reporting" },
  ];

  return (
    <section ref={root} className="wrap pulse" aria-label="The last 30 days">
      <div className="pulse-head" data-rise>
        <p className="kicker">
          The last 30 days
          {near && !done && <span className="pulse-live"> &middot; counting</span>}
        </p>
        <p>
          Counted by the nodes themselves, in reports they sign and publish on Nostr.{" "}
          <Link href="/stats" className="link">
            Open the stats <ArrowRight />
          </Link>
        </p>
      </div>
      <dl className="pulse-grid">
        {stats.map((stat, i) => (
          <div key={stat.label} data-rise style={{ ["--i" as string]: i }}>
            <dt>{stat.label}</dt>
            <dd data-wait={stat.value === null || undefined}>
              <Count value={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
