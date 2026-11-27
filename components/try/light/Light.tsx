"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { NostrMark, XMark } from "@/components/icons/platformIcons";
import { Fibres, reach, type Pose } from "@/components/try/light/fibres";
import { blow } from "@/components/try/light/wind";
import "./light.css";

const CHAT = "https://chat.routstr.com";
const GUIDE = "https://docs.routstr.com/provider/quickstart/";
const GITHUB = "https://github.com/Routstr";

/* One pose of the light for each scene, in page order. On a wide screen it
   stands beside the words; on a narrow one it stands above them. */
const still = { chosen: 0, blur: 1, mark: 0 };
const WIDE: Pose[] = [
  { ...still, form: 0, x: 2.6, y: 0.1, yaw: -0.42, pitch: 0.2, roll: -0.34, scale: 1.05, gain: 1, pulse: 0.8 },
  { ...still, form: 1, x: 2.2, y: -0.7, yaw: -0.62, pitch: 0.86, roll: 0.05, scale: 0.9, gain: 0.9, pulse: 0.2, chosen: 1, blur: 0.7 },
  { ...still, form: 2, x: 0, y: -1.42, yaw: 0, pitch: 0.12, roll: 0.05, scale: 1, gain: 0.55, pulse: 2.6 },
  { ...still, form: 3, x: -1.98, y: -0.05, yaw: 0.2, pitch: 1.0, roll: 0.3, scale: 0.98, gain: 0.4, pulse: 1.3 },
  { ...still, form: 4, x: 1.36, y: 0, yaw: 0, pitch: 0.2, roll: 0, scale: 1.0, gain: 0.38, pulse: 1.5 },
  { ...still, form: 7, x: 1.5, y: -0.1, yaw: -0.5, pitch: 0.16, roll: 0.42, scale: 0.9, gain: 0.5, pulse: 1.6, blur: 0.3 },
  { ...still, form: 7, x: 0, y: -1.0, yaw: 0, pitch: 0.1, roll: 0.02, scale: 1, gain: 0.5, pulse: 1.2, blur: 0.2 },
  { ...still, form: 5, x: 0, y: -1.45, yaw: 0, pitch: 0.08, roll: 0, scale: 1, gain: 0.7, pulse: 1.1, chosen: 0.6, blur: 0.5 },
  { ...still, form: 6, x: 0, y: 0.52, yaw: 0, pitch: 0, roll: 0, scale: 0.98, gain: 2.3, pulse: 1.2, blur: 0, mark: 1 },
];
const NARROW: Pose[] = [
  { ...still, form: 0, x: 0.12, y: 0.98, yaw: -0.5, pitch: 0.2, roll: -0.5, scale: 0.6, gain: 1, pulse: 0.8 },
  { ...still, form: 1, x: 0.2, y: 0.8, yaw: -0.62, pitch: 0.86, roll: 0.05, scale: 0.5, gain: 0.9, pulse: 0.2, chosen: 1, blur: 0.7 },
  { ...still, form: 2, x: 0, y: 0.95, yaw: 0, pitch: 0.12, roll: 0.3, scale: 0.6, gain: 0.55, pulse: 2.6 },
  { ...still, form: 3, x: 0, y: 1.25, yaw: 0.2, pitch: 1.0, roll: 0.3, scale: 0.44, gain: 0.22, pulse: 1.3 },
  { ...still, form: 4, x: 0, y: 1.02, yaw: 0, pitch: 0.2, roll: 0, scale: 0.5, gain: 0.38, pulse: 1.5 },
  { ...still, form: 7, x: 0, y: 1.0, yaw: -0.3, pitch: 0.16, roll: 0.3, scale: 0.6, gain: 0.5, pulse: 1.6, blur: 0.3 },
  { ...still, form: 7, x: 0, y: 1.02, yaw: 0, pitch: 0.1, roll: 0.08, scale: 0.62, gain: 0.5, pulse: 1.2, blur: 0.2 },
  { ...still, form: 5, x: 0, y: -1.45, yaw: 0, pitch: 0.1, roll: 0, scale: 0.8, gain: 0.55, pulse: 1.1, chosen: 0.6, blur: 0.5 },
  { ...still, form: 6, x: 0, y: 0.1, yaw: 0, pitch: 0, roll: 0, scale: 0.6, gain: 2.1, pulse: 1.4, blur: 0, mark: 1 },
];
/* How the page opens: one cable of light crosses it, then lets go into the first shape. */
const OPENING_WIDE: Pose = { ...still, form: 2, x: 0.4, y: 0.1, yaw: 0, pitch: 0.1, roll: -0.16, scale: 1, gain: 0.34, pulse: 4 };
const OPENING_NARROW: Pose = { ...still, form: 2, x: 0, y: 1.0, yaw: 0, pitch: 0.1, roll: -0.3, scale: 0.6, gain: 0.5, pulse: 4 };

