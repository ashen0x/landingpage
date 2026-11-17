"use client";

import { useEffect, useRef } from "react";
import { Fibres, reach, type Pose } from "@/components/try/light/fibres";

const still = { yaw: -0.58, pitch: 0.86, roll: 0.05, blur: 0.7, mark: 0 };

let live: Fibres | null = null;
let turn = 0;
let fade = 0;

/** Something was picked on the page: one lane of the strip goes gold for a moment. */
export function pulse() {
  if (!live) return;
  live.choose(turn++ % 4);
  window.clearTimeout(fade);
  fade = window.setTimeout(() => live?.choose(null), 700);
}

/** A strip of the home page's light across the top of a page: the lanes, and the one that won. */
export function Band() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let key = "";
    let set: { opening: Pose; list: Pose[] } | null = null;
    const light = new Fibres(
      el,
      (width, height) => {
        if (!set || key !== `${width}/${height}`) {
          key = `${width}/${height}`;
          const half = reach(width / height);
          const size = Math.min(1.5, Math.max(0.62, half / 4.6));
          set = {
            // one cable crosses the strip, then opens into lanes on the side away from the words
            opening: { ...still, form: 2, x: half * 0.2, y: 0.1, yaw: 0, pitch: 0.1, roll: -0.04, scale: size * 1.3, gain: 0.26, pulse: 4, chosen: 0 },
            list: [{ ...still, form: 1, x: half * 0.52, y: -0.28, scale: size, gain: 0.6, pulse: 0.25, chosen: 1 }],
          };
        }
        return set;
      },
      undefined,
      window.innerWidth < 760 ? 180 : 380
    );
    if (light.dead) return;
    el.dataset.ready = "";
    live = light;

    const onPointer = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      light.point((event.clientX - box.left) / box.width - 0.5, (event.clientY - box.top) / box.height - 0.5);
    };
    const onResize = () => light.resize();
    const onShow = () => light.start();
    // nothing is drawn once the strip has scrolled away
    const seen = new IntersectionObserver(([entry]) => (entry.isIntersecting ? light.start() : light.stop()));
    seen.observe(el);
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = null;
      light.stop();
      seen.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return <canvas ref={canvas} className="bd" aria-hidden="true" />;
}
