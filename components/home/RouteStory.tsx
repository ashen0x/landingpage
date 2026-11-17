const stops = [
  {
    title: "You ask",
    text: "You write a question and choose a model, in the chat or from your own tools.",
  },
  {
    title: "Your wallet pays",
    text: "You add sats first, over Lightning or as Cashu coins. There is no sign-up step.",
  },
  {
    title: "Nostr finds the nodes",
    text: "Nodes announce themselves on Nostr, an open noticeboard. Your app asks each one for its models and prices.",
  },
  {
    title: "Best price goes first",
    text: "The lowest price estimate gets the first try. If that node is down, the next one gets it.",
  },
  {
    title: "The answer comes home",
    text: "You pay for what the answer used. The rest stays yours for the next question, or you can ask for it back.",
  },
];

export function RouteStory() {
  return (
    <section id="how" className="wrap how">
      <header data-rise>
        <p className="kicker">How it works</p>
        <h2 className="d2">
          One question, <em>start to finish.</em>
        </h2>
      </header>
      <ol className="how-line" data-rise>
        {stops.map((stop, i) => (
          <li key={stop.title} style={{ ["--i" as string]: i }}>
            <span className="how-n mono">{i + 1}</span>
            <h3 className="d3">{stop.title}</h3>
            <p>{stop.text}</p>
          </li>
        ))}
      </ol>
      <p className="how-note" data-rise>
        Good to know: the node that answers you passes your question to the model, so it can read
        it, like any API provider. What it never asks for is an account, an email or a card.
      </p>
    </section>
  );
}
