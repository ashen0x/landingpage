import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { Capabilities } from "@/components/capabilities/Capabilities";
import "@/components/layout/pages.css";
import "./capabilities.css";

const description =
  "What Routstr can do: AI with no account, paid in sats per request with the change back, every model through one API, routing around failed nodes, privacy over Tor and sealed enclaves, discovery over Nostr, teams, and selling your own models.";

export const metadata: Metadata = {
  // the root layout adds " | Routstr"
  title: "Capabilities",
  description,
  openGraph: { title: "Capabilities - Routstr", description, url: "https://routstr.com/capabilities" },
  twitter: { title: "Capabilities - Routstr", description },
};

/* Capabilities: a short head, then what Routstr can do as a row of names. The one playing stands
   in words with the request that does it, and the light beside them acts it out. */
export default function CapabilitiesPage() {
  return (
    <SiteShell band={false}>
      <section className="pg cp">
        <p className="pg-label">Capabilities</p>
        <h1 className="pg-title">
          <span>
            <i>What Routstr</i>
          </span>{" "}
          <span>
            <i style={{ ["--i" as string]: 1 }}>can do.</i>
          </span>
        </h1>
        <Capabilities />
      </section>
    </SiteShell>
  );
}
