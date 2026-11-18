import type { Metadata } from "next";

const description =
  "A small program that gives your coding agents every model. It finds Routstr nodes on Nostr, pays them in sats from its own wallet, and sends each request to the cheapest one that works.";

export const metadata: Metadata = {
  // the root layout adds " | Routstr"
  title: "routstrd",
  description,
  openGraph: {
    title: "routstrd - Routstr",
    description,
    url: "https://routstr.com/routstrd",
  },
  twitter: {
    title: "routstrd - Routstr",
    description,
  },
};

export default function RoutstrdLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
