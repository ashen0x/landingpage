"use client";

import { useEffect, useRef } from "react";
import { GLYPHS, SHAPES, buildMasks, type Images } from "@/lib/lockup/masks";
import { HUE_GAP, hourHue, palette, readForeground } from "@/lib/lockup/palette";

const HOLD_MS = 450;
const WAVE_S = 1.1;
const RETURN_S = 4.5;
const PACKET_EVERY = 6.5;
const PACKET_RUN = 2.4;
const BOOT = 1.5;

type Dot = { x: number; y: number; masks: number; bright: number; lit: number; delay: number };
type Ripple = { x: number; y: number; t0: number };

export function DotMatrixLockup() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const images: Images = new Map();
    let dots: Dot[] = [];
    let w = 0;
    let h = 0;
    let cell = 6;
    let fg: [number, number, number] = [128, 128, 128];
    let dark = true;
    let lastFrame = 0;
    let raf = 0;
    let timer = 0;
    let running = false;
    let inView = false;
    let bootAt = -1;
    let packetAt = 0;
    let shown = 0;
    let next = 0;
    let waveAt = -1;
    let settledAt = 0;
    const waveFrom = { x: 0, y: 0 };
    let rich = 0;
    let holdSince = -1;
    const pointer = { x: -1e4, y: -1e4, active: false };
    const ripples: Ripple[] = [];

    const readColor = () => {
      fg = readForeground(host);
      dark = document.documentElement.classList.contains("dark");
    };

    const build = () => {
      w = host.clientWidth;
      if (!w) return;
      h = Math.max(96, Math.round(w / (w < 640 ? 4.2 : 5.4)));
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const set = buildMasks(w, h, getComputedStyle(host).fontFamily, images);
      if (!set) return;
      // Cell follows the type size so a stroke is always two or three dots wide.
      cell = Math.max(3, Math.round(set.wordSize / 24));
      dots = [];
      for (let y = cell / 2; y < h; y += cell) {
        for (let x = cell / 2; x < w; x += cell) {
          const i = (Math.round(y) * w + Math.round(x)) * 4;
          let masks = 0;
          let bright = 0;
          set.masks.forEach((m, k) => {
            if ((m[i + 3] ?? 0) <= 96) return;
            masks |= 1 << k;
            // Dark pixels of an image mark stay lit (the nut's glasses).
            const b = set.bright[k];
            if (b && b[i] + b[i + 1] + b[i + 2] < 180) bright |= 1 << k;
          });
          if (!masks) continue;
          dots.push({ x, y, masks, bright, lit: 0, delay: x / w + Math.random() * 0.1 });
        }
      }
    };

    const ease = (v: number) => v * v * (3 - 2 * v);

    const startWave = (to: number, t: number) => {
      next = to;
      waveAt = t;
      waveFrom.x = pointer.x;
      waveFrom.y = pointer.y;
    };

    const frame = (now: number) => {
      if (now - lastFrame < 28) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastFrame = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);

      let busy = !reduced;
      const bp = reduced || bootAt < 0 ? 1 : Math.min(1, (t - bootAt) / BOOT);
      if (bp < 1) busy = true;

      const since = t - packetAt;
      const packetOn = !reduced && shown === 0 && since >= 0 && since < PACKET_RUN;
      const px = -cell * 12 + (since / PACKET_RUN) * (w + cell * 24);
      if (packetOn) busy = true;

      for (let i = ripples.length - 1; i >= 0; i--) {
        if (t - ripples[i].t0 > 1.8) ripples.splice(i, 1);
      }
      if (ripples.length) busy = true;

      let front = -1;
      if (waveAt >= 0) {
        const age = t - waveAt;
        if (age < WAVE_S) {
          front = ease(age / WAVE_S);
          busy = true;
        } else {
          shown = next;
          waveAt = -1;
          settledAt = t;
        }
      } else if (shown !== 0 && holdSince < 0 && t - settledAt > RETURN_S) {
        startWave(0, t);
        busy = true;
      }
      const maxDist = Math.hypot(Math.max(waveFrom.x, w - waveFrom.x), Math.max(waveFrom.y, h - waveFrom.y));
      const waveBand = cell * 8;
      const curBit = 1 << shown;
      const nextBit = 1 << next;

      const wantRich = holdSince >= 0 && t - holdSince > HOLD_MS / 1000 ? 1 : 0;
      rich += (wantRich - rich) * (wantRich > rich ? 0.08 : 0.04);
      if (Math.abs(wantRich - rich) > 0.01) busy = true;

      const hueA = reduced ? 0.15 : hourHue(t);
      const sat = 1 + 1.6 * rich;
      const [ar, ag, ab] = palette(hueA, dark, sat);
      const [br, bg, bb] = palette((hueA + HUE_GAP) % 1, dark, sat);
      const drift = reduced ? 0 : 0.18 * Math.sin(t * 0.09);
      const tintBase = 0.62 + 0.3 * rich;

      const R = cell * 11;
      const band = cell * 9;
      for (const d of dots) {
        let target = 0;
        if (pointer.active) {
          const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y);
          if (dist < R) target = 1 - dist / R;
        }
        if (packetOn) {
          const dx = d.x - px;
          if (dx > -band * 2.2 && dx < band * 0.5) {
            const v = dx > 0 ? (1 - dx / (band * 0.5)) * 0.6 : (1 + dx / (band * 2.2)) * 0.6;
            if (v > target) target = v;
          }
        }
        for (const r of ripples) {
          const age = t - r.t0;
          const off = Math.abs(Math.hypot(d.x - r.x, d.y - r.y) - 520 * age);
          if (off < cell * 9) {
            const v = (1 - off / (cell * 9)) * (1 - age / 1.8);
            if (v > target) target = v;
          }
        }

        let m = 0;
        if (front >= 0) {
          const dist = Math.hypot(d.x - waveFrom.x, d.y - waveFrom.y);
          m = Math.max(0, Math.min(1, (front * (maxDist + waveBand) - dist) / waveBand));
          const edge = 4 * m * (1 - m);
          if (edge > target) target = edge;
        }
        const inCur = d.masks & curBit ? 1 : 0;
        const inNext = d.masks & nextBit ? 1 : 0;
        const presence = inCur * (1 - m) + inNext * m;
        const glow = (d.bright & curBit ? 1 - m : 0) + (d.bright & nextBit ? m : 0);
        if (glow > target) target = glow;

        // Light comes on fast and fades slowly, so the cursor leaves a trail.
        d.lit += (target - d.lit) * (target > d.lit ? 0.18 : 0.06);
        if (Math.abs(target - d.lit) > 0.004) busy = true;

        if (presence <= 0.01) continue;
        const on = bp >= 1 ? 1 : Math.max(0, Math.min(1, (bp - d.delay * 0.85) / 0.15));
        if (on <= 0) continue;

        const shimmer = reduced ? 0 : 0.06 * Math.sin(d.x * 0.05 + d.y * 0.11 + t * 1.3);
        const mix = Math.max(0, Math.min(1, (d.x / w - 0.3 + drift) / 0.4));
        const pr = ar + (br - ar) * mix;
        const pg = ag + (bg - ag) * mix;
        const pb = ab + (bb - ab) * mix;
        const tint = tintBase * (1 - d.lit);
        const cr = Math.round(fg[0] * (1 - tint) + pr * 255 * tint);
        const cg = Math.round(fg[1] * (1 - tint) + pg * 255 * tint);
        const cb = Math.round(fg[2] * (1 - tint) + pb * 255 * tint);
        const a = (0.4 + shimmer + 0.6 * d.lit) * on * presence;
        const r = cell * 0.26 + cell * 0.12 * d.lit;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (busy && inView) {
        raf = requestAnimationFrame(frame);
        return;
      }
      running = false;
      if (inView && !reduced) {
        const nextPacket = Math.max(0, packetAt + PACKET_EVERY - t);
        timer = window.setTimeout(() => {
          packetAt = performance.now() / 1000;
          wake();
        }, nextPacket * 1000);
      }
    };

    const wake = () => {
      if (running) return;
      window.clearTimeout(timer);
      running = true;
      raf = requestAnimationFrame(frame);
    };

    const sleep = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };

    readColor();
    build();
    void document.fonts.ready.then(() => {
      build();
      wake();
    });
    for (const g of GLYPHS) {
      if (g.kind !== "image") continue;
      const img = new Image();
      img.onload = () => {
        images.set(g.src, img);
        build();
        wake();
      };
      img.src = g.src;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (!inView) return sleep();
        if (bootAt < 0) {
          bootAt = performance.now() / 1000;
          packetAt = bootAt + BOOT + 0.6;
        }
        wake();
      },
      { threshold: 0.3 }
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      build();
      wake();
    });
    ro.observe(host);

    const mo = new MutationObserver(() => {
      readColor();
      wake();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.active = true;
      wake();
    };
    const onLeave = () => {
      pointer.active = false;
      holdSince = -1;
      wake();
    };
    const onDown = (e: PointerEvent) => {
      const p = local(e);
      pointer.x = p.x;
      pointer.y = p.y;
      ripples.push({ x: p.x, y: p.y, t0: performance.now() / 1000 });
      holdSince = performance.now() / 1000;
      wake();
    };
    const onUp = () => {
      const t = performance.now() / 1000;
      // A short press is a click; a long press was the colour reveal.
      if (holdSince >= 0 && t - holdSince < HOLD_MS / 1000 && waveAt < 0) {
        startWave((shown + 1) % SHAPES, t);
      }
      holdSince = -1;
      wake();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") sleep();
      else if (inView) wake();
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointercancel", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      sleep();
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="mx-auto mt-16 w-full max-w-[1800px] select-none text-foreground md:mt-32"
      style={{ fontFamily: "var(--font-michroma), monospace" }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Routstr"
        className="block w-full [touch-action:pan-y]"
      />
    </div>
  );
}
