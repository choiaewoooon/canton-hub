"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "canton-hub-lang";
const DEFAULT_LANG = "ko";

export function useLang() {
  const [lang, setLangState] = useState<string>(DEFAULT_LANG);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      setLangState(stored);
    }
  }, []);

  const setLang = (next: string) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  return [lang, setLang] as const;
}
