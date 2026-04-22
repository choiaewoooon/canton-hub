"use client";

import { useLang } from "@/lib/use-lang";

const LANGS: { value: string; label: string }[] = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

export default function LanguageSelect() {
  const [lang, setLang] = useLang();
  return (
    <select
      className="ch-btn-nav"
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label="Language"
    >
      {LANGS.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
