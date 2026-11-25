"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { pulse } from "@/components/layout/Band";
import { getPrimaryHttpEndpoint, isProviderVisible } from "@/lib/api/providers";
import { useNodeLists } from "@/lib/use-node-lists";
import { NodePicker, type Listed } from "./NodePicker";
import {
  ask,
  cleanNode,
  hostOf,
  NodeError,
  paysAddresses,
  type Created,
  type Info,
  type Invoice,
  type InvoiceStatus,
  type Refund,
  type Topup,
} from "./node";

/** The node picked, and the key the visitor keeps for each node. */
const PICKS = "routstr_topup";
/** A key with no node yet: the old page's single key, or one from an ?apikey= link. */
const LOOSE = "routstr_api_key";
/** Where a key waits while it has no node: under no address at all. */
const NO_NODE = "";
/** What must outlive the tab: an invoice not yet paid, a token not yet saved, a new key. */
const KEPT = "routstr_topup_kept";
const AMOUNTS = [1000, 5000, 21000];
const MOST = 1_000_000;

type Card =
  | {
      kind: "invoice";
      node: string;
      id: string;
      bolt11: string;
      sats: number;
      until: number;
      create: boolean;
      state: "waiting" | "landing" | "expired" | "stuck";
    }
  | {
      kind: "token";
      node: string;
      token: string;
      /** How much the token holds, in `unit` (sats when it says nothing). */
      sats: number;
      unit?: string;
      change: boolean;
      /** With change: what the node did add to the key (null when it did not say). */
      added?: number | null;
    }
  | { kind: "added"; sats: number | null; node?: string }
  | { kind: "key"; node: string; key: string }
  /** A take-out the node was asked for and whose answer has not come: kept, so it can be asked again. */
  | { kind: "out"; node: string; to: string | null }
  | { kind: "sent"; sats: number; to: string; done: boolean };
type Look =
  | { at: string; state: "ok"; sats: number; spent: number }
  | { at: string; state: "unknown" | "down" | "old" };
type Busy = "invoice" | "token" | "out" | null;

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const toSats = (msats: number) => Math.floor(msats / 1000);
/** Sats with their thousandths kept: for what a node just added or gave back, where less than one sat is still something. */
const inSats = (msats: number) => msats / 1000;

function load(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}
/** Whether it was kept. */
function save(name: string, value: string | null): boolean {
  try {
    if (value) localStorage.setItem(name, value);
    else localStorage.removeItem(name);
    return true;
  } catch {
    // storage is off or full: the page still works, it just forgets on reload
    return false;
  }
}
function read<T>(name: string): T | null {
  try {
    return JSON.parse(load(name) ?? "null") as T | null;
  } catch {
    return null;
  }
}

type Kept = { node?: string; keys?: Record<string, string>; drafts?: Record<string, string> };
/** The keys the nodes know, and the drafts they do not know yet, each by its node's address. */
type Book = { keys: Record<string, string>; drafts: Record<string, string> };
const put = (all: Record<string, string>, at: string, value: string) => {
  const next = { ...all };
  if (value) next[at] = value;
  else delete next[at];
  return next;
};

function explain(error: unknown): string {
  if (!(error instanceof NodeError)) return "Something went wrong. Try again.";
  switch (error.code) {
    case "refund_in_progress":
      return "A take-out for this key is already running. Try again in a minute.";
    case "refund_ongoing_requests":
      return "The key is in use right now. Try again when its requests are done.";
    case "no_balance_to_refund":
      return "There is nothing left to take out.";
    case "balance_too_small_to_refund":
      return "Less than one sat is left, too little to take out.";
  }
  return error.message;
}

/** The balance as shown: when sats land on the same key it counts up to them, and the band's gold lane lights once. */
function useCount(value: number | null, owner: string): [number | null, boolean] {
  const [tween, setTween] = useState<number | null>(null);
  const last = useRef({ owner, value });
  useLayoutEffect(() => {
    const before = last.current;
    last.current = { owner, value };
    if (value === null || before.value === null || before.owner !== owner || value <= before.value) return;
    pulse();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const from = before.value;
    const start = performance.now();
    setTween(from);
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 900);
      setTween(t < 1 ? Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))) : null);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      setTween(null);
    };
  }, [value, owner]);
  return [tween ?? value, tween !== null];
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" />
    </svg>
  );
}

