"use client";

const LANGS = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];

interface NavbarProps {
  lang: string;
  onLangChange: (lang: string) => void;
  connected: boolean;
}

export default function Navbar({ lang, onLangChange, connected }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-canton-border bg-canton-bg sticky top-0 z-50">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gradient-to-br from-canton-lime to-[#a3c93a] rounded-md flex items-center justify-center text-sm font-black text-black">
          C
        </div>
        <span className="text-base font-bold text-zinc-50">Canton Hub</span>
      </div>

      <div className="flex gap-1">
        <a className="text-sm px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-50" href="#">Dashboard</a>
        <a className="text-sm px-3 py-1.5 rounded-md text-zinc-600 cursor-not-allowed" href="#">Analytics</a>
        <a className="text-sm px-3 py-1.5 rounded-md text-zinc-600 cursor-not-allowed" href="#">Feed</a>
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
