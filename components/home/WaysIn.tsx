"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Blocks, Bot, Check, Copy, Terminal, Users } from "lucide-react";
import { DOCS_URL } from "@/components/Header";

type Line = { text: string; note?: string };
type Way = {
  id: string;
  icon: typeof Bot;
  title: string;
  sub: string;
  /** shell lines get a prompt and are copied without their notes */
  kind: "shell" | "code" | "list";
  label: string;
  lines: Line[];
  text: string;
  links: { text: string; href: string }[];
};

const ways: Way[] = [
  {
    id: "agents",
    icon: Bot,
    title: "Coding agents",
    sub: "routstrd",
    kind: "shell",
    label: "terminal",
    lines: [
      { text: "curl -fsSL https://github.com/Routstr/routstrd/releases/latest/download/install.sh | sh" },
      { text: "routstrd onboard" },
      { text: "routstrd receive 2100", note: "2,100 sats over Lightning" },
      { text: "routstrd clients add --claude-code", note: "or --opencode, --pi-agent" },
    ],
    text: "A small daemon on your machine with its own wallet. It finds the nodes, sends each request to the best price and pays for it. Claude Code, OpenCode and Pi are one command each.",
    links: [{ text: "About the daemon", href: "/routstrd" }],
  },
  {
    id: "mcp",
    icon: Blocks,
    title: "Any MCP app",
    sub: "routstr-mcp, in preview",
    kind: "list",
    label: "tools your agent gets",
    lines: [
      { text: "ask", note: "one model, one answer, a receipt in sats" },
      { text: "council", note: "two to five models on the same question" },
      { text: "delegate", note: "hand a whole task to another model" },
      { text: "quote", note: "what a prompt will cost, before it runs" },
      { text: "find_models", note: "search every node, cheapest first" },
      { text: "balance", note: "sats left, and what was spent today" },
    ],
    text: "Keep your main model and add every other one as a tool: a second opinion, a council of three, or a review handed to a cheaper model.",
    links: [{ text: "Preview on GitHub", href: "https://github.com/ashen0x/routstr-mcp" }],
  },
  {
    id: "api",
    icon: Terminal,
    title: "Your own app",
    sub: "OpenAI-compatible API",
    kind: "code",
    label: "python",
    lines: [
      { text: "from openai import OpenAI" },
      { text: "" },
      { text: "client = OpenAI(" },
      { text: '    base_url="https://<node>/v1",' },
      { text: '    api_key="cashuB...",', note: "a Cashu token is the key" },
      { text: ")" },
      { text: "client.chat.completions.create(" },
      { text: '    model="gpt-5-nano",' },
      { text: '    messages=[{"role": "user", "content": "hello"}],' },
      { text: ")" },
    ],
    text: "Every node speaks the OpenAI API. Change the base URL, use a Cashu token as the key, and your code works. For routing and a wallet inside your app, the TypeScript SDK is what the chat app runs on.",
    links: [
      { text: "Read the docs", href: DOCS_URL },
      { text: "The SDK", href: "https://github.com/Routstr/routstr-sdk" },
    ],
  },
  {
    id: "team",
    icon: Users,
    title: "Your team",
    sub: "routstrd-remote",
    kind: "shell",
    label: "terminal",
    lines: [
      { text: "routstrd remote https://<your-instance>" },
      { text: "routstrd npubs register" },
      { text: "routstrd clients add --claude-code" },
    ],
    text: "One hosted daemon for everyone. Each teammate gets their own key, and usage is tracked per person.",
    links: [{ text: "routstrd-remote on GitHub", href: "https://github.com/Routstr/routstrd-remote" }],
  },
];

export function WaysIn() {
  const [id, setId] = useState(ways[0].id);
  const [copied, setCopied] = useState(false);
  const way = ways.find((item) => item.id === id)!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(way.lines.map((line) => line.text).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked: the text is still selectable
    }
  };

  return (
    <section id="ways-in" className="wrap">
      <div className="sheet ways">
        <header className="sec-head">
          <div data-rise>
            <p className="kicker">02 &middot; Build with it</p>
            <h2 className="d2">
              Point your tools <em>at the market.</em>
            </h2>
          </div>
          <div data-rise style={{ ["--i" as string]: 1 }}>
            <p className="lede">
              Routstr speaks the OpenAI API, so most tools work by changing one address. Pick the
              way in that fits.
            </p>
          </div>
        </header>

        <div className="ways-body" data-rise>
          <div className="ways-tabs" role="tablist" aria-label="Ways in">
            {ways.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === id}
                className="ways-tab"
                onClick={() => {
                  setId(item.id);
                  setCopied(false);
                }}
              >
                <item.icon />
                <span>
                  <b>{item.title}</b>
                  <small>{item.sub}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="ways-panel" role="tabpanel" key={way.id}>
            <div className="code">
              <div className="code-bar">
                <span>{way.label}</span>
                {way.kind !== "list" && (
                  <button type="button" onClick={copy} aria-label="Copy">
                    {copied ? <Check /> : <Copy />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
              <pre data-kind={way.kind}>
                {way.lines.map((line, i) => (
                  <span key={i} className="code-line" style={{ ["--i" as string]: i }}>
                    <span className="code-text">{line.text || " "}</span>
                    {line.note && <span className="code-note">{line.note}</span>}
                  </span>
                ))}
              </pre>
            </div>
            <div className="ways-text">
              <p>{way.text}</p>
              <p className="ways-links">
                {way.links.map((link) =>
                  link.href.startsWith("/") ? (
                    <Link key={link.href} href={link.href} className="link">
                      {link.text} <ArrowRight />
                    </Link>
                  ) : (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="link">
                      {link.text} <ArrowUpRight />
                    </a>
                  )
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
