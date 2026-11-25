"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SiteShell } from "@/components/layout/site-shell";
import { Mark } from "@/components/layout/Mark";
import { Kinds } from "@/components/layout/Kinds";
import { companyIn } from "@/components/stats/model-company-icon";
import { ModelReviews } from "@/components/ModelReviews";
import { Provider, getModelNameWithoutProvider } from "@/app/data/models";
import { useNodeLists } from "@/lib/use-node-lists";
import { usePricingView } from "@/app/contexts/PricingContext";
import { fetchListPrices, fetchReviewLabels } from "@/lib/api/price-sources";
import { isApproved, requestCost, type TokenRates } from "@/lib/price-radar";
import { usageKey, useModelUsage } from "@/lib/model-usage";
import { getLocalCashuToken, setLocalCashuToken } from "@/utils/storageUtils";
import { wholeSentences } from "@/lib/describe";
import { formatCompactContextLength, formatCompactCount, formatCompactPriceValue } from "@/lib/number-format";
import "@/components/layout/pages.css";
import "./model.css";

type CodeLanguage = "curl" | "javascript" | "python";

function decodeSegments(segments: string[]): string[] {
  return segments.map((s) => decodeURIComponent(s));
}

function isUnknownProviderName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "unknown";
}

export default function ModelDetailPage() {
  const params = useParams();
  const { currency, setCurrency } = usePricingView();
  /* Every node's own list, from the loader the other pages share: asked once, and the lists of
     the last visit show at once. */
  const { nodes, loading: pricingLoading } = useNodeLists();
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  const modelIdParts = params.modelId as string[];
  const decodedModelIdParts = decodeSegments(modelIdParts);
  const decodedModelId = decodedModelIdParts.join("/");

  const [activeTab, setActiveTab] = useState<CodeLanguage>("curl");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [descExpanded, setDescExpanded] = useState<boolean>(false);
  const [idCopied, setIdCopied] = useState(false);

  const usage = useModelUsage();
  const [labels, setLabels] = useState<Map<string, string>>(() => new Map());
  const [listPrices, setListPrices] = useState<Map<string, TokenRates>>(() => new Map());
  useEffect(() => {
    let active = true;
    void fetchReviewLabels().then((found) => active && setLabels(found));
    void fetchListPrices().then((found) => active && setListPrices(found));
    return () => {
      active = false;
    };
  }, []);

  /* The id in the address as nodes spell it: exactly, else in other capitals, else by its last part
     alone (an old link to "gpt-x" still finds "openai/gpt-x"). The strictest way that finds a seller is used. */
  const sold = useMemo(() => {
    const ids = nodes.flatMap(({ models }) => models.map((m) => m.id));
    const lower = decodedModelId.toLowerCase();
    const ways: ((id: string) => boolean)[] = [
      (id) => id === decodedModelId,
      (id) => id.toLowerCase() === lower,
      (id) => usageKey(id) === usageKey(decodedModelId),
    ];
    return ways.find((way) => ids.some(way)) ?? ways[0];
  }, [nodes, decodedModelId]);
  // every node whose list has this model, once each: named nodes first, then by what a request costs
  const providersWithPricing = useMemo(() => {
    const seen = new Set<string>();
    return nodes
      .flatMap(({ provider, models }) => {
        const found = models.find((m) => sold(m.id));
        if (!found || seen.has(provider.id)) return [];
        seen.add(provider.id);
        return [{ provider, model: found }];
      })
      .sort((a, b) => {
        const aUnknown = isUnknownProviderName(a.provider.name);
        const bUnknown = isUnknownProviderName(b.provider.name);
        if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
        const cost = (entry: (typeof a)) => (entry.model.sats_unpriced ? null : requestCost(entry.model.sats_pricing)) || Infinity;
        return cost(a) - cost(b) || 0;
      });
  }, [nodes, sold]);
  const model = providersWithPricing[0]?.model ?? null;
  const notFound = !pricingLoading && !model;

  // approved nodes first: that is where apps send a request. Within each, the order above (by cost) holds.
  const place = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();
  const approved = (provider: Provider) =>
    labels.size === 0 ||
    isApproved(
      providersWithPricing.filter((entry) => place(entry.provider.endpoint_url) === place(provider.endpoint_url)).map((entry) => entry.provider.pubkey),
      labels
    );
  const sellers = [...providersWithPricing].sort((a, b) => Number(approved(b.provider)) - Number(approved(a.provider)));
  const selected = sellers.find((entry) => entry.provider.id === selectedProviderId) ?? sellers[0];
  // a token is kept per node: for the node the code below is written for
  const storageBaseUrl = (selected?.provider.endpoint_url || "https://api.routstr.com").replace(/\/v1$/, "");

  useEffect(() => {
    try {
      const existing = getLocalCashuToken(storageBaseUrl) || "";
      setTokenInput(existing);
    } catch {}
  }, [storageBaseUrl]);

  if (notFound) {
    return (
      <SiteShell>
        <section className="pg md">
          <h1>No such model</h1>
          <p className="pg-lede">No node sells a model under this name right now.</p>
          <Link href="/models" className="pg-more">
            All models <ArrowRight strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </section>
      </SiteShell>
    );
  }
  if (!model) {
    return (
      <SiteShell>
        <section className="pg md">
          <p className="pg-lede">Asking the nodes about this model.</p>
        </section>
      </SiteShell>
    );
  }

  const sats = currency === "sats";
  const price = (value: number | undefined) =>
    !value || !(value > 0)
      ? "—"
      : value * 1_000_000 < 0.005
        ? "<0.01"
        : formatCompactPriceValue(value * 1_000_000, { fixedSmallDecimals: !sats });
  const base = selected?.provider.endpoint_url
    ? selected.provider.endpoint_url.endsWith("/v1")
      ? selected.provider.endpoint_url
      : `${selected.provider.endpoint_url.replace(/\/$/, "")}/v1`
    : "https://api.routstr.com/v1";
  const name = getModelNameWithoutProvider(model.name);
  const token = tokenInput.trim() || "YOUR_TOKEN";
  const code: Record<CodeLanguage, string> = {
    curl: `curl -X POST ${base}/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token}" \\\n  -d '{\n    "model": "${model.id}",\n    "messages": [\n      { "role": "user", "content": "Hello Nostr" }\n    ]\n  }'`,
    javascript: `import OpenAI from 'openai';\n\nconst openai = new OpenAI({\n  baseURL: '${base}',\n  apiKey: '${token}'\n});\n\nconst completion = await openai.chat.completions.create({\n  model: '${model.id}',\n  messages: [{ role: 'user', content: 'Hello Nostr' }]\n});\nconsole.log(completion.choices[0].message);`,
    python: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${base}",\n    api_key="${token}"\n)\n\ncompletion = client.chat.completions.create(\n    model="${model.id}",\n    messages=[{"role": "user", "content": "Hello Nostr"}]\n)\nprint(completion.choices[0].message.content)`,
  };
  const copy = async (text: string, done: (on: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      done(true);
      window.setTimeout(() => done(false), 1500);
    } catch {
      // clipboard blocked: the text is still selectable
    }
  };
  const requests = usage.requests?.[usageKey(model.id)] ?? 0;
  // nodes describe a model in their own words: the fullest of them is shown
  const about = [model, ...sellers.map((entry) => entry.model)]
    .map((one) => wholeSentences(one.description ?? ""))
    .reduce((longest, text) => (text.length > longest.length ? text : longest), "");
  const takes = model.architecture?.input_modalities ?? [];
  const gives = model.architecture?.output_modalities ?? [];
  const best = sellers[0] && approved(sellers[0].provider) && !sellers[0].model.sats_unpriced ? sellers[0] : null;
  const mine = selected ? requestCost(selected.model.pricing) : null;
  const theirs = requestCost(listPrices.get(model.id));
  // a price above zero never reads as 100% under
  const against = mine && theirs ? Math.max(-99, Math.round((mine / theirs - 1) * 100)) : null;

  return (
    <SiteShell>
      <section className="pg md">
        <Link href="/models" className="md-back">
          <ArrowLeft strokeWidth={1.5} aria-hidden="true" /> All models
        </Link>
        <div className="md-head">
          <Mark company={companyIn(`${model.id} ${model.name}`)} />
          <h1>{name}</h1>
        </div>
        <div className="md-under">
          <p className="pg-id">
            <code>{model.id}</code>
            <button type="button" onClick={() => copy(model.id, setIdCopied)}>
              {idCopied ? "Copied" : "Copy"}
            </button>
          </p>
          <a href={`https://chat.routstr.com/?model=${encodeURIComponent(model.id.split("/").pop() || model.id)}`} className="pg-more">
            Try it in the chat <ArrowRight strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>

        <div className="md-two">
          <div className="md-main">
            {about && (
              <>
                <div className="md-about" data-short={!descExpanded && about.length > 300 ? "" : undefined}>
                  <ReactMarkdown>{about}</ReactMarkdown>
                </div>
                {about.length > 300 && (
                  <button type="button" className="md-toggle" onClick={() => setDescExpanded(!descExpanded)}>
                    {descExpanded ? "Show less" : "Read it all"}
                  </button>
                )}
              </>
            )}

            <dl className="pg-facts" style={{ marginTop: "clamp(26px, 5vh, 44px)" }}>
              {model.context_length > 0 && (
                <div>
                  <dd>{formatCompactContextLength(model.context_length)}</dd>
                  <dt>context</dt>
                </div>
              )}
              {takes.length > 0 && (
                <div>
                  <dd>
                <Kinds list={takes} />
              </dd>
                  <dt>takes in</dt>
                </div>
              )}
              {gives.length > 0 && (
                <div>
                  <dd>
                <Kinds list={gives} />
              </dd>
                  <dt>gives back</dt>
                </div>
              )}
              {requests > 0 && (
                <div>
                  <dd>{formatCompactCount(requests)}</dd>
                  <dt>requests, 30 days</dt>
                </div>
              )}
              {model.created > 0 && (
                <div>
                  <dd>{new Date(model.created * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</dd>
                  <dt>released</dt>
                </div>
              )}
                </dl>

            <h2>
              {pricingLoading && sellers.length === 0 ? "Asking the nodes" : `Sold by ${sellers.length} ${sellers.length === 1 ? "node" : "nodes"}`}
              <span className="md-unit">
                <span className="pg-switch" role="group" aria-label="Show prices in">
                  <button type="button" aria-pressed={sats} onClick={() => setCurrency("sats")}>
                    sats
                  </button>
                  <button type="button" aria-pressed={!sats} onClick={() => setCurrency("usd")}>
                    USD
                  </button>
                </span>
                per 1M · input / output
              </span>
            </h2>
            <div className="md-sellers">
              {sellers.map((entry) => (
                <button
                  key={entry.provider.id}
                  type="button"
                  aria-pressed={entry === selected}
                  data-best={entry === best || undefined}
                  data-off={!approved(entry.provider) || undefined}
                  title="Write the code below for this node"
                  onClick={() => setSelectedProviderId(entry.provider.id)}
                >
                  <span>
                    {entry.provider.name}
                    {!approved(entry.provider) && <i>not approved</i>}
                  </span>
                  <span>{price(sats ? entry.model.sats_pricing?.prompt : entry.model.pricing?.prompt)}</span>
                  <span>{price(sats ? entry.model.sats_pricing?.completion : entry.model.pricing?.completion)}</span>
                </button>
              ))}
            </div>

          </div>

          <aside className="md-side">
            {selected && (
              <div className="md-goes" data-picked={selected !== best || undefined}>
                <p>{selected === best ? "A request goes to" : "You picked"}</p>
                <b>{selected.provider.name}</b>
                <dl>
                  <div>
                    <dd>{price(sats ? selected.model.sats_pricing?.prompt : selected.model.pricing?.prompt)}</dd>
                    <dt>input</dt>
                  </div>
                  <div>
                    <dd>{price(sats ? selected.model.sats_pricing?.completion : selected.model.pricing?.completion)}</dd>
                    <dt>output</dt>
                  </div>
                  {against !== null && (
                    <div>
                      <dd data-under={against < 0 || undefined}>
                        {against < 0 ? `−${-against}%` : against > 0 ? `+${against}%` : "0%"}
                      </dd>
                      <dt>vs OpenRouter</dt>
                    </div>
                  )}
                </dl>
                <small>
                  {sats ? "sats" : "USD"} per 1M tokens.{" "}
                  {selected === best
                    ? "It is the cheapest approved node right now."
                    : !approved(selected.provider)
                      ? "This node is not approved, so apps do not send requests to it."
                      : best
                        ? `Apps would send the request to ${best.provider.name}, the cheapest approved node.`
                        : ""}
                </small>
              </div>
            )}
            <h2>
              Call it<small>{selected ? `at ${selected.provider.name}` : ""}</small>
            </h2>
            <div className="md-code">
              <div className="md-code-top">
                <div className="pg-switch" role="group" aria-label="Language">
                  {(["curl", "python", "javascript"] as const).map((language) => (
                    <button key={language} type="button" aria-pressed={activeTab === language} onClick={() => setActiveTab(language)}>
                      {language === "curl" ? "cURL" : language === "python" ? "Python" : "JavaScript"}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => copy(code[activeTab], setCopied)}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre>{code[activeTab]}</pre>
            </div>
            <label className="md-token">
              Your Cashu token or API key. It is put into the code above and kept only in this browser.
              <input
                type="text"
                spellCheck={false}
                autoComplete="off"
                placeholder="cashuB... or sk-..."
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                onBlur={() => setLocalCashuToken(storageBaseUrl, tokenInput || "")}
              />
            </label>

          </aside>

          <div className="md-reviews">
            <ModelReviews modelId={model.id} providersForModel={sellers.map((entry) => entry.provider)} />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
