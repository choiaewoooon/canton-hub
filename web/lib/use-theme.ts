"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "canton-hub-theme";
const DEFAULT_THEME: Theme = "dark";

/**
 * Theme hook — reads/writes localStorage and toggles `.dark` class on <html>.
 * The actual initial class is applied by a blocking script in layout.tsx to
 * prevent flash-of-wrong-theme; this hook only reflects and updates state
 * after mount.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
      const root = document.documentElement;
      if (next === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggleTheme };
}
