"use client";

import { Fragment, useMemo, useState } from "react";
/* Each tab of `routstrd top`, drawn by routstrd's own code (v0.5.1, src/tui/usage/render.ts)
   for a made-up month of use: Claude Code on Claude Opus and Sonnet, OpenCode on DeepSeek,
   Pi on GPT-6 Luna, each at the price the cheapest approved node asked on 17 Nov, on made-up
   nodes. A terminal 100 columns wide, as the ANSI text it prints. */
import screens from "./top-screens.json";

const TABS = [
  ["overview", "Overview"],
  ["history", "History"],
  ["models", "Models"],
  ["providers", "Providers"],
  ["clients", "Clients"],
  ["recent", "Recent"],
] as const;
type Tab = (typeof TABS)[number][0];

/** ANSI colour codes to the names the page colours them by. */
const FG: Record<string, string> = {
  "31": "t-r",
  "32": "t-g",
  "33": "t-y",
  "34": "t-b",
  "36": "t-c",
  "37": "t-w",
  "208": "t-o",
};
const BG: Record<string, string> = { "42": "t-on", "44": "t-sel" };

type Run = { text: string; style: string };

/** The screen as lines of runs of text that share one style. */
function parse(ansi: string): Run[][] {
  const lines: Run[][] = [[]];
  let fg = "";
  let bg = "";
  let bold = false;
  let dim = false;
  // split on the escapes: text, codes, text, codes, ...
  ansi.split(/\x1b\[([0-9;]*)m/).forEach((part, i) => {
    if (i % 2) {
      const codes = part.split(";");
      for (let k = 0; k < codes.length; k++) {
        const code = codes[k];
        if (code === "0" || code === "") [fg, bg, bold, dim] = ["", "", false, false];
        else if (code === "1") bold = true;
        else if (code === "2") dim = true;
        // 38;5;n: one of 256 colours
        else if (code === "38") fg = FG[codes[(k += 2)]] ?? "";
        else if (FG[code]) fg = FG[code];
        else if (BG[code]) bg = BG[code];
      }
      return;
    }
    // bold with no colour of its own is the terminal's bright white
    const style = [fg || (bold && "t-hi"), bg, bold && "t-bd", dim && "t-dm"].filter(Boolean).join(" ");
    part.split("\n").forEach((text, n) => {
      if (n) lines.push([]);
      const line = lines[lines.length - 1];
      if (!text) return;
      const last = line[line.length - 1];
      if (last && last.style === style) last.text += text;
      else line.push({ text, style });
    });
  });
  while (lines.length && !lines[lines.length - 1].length) lines.pop();
  return lines;
}

/** The most lines any tab has, so the window keeps one height. */
const ROWS = Math.max(...TABS.map(([tab]) => screens[tab].split("\n").length));

function Screen({ tab }: { tab: Tab }) {
  const lines = useMemo(() => parse(screens[tab]), [tab]);
  return (
    <pre style={{ ["--rows" as string]: ROWS }}>
      {lines.map((line, n) => (
        <Fragment key={n}>
          {line.map(({ text, style }, i) =>
            // a run of full blocks is drawn as one bar, the same in every font
            text.split(/(█+)/).map((part, k) =>
              k % 2 ? (
                <span key={`${i}.${k}`} className={`t-blk ${style}`} style={{ width: `${part.length}ch` }} />
              ) : style ? (
                part && (
                  <span key={`${i}.${k}`} className={style}>
                    {part}
                  </span>
                )
              ) : (
                part
              )
            )
          )}
          {"\n"}
        </Fragment>
      ))}
    </pre>
  );
}

/* `routstrd top` as it looks in a terminal. The tabs above it, the arrow keys and 1 to 6 move
   between its views, as they do in the real one. */
export function Top() {
  const [tab, setTab] = useState<Tab>("overview");
  const at = TABS.findIndex(([key]) => key === tab);

  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const digit = Number(event.key);
    const next =
      event.key === "ArrowRight"
        ? (at + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (at - 1 + TABS.length) % TABS.length
          : digit >= 1 && digit <= TABS.length
            ? digit - 1
            : -1;
    if (next < 0 || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    setTab(TABS[next][0]);
    const list = event.currentTarget.querySelector('[role="tablist"]');
    if (list?.contains(document.activeElement)) (list.children[next] as HTMLElement).focus();
  };

  return (
    <div>
      <div className="rd-code rd-top" onKeyDown={onKey}>
        <div className="rd-bar">
          <div role="tablist" aria-label="routstrd top">
            {TABS.map(([key, name], i) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={key === tab}
                tabIndex={key === tab ? 0 : -1}
                onClick={() => setTab(key)}
              >
                <i>{i + 1}</i>
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="rd-screen" role="tabpanel" tabIndex={0} aria-label={`routstrd top, ${TABS[at][1]}`}>
          <Screen tab={tab} />
        </div>
      </div>
      <p className="rd-under">Example numbers and nodes: a month of Claude Code, OpenCode and Pi, at the cheapest prices of 17 Nov.</p>
    </div>
  );
}