const scenes = ["Start", "Route", "Pay", "Build", "Earn", "Social", "Voices", "Open", "Routstr"];

const snippets = [
  {
    tab: "Agents",
    lines: [
      ["$", "curl -fsSL \\"],
      ["", "    https://github.com/Routstr/routstrd/releases/latest/download/install.sh | sh"],
      ["$", "routstrd onboard"],
      ["$", "routstrd receive 2100", "top up over Lightning"],
      ["$", "routstrd clients add --claude-code", "or --opencode, --pi-agent"],
    ],
  },
  {
    tab: "Python",
    lines: [
      ["", "from openai import OpenAI"],
      ["", ""],
      ["", "client = OpenAI("],
      ["", '    base_url="https://provider.example/v1",', "any Routstr node"],
      ["", '    api_key="cashuBo2F...",', "a Cashu token is the key"],
      ["", ")"],
    ],
  },
  {
    tab: "cURL",
    lines: [
      ["$", "curl https://provider.example/v1/chat/completions \\"],
      ["", '    -H "x-cashu: cashuBo2F..." \\'],
      ["", "    -d '{"],
      ["", '      "model": "gpt-5-nano",'],
      ["", '      "messages": [{"role": "user", "content": "hello"}]'],
      ["", "    }'"],
    ],
  },
];

const tools = [
  { name: "routstrd", line: "A local daemon that routes your coding agents.", href: "/routstrd" },
  { name: "SDK", line: "Routing and a wallet, inside your own app.", href: `${GITHUB}/routstr-sdk` },
  { name: "MCP", line: "Every model as a tool for your agent. In preview.", href: "https://github.com/ashen0x/routstr-mcp" },
  { name: "Chat", line: "Every model in one place. Nothing to sign up for.", href: CHAT },
];

const rails = [
  { name: "Lightning", line: "Pay an invoice from any wallet." },
  { name: "Cashu", line: "Paste an ecash token. It works as your API key." },
];

/* What people have posted in public, word for word, each with its source. A long post is cut
   at the end of a sentence; the card links to the whole of it. */
