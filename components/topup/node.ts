/* Talking to the one node the visitor picked. The key is only ever sent from here,
   and only to that node. */

export class NodeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

/** A node's address as the page keeps it: https (http only for a local or onion node), no slash or /v1 at the end. */
export function cleanNode(raw: string): string | null {
  let text = raw.trim();
  if (!text || /\s/.test(text) || !/[.:]/.test(text)) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    const local = /^(localhost|127\.0\.0\.1)$|\.onion$/.test(url.hostname);
    if (url.protocol !== "https:" && !local) return null;
    return url.origin + url.pathname.replace(/\/+$/, "").replace(/\/v1$/, "");
  } catch {
    return null;
  }
}

export const hostOf = (node: string) => node.replace(/^https?:\/\//, "");

/** A node that announces 0.5 or later pays out to a Lightning address; an older one gives a token. */
export function paysAddresses(version: string | null): boolean {
  const found = version?.match(/(\d+)\.(\d+)/);
  return !found || Number(found[1]) > 0 || Number(found[2]) >= 5;
}

export async function ask<T>(
  node: string,
  path: string,
  { key, body, wait = 20_000 }: { key?: string; body?: object; wait?: number } = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(node + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(wait),
    });
  } catch {
    throw new NodeError(`No answer from ${hostOf(node)}. Try again in a moment.`, 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // a node answers {detail: "..."} or {detail: {error: {message, code}}}
    const detail = data?.detail ?? data;
    const error = typeof detail === "object" ? detail?.error : undefined;
    const said = typeof detail === "string" ? detail : error?.message;
    // the route itself is missing: the node runs a Routstr from before it
    if (response.status === 404 && said === "Not Found") {
      throw new NodeError(`${hostOf(node)} runs an older Routstr that cannot do this.`, 404, "missing");
    }
    throw new NodeError(
      said ? `The node said: ${said}` : `The node said no (${response.status}).`,
      response.status,
      error?.code
    );
  }
  return data as T;
}

export type Info = { balance: number; total_spent: number };
export type Invoice = {
  invoice_id: string;
  bolt11: string;
  amount_sats: number;
  expires_at: number;
};
export type InvoiceStatus = {
  status: "pending" | "settlement_pending" | "paid" | "expired" | "reconciliation_required";
  api_key?: string | null;
};
export type Topup = {
  msats: number;
  change_token?: string;
  change_amount?: number;
  change_unit?: string;
};
export type Created = { api_key: string };
export type Refund = {
  status?: string;
  token?: string;
  recipient?: string;
  sats?: string;
  msats?: string;
};
