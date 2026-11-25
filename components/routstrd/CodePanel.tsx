"use client";

import { useRef, useState, type ReactNode } from "react";
import "./code-panel.css";

/** A line of a terminal: the prompt ("$" or none), the command, and a note after it. */
export type Line = readonly [prompt: string, text: string, note?: string];
export type Example = { tab: string; lines: readonly Line[] };

/* Commands to copy, with a tab for each case. Every case lies in the same place, so the
   panel is as tall as the tallest and nothing below it moves on a switch. */
export function CodePanel({ label, examples, under }: { label: string; examples: readonly Example[]; under?: ReactNode }) {
  const [open, setOpen] = useState(0);
  // the tab just copied, so a switch to another tab does not say it was
  const [copied, setCopied] = useState<number | null>(null);
  const reset = useRef(0);
  const example = examples[open];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example.lines.map(([, text]) => text).join("\n"));
      setCopied(open);
      window.clearTimeout(reset.current);
      reset.current = window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked: the text can still be selected
    }
  };

  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const go = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!go || event.altKey || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    const next = (open + go + examples.length) % examples.length;
    setOpen(next);
    (event.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <div>
      <div className="rd-code">
        <div className="rd-bar">
          <div role="tablist" aria-label={label} onKeyDown={onKey}>
            {examples.map((item, i) => (
              <button
                key={item.tab}
                type="button"
                role="tab"
                aria-selected={i === open}
                tabIndex={i === open ? 0 : -1}
                onClick={() => setOpen(i)}
              >
                {item.tab}
              </button>
            ))}
          </div>
          <button type="button" className="rd-copy" onClick={copy}>
            {copied === open ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="rd-code-body">
          {examples.map((item, n) => (
            <pre key={item.tab} role="tabpanel" data-on={n === open || undefined} aria-hidden={n !== open || undefined}>
              {item.lines.map(([prompt, text, note], i) => (
                <span key={i}>
                  {prompt && <i>{prompt} </i>}
                  {text}
                  {note && <em>{`  # ${note}`}</em>}
                  {"\n"}
                </span>
              ))}
            </pre>
          ))}
        </div>
      </div>
      {under && <p className="rd-under">{under}</p>}
    </div>
  );
}