const voices = [
  {
    on: "x",
    name: "Juraj Bednar",
    face: "juraj",
    handle: "@jurbed",
    text: "The magic trick is routstr. It creates a brutal competitive marketplace for inference, where providers undercut each other on price.",
    href: "https://x.com/jurbed/status/2101954518804042189",
  },
  // second, not first: the row drifts to the left, and the first post is the first to leave
  {
    on: "x",
    name: "jack",
    face: "jack",
    handle: "@jack",
    text: "nostr+bitcoin+ai routstr.com",
    href: "https://x.com/jack/status/1925607683454869946",
  },
  {
    on: "nostr",
    name: "calle",
    face: "calle",
    handle: "npub12rv5...sf485vg",
    text: "This is incredible. AI chat pay per use. No accounts but instant and anonymous Bitcoin micro payments with Cashu.\n\nTry it with a tiny amount and see for yourself!",
    href: "https://njump.me/nevent1qqszj3rsayzeguyu02lfph63xm4lrh38el73yq37zsnhc6vrqq5tkxqzypgdjn7zmpvqc6ptqud9gtutrcc6yq9s2z96h9dr80hss4wl9qwkx0u6nyh",
  },
  {
    on: "nostr",
    name: "Vitor Pamplona",
    face: "vitor",
    handle: "npub1gcxz...qlfnj5z",
    text: "You know what, routstr.com is the first app that has loaded my NIP-60 tokens correctly. #winning",
    href: "https://njump.me/note1qtyuwpuzwls6ecjzqmahd4lu0rq9p63h5xuqta5xvs4zr43m2ygsvpmr3m",
  },
  {
    on: "x",
    name: "Cashu",
    face: "cashu",
    handle: "@CashuBTC",
    text: "With routstr, you can pay for AI services with Bitcoin using Cashu ecash.",
    href: "https://x.com/CashuBTC/status/1978042521625231844",
  },
  {
    on: "nostr",
    name: "ManiMe",
    face: "manime",
    handle: "npub1manl...qvyn9tn",
    text: "Routstr just BLEW MY MIND!!\nAfter stalling FOR A WEEK on KYC and rent seeking OpenRouter setup … I just discovered ZERO FRICTION and NOSTR NATIVE API access to a variety of AI models … for use in stacks and goose and others.",
    href: "https://njump.me/note1jmct8qpu0ya023msu7xxlk084fy5qcutrjas7djthn2zp25twuxqe7w2rm",
  },
  {
    on: "x",
    name: "RoninHodler",
    face: "ronin",
    handle: "@RoninHodler",
    text: "Can you imagine being able to use the best AI models (like GPT, Claude, DeepSeek, etc.) without creating an account, without giving your data, without a credit card, and paying only with Bitcoin?\n\nThat already exists and it's called Routstr.",
    href: "https://x.com/RoninHodler/status/2079537336182772187",
  },
  {
    on: "nostr",
    name: "highperfocused",
    face: "highperfocused",
    handle: "npub1fq8v...qntmzut",
    text: "GM nostr\nI'm currently hosting qwen3.5 122b locally on my home.\nYou can give it a try via #routstr (an awesome project btw).",
    href: "https://njump.me/note1dspkyvxlr3t227r4xkjlezyuyj5gym3mu9vg3s4kk8aev7nn83fsk89zls",
  },
  {
    on: "nostr",
    name: "DerOptimist",
    face: "deroptimist",
    handle: "npub1hn9v...sfgtwc3",
    text: "Social media on nostr is great, but projects like ZapStore, Routstr and White Noise are where Nostr really shines imo.",
    href: "https://njump.me/note1a46yytzc5skcerqcdc8e6973phku6a5hdxre7kczdx98u2lrjpsstuakuj",
  },
  {
    on: "nostr",
    name: "npub1ak68...xy8fx",
    face: "npub1ak68",
    handle: "",
    text: "When you run your own routstr AI proxy on your own private vps, self host your own AI otrta chat client and send cashu from your own client to your own proxy to privately query AI over tor.",
    href: "https://nostr.eu/nevent1qqs24ymyjlp730qgf2nrj7utk3kf8m08xsrmftxdk5d60ln92tgsvvqzyrkmgup8z2t6cknp7fml8ng5me2vvl44enfqauxemu5muxrgtwcqgx6yq3l",
  },
  {
    on: "nostr",
    name: "hakkadaikon",
    face: "hakkadaikon",
    handle: "npub1zqdn...suyk6mn",
    text: "Today, at a Japanese online study group, I gave a short lightning talk explaining routstr.\n\nI'm really looking forward to the future of routstr",
    href: "https://njump.me/note1tndg92zz7rkvswy9vsdd7venqj0jalyxaut67qzgtes95g9dv0sszumc54",
  },
];

const repos = ["routstr-core", "routstrd", "routstr-sdk", "routstr-chat", "routstrd-remote"];

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A line of a heading that rises out of its own mask. */
function Ln({ children, i = 0 }: { children: React.ReactNode; i?: number }) {
  return (
    <span className="ln">
      <span style={{ ["--i" as string]: i }}>{children}</span>
    </span>
  );
}

