"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/lib/use-theme";

const LANGS = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];

const NAV_ITEMS = {
  ko: [
    { href: "/", label: "대시보드" },
    { href: "/analytics", label: "분석" },
    { href: "/feed", label: "피드" },
  ],
  en: [
    { href: "/", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
    { href: "/feed", label: "Feed" },
  ],
  ja: [
    { href: "/", label: "ダッシュボード" },
    { href: "/analytics", label: "分析" },
    { href: "/feed", label: "フィード" },
  ],
  zh: [
    { href: "/", label: "仪表板" },
    { href: "/analytics", label: "分析" },
    { href: "/feed", label: "动态" },
  ],
};

const FEEDBACK_LABEL: Record<string, string> = {
  ko: "문의·피드백",
  en: "Feedback",
  ja: "問い合わせ",
  zh: "反馈",
};

const FEEDBACK_TITLE: Record<string, string> = {
  ko: "버그 제보·문의·피드백은 텔레그램으로 (@coblin_ibc)",
  en: "Bug reports, questions & feedback on Telegram (@coblin_ibc)",
  ja: "バグ報告・質問・フィードバックはTelegramへ (@coblin_ibc)",
  zh: "Bug 反馈与提问请联系 Telegram (@coblin_ibc)",
};

interface NavbarProps {
  lang: string;
  onLangChange: (lang: string) => void;
  connected: boolean;
}

export default function Navbar({ lang, onLangChange, connected }: NavbarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[lang as keyof typeof NAV_ITEMS] || NAV_ITEMS.en;
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const themeLabel =
    lang === "ko"
      ? theme === "dark"
        ? "라이트"
        : "다크"
      : theme === "dark"
        ? "Light"
        : "Dark";

  const feedbackLabel = FEEDBACK_LABEL[lang] || FEEDBACK_LABEL.en;
  const feedbackTitle = FEEDBACK_TITLE[lang] || FEEDBACK_TITLE.en;

  return (
    <nav className="border-b border-canton-border bg-canton-bg sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-2">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition shrink-0">
          <div className="w-8 h-8 rounded-md overflow-hidden ring-1 ring-canton-lime/30 shrink-0">
            <Image
              src="/logo-badkids.jpg"
              alt="Canton Hub"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <span className="text-base font-bold text-zinc-50 hidden sm:inline">Canton Hub</span>
        </Link>

        {/* Desktop nav (md+) */}
        <div className="hidden md:flex gap-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm px-3 py-1.5 rounded-md transition ${
                  active
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live indicator — hidden on xs */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs pr-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? "bg-canton-up animate-pulse" : "bg-zinc-600"
              }`}
            />
            <span className={connected ? "text-canton-up" : "text-zinc-600"}>
              {connected ? "Live" : "Offline"}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${themeLabel} mode`}
            title={`${themeLabel} mode`}
            className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs px-2 py-1.5 rounded-md hover:text-zinc-200 transition flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span aria-hidden className="text-sm leading-none">
              {theme === "dark" ? "☀" : "☾"}
            </span>
            <span className="hidden lg:inline">{themeLabel}</span>
          </button>

          {/* Language select */}
          <select
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            aria-label="Language"
            className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs px-2 py-1.5 rounded-md outline-none cursor-pointer shrink-0"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          {/* Feedback/Telegram */}
          <a
            href="https://t.me/coblin_ibc"
            target="_blank"
            rel="noopener noreferrer"
            title={feedbackTitle}
            aria-label={feedbackTitle}
            className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs px-2.5 py-1.5 rounded-md hover:text-canton-lime hover:border-canton-lime/40 transition flex items-center gap-1 shrink-0"
          >
            <span aria-hidden>💬</span>
            <span className="hidden lg:inline">{feedbackLabel}</span>
          </a>

          {/* Mobile hamburger (hidden on md+) */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="md:hidden bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm w-8 h-8 rounded-md hover:text-zinc-200 transition cursor-pointer shrink-0 flex items-center justify-center"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-canton-border bg-canton-bg">
          <div className="flex flex-col px-4 py-2 gap-1">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`text-sm px-3 py-2.5 rounded-md transition ${
                    active
                      ? "bg-zinc-800 text-zinc-50"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {/* Live indicator in mobile menu */}
            <div className="flex items-center gap-1.5 text-xs px-3 py-2 text-zinc-600">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? "bg-canton-up animate-pulse" : "bg-zinc-600"
                }`}
              />
              <span className={connected ? "text-canton-up" : "text-zinc-600"}>
                {connected ? "Live" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
