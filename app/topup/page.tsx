import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { TopUp } from "@/components/topup/TopUp";
import "@/components/layout/pages.css";
import "./topup.css";

const description =
  "Add sats to a Routstr API key by Lightning or Cashu, get a new key, or take your sats out. Your key goes only to the node you pick.";

export const metadata: Metadata = {
  // the root layout adds " | Routstr"
  title: "Top-up",
  description,
  openGraph: {
    title: "Top-up - Routstr",
    description,
    url: "https://routstr.com/topup",
  },
  twitter: { title: "Top-up - Routstr", description },
};

/* Top-up: pick the node a key lives on, then add sats to it by the node's own Lightning
   invoice or a Cashu token, or take them out again. With no key, paying gets you one. */
export default function TopUpPage() {
  return (
    <SiteShell>
      <section className="pg tu">
        <p className="pg-label">Top-up</p>
        <h1 className="pg-title">
          <span>
            <i>Sats for</i>
          </span>{" "}
          <span>
            <i style={{ ["--i" as string]: 1 }}>your API key.</i>
          </span>
        </h1>
        <p className="pg-lede">
          A key lives on one node. Pick it, add sats by Lightning or Cashu, and take them out when you are done.
        </p>
        <TopUp />
      </section>
    </SiteShell>
  );
}