/** What the headline says AI now is, one word at a time. */
const turns = ["Permissionless.", "Decentralized.", "Private."];
/** How long a word of the headline has, its coming and going on the wind included. */
const TURN_MS = 5000;

/** The headline. Its last word is one of three in turn: the three lie on one another. The one that
    stands is drawn as threads into a point where the light gathers its fibres (`ends`, in pixels
    of the screen), and the next is spun out of it (wind.ts). While the threads are on their way no
    word stands in the page. */
function Headline({ live, ends }: { live: boolean; ends: () => [number, number][] }) {
  const [at, setAt] = useState(0);
  const word = useRef(0);
  const words = useRef<HTMLElement>(null);
  const air = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!live || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let still = () => {};
    const timer = window.setInterval(() => {
      if (document.hidden || !words.current || !air.current) return;
      const next = (word.current + 1) % turns.length;
      const spans = words.current.children;
      still();
      still = blow(air.current, spans[word.current] as HTMLElement, spans[next] as HTMLElement, ends, () => setAt(next));
      word.current = next;
      setAt(-1);
    }, TURN_MS);
    return () => {
      window.clearInterval(timer);
      still();
    };
  }, [live, ends]);
  return (
    <h1 aria-label="AI is now permissionless, decentralized, private.">
      <Ln>AI is now</Ln>{" "}
      <Ln i={1}>
        <b className="lt-turn" aria-hidden="true" ref={words}>
          {turns.map((word, i) => (
            <span key={word} data-on={i === at || undefined}>
              {word}
            </span>
          ))}
        </b>
      </Ln>
      <canvas className="lt-wind" ref={air} aria-hidden="true" />
    </h1>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
    </svg>
  );
}

function Code() {
  const [open, setOpen] = useState(0);
  const [copied, setCopied] = useState(false);
  const snippet = snippets[open];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.lines.map((line) => line[1]).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the text is still selectable
    }
  };
  return (
    <div className="lt-code">
      <div className="lt-code-bar">
        <div role="tablist" aria-label="Example">
          {snippets.map((item, i) => (
            <button key={item.tab} type="button" role="tab" aria-selected={i === open} onClick={() => setOpen(i)}>
              {item.tab}
            </button>
          ))}
        </div>
        <button type="button" className="lt-copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* every example lies in the same place, so the panel is as tall as the tallest and nothing moves on a switch */}
      <div className="lt-code-body">
        {snippets.map((item, n) => (
          <pre key={item.tab} data-on={n === open || undefined} aria-hidden={n !== open || undefined}>
            {item.lines.map(([prompt, text, note], i) => (
              <span key={i} style={{ ["--i" as string]: i }}>
                {prompt && <i>{prompt} </i>}
                {text}
                {note && <em>{`  # ${note}`}</em>}
                {"\n"}
              </span>
            ))}
          </pre>
        ))}
      </div>
    </div>
  );
}

/** How fast the row of posts travels, in pixels a second. */
const DRIFT = 32;

/** A row of posts that never stops: it drifts slowly, round and round. It rests while the
 *  pointer is on it, and can be pulled along by hand. On a phone it is a row to swipe. */
