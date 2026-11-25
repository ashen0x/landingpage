"use client";

import { useEffect, useRef, useState } from "react";
import { cleanNode, hostOf } from "./node";

export type Listed = { url: string; name: string; version: string | null; models: number };

/* The node field: every node of the live list in the order of the alphabet, none put
   first, and any other address typed in. */
export function NodePicker({
  nodes,
  loading,
  value,
  onPick,
}: {
  nodes: Listed[];
  loading: boolean;
  value: string;
  onPick: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const picked = nodes.find((node) => node.url === value);
  const needle = query.trim().toLowerCase();
  const typed = cleanNode(query);
  const options: { url: string; name: string; models?: number }[] = nodes.filter(
    (node) => !needle || node.name.toLowerCase().includes(needle) || node.url.includes(needle)
  );
  if (typed && !nodes.some((node) => node.url === typed)) options.push({ url: typed, name: "" });
  const current = Math.min(active, options.length - 1);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    list.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [current, open]);

  const show = () => {
    setQuery("");
    setActive(
      Math.max(
        0,
        nodes.findIndex((node) => node.url === value)
      )
    );
    setOpen(true);
  };
  const pick = (url: string) => {
    onPick(url);
    setOpen(false);
  };
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return show();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + options.length) % Math.max(1, options.length));
    } else if (event.key === "Enter" && open && options[current]) {
      event.preventDefault();
      pick(options[current].url);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={box} className="tu-field tu-node" data-open={open || undefined}>
      <small>Node</small>
      <input
        role="combobox"
        aria-label="Node"
        aria-expanded={open}
        aria-controls="tu-nodes"
        aria-autocomplete="list"
        aria-activedescendant={open && options[current] ? `tu-node-${current}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={open ? "Search, or type an address" : "Pick a node"}
        value={open ? query : (picked?.name ?? (value ? hostOf(value) : ""))}
        onFocus={show}
        onClick={() => !open && show()}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKey}
        onBlur={(event) => {
          if (!box.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      />
      {!open && picked && <em>{hostOf(picked.url)}</em>}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="m4 6 4 4 4-4" />
      </svg>
      {open && (
        <ul ref={list} id="tu-nodes" role="listbox" aria-label="Nodes" className="tu-list">
          {options.map((option, index) => (
            <li
              key={option.url}
              id={`tu-node-${index}`}
              role="option"
              aria-selected={option.url === value}
              data-active={index === current || undefined}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => index !== current && setActive(index)}
              onClick={() => pick(option.url)}
            >
              <b>{option.name || `Use ${hostOf(option.url)}`}</b>
              {option.name && (
                <span>
                  {hostOf(option.url)} · {option.models} {option.models === 1 ? "model" : "models"}
                </span>
              )}
            </li>
          ))}
          {options.length === 0 && (
            <li className="tu-none">{loading ? "Finding nodes…" : "No node by that name. Type its address."}</li>
          )}
        </ul>
      )}
    </div>
  );
}