export function TopUp() {
  const { nodes: lists, loading } = useNodeLists();
  const [ready, setReady] = useState(false);
  const [node, setNode] = useState("");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [look, setLook] = useState<Look | null>(null);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<"add" | "out">("add");
  const [preset, setPreset] = useState<number | null>(5000);
  const [other, setOther] = useState("");
  const [pasting, setPasting] = useState(false);
  const [token, setToken] = useState("");
  const [address, setAddress] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [say, setSay] = useState("");
  const [copied, setCopied] = useState("");
  const copiedTimer = useRef(0);
  const cardBox = useRef<HTMLDivElement>(null);
  /** The keys and drafts as this tab last wrote or read them, the node it has picked, and whether that write was kept. */
  const book = useRef<Book>({ keys: {}, drafts: {} });
  const pickedNow = useRef("");
  const stored = useRef(true);
  /** The card as this tab last stored it: only that one is this tab's to take away. */
  const keptCard = useRef<string | null>(null);

  /* Every node of the live list that sells something and can be reached from a browser,
     one line per address, in the order of the alphabet. */
  const listed = useMemo(() => {
    const byUrl = new Map<string, Listed & { at: number }>();
    lists.forEach(({ provider, models }) => {
      const url = cleanNode(getPrimaryHttpEndpoint(provider));
      if (!url?.startsWith("https://") || models.length === 0 || !isProviderVisible(provider)) return;
      const had = byUrl.get(url);
      if (had && had.at >= provider.created_at) return;
      byUrl.set(url, {
        url,
        name: provider.name.trim() || hostOf(url),
        version: provider.version || null,
        models: models.length,
        at: provider.created_at,
      });
    });
    return Array.from(byUrl.values()).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }, [lists]);

  /* A key belongs to a node once that node knows it. Until then it is a draft, and it stays
     with the node it was typed for: no other node is ever sent it. A key that came with no node
     (the old page's, a link's, or typed before a node was picked) waits for the first node
     picked, and then is that node's draft. */
  const own = node ? keys[node] : undefined;
  const key = own ?? drafts[node] ?? "";
  /* Every change to the keys and drafts is made here, in one step: on what the browser holds right
     now (another tab may have saved a key since this one last looked), written back at once, then
     shown. So a tab opened earlier can never write its old copy over a key saved elsewhere. With
     storage off or full, this tab's own copy is what is changed. */
  const change = useCallback((act: (now: Book) => Book) => {
    const held = stored.current ? read<Kept>(PICKS) : null;
    const next = act(held ? { keys: held.keys ?? {}, drafts: held.drafts ?? {} } : book.current);
    book.current = next;
    // the old page's key lives on in the drafts, and leaves its own place only once the drafts are kept
    stored.current = save(PICKS, JSON.stringify({ node: pickedNow.current, ...next }));
    if (stored.current) save(LOOSE, next.drafts[NO_NODE] ?? null);
    setKeys(next.keys);
    setDrafts(next.drafts);
  }, []);
  const setKey = (value: string) =>
    change((now) =>
      now.keys[node] === undefined ? { ...now, drafts: put(now.drafts, node, value) } : { ...now, keys: put(now.keys, node, value) }
    );
  const pickNode = (url: string) => {
    pickedNow.current = url;
    setNode(url);
    setSay("");
    // a key still without a node goes with the first node picked, unless that node has one already
    change((now) =>
      now.drafts[NO_NODE] && url && !now.keys[url] && !now.drafts[url]
        ? { ...now, drafts: put(put(now.drafts, url, now.drafts[NO_NODE]), NO_NODE, "") }
        : now
    );
  };
  /* The node said it does not know this key: let it go from here, to be asked of the next node picked. */
  const tryElsewhere = () => {
    if (!node || own !== undefined || !drafts[node] || drafts[NO_NODE]) return;
    pickedNow.current = "";
    setNode("");
    change((now) => (now.drafts[node] ? { ...now, drafts: put(put(now.drafts, NO_NODE, now.drafts[node]), node, "") } : now));
  };
  // a key the node just made: it stays on the card until saved, and fills an empty key field
  const gotKey = useCallback(
    (at: string, made: string) => {
      change((now) => (now.keys[at] ? now : { ...now, keys: { ...now.keys, [at]: made } }));
      setCard({ kind: "key", node: at, key: made });
    },
    [change]
  );

  // what this browser kept, and an old link's ?apikey=&provider_url= (taken out of the address at once)
  useEffect(() => {
    const picks = read<Kept>(PICKS) ?? {};
    const all = { ...picks.keys };
    const kept: Record<string, string> = { ...picks.drafts };
    const old = load(LOOSE);
    if (old && !kept[NO_NODE]) kept[NO_NODE] = old;
    let picked = picks.node ?? "";
    const params = new URLSearchParams(location.search);
    const linkNode = cleanNode(params.get("provider_url") ?? "");
    const linkKey = params.get("apikey")?.trim();
    if (linkKey && linkNode) all[linkNode] = linkKey;
    else if (linkKey) kept[NO_NODE] = linkKey;
    // a link's key shows at once: on its node, or with none picked until its node is
    if (linkKey || linkNode) picked = linkNode ?? "";
    if (params.has("apikey") || params.has("provider_url")) history.replaceState(history.state, "", location.pathname);
    pickedNow.current = picked;
    setNode(picked);
    // what a link or the old page brought is written down with the rest, at once
    book.current = { keys: all, drafts: kept };
    change(() => ({ keys: all, drafts: kept }));
    keptCard.current = load(KEPT);
    setCard(read<Card>(KEPT));
    setReady(true);
  }, [change]);

  // what another tab saves shows here at once: its keys, and a card it must not lose
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PICKS) {
        const held = read<Kept>(PICKS);
        if (!held) return;
        book.current = { keys: held.keys ?? {}, drafts: held.drafts ?? {} };
        setKeys(book.current.keys);
        setDrafts(book.current.drafts);
      }
      if (event.key === KEPT && event.newValue) {
        // taken up only where this tab holds nothing of its own to keep
        setCard((mine) => {
          if (mine && ["invoice", "token", "key", "out"].includes(mine.kind)) return mine;
          keptCard.current = event.newValue;
          return read<Card>(KEPT);
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const keep =
      (card?.kind === "invoice" && card.state !== "expired") ||
      card?.kind === "token" ||
      card?.kind === "key" ||
      card?.kind === "out";
    const text = keep ? JSON.stringify(card) : null;
    // nothing to keep: only this tab's own stored card is taken away, never one another tab stored since
    if (!text && load(KEPT) !== keptCard.current) return;
    if (save(KEPT, text)) keptCard.current = text;
  }, [ready, card]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  // the balance, asked of the picked node only, once the key looks like one
  const at = `${node} ${key}`;
  const keyShape = /^sk-\S+$/.test(key);
  useEffect(() => {
    if (!node || !keyShape) return;
    let live = true;
    const timer = window.setTimeout(async () => {
      try {
        const info = await ask<Info>(node, "/v1/balance/info", { key });
        if (!live) return;
        setLook({
          at,
          state: "ok",
          sats: toSats(info.balance),
          spent: toSats(info.total_spent),
        });
        // the node knows the key: from now on it is that node's key
        change((now) => ({
          keys: now.keys[node] ? now.keys : { ...now.keys, [node]: key },
          drafts: now.drafts[node] === key ? put(now.drafts, node, "") : now.drafts,
        }));
      } catch (error) {
        const said = error instanceof NodeError ? error : null;
        if (live)
          setLook({
            at,
            state:
              said?.code === "missing" ? "old" : said && [401, 403, 404].includes(said.status) ? "unknown" : "down",
          });
      }
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [node, key, keyShape, at, tick, change]);
  const refresh = () => setTick((n) => n + 1);

  const status = !ready
    ? "wait"
    : !node
      ? "node"
      : !key
        ? "nokey"
        : !keyShape
          ? "bad"
          : look?.at === at
            ? look.state
            : "checking";
  const known = status === "ok" && look?.state === "ok" ? look : null;
  // while it counts up, a screen reader waits and then reads the new balance once
  const [balance, counting] = useCount(known?.sats ?? null, at);

  // an invoice is watched until the node says it is paid; the node adds the sats even if this page is closed
  const waiting = card?.kind === "invoice" && card.state !== "expired" ? card : null;
  useEffect(() => {
    if (!waiting) return;
    let live = true;
    let timer = 0;
    const check = async () => {
      try {
        const found = await ask<InvoiceStatus>(waiting.node, `/v1/balance/lightning/invoice/${waiting.id}/status`);
        if (!live) return;
        // a new key's invoice is done only when the key comes with it
        if (found.status === "paid" && (!waiting.create || found.api_key)) {
          if (found.api_key && waiting.create) gotKey(waiting.node, found.api_key);
          else {
            setCard({ kind: "added", sats: waiting.sats, node: waiting.node });
            refresh();
          }
          return;
        }
        const next =
          found.status === "expired"
            ? "expired"
            : found.status === "reconciliation_required"
              ? "stuck"
              : found.status === "pending"
                ? "waiting"
                : "landing";
        if (next !== waiting.state) return setCard({ ...waiting, state: next });
      } catch {
        // the node did not answer this time; ask again
      }
      // long past its time and still no word: keep asking (a late payment must not be lost), but seldom
      // one the operator has to finish is asked about seldom too
      const seldom = waiting.state === "stuck" || Date.now() / 1000 > waiting.until + 60;
      if (live) timer = window.setTimeout(check, seldom ? 30_000 : 3000);
    };
    timer = window.setTimeout(check, 1500);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [waiting, gotKey]);

  const listedNode = listed.find((item) => item.url === node);
  const addresses = paysAddresses(listedNode?.version ?? null);
  // what is typed stays as typed: only whole sats in digits are an amount, anything else is none
  const otherOk = /^\d+$/.test(other);
  const amount = preset ?? (otherOk ? Number(other) : NaN);
  const amountOk = amount >= 1 && amount <= MOST;
  // what the card holds must be saved before anything replaces it
  const hold =
    card?.kind === "token"
      ? "Save the token first, then go on."
      : card?.kind === "key" && keys[card.node] !== card.key
        ? "Save the new key first, then go on."
        : card?.kind === "out"
          ? "A take-out is not finished. Ask the node again first."
          : card?.kind === "invoice" && card.create && card.state !== "expired"
            ? card.state === "stuck"
              ? "Your new key comes with this invoice, once its node has finished it."
              : "Your new key comes with this invoice. Drop it to start again."
            : "";
  const canAdd = (status === "ok" || status === "nokey") && !busy && !hold;
  const canOut = !!known?.sats && !busy && !hold;

  const run = async (what: Busy, job: () => Promise<void>) => {
    setBusy(what);
    setSay("");
    try {
      await job();
    } catch (error) {
      setSay(explain(error));
    }
    setBusy(null);
  };

  const getInvoice = () =>
    run("invoice", async () => {
      const made = await ask<Invoice>(node, "/v1/balance/lightning/invoice", {
        key: key || undefined,
        body: { amount_sats: amount, purpose: key ? "topup" : "create" },
      });
      setCard({
        kind: "invoice",
        node,
        id: made.invoice_id,
        bolt11: made.bolt11,
        sats: made.amount_sats,
        until: made.expires_at,
        create: !key,
        state: "waiting",
      });
    });

  const addToken = () =>
    run("token", async () => {
      const cashu = token.replace(/\s+/g, "");
      if (key) {
        const added = await ask<Topup>(node, "/v1/balance/topup", {
          key,
          body: { cashu_token: cashu },
          wait: 60_000,
        });
        const change = added.change_token;
        // a node that does not say how much it added gets no number made up for it
        const credited = Number.isFinite(added.msats) ? inSats(added.msats) : null;
        // change comes in the unit of the mint it is from: sats, msats, or something else that is named as it is
        const unit = added.change_unit ?? "sat";
        setCard(
          change
            ? {
                kind: "token",
                node,
                token: change,
                sats: unit === "msat" ? inSats(added.change_amount ?? 0) : (added.change_amount ?? 0),
                unit: unit === "sat" || unit === "msat" ? "sats" : unit,
                change: true,
                added: credited,
              }
            : { kind: "added", sats: credited, node }
        );
        refresh();
      } else {
        const made = await ask<Created>(node, "/v1/balance/create", {
          body: { initial_balance_token: cashu },
          wait: 60_000,
        });
        gotKey(node, made.api_key);
      }
      setToken("");
      setPasting(false);
    });

  // everything left on the key, to a Lightning address or as a Cashu token; asking again is safe, the node answers with the same payout
  /* Everything left on the key, to a Lightning address or as a Cashu token. The node may pay out
     and its answer still not arrive (a reload, a lost connection): what was asked is stored before
     the request leaves, and stays until an answer has come. Asking again is safe: the node answers
     with the same payout, never a second one, also when the balance is already zero. */
  const takeOut = (to: string | null, from = node) =>
    run("out", async () => {
      const asked: Card = { kind: "out", node: from, to };
      const text = JSON.stringify(asked);
      if (save(KEPT, text)) keptCard.current = text;
      setCard(asked);
      let paid: Refund;
      try {
        paid = await ask<Refund>(from, "/v1/balance/refund", {
          key: keys[from] ?? key,
          body: to ? { lightning_address: to } : {},
          wait: 90_000,
        });
      } catch (error) {
        // the node said no, and is not at it already: nothing went out, so there is nothing to ask for again
        const said = error instanceof NodeError ? error : null;
        if (said && said.status >= 400 && said.status < 500 && said.code !== "refund_in_progress") setCard(null);
        throw error;
      }
      const sats = paid.sats ? Number(paid.sats) : toSats(Number(paid.msats ?? 0));
      setCard(
        paid.token
          ? { kind: "token", node: from, token: paid.token, sats, change: false }
          : {
              kind: "sent",
              sats,
              to: paid.recipient ?? to ?? "",
              done: paid.status === "paid",
            }
      );
      refresh();
    });

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(""), 1500);
    } catch {
      // clipboard blocked: the text is still there to select
    }
  };
  // the button pressed goes with the card, so the keyboard carries on from the card
  const clear = () => {
    setCard(null);
    cardBox.current?.focus();
  };

  const host = hostOf(node);
  const head: Record<typeof status, [string, React.ReactNode]> = {
    wait: ["", ""],
    node: [
      "No node yet.",
      <>
        Pick the node your key is on, or any node to get a new key. <Link href="/providers">Compare nodes</Link>
      </>,
    ],
    nokey: ["No key yet.", `Pay ${host} and it gives you one.`],
    bad: ["Not a key.", "A key starts with sk-."],
    checking: ["Checking…", `Asking ${host}.`],
    unknown: [
      "Key not found.",
      own === undefined && !drafts[NO_NODE] ? (
        <>
          {host} does not know this key. Is it from another node?{" "}
          <button type="button" onClick={tryElsewhere}>
            Try another node
          </button>
        </>
      ) : (
        `${host} does not know this key. Is it from another node?`
      ),
    ],
    old: ["Too old.", `${host} runs an older Routstr that this page cannot use.`],
    down: [
      "No answer.",
      <>
        {host} did not answer.{" "}
        <button type="button" onClick={refresh}>
          Try again
        </button>
      </>,
    ],
    ok: ["", ""],
  };

  const copyButton = (what: string, value: string) => (
    <button type="button" onClick={() => copy(what, value)}>
      {copied === what ? "Copied" : `Copy ${what}`}
    </button>
  );
  const closer = (label: string) => (
    <button type="button" onClick={clear}>
      {label}
    </button>
  );

  /** The card: what will happen, or what the node gave back and what can be done with it. */
  const face = ((): { title: React.ReactNode; text: string; code?: string; actions?: React.ReactNode } => {
    if (!card) {
      return tab === "add"
        ? {
            title: "Pay by Lightning",
            text: "The invoice comes from the node itself. Once it is paid, the node adds the sats, even if this page is closed.",
          }
        : {
            title: "Take your sats out",
            text: "Everything left on the key goes to your Lightning address, or comes back as a Cashu token for any Cashu wallet.",
          };
    }
    switch (card.kind) {
      case "invoice": {
        if (card.state === "expired") {
          return {
            title: "This invoice expired.",
            text: "Nothing was paid. Get a new one.",
            actions: closer("Start over"),
          };
        }
        const until = new Date(card.until * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const from = `From ${hostOf(card.node)}.`;
        return {
          title: (
            <>
              Pay <i>{fmt(card.sats)} sats</i>
              {card.create && " for a new key"}
            </>
          ),
          text:
            card.state === "stuck"
              ? `Paid, but the node could not add it. Its operator has to finish it: keep this invoice and ask them. This page keeps checking${card.create ? ", and shows your key once it is done" : ""}.`
              : card.state === "landing"
                ? "Paid. The node is adding the sats now."
                : card.create
                  ? `${from} Your key shows here once it is paid. This browser keeps the invoice until then. Good until ${until}.`
                  : `${from} You can close this page. The node adds the sats when it is paid. Good until ${until}.`,
          code: card.bolt11,
          actions: (
            <>
              {copyButton("invoice", card.bolt11)}
              <a href={`lightning:${card.bolt11}`}>Open wallet</a>
              {/* a paid invoice that brings a new key is never dropped: the key can only come through it */}
              {card.state !== "landing" &&
                !(card.state === "stuck" && card.create) &&
                closer(card.state === "stuck" ? "Close" : card.create ? "I did not pay" : "Start over")}
            </>
          ),
        };
      }
      case "added":
        return {
          title:
            card.sats === null ? (
              "Added."
            ) : (
              <>
                <i>{fmt(card.sats)} sats</i> added.
              </>
            ),
          text: card.node && card.node !== node ? `They are on your key at ${hostOf(card.node)}.` : "They are on your key now.",
          actions: closer("Done"),
        };
      case "key":
        return {
          title: "Your new key",
          text: "Save it now: it is the only way to these sats. An app needs the key and the base URL.",
          code: card.key,
          actions: (
            <>
              {copyButton("key", card.key)}
              {copyButton("base URL", `${card.node}/v1`)}
              {closer("Done")}
            </>
          ),
        };
      case "token":
        return {
          title: (
            <>
              {card.change && "Your change, "}
              <i>
                {fmt(card.sats)} {card.unit ?? "sats"}
              </i>
              {!card.change && " as a Cashu token"}
            </>
          ),
          text: `${card.change && typeof card.added === "number" ? `${fmt(card.added)} sats were added to your key. ` : ""}Paste it into any Cashu wallet. It stays here until you say you saved it.`,
          code: card.token,
          actions: (
            <>
              {copyButton("token", card.token)}
              {closer("I saved it")}
            </>
          ),
        };
      case "out":
        return busy === "out"
          ? { title: "Taking out…", text: `Asking ${hostOf(card.node)}. This can take a minute.` }
          : {
              title: "This take-out is not finished.",
              text: `${hostOf(card.node)} was asked to pay out, and its answer did not arrive. Ask again: the node gives the same payout, never a second one.`,
              actions: (
                <>
                  <button type="button" disabled={!!busy || !keys[card.node]} onClick={() => takeOut(card.to, card.node)}>
                    Ask again
                  </button>
                  {/* sats still on the key mean nothing was paid out: then it can also be left for later */}
                  {card.node === node && !!known?.sats && closer("Not now")}
                </>
              ),
            };
      case "sent":
        return {
          title: (
            <>
              {card.done ? "Sent " : "Sending "}
              <i>{fmt(card.sats)} sats</i>
            </>
          ),
          text: card.done ? `to ${card.to}.` : `to ${card.to}. It can take a minute.`,
          actions: closer("Done"),
        };
    }
  })();

  const qr = card?.kind === "invoice" && card.state !== "expired";

  return (
    <>
      <div className="tu-tools">
        <NodePicker
          nodes={listed}
          loading={loading}
          value={node}
          onPick={pickNode}
        />
        <label className="tu-field">
          <small>Key</small>
          <input
            type="password"
            aria-label="API key"
            autoComplete="off"
            spellCheck={false}
            placeholder={node ? "sk-…, or none for a new key" : "sk-…"}
            value={key}
            onChange={(event) => setKey(event.target.value.trim())}
          />
          {key && (
            <button type="button" onClick={() => setKey("")}>
              Forget
            </button>
          )}
        </label>
      </div>
      <p className="tu-note">Your key goes only to the node you pick, and is kept in this browser.</p>

      <div className="tu-bal" aria-live="polite" aria-atomic="true" aria-busy={counting}>
        {status === "ok" ? (
          <>
            <strong>
              {fmt(balance ?? 0)}
              <u>sats</u>
            </strong>
            <p>
              left on this key <b>/ {fmt(known?.spent ?? 0)} spent</b>
              <span className="tu-use">
                {copyButton("key", key)}
                {copyButton("base URL", `${node}/v1`)}
              </span>
            </p>
          </>
        ) : (
          <>
            <strong data-word data-wait={status === "checking" || undefined}>
              {head[status][0]}
            </strong>
            <p>{head[status][1]}</p>
          </>
        )}
      </div>

      <div className="tu-act">
        <div>
          <div className="pg-switch" role="group" aria-label="What to do">
            <button type="button" aria-pressed={tab === "add"} onClick={() => setTab("add")}>
              Add sats
            </button>
            <button type="button" aria-pressed={tab === "out"} onClick={() => setTab("out")}>
              Take out
            </button>
          </div>

          {tab === "add" ? (
            <>
              <div className="pg-chips tu-amounts" role="group" aria-label="Amount in sats">
                {AMOUNTS.map((sats) => (
                  <button key={sats} type="button" aria-pressed={preset === sats} onClick={() => setPreset(sats)}>
                    {fmt(sats)}
                  </button>
                ))}
                {preset === null ? (
                  <label className="tu-other">
                    <input
                      autoFocus
                      inputMode="numeric"
                      aria-label="Other amount in sats"
                      placeholder="Sats"
                      value={other}
                      aria-invalid={(other !== "" && !otherOk) || undefined}
                      onChange={(event) => setOther(event.target.value.trim().slice(0, 12))}
                      onKeyDown={(event) => event.key === "Enter" && canAdd && amountOk && getInvoice()}
                    />
                    <i>sats</i>
                  </label>
                ) : (
                  <button type="button" aria-pressed={false} onClick={() => setPreset(null)}>
                    Other
                  </button>
                )}
              </div>
              <button type="button" className="tu-btn" disabled={!canAdd || !amountOk} onClick={getInvoice}>
                {busy === "invoice" ? "Getting invoice…" : status === "nokey" ? "Get a key" : "Get invoice"}
                <Arrow />
              </button>
              {preset === null && other !== "" && !otherOk && (
                <p className="tu-alt" role="alert">
                  Whole sats only, in digits: no dot, comma or minus.
                </p>
              )}
              {amount > MOST && <p className="tu-alt">A node takes at most {fmt(MOST)} sats at once.</p>}
              <p className="tu-alt">
                Have a Cashu token?{" "}
                <button type="button" aria-expanded={pasting} onClick={() => setPasting(!pasting)}>
                  Paste it
                </button>
              </p>
              {pasting && (
                <div className="tu-paste">
                  <textarea
                    autoFocus
                    rows={3}
                    spellCheck={false}
                    aria-label="Cashu token"
                    placeholder="cashuB…"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                  />
                  <button
                    type="button"
                    className="tu-btn tu-quiet"
                    disabled={!canAdd || !/cashu/.test(token)}
                    onClick={addToken}
                  >
                    {busy === "token" ? "Adding…" : status === "nokey" ? "Get a key" : "Add token"}
                    <Arrow />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {addresses ? (
                <label className="tu-field tu-to">
                  <small>To</small>
                  <input
                    type="text"
                    inputMode="email"
                    aria-label="Lightning address"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="you@wallet.com"
                    value={address}
                    onChange={(event) => setAddress(event.target.value.trim())}
                    onKeyDown={(event) => event.key === "Enter" && canOut && address && takeOut(address)}
                  />
                </label>
              ) : (
                <p className="tu-alt">
                  This node gives your sats back as a Cashu token. A key that has a Lightning address saved on it is
                  paid there instead.
                </p>
              )}
              <button
                type="button"
                className="tu-btn"
                disabled={!canOut || (addresses && !address)}
                onClick={() => takeOut(addresses ? address : null)}
              >
                {busy === "out"
                  ? "Taking out…"
                  : addresses
                    ? `Send ${known?.sats ? `${fmt(known.sats)} sats` : "all"}`
                    : "Get a Cashu token"}
                <Arrow />
              </button>
              {addresses && (
                <p className="tu-alt">
                  Or{" "}
                  <button type="button" disabled={!canOut} onClick={() => takeOut(null)}>
                    get them as a Cashu token
                  </button>
                  . A key that has a Lightning address saved on it is paid there instead.
                </p>
              )}
            </>
          )}
          <p className="tu-say" role="status">
            {say || hold}
          </p>
        </div>

        <div ref={cardBox} className="tu-card" data-qr={qr || undefined} tabIndex={-1} aria-live="polite">
          {qr && (
            <a className="tu-qr" href={`lightning:${card.bolt11}`} aria-label="Open the invoice in a wallet">
              <QRCode value={`lightning:${card.bolt11}`.toUpperCase()} size={256} viewBox="0 0 256 256" />
            </a>
          )}
          <div>
            <h2>{face.title}</h2>
            <p>{face.text}</p>
            {face.code && <code data-key={card?.kind === "key" || undefined}>{face.code}</code>}
            {face.actions && <div className="tu-acts">{face.actions}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
