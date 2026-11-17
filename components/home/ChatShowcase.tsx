import { ArrowUpRight } from "lucide-react";
import { CHAT_URL } from "@/components/Header";

/* Each shot exists in both rooms; the theme picks which one shows. */
function Shot({
  name,
  alt,
  width,
  height,
  title,
  children,
}: {
  name: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  children: string;
}) {
  return (
    <figure className={`shot shot-${name}`} data-rise>
      <div className="shot-frame">
        {(["paper", "night"] as const).map((room) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={room}
            src={`/home/chat-${name}-${room}.webp`}
            alt={room === "paper" ? alt : ""}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            data-room={room}
          />
        ))}
      </div>
      <figcaption>
        <b>{title}</b>
        <span>{children}</span>
      </figcaption>
    </figure>
  );
}

export function ChatShowcase() {
  return (
    <section id="chat" className="wrap">
      <div className="sheet chat">
        <header className="sec-head">
          <div data-rise>
            <p className="kicker">01 &middot; Use it</p>
            <h2 className="d2">
              Every model in one chat. <em>Nothing to sign up for.</em>
            </h2>
          </div>
          <div data-rise style={{ ["--i" as string]: 1 }}>
            <p className="lede">
              Pick a model and see what a message costs before you send it. The first thing the
              app asks for is a few sats, not your email.
            </p>
            <a href={CHAT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-tint">
              Open the chat <ArrowUpRight />
            </a>
          </div>
        </header>

        <div className="chat-stage">
          <Shot name="thread" title="Pay for the answer you got" alt="A Routstr chat: an answer with code and a table, and 31 sats charged for it" width={1800} height={1125}>
            The app holds a little for each message and returns what the answer did not use. This one cost 31 sats.
          </Shot>
          <Shot name="picker" title="A price on every model" alt="The model picker: each model with its price in sats per message" width={1360} height={1060}>
            Sats per message, next to each model, before you send.
          </Shot>
          <Shot name="topup" title="Sats, not sign-up" alt="The first message asks for a few sats, with no account needed" width={1000} height={667}>
            Pay a Lightning invoice or paste a Cashu token. Your message sends itself when the sats land.
          </Shot>
        </div>
      </div>
    </section>
  );
}
