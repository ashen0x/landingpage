"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp as ArrowUpIcon } from "lucide-react";
import { useNostr } from "@/context/NostrContext";
import { type Event } from "nostr-tools";
import { getDefaultRelays } from "@/lib/nostr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Provider } from "@/app/data/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "@/components/model-reviews.css";

interface ModelReviewsProps {
  modelId: string;
  providersForModel: Provider[];
}

interface ReviewItem {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
}

function formatTimeAgo(createdAtSeconds: number): string {
  const now = Date.now();
  const then = createdAtSeconds * 1000;
  const diffMs = Math.max(0, now - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  const yr = Math.floor(mon / 12);
  return `${yr}y ago`;
}

export function ModelReviews({ modelId, providersForModel }: ModelReviewsProps) {
  const { isAuthenticated, publicKey, publishEvent, pool, logout, login, loginWithNsec } = useNostr();
  const [selectedProviderId, setSelectedProviderId] = useState<string>(providersForModel[0]?.pubkey || "");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [nsecInput, setNsecInput] = useState("");
  const [isUpvotingById, setIsUpvotingById] = useState<Record<string, boolean>>({});
  const [userUpvoted, setUserUpvoted] = useState<Record<string, boolean>>({});
  const [upvoteCounts, setUpvoteCounts] = useState<Record<string, number>>({});
  const reactionByReviewerRef = useRef<Record<string, Map<string, 'up' | 'none'>>>({});
  const [sortMode, setSortMode] = useState<'top' | 'new'>('top');

  useEffect(() => {
    if (!loginOpen) {
      setError(null);
      setNsecInput("");
    }
  }, [loginOpen]);

  useEffect(() => {
    let active = true;
    if (!pool || !selectedProviderId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    const relays = getDefaultRelays();
    const nextItems: ReviewItem[] = [];
    const closer = pool.subscribeMany(
      relays,
      {
        kinds: [1986],
        "#t": ["model:" + modelId, "provider:" + selectedProviderId],
        limit: 50,
      },
      {
        onevent(evt: Event) {
          const hasModelTag = evt.tags?.some((t) => t[0] === "t" && t[1] === `model:${modelId}`);
          const hasProviderTag = evt.tags?.some((t) => t[0] === "t" && t[1] === `provider:${selectedProviderId}`);
          if (!hasModelTag || !hasProviderTag) return;
          nextItems.push({ id: evt.id, pubkey: evt.pubkey, content: evt.content, created_at: evt.created_at });
        },
        oneose() {
          if (!active) return;
          nextItems.sort((a: ReviewItem, b: ReviewItem) => b.created_at - a.created_at);
          setItems(nextItems);
          setIsLoading(false);
        },
      }
    );
    return () => { active = false; try { closer.close(); } catch {} };
  }, [pool, modelId, selectedProviderId]);

  useEffect(() => {
    if (!pool || items.length === 0) {
      setUpvoteCounts({});
      setUserUpvoted({});
      reactionByReviewerRef.current = {};
      return;
    }
    const reviewIds = items.map((r) => r.id);
    const relays = getDefaultRelays();
    const closer = pool.subscribeMany(
      relays,
      { kinds: [7], "#e": reviewIds, limit: 1000 },
      {
        onevent(evt: Event) {
          const eTag = evt.tags.find((t) => t[0] === "e")?.[1];
          if (!eTag) return;
          const content = (evt.content || "").trim();
          const isPositive = content === "+" || content === "❤️" || content === "👍" || content === "❤";
          if (!reactionByReviewerRef.current[eTag]) reactionByReviewerRef.current[eTag] = new Map<string, 'up' | 'none'>();
          reactionByReviewerRef.current[eTag].set(evt.pubkey, isPositive ? 'up' : 'none');
          let count = 0;
          reactionByReviewerRef.current[eTag].forEach((v) => { if (v === 'up') count++; });
          setUpvoteCounts((prev) => ({ ...prev, [eTag]: count }));
          if (publicKey && evt.pubkey === publicKey) setUserUpvoted((prev) => ({ ...prev, [eTag]: isPositive }));
        },
      }
    );
    return () => { try { closer.close(); } catch {} };
  }, [pool, items, publicKey]);

  async function handleSubmit() {
    setError(null);
    if (!reviewText.trim() || !selectedProviderId) return;
    setIsSubmitting(true);
    try {
      const signed = await publishEvent(reviewText.trim(), 1986, [["t", "model:" + modelId], ["t", "provider:" + selectedProviderId]]);
      if (signed) {
        setItems((prev) => [{ id: signed.id, pubkey: signed.pubkey, content: signed.content, created_at: signed.created_at }, ...prev]);
        setUserUpvoted((prev) => ({ ...prev, [signed.id]: true }));
        setUpvoteCounts((prev) => ({ ...prev, [signed.id]: (prev[signed.id] || 0) + 1 }));
        try { await publishEvent("+", 7, [["e", signed.id],["p", signed.pubkey]]); } catch {}
        setReviewText("");
      }
    } catch { setError("Error submitting review"); }
    finally { setIsSubmitting(false); }
  }

  async function handleUpvote(reviewId: string, reviewPubkey: string) {
    if (!isAuthenticated) { setLoginOpen(true); return; }
    if (!publishEvent) return;
    setIsUpvotingById((prev) => ({ ...prev, [reviewId]: true }));
    try {
      const currentlyUpvoted = !!userUpvoted[reviewId];
      const signed = await publishEvent(currentlyUpvoted ? "" : "+", 7, [["e", reviewId],["p", reviewPubkey]]);
      if (signed) {
        setUserUpvoted((prev) => ({ ...prev, [reviewId]: !currentlyUpvoted }));
        setUpvoteCounts((prev) => ({ ...prev, [reviewId]: Math.max(0, (prev[reviewId] || 0) + (currentlyUpvoted ? -1 : 1)) }));
      }
    } catch {}
    finally { setIsUpvotingById((prev) => ({ ...prev, [reviewId]: false })); }
  }

  const sortedItems = useMemo(() => {
    const list = [...items];
    if (sortMode === 'top') {
      list.sort((a, b) => {
        const bu = upvoteCounts[b.id] || 0;
        const au = upvoteCounts[a.id] || 0;
        if (bu !== au) return bu - au;
        return b.created_at - a.created_at;
      });
    } else { list.sort((a, b) => b.created_at - a.created_at); }
    return list;
  }, [items, upvoteCounts, sortMode]);

  return (
    <div>
      <h2>
        Reviews
        <span className="pg-switch" role="group" aria-label="Order of the reviews">
          <button type="button" aria-pressed={sortMode === "top"} onClick={() => setSortMode("top")}>
            Top
          </button>
          <button type="button" aria-pressed={sortMode === "new"} onClick={() => setSortMode("new")}>
            Newest
          </button>
        </span>
      </h2>

      <div className="rv-top">
        <label>
          Of this model at
          <select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}>
            {providersForModel.map((p) => (
              <option key={p.id} value={p.pubkey}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {!isAuthenticated && (
          <button type="button" className="rv-pill" onClick={() => setLoginOpen(true)}>
            Log in with Nostr to write one
          </button>
        )}
      </div>

      {isAuthenticated && (
        <div className="rv-write">
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="How did it go for you?"
            aria-label="Your review"
            rows={3}
          />
          <div>
            <button type="button" className="rv-pill" onClick={handleSubmit} disabled={isSubmitting || !reviewText.trim()}>
              {isSubmitting ? "Publishing" : "Publish review"}
            </button>
            <button type="button" className="rv-quiet" onClick={logout}>
              Log out ({publicKey?.slice(0, 8)})
            </button>
          </div>
          {error ? <p className="rv-error">{error}</p> : null}
        </div>
      )}

      {isLoading ? (
        <p className="rv-none">Looking for reviews.</p>
      ) : items.length === 0 ? (
        <p className="rv-none">No reviews yet.</p>
      ) : (
        <ul className="rv-list">
          {sortedItems.map((r) => (
            <li key={r.id}>
              <span className="rv-vote">
                <button
                  type="button"
                  aria-label="Upvote"
                  aria-pressed={Boolean(userUpvoted[r.id])}
                  disabled={Boolean(isUpvotingById[r.id])}
                  onClick={() => handleUpvote(r.id, r.pubkey)}
                >
                  <ArrowUpIcon />
                </button>
                {upvoteCounts[r.id] || 0}
              </span>
              <div>
                <p>{r.content}</p>
                <small>
                  {formatTimeAgo(r.created_at)} · {r.pubkey.slice(0, 16)}…
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Login with Nostr</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">Use an extension or paste your nsec to sign review events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <Button className="w-full" onClick={async () => { if (await login()) setLoginOpen(false); }}>Connect Extension</Button>
            <div className="space-y-3">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Or use Private Key</span>
              <Input
                type="password"
                value={nsecInput}
                onChange={e => setNsecInput(e.target.value)}
                className="h-10 border-border bg-card text-xs text-foreground placeholder:text-muted-foreground"
                placeholder="nsec1..."
              />
              <Button variant="outline" className="w-full" onClick={() => { if (loginWithNsec(nsecInput)) setLoginOpen(false); }}>Login with nsec</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
