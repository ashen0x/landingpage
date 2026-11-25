import { BACK, type Example, type Line } from "@/components/routstrd/CodePanel";
import { INSTALL_SH } from "@/components/routstrd/install";

/** What the live market says, for the numbers under each capability. */
export type Market = {
  /** Nodes that answered with their models. */
  nodes: number;
  models: number;
  /** Models sold by two nodes or more. */
  backed: number;
  lightning: number;
  takeOut: number;
  tor: number;
  /** Models that run in a sealed enclave, and on how many nodes. */
  sealed: number;
  sealedNodes: number;
  /** Nodes found on the relays so far, and how many relays answered. */
  found: number | null;
  relays: number;
  /** The model sold most widely, for the examples. */
  model: string;
};

/** Something Routstr does, the light that acts it out, and the proof under it. */
export type Capability = {
  key: Act;
  /** Short, for the list. */
  name: string;
  title: string;
  line: string;
  /** The live number that backs it, if there is one (null while the nodes are asked). */
  stat: (market: Market | null) => string | null;
  examples: (model: string) => Example[];
  link: { href: string; text: string };
};

export type Act = "key" | "pay" | "api" | "route" | "private" | "found" | "teams" | "sell";

const NODE = "https://node.example.com";
const DOCS = "https://docs.routstr.com";

/* A model id is the node's own text: inside the shell's single quotes a quote is written '\''
   so it cannot end the string, and JSON's own escaping covers the rest. */
