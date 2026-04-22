"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LiveDot from "./live-dot";
import ThemeToggle from "./theme-toggle";
import LanguageSelect from "./language-select";

const LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/analytics", label: "분석" },
  { href: "/feed", label: "피드" },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="ch-navbar">
      <div className="ch-nav-inner">
        <Link className="ch-logo" href="/">
          <div className="ch-logo-badge">C</div>
          <span className="ch-logo-name">Canton Hub</span>
        </Link>
        <div className="ch-nav-links">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`ch-nav-link${active ? " active" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="ch-nav-right">
          <LiveDot />
          <ThemeToggle />
          <LanguageSelect />
          <a
            className="ch-btn-nav"
            href="https://t.me/coblin_ibc"
            target="_blank"
            rel="noopener noreferrer"
          >
            💬 문의
          </a>
        </div>
      </div>
    </nav>
  );
}
