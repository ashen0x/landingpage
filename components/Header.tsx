"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { RoutstrMark } from "@/components/RoutstrMark";
import { useTheme } from "@/app/contexts/ThemeContext";
import "@/components/layout/shell.css";

type NavLink = { title: string; href: string; note?: string; external?: boolean };

export const CHAT_URL = "https://chat.routstr.com";
export const DOCS_URL = "https://docs.routstr.com";
export const GITHUB_URL = "https://github.com/Routstr";

const primary: NavLink[] = [
  { title: "Models", href: "/models" },
  { title: "Providers", href: "/providers" },
  { title: "Prices", href: "/prices" },
  { title: "Stats", href: "/stats" },
  { title: "Docs", href: DOCS_URL, external: true },
];

const more: NavLink[] = [
  { title: "Routstr Daemon", href: "/routstrd", note: "Routing for coding agents" },
  { title: "Hosted Daemon", href: "https://github.com/Routstr/routstrd-remote", note: "One daemon for a team", external: true },
  { title: "Top-Up", href: "/topup", note: "Fund an API key" },
  { title: "Capabilities", href: "/capabilities", note: "What Routstr can do" },
  { title: "Blog", href: "/blog", note: "Guides and release notes" },
  { title: "Roadmap", href: "/roadmap", note: "What comes next" },
];

function Item({ link, className, current, onClick }: { link: NavLink; className?: string; current?: boolean; onClick?: () => void }) {
  const body = (
    <>
      {link.title}
      {link.note && <span>{link.note}</span>}
    </>
  );
  return link.external ? (
    <a href={link.href} className={className} onClick={onClick}>
      {body}
    </a>
  ) : (
    <Link href={link.href} className={className} aria-current={current ? "page" : undefined} onClick={onClick}>
      {body}
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const root = useRef<HTMLElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    // the list opens under its own word
    if (moreButton.current) root.current?.style.setProperty("--more", `${moreButton.current.offsetLeft - 18}px`);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <header ref={root} className="hd" data-scrolled={scrolled || undefined} data-open={open || undefined}>
      <div className="hd-bar">
        <Link href="/" className="hd-brand" onClick={close}>
          <RoutstrMark />
          routstr
        </Link>

        <nav className="hd-nav" aria-label="Main">
          {primary.map((link) => (
            <Item key={link.href} link={link} className="hd-link" current={pathname.startsWith(link.href)} />
          ))}
          <button
            ref={moreButton}
            type="button"
            className="hd-link"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            More <ChevronDown />
          </button>
        </nav>

        <a href={GITHUB_URL} className="hd-link hd-quiet">
          GitHub
        </a>
        <button
          type="button"
          className="hd-icon hd-theme"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>
        <a href={CHAT_URL} className="hd-pill">
          Open chat <ArrowRight strokeWidth={1.5} />
        </a>
        <button
          type="button"
          className="hd-icon hd-menu"
          aria-expanded={open}
          aria-label={open ? "Close the menu" : "Open the menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="hd-panel">
          <div className="hd-panel-phone">
            {primary.map((link) => (
              <Item key={link.href} link={link} onClick={close} />
            ))}
          </div>
          {more.map((link) => (
            <Item key={link.href} link={link} onClick={close} />
          ))}
          <div className="hd-panel-phone">
            <button type="button" onClick={toggleTheme}>
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