const quoted = (model: string) => JSON.stringify(model).replace(/'/g, "'\\''");

/** A request with a body, one header to a line: what every curl here looks like. */
const curl = (url: string, headers: string[], body: string, flags = ""): Line[] => [
  ["$", `curl ${flags}${url} \\`],
  ...headers.map((header): Line => ["", `    -H "${header}" \\`]),
  ["", `    -d '${body}'`],
];

const of = (n: number, all: number) => `${n} of ${all}`;

export const CAPABILITIES: Capability[] = [
  {
    key: "key",
    name: "No account",
    title: "No account. Just sats.",
    line: "Hand a node a Cashu token or pay its Lightning invoice, and it gives you a key. No email, no card, no name.",
    stat: (m) =>
      m &&
      `${of(m.nodes, m.nodes)} nodes give a key for a Cashu token. ${of(m.lightning, m.nodes)} for a Lightning invoice.`,
    examples: () => [
      {
        tab: "Cashu",
        lines: [
          ...curl(
            `${NODE}/v1/balance/create`,
            ["Content-Type: application/json"],
            '{ "initial_balance_token": "cashuB..." }'
          ),
          ["", ""],
          [BACK, '{ "api_key": "sk-...", "balance": 1000000 }', "1,000 sats, in millisats"],
        ],
      },
      {
        tab: "Lightning",
        lines: [
          ...curl(
            `${NODE}/v1/balance/lightning/invoice`,
            ["Content-Type: application/json"],
            '{ "amount_sats": 1000, "purpose": "create" }'
          ),
          ["", ""],
          ["$", `curl ${NODE}/v1/balance/lightning/invoice/ID/status`, "once it is paid, the key"],
        ],
      },
    ],
    link: { href: "/topup", text: "Get a key on Top-up" },
  },
  {
    key: "pay",
    name: "Pay per request",
    title: "Pay for each request. Get the change.",
    line: "Put a Cashu token on the request and the change comes back with the answer. Or take what is left on a key out to Lightning.",
    stat: (m) => m && `${of(m.takeOut, m.nodes)} nodes pay what is left on a key to a Lightning address.`,
    examples: (model) => [
      {
        tab: "Token on the request",
        lines: [
          ...curl(
            `${NODE}/v1/chat/completions`,
            ["X-Cashu: cashuB...", "Content-Type: application/json"],
            `{ "model": ${quoted(model)}, "messages": [{ "role": "user", "content": "Hello" }] }`,
            "-i "
          ),
          ["", ""],
          [BACK, "x-cashu: cashuB...", "the change, back with the answer"],
        ],
      },
      {
        tab: "Take it out",
        lines: curl(
          `${NODE}/v1/balance/refund`,
          ["Authorization: Bearer sk-...", "Content-Type: application/json"],
          '{ "lightning_address": "you@wallet.com" }'
        ),
      },
    ],
    link: { href: `${DOCS}/client/payments/`, text: "How paying works" },
  },
  {
    key: "api",
    name: "One API",
    title: "Every model. One API.",
    line: "Every node speaks the OpenAI API and Anthropic's. Point any SDK, app or agent at a node and it already works.",
    stat: (m) =>
      m && `${m.models.toLocaleString("en-US")} models on ${m.nodes} nodes, from chat to pictures to embeddings.`,
    examples: (model) => [
      {
        tab: "OpenAI",
        lines: [
          ["", "from openai import OpenAI"],
          ["", ""],
          ["", `client = OpenAI(base_url="${NODE}/v1", api_key="sk-...")`],
          ["", `r = client.chat.completions.create(model=${JSON.stringify(model)}, messages=[`],
          ["", '    { "role": "user", "content": "Hello" },'],
          ["", "])"],
        ],
      },
      {
        tab: "Anthropic",
        lines: curl(
          `${NODE}/v1/messages`,
          ["Authorization: Bearer sk-...", "Content-Type: application/json"],
          `{ "model": ${quoted(model)}, "max_tokens": 1024, "messages": [{ "role": "user", "content": "Hello" }] }`
        ),
      },
      {
        tab: "Any app",
        lines: [
          ["$", `export OPENAI_BASE_URL=${NODE}/v1`],
          ["$", "export OPENAI_API_KEY=sk-...", "most apps that speak OpenAI read these two"],
        ],
      },
    ],
    link: { href: "/models", text: "Every model" },
  },
  {
    key: "route",
    name: "Never stuck",
    title: "The cheapest node. Then the next.",
    line: "routstrd on your machine sends each request to the cheapest node you approved for that model, and to the next one if it fails.",
    stat: (m) =>
      m && `${m.backed.toLocaleString("en-US")} models are sold by two nodes or more, so there is always another.`,
    examples: () => [
      {
        tab: "routstrd",
        lines: [
          ["$", `curl -fsSL ${INSTALL_SH} | sh`],
          ["$", "routstrd onboard --claude-code", "or --opencode, --pi-agent, --openclaw, --hermes"],
        ],
      },
    ],
    link: { href: "/routstrd", text: "More on routstrd" },
  },
  {
    key: "private",
    name: "Private",
    title: "Nothing to tie it to you.",
    line: "No account means no name on a request. Reach a node over Tor, or pick a sealed model that not even the node can read.",
    stat: (m) =>
      m &&
      `${of(m.tor, m.nodes)} nodes answer over Tor. ${m.sealed} models on ${m.sealedNodes} nodes run in a sealed enclave.`,
    examples: (model) => [
      {
        tab: "Over Tor",
        lines: curl(
          "http://nodeaddress.onion/v1/chat/completions",
          ["Authorization: Bearer sk-...", "Content-Type: application/json"],
          `{ "model": ${quoted(model)}, "messages": [{ "role": "user", "content": "Hello" }] }`,
          "--socks5-hostname 127.0.0.1:9050 "
        ),
      },
    ],
    link: { href: "/providers", text: "Nodes on Tor" },
  },
  {
    key: "found",
    name: "Found over Nostr",
    title: "No list anyone can shut down.",
    line: "Each node announces itself on Nostr relays, and curators vouch for the ones they trust. Apps find them there, with no server in between.",
    stat: (m) =>
      m &&
      (m.found === null
        ? "Asking the relays…"
        : m.found === 0
          ? "The relays did not answer this time. Try again in a moment."
          : `Just now this page found ${m.found} nodes${m.relays ? ` on ${m.relays} relays` : ""}. ${m.nodes} of them answered.`),
    examples: () => [
      {
        tab: "A node says",
        lines: [
          ["", "{"],
          ["", '  "kind": 38421,', "a node announcing itself"],
          ["", '  "tags": ['],
          ["", '    ["d", "my-node"],'],
          ["", '    ["u", "https://node.example.com"],'],
          ["", '    ["u", "http://nodeaddress.onion"],'],
          ["", '    ["mint", "https://mint.example.com"]'],
          ["", "  ]"],
          ["", "}"],
        ],
      },
      {
        tab: "A curator says",
        lines: [
          ["", "{"],
          ["", '  "kind": 38000,', "vouching for a node"],
          ["", '  "tags": ['],
          ["", '    ["k", "38421"],'],
          ["", '    ["u", "https://node.example.com"],'],
          ["", '    ["a", "38421:<node pubkey>:my-node"]'],
          ["", "  ]"],
          ["", "}"],
        ],
      },
    ],
    link: { href: "https://github.com/Routstr/protocol", text: "The protocol" },
  },
  {
    key: "teams",
    name: "Teams",
    title: "One wallet for the whole team.",
    line: "Run routstrd on a server. Everyone signs in with their own Nostr key and gets their own keys; one wallet pays, and you see who spent what.",
    stat: () => "On any server, or in one click on Cloudron.",
    examples: () => [
      {
        tab: "Join a team",
        lines: [
          ["$", "routstrd remote https://team.example.com"],
          ["$", "routstrd clients add --claude-code", "a key of your own, set up in Claude Code"],
        ],
      },
    ],
    link: { href: `${DOCS}/teams/`, text: "Set up a team" },
  },
  {
    key: "sell",
    name: "Sell",
    title: "Sell what you have.",
    line: "Put Routstr Core in front of any model API or your own GPU, set a price in sats, and get paid for every request.",
    stat: (m) => m && `${m.nodes} nodes are selling right now.`,
    examples: () => [
      {
        tab: "Start a node",
        lines: [
          ["$", "git clone https://github.com/Routstr/routstr-core.git && cd routstr-core"],
          ["$", "python3 scripts/node_setup.py start \\"],
          ["", "    --public-url https://node.example.com \\"],
          ["", "    --ln-address you@wallet.com", "where your sats go"],
        ],
      },
    ],
    link: { href: `${DOCS}/provider/quickstart/`, text: "Run a node" },
  },
];
