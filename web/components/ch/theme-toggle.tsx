"use client";

import { useTheme } from "@/lib/use-theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      className="ch-btn-nav"
      onClick={toggleTheme}
      aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      <span>{dark ? "\u2600" : "\u263E"}</span>
      <span>{dark ? "라이트" : "다크"}</span>
    </button>
  );
}
