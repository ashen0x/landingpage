import Link from "next/link";
import { RoutstrMark } from "@/components/RoutstrMark";
import "@/components/layout/shell.css";

const links = [
  { text: "Models", href: "/models" },
  { text: "Providers", href: "/providers" },
  { text: "Prices", href: "/prices" },
  { text: "Stats", href: "/stats" },
  { text: "Daemon", href: "/routstrd" },
  { text: "Top-Up", href: "/topup" },
  { text: "Capabilities", href: "/capabilities" },
  { text: "Blog", href: "/blog" },
  { text: "Roadmap", href: "/roadmap" },
  { text: "Docs", href: "https://docs.routstr.com" },
  { text: "Chat", href: "https://chat.routstr.com" },
  { text: "GitHub", href: "https://github.com/Routstr" },
  { text: "X", href: "https://x.com/routstrai" },
  { text: "Nostr", href: "https://njump.me/npub130mznv74rxs032peqym6g3wqavh472623mt3z5w73xq9r6qqdufs7ql29s" },
];

export default function Footer() {
  return (
    <footer className="ft">
      <div className="ft-row">
        <Link href="/" className="hd-brand">
          <RoutstrMark />
          routstr
        </Link>
        <nav aria-label="Site">
          {links.map((link) =>
            link.href.startsWith("/") ? (
              <Link key={link.href} href={link.href}>
                {link.text}
              </Link>
            ) : (
              <a key={link.href} href={link.href}>
                {link.text}
              </a>
            )
          )}
        </nav>
      </div>
      <div className="ft-row ft-base">
        <span>&copy; {new Date().getFullYear()} Routstr. Open source.</span>
        <span>Nodes are run by independent operators.</span>
      </div>
    </footer>
  );
}
