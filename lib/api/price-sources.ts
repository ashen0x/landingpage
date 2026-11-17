import { createPool } from "@/lib/nostr";
import {
  indexListPrices,
  indexListOpen,
  indexListScores,
  latestReviewLabels,
  parseModelIdMappings,
  type ModelIdMappings,
  type TokenRates,
} from "@/lib/price-radar";

// The key and relays apps read node reviews (kind 38425) and model id
// mappings (kind 38426) from.
const ROUTSTR_PUBKEY =
  "4ad6fa2d16e2a9b576c863b4cf7404a70d4dc320c0c447d10ad6ff58993eacc8";
const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.routstr.com"];
const MAX_FUTURE_DRIFT_SECONDS = 15 * 60;

const LIST_PRICES_URL = "https://openrouter.ai/api/v1/models";

/** Newest review label per node key. Empty when no relay answers. */
export async function fetchReviewLabels(): Promise<Map<string, string>> {
  const pool = createPool();
  try {
    const events = await pool.querySync(
      RELAYS,
      { kinds: [38425], authors: [ROUTSTR_PUBKEY], limit: 500 },
      { maxWait: 5000 }
    );
    const latest = Math.floor(Date.now() / 1000) + MAX_FUTURE_DRIFT_SECONDS;
    return latestReviewLabels(events.filter((e) => e.created_at <= latest));
  } catch {
    return new Map();
  } finally {
    pool.close(RELAYS);
  }
}

/** Newest valid model id mapping snapshot. Empty when none is found. */
export async function fetchModelIdMappings(): Promise<ModelIdMappings> {
  const pool = createPool();
  try {
    const events = await pool.querySync(
      RELAYS,
      { kinds: [38426], authors: [ROUTSTR_PUBKEY], "#d": ["model-id-mappings"] },
      { maxWait: 5000 }
    );
    const latest = Math.floor(Date.now() / 1000) + MAX_FUTURE_DRIFT_SECONDS;
    const newestFirst = events.filter((e) => e.created_at <= latest).sort(
      (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id)
    );
    for (const event of newestFirst) {
      const mappings = parseModelIdMappings(event.content);
      if (mappings) return mappings;
    }
    return {};
  } catch {
    return {};
  } finally {
    pool.close(RELAYS);
  }
}

export interface ListData {
  /** USD rates by model id. */
  readonly prices: Map<string, TokenRates>;
  /** The intelligence index by model id, for the models that have one. */
  readonly scores: Map<string, number>;
  /** Whether a model's weights are public, by model id. */
  readonly open: Map<string, boolean>;
}

/** What OpenRouter's public model list says, read once. Empty when unreachable. */
export async function fetchListData(
  fetchImpl: typeof fetch = fetch
): Promise<ListData> {
  try {
    const response = await fetchImpl(LIST_PRICES_URL, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { prices: new Map(), scores: new Map(), open: new Map() };
    const payload = (await response.json()) as { data?: unknown };
    const models = Array.isArray(payload.data) ? payload.data : [];
    return { prices: indexListPrices(models), scores: indexListScores(models), open: indexListOpen(models) };
  } catch {
    return { prices: new Map(), scores: new Map(), open: new Map() };
  }
}

/** OpenRouter's public USD rates by model id. Empty when unreachable. */
export async function fetchListPrices(
  fetchImpl: typeof fetch = fetch
): Promise<Map<string, TokenRates>> {
  return (await fetchListData(fetchImpl)).prices;
}
