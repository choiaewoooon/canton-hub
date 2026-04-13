"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

interface NavbarProps {
  lang: string;
  onLangChange: (lang: string) => void;
  connected: boolean;
}

export default function Navbar({ lang, onLangChange, connected }: NavbarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[lang as keyof typeof NAV_ITEMS] || NAV_ITEMS.en;

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-canton-border bg-canton-bg sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition">
        <div className="w-7 h-7 bg-gradient-to-br from-canton-lime to-[#a3c93a] rounded-md flex items-center justify-center text-sm font-black text-black">
          C
        </div>
        <span className="text-base font-bold text-zinc-50">Canton Hub</span>
      </Link>

      <div className="flex gap-1">
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

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-canton-up animate-pulse" : "bg-zinc-600"}`} />
          <span className={connected ? "text-canton-up" : "text-zinc-600"}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        <select
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs px-2 py-1.5 rounded-md outline-none cursor-pointer"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        <a
          href="https://t.me/"
          target="_blank"
          rel="noopener"
          className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs px-3 py-1.5 rounded-md hover:text-zinc-200 transition"
        >
          Telegram
        </a>
      </div>
    </nav>
  );
}
