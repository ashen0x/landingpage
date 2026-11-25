import { SiteShell } from "@/components/layout/site-shell";
import { CodePanel, type Example } from "@/components/routstrd/CodePanel";
import { AGENTS, INSTALL_SH } from "@/components/routstrd/install";
import { RouteStage } from "@/components/routstrd/RouteStage";
import { Top } from "@/components/routstrd/Top";
import "@/components/layout/pages.css";
import "./routstrd.css";

const GITHUB = "https://github.com/Routstr/routstrd";
const AUTH = "https://github.com/Routstr/routstrd-auth";

const installer: Example["lines"] = [
  ["$", "curl -fsSL \\"],
  ["", `    ${INSTALL_SH} | sh`],
];
const agents: Example[] = AGENTS.map(([tab, flag]) => ({
  tab,
  lines: [
    ...installer,
    ["$", `routstrd onboard ${flag}`, "makes a wallet, sets up your agent"],
    ["$", "routstrd receive 2100", "a Lightning invoice for 2,100 sats"],
  ],
}));

const team: Example[] = [
  {
    tab: "You, the admin",
    lines: [
      ["$", "routstrd remote https://ai.your-team.com"],
      ["$", "routstrd npubs whoami", "your npub"],
      ["$", "curl https://ai.your-team.com/npubs \\"],
      ["", "    -H 'x-routstr-bootstrap-token: TOKEN' \\"],
      ["", `    -d '{"npub": "npub1...", "name": "you"}'`, "makes you the admin; TOKEN is in the server log"],
      ["$", "routstrd npubs add npub1... --name alice --limit-sats 50000", "50,000 sats a month"],
    ],
  },
  {
    tab: "A new member",
    lines: [
      ["$", "routstrd remote https://ai.your-team.com", "makes your own key"],
      ["$", "routstrd npubs whoami", "send this to your admin"],
      ["$", "routstrd clients add --claude-code", "once you are in"],
    ],
  },
];

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
    </svg>
  );
}

function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <ul className="rd-steps">
      {steps.map(([name, text]) => (
        <li key={name}>
          <b>{name}</b>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/* routstrd: what it is in one line, then the light (your agents, routstrd, the nodes that
   sell a model, live) with how it picks a node under it, then how to install it, what you
   see of it in the terminal, and how a team shares one. */
export default function RoutstrdPage() {
  return (
    <SiteShell band={false}>
      <section className="pg rd">
        <header className="rd-head">
          <div>
            <p className="pg-label">routstrd</p>
            <h1 className="pg-title">
              <span>
                <i>Every model,</i>
              </span>
              <span>
                <i style={{ ["--i" as string]: 1 }}>for your agents.</i>
              </span>
            </h1>
          </div>
          <div className="rd-intro">
            <p className="pg-lede">
              A small program on your computer. It sends your agents&apos; requests to the cheapest Routstr node and pays it in
              sats.
            </p>
            <div className="rd-cta">
              <a className="rd-btn" href="#install">
                Install it <Arrow />
              </a>
              <a className="rd-link" href={GITHUB} target="_blank" rel="noopener noreferrer">
                Code on GitHub
              </a>
            </div>
            <ul className="rd-facts">
              <li>Linux, macOS</li>
              <li>No sign-up</li>
              <li>Lightning, Cashu</li>
              <li>Open source</li>
            </ul>
          </div>
        </header>

        <RouteStage />

        <section className="rd-how" aria-labelledby="rd-how">
          <p className="pg-label" id="rd-how">
            How it picks
          </p>
          <Steps
            steps={[
              ["Finds", "Nodes list themselves on Nostr. It looks again every 21 minutes."],
              ["Picks", "The cheapest node a reviewer approved."],
              ["Pays", "From its own wallet. Sats left on a node come back on their own."],
              ["Moves on", "A node that fails sits out a while, longer if it keeps failing. The next one takes over."],
            ]}
          />
        </section>

        <section className="rd-part" id="install" aria-labelledby="rd-install">
          <div>
            <p className="pg-label">Install</p>
            <h2 id="rd-install">Three commands.</h2>
            <p className="pg-lede">Then use your agent as you always do.</p>
          </div>
          <CodePanel
            label="Your agent"
            examples={agents}
            under={
              <>
                With Bun: <code>bun i -g routstrd</code>
              </>
            }
          />
        </section>

        <section className="rd-part rd-watch" aria-labelledby="rd-watch">
          <div>
            <p className="pg-label">Watch</p>
            <h2 id="rd-watch">
              Every sat,
              <br />
              in plain sight.
            </h2>
            <p className="pg-lede">
              <code>routstrd top</code> shows your balance and what each model, node and agent cost you, live in your terminal.
            </p>
          </div>
          <Top />
        </section>

        {/* "#teams" is the old page's address for this part: links to it still land here */}
        <section className="rd-part" id="teams" aria-labelledby="rd-teams">
          <div>
            <p className="pg-label">Teams</p>
            <h2 id="rd-teams">
              One wallet
              <br />
              for the whole team.
            </h2>
            <p className="pg-lede">
              Run routstrd-auth on a server. Everyone gets their own key and a monthly limit in sats.
            </p>
            <a className="rd-link rd-more" href={AUTH} target="_blank" rel="noopener noreferrer">
              routstrd-auth on GitHub
            </a>
          </div>
          <CodePanel label="Who you are" examples={team} />
        </section>

        <footer className="rd-end">
          <ul>
            <li>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <a href="https://docs.routstr.com" target="_blank" rel="noopener noreferrer">
                Docs
              </a>
            </li>
            <li>
              <a href={`${GITHUB}/blob/main/SKILL.md`} target="_blank" rel="noopener noreferrer">
                Every command
              </a>
            </li>
            <li>
              <a
                href="https://njump.me/npub1ftt05tgku25m2akgvw6v7aqy5ux5mseqcrzy05g26ml43xf74nyqsredsh"
                target="_blank"
                rel="noopener noreferrer"
              >
                Nostr
              </a>
            </li>
          </ul>
          <p>
            No terminal?{" "}
            <a href="https://chat.routstr.com" target="_blank" rel="noopener noreferrer">
              Open the chat
            </a>
          </p>
        </footer>
      </section>
    </SiteShell>
  );
}
