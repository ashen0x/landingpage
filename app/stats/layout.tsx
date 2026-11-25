import type { Metadata } from "next";

const description =
  "What runs through Routstr: requests, sats paid to nodes and tokens, day by day, by model and by node, from the usage reports the nodes sign.";

export const metadata: Metadata = {
  // the root layout adds " | Routstr"
  title: "Stats",
  description,
  openGraph: { title: "Stats - Routstr", description, url: "https://routstr.com/stats" },
  twitter: { title: "Stats - Routstr", description },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