function Voices({ onPull, live }: { onPull: () => void; live: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const belt = useRef<HTMLUListElement>(null);
  const on = useRef(live);
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    on.current = live;
  }, [live]);

  useEffect(() => {
    const win = frame.current;
    const row = belt.current;
    if (!win || !row) return;
    const swiped = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const items = Array.from(row.children) as HTMLElement[];
    // the posts are laid twice, end to end: one lap is the way from a post to its twin
    const lap = () => items[items.length / 2].offsetLeft - items[0].offsetLeft;
    let at = 0;
    let speed = 0;
    let over = false;
    let pull: { from: number; at: number; moved: boolean; last: number; when: number; pace: number } | null = null;
    let swallow = false;
    let then = performance.now();
    let tick = 0;

    const step = (now: number) => {
      tick = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - then) / 1000);
      then = now;
      if (swiped.matches) {
        row.style.transform = "";
        return;
      }
      // it eases to a rest and back to its pace, never stops or starts dead
      const want = on.current && !over && !pull && !calm.matches ? DRIFT : 0;
      speed += (want - speed) * (1 - Math.exp(-dt * 3));
      if (!pull) at += speed * dt;
      const round = lap();
      if (round > 0) at = ((at % round) + round) % round;
      row.style.transform = `translate3d(${(-at).toFixed(2)}px, 0, 0)`;
    };
    tick = requestAnimationFrame(step);

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") over = true;
    };
    const onLeave = () => (over = false);
    const onDown = (event: PointerEvent) => {
      if (swiped.matches || event.button !== 0) return;
      pull = { from: event.clientX, at, moved: false, last: event.clientX, when: event.timeStamp, pace: 0 };
    };
    const onMove = (event: PointerEvent) => {
      if (!pull) return;
      const by = event.clientX - pull.from;
      if (!pull.moved && Math.abs(by) < 6) return;
      if (!pull.moved) win.setPointerCapture(event.pointerId);
      pull.moved = true;
      at = pull.at - by;
      // how fast the hand is going, to carry on from when it lets go
      const span = Math.max(1, event.timeStamp - pull.when);
      pull.pace = pull.pace * 0.6 + ((pull.last - event.clientX) / span) * 1000 * 0.4;
      pull.last = event.clientX;
      pull.when = event.timeStamp;
    };
    const onUp = () => {
      if (pull?.moved) {
        speed = Math.max(-1400, Math.min(1400, pull.pace));
        onPull();
        // the click that ends a pull is not a click on a post
        swallow = true;
        window.setTimeout(() => (swallow = false), 0);
      }
      pull = null;
    };
    const onClick = (event: MouseEvent) => {
      if (swallow) event.preventDefault();
    };
    // a post reached with the keyboard is brought to the front of the row
    const onFocus = (event: FocusEvent) => {
      const item = (event.target as HTMLElement).closest("li");
      over = true;
      if (item && !swiped.matches) at = item.offsetLeft - items[0].offsetLeft;
    };
    // swiped by hand on a phone: which post leads
    const onScroll = () => {
      const stride = items[1].offsetLeft - items[0].offsetLeft;
      setSeen(Math.min(items.length / 2 - 1, Math.max(0, Math.round(win.scrollLeft / stride))));
    };

    win.addEventListener("pointerenter", onEnter);
    win.addEventListener("pointerleave", onLeave);
    win.addEventListener("pointerdown", onDown);
    win.addEventListener("pointermove", onMove);
    win.addEventListener("pointerup", onUp);
    win.addEventListener("pointercancel", onUp);
    win.addEventListener("click", onClick, true);
    win.addEventListener("focusin", onFocus);
    win.addEventListener("focusout", onLeave);
    win.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(tick);
      win.removeEventListener("pointerenter", onEnter);
      win.removeEventListener("pointerleave", onLeave);
      win.removeEventListener("pointerdown", onDown);
      win.removeEventListener("pointermove", onMove);
      win.removeEventListener("pointerup", onUp);
      win.removeEventListener("pointercancel", onUp);
      win.removeEventListener("click", onClick, true);
      win.removeEventListener("focusin", onFocus);
      win.removeEventListener("focusout", onLeave);
      win.removeEventListener("scroll", onScroll);
    };
  }, [onPull]);

  return (
    <div className="lt-voice">
      <div className="lt-posts" ref={frame}>
        <ul ref={belt}>
          {[...voices, ...voices].map((voice, i) => {
            const twin = i >= voices.length;
            return (
              <li key={`${voice.href}${twin ? "-twin" : ""}`} data-twin={twin || undefined} aria-hidden={twin || undefined}>
                <a href={voice.href} className="lt-post" draggable={false} tabIndex={twin ? -1 : undefined}>
                  {voice.on === "x" ? <XMark className="lt-on" /> : <NostrMark className="lt-on lt-on-nostr" />}
                  <blockquote data-loud={voice.text.length < 40 || undefined}>{voice.text}</blockquote>
                  <footer>
                    <Image src={`/voices/${voice.face}.webp`} alt="" width={28} height={28} loading="eager" draggable={false} />
                    <b>{voice.name}</b>
                    {voice.handle && <span>{voice.handle}</span>}
                    <Arrow />
                  </footer>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="lt-ticks">
        {voices.map((voice, i) => (
          <button
            key={voice.href}
            type="button"
            aria-current={i === seen || undefined}
            aria-label={`Show the post by ${voice.name}`}
            onClick={() => {
              const items = belt.current?.children;
              if (!items || !frame.current) return;
              const left = (items[i] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft;
              frame.current.scrollTo({ left, behavior: "smooth" });
            }}
          >
            <i />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Light() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const film = useRef<HTMLElement>(null);
  const engine = useRef<Fibres | null>(null);
  const [at, setAt] = useState(0);
  const jump = useRef<(i: number) => void>(() => {});
  const pluck = useCallback(() => engine.current?.pluck(), []);
  /* the spindle's fibres all leave one point and meet again in another: the two ends of its length */
  const ends = useCallback(() => {
    const one = engine.current?.spot(-1.85, 0, 0);
    const other = engine.current?.spot(1.85, 0, 0);
    return one && other ? [one, other] : [];
  }, []);
  useEffect(() => {
    const host = root.current;
    const reel = film.current;
    if (!canvas.current || !host || !reel) return;
    const parts = Array.from(host.querySelectorAll<HTMLElement>("[data-part]"));
    const column = host.querySelector<HTMLElement>(".lt-build .lt-in");
    let shown = 0;
    /* The ring stands left of the Build column. On a tighter screen it steps
       back and shrinks, so it never sits under the words. */
    let columnAt = 0.45;
    let wide = { key: "", opening: OPENING_WIDE, list: WIDE };
    const light = new Fibres(
      canvas.current,
      (width, height) => {
        if (width <= 760 || width < height) return { opening: OPENING_NARROW, list: NARROW };
        const key = `${width}/${height}/${columnAt.toFixed(3)}`;
        if (wide.key !== key) {
          const half = reach(width / height);
          const edge = (columnAt * 2 - 1) * half - 0.12;
          const size = Math.min(0.98, Math.max(0.6, (edge + half) / 2.2));
          const list = WIDE.map((pose) => (pose.form === 3 ? { ...pose, scale: size, x: edge - 1.5 * size } : pose));
          wide = { key, opening: OPENING_WIDE, list };
        }
        return wide;
      },
      (stage) => {
        const now = Math.round(stage);
        if (now !== shown) {
          shown = now;
          setAt(now);
        }
      }
    );
    engine.current = light;

    /* On a screen with room, the page plays like a film: the scenes are
       pinned and scrolling moves through them. Elsewhere they simply stack. */
    const wants = window.matchMedia(
      "(min-width: 900px) and (min-height: 700px) and (min-aspect-ratio: 11/10) and (prefers-reduced-motion: no-preference)"
    );
    const stacked = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)");
    let pinned = false;
    let centres: number[] = [];
    let boxes: number[][] = [];
    const last = parts.length - 1;
    /* A scene taller than the screen takes its light along as it scrolls by,
       so the words never run underneath it. */
    const carried = (k: number) => {
      const [top, height] = boxes[k] ?? [0, 0];
      const over = height - window.innerHeight;
      if (over < window.innerHeight * 0.25) return 0;
      const home = stacked.matches ? top : top + over / 2;
      return Math.min(top + over - home, Math.max(top - home, window.scrollY - home)) / window.innerHeight;
    };

    const rail = host.querySelector<HTMLElement>(".lt-rail");
    let rest = 0;
    const follow = () => {
      // the rail shows itself while the page is moving, then goes quiet again
      if (rail) {
        rail.dataset.awake = "";
        window.clearTimeout(rest);
        rest = window.setTimeout(() => delete rail.dataset.awake, 1400);
      }
      if (pinned) {
        const run = reel.offsetHeight - window.innerHeight;
        const q = Math.min(last, Math.max(0, ((window.scrollY - reel.offsetTop) / run) * last));
        light.target = q;
        light.lift = 0;
        parts.forEach((part, i) => {
          const away = q - i;
          const show = 1 - smooth(0.16, 0.42, Math.abs(away));
          part.style.setProperty("--show", show.toFixed(3));
          part.style.setProperty("--drift", `${(-away * 90).toFixed(1)}px`);
          part.toggleAttribute("data-live", show > 0.01);
          if (show > 0.5) part.dataset.in = "";
        });
        return;
      }
      const y = window.scrollY + window.innerHeight / 2;
      let i = 0;
      while (i < centres.length - 2 && y > centres[i + 1]) i++;
      const span = centres[i + 1] - centres[i] || 1;
      const along = Math.min(1, Math.max(0, (y - centres[i]) / span));
      light.target = i + along;
      const turn = smooth(0.22, 0.78, along);
      light.lift = carried(i) * (1 - turn) + carried(i + 1) * turn;
    };
    const measure = () => {
      pinned = wants.matches;
      host.toggleAttribute("data-film", pinned);
      if (!pinned) {
        for (const part of parts) {
          part.style.removeProperty("--show");
          part.style.removeProperty("--drift");
          part.removeAttribute("data-live");
        }
      }
      centres = parts.map((part) => part.offsetTop + part.offsetHeight / 2);
      boxes = parts.map((part) => [part.offsetTop, part.offsetHeight]);
      if (column) columnAt = column.getBoundingClientRect().left / window.innerWidth;
      follow();
    };
    jump.current = (i) => {
      const top = pinned
        ? reel.offsetTop + (i / last) * (reel.offsetHeight - window.innerHeight)
        : centres[i] - window.innerHeight / 2;
      window.scrollTo({ top, behavior: "smooth" });
    };

    const onPointer = (event: PointerEvent) => {
      light.point(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
    };
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onClick = (event: MouseEvent) => {
      // a press on a link or a button is for that link or button
      if (calm.matches || (event.target as Element).closest("a, button, pre")) return;
      light.tap(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
    };
    const onResize = () => {
      light.resize();
      measure();
    };
    const onShow = () => light.start();

    // where the scenes stack, each one comes in the first time it is seen
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !pinned) (entry.target as HTMLElement).dataset.in = "";
        }
      },
      { threshold: 0.3 }
    );
    parts.forEach((part) => seen.observe(part));

    measure();
    light.start();
    // without WebGL the page keeps a still glow where the light would be
    host.dataset.ready = light.dead ? "flat" : "";
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearTimeout(rest);
      light.dispose();
      seen.disconnect();
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return (
    <div className="lt" ref={root}>
      <canvas ref={canvas} className="lt-light" aria-hidden="true" />

      <Header />

      <nav className="lt-rail" aria-label="Scenes">
        {scenes.map((name, i) => (
          <button key={name} type="button" aria-current={at === i || undefined} onClick={() => jump.current(i)}>
            <span>{name}</span>
            <i />
          </button>
        ))}
      </nav>

      <main className="lt-film" ref={film} style={{ ["--scenes" as string]: scenes.length }}>
        <div className="lt-screen">
          <section className="lt-part lt-hero" data-part data-side="left">
            <div className="lt-in">
              <Headline live={scenes[at] === "Start"} ends={ends} />
              <p className="lt-lede">
                Independent nodes sell the models. Your request takes the best path. You pay for
                it in sats.
              </p>
              <div className="lt-cta">
                <Link href="/routstrd" className="lt-btn">
                  Use routstrd <Arrow />
                </Link>
                <a href={GUIDE} className="lt-link">
                  Run a node
                </a>
              </div>
              <ul className="lt-facts">
                <li>OpenAI-compatible</li>
                <li>Lightning and Cashu</li>
                <li>Found over Nostr</li>
                <li>Open source</li>
              </ul>
            </div>
          </section>

          <section className="lt-part" data-part data-side="left">
            <div className="lt-in">
              <p className="lt-label">Route</p>
              <h2>
                <Ln>Many nodes.</Ln>
                <Ln i={1}>The best inference</Ln>
                <Ln i={2}>
                  path <b>wins.</b>
                </Ln>
              </h2>
              <p className="lt-lede">
                Every node publishes its own prices. Each request goes to the best one, and moves
                on to the next if that node is down.
              </p>
              <Link href="/prices" className="lt-link">
                See the prices
              </Link>
            </div>
          </section>

          <section className="lt-part lt-pay" data-part data-side="left">
            <div className="lt-in">
              <p className="lt-label">Pay</p>
              <h2>
                <Ln>Pay per request,</Ln>
                <Ln i={1}>
                  in <b>sats.</b>
                </Ln>
              </h2>
              <p className="lt-lede">No account, no card, no subscription. What you do not spend stays yours.</p>
              <dl className="lt-rows">
                {rails.map((rail) => (
                  <div key={rail.name}>
                    <dt>{rail.name}</dt>
                    <dd>{rail.line}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="lt-part lt-build" data-part data-side="right">
            <div className="lt-in">
              <p className="lt-label">Build</p>
              <h2>
                <Ln>Plug it into</Ln>
                <Ln i={1}>anything.</Ln>
              </h2>
              <p className="lt-lede">
                Every node speaks the OpenAI API. Change one address and your tools already work.
              </p>
              <Code />
              <ul className="lt-tools" onPointerLeave={() => engine.current?.choose(null)}>
                {tools.map((tool, i) => (
                  <li key={tool.name}>
                    <Link
                      href={tool.href}
                      onPointerEnter={() => engine.current?.choose(i)}
                      onFocus={() => engine.current?.choose(i)}
                      onBlur={() => engine.current?.choose(null)}
                    >
                      <b>{tool.name}</b>
                      <span>{tool.line}</span>
                      <Arrow />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="lt-part" data-part data-side="left">
            <div className="lt-in">
              <p className="lt-label">Earn</p>
              <h2>
                <Ln>Run a node.</Ln>
                <Ln i={1}>
                  Earn <b>sats.</b>
                </Ln>
              </h2>
              <p className="lt-lede">
                Put Routstr Core in front of any model API and set your price. It lists your node
                and collects payment for every request.
              </p>
              <div className="lt-cta">
                <a href={GUIDE} className="lt-btn">
                  Run a node <Arrow />
                </a>
                <Link href="/providers" className="lt-link">
                  See who is selling
                </Link>
              </div>
            </div>
          </section>

          <section className="lt-part" data-part data-side="left">
            <div className="lt-in">
              <p className="lt-label">Social</p>
              <h2>
                <Ln>A marketplace</Ln>
                <Ln i={1}>
                  inside <b>social media.</b>
                </Ln>
              </h2>
              <p className="lt-lede">
                Nodes announce themselves on Nostr. People review them under their own names, and
                every node signs what it sold. You see who to trust before you spend a sat.
              </p>
              <Link href="/providers" className="lt-link">
                See the nodes and their reviews
              </Link>
            </div>
          </section>

          <section className="lt-part lt-voices" data-part data-side="left">
            <div className="lt-in">
              <h2 className="lt-label">What people say</h2>
              <Voices onPull={pluck} live={scenes[at] === "Voices"} />
            </div>
          </section>

          <section className="lt-part lt-open" data-part data-side="center">
            <div className="lt-in">
              <p className="lt-label">Open</p>
              <h2>
                <Ln>Open source,</Ln>
                <Ln i={1}>end to end.</Ln>
              </h2>
              <ul className="lt-repos">
                {repos.map((repo) => (
                  <li key={repo}>
                    <a href={`${GITHUB}/${repo}`}>{repo}</a>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="lt-part lt-end" data-part data-side="center">
            <div className="lt-in">
              <h2 className="lt-word">
                <Ln>routstr</Ln>
              </h2>
              <div className="lt-cta">
                <Link href="/routstrd" className="lt-btn">
                  Get the CLI <Arrow />
                </Link>
                <a href={GUIDE} className="lt-link">
                  Run a node
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
