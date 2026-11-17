import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CHAT_URL, DOCS_URL } from "@/components/Header";

const voices = [
  {
    quote: "This is incredible. AI chat pay per use.",
    name: "calle",
    role: "on Nostr",
    href: "https://nostr.com/nevent1qqszj3rsayzeguyu02lfph63xm4lrh38el73yq37zsnhc6vrqq5tkxqzypgdjn7zmpvqc6ptqud9gtutrcc6yq9s2z96h9dr80hss4wl9qwkx0u6nyh",
  },
  {
    quote: "With routstr, you can pay for AI services with Bitcoin using Cashu ecash.",
    name: "Cashu",
    role: "@CashuBTC",
    href: "https://x.com/CashuBTC/status/1978042521625231844",
  },
  {
    quote: "Routstr brings the convenience of the OpenRouter experience to the permissionless, censorship-resistant world of Nostr and Bitcoin",
    name: "Hamish MacEwan",
    role: "@HamishMacEwan",
    href: "https://x.com/HamishMacEwan/status/1952444259346636857",
  },
];

const doors = [
  { title: "Chat", text: "Ask a model in the browser.", href: CHAT_URL, external: true },
  { title: "Build", text: "Wire it into your agent or app.", href: DOCS_URL, external: true },
  { title: "Sell", text: "Run a node and earn sats.", href: "https://docs.routstr.com/provider/quickstart/", external: true },
  { title: "Look around", text: "Every model and its price.", href: "/models", external: false },
];

export function Voices() {
  return (
    <section className="wrap voices" aria-label="What people say">
      <figure className="voice-lead" data-rise>
        <blockquote className="d2">
          <a href="https://x.com/jack/status/1925607683454869946" target="_blank" rel="noopener noreferrer">
            &ldquo;nostr+bitcoin+ai routstr.com&rdquo;
          </a>
        </blockquote>
        <figcaption className="mono">jack &middot; @jack</figcaption>
      </figure>
      <ul className="voice-list">
        {voices.map((voice, i) => (
          <li key={voice.name} data-rise style={{ ["--i" as string]: i }}>
            <a href={voice.href} target="_blank" rel="noopener noreferrer">
              <blockquote>&ldquo;{voice.quote}&rdquo;</blockquote>
              <span className="mono">
                {voice.name} &middot; {voice.role}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Closing() {
  return (
    <section className="wrap closing">
      <h2 className="d1" data-rise>
        Begin <em>anywhere.</em>
      </h2>
      <ul className="doors">
        {doors.map((door, i) => {
          const body = (
            <>
              <span className="d3">{door.title}</span>
              <span>{door.text}</span>
              {door.external ? <ArrowUpRight /> : <ArrowRight />}
            </>
          );
          return (
            <li key={door.title} data-rise style={{ ["--i" as string]: i }}>
              {door.external ? (
                <a href={door.href} target="_blank" rel="noopener noreferrer">
                  {body}
                </a>
              ) : (
                <Link href={door.href}>{body}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
