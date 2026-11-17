"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Star } from "lucide-react";

type Repo = { name: string; owner?: string; role: string; text: string; lang: string; stars?: number };

// Star counts are replaced by GitHub's own when it answers.
const repos: Repo[] = [
  { name: "routstr-core", role: "The node", text: "A payment proxy for any OpenAI-compatible API. Bills each request in sats.", lang: "Python", stars: 85 },
  { name: "routstr-chat", role: "The chat app", text: "Every model, a wallet built in, no sign-up.", lang: "TypeScript", stars: 23 },
  { name: "routstrd", role: "The daemon", text: "A local router with its own wallet, for coding agents and scripts.", lang: "TypeScript", stars: 12 },
  { name: "routstr-sdk", role: "The library", text: "Finds nodes, compares prices, pays and fails over. The chat app and the daemon run on it.", lang: "TypeScript", stars: 2 },
  { name: "routstrd-remote", role: "For teams", text: "The daemon in Docker, with a key for each teammate.", lang: "TypeScript", stars: 4 },
  { name: "routstr-mcp", owner: "ashen0x", role: "In preview", text: "Every model as a tool for Claude Code, Codex, Cursor and other MCP apps.", lang: "TypeScript" },
];

const stack = [
  ["Lightning", "Sats in, sats out, in seconds."],
  ["Cashu", "Ecash, so each request can carry its own payment."],
  ["Nostr", "Where nodes announce themselves and publish their numbers."],
  ["OpenAI API", "The shape every node speaks, so your tools already fit."],
];

export function OpenSource() {
  const [stars, setStars] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    fetch("https://api.github.com/orgs/Routstr/repos?per_page=100", {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(6000),
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((list: unknown) => {
        if (!active || !Array.isArray(list)) return;
        setStars(
          Object.fromEntries(
            list
              .filter((repo) => typeof repo?.name === "string" && typeof repo?.stargazers_count === "number")
              .map((repo) => [repo.name, repo.stargazers_count])
          )
        );
      })
      .catch(() => {
        // GitHub unreachable or rate limited: the listed counts stay
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="open" className="wrap open">
      <header className="sec-head">
        <div data-rise>
          <p className="kicker">Open source</p>
          <h2 className="d2">
            Every part <em>is public.</em>
          </h2>
        </div>
        <div data-rise style={{ ["--i" as string]: 1 }}>
          <p className="lede">
            The node, the router, the wallet code and the chat app are all on GitHub. Read them,
            run them, change them.
          </p>
        </div>
      </header>

      <ul className="repos">
        {repos.map((repo, i) => {
          const count = stars[repo.name] ?? repo.stars;
          return (
            <li key={repo.name} data-rise style={{ ["--i" as string]: i % 3 }}>
              <a href={`https://github.com/${repo.owner ?? "Routstr"}/${repo.name}`} target="_blank" rel="noopener noreferrer">
                <span className="repo-role kicker">{repo.role}</span>
                <span className="repo-name mono">
                  {repo.name} <ArrowUpRight />
                </span>
                <span className="repo-text">{repo.text}</span>
                <span className="repo-meta mono">
                  <span>{repo.lang}</span>
                  {count !== undefined && !repo.owner && (
                    <span>
                      <Star /> {count}
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <dl className="stack" data-rise>
        {stack.map(([name, text]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
