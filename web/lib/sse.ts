"use client";
import { useEffect, useRef, useState } from "react";
import type { PriceData } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useRealtimePrice(fallback: PriceData | undefined) {
  const [price, setPrice] = useState<PriceData | undefined>(fallback);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API}/api/sse/price`);
    sourceRef.current = es;

    es.addEventListener("price", (e) => {
      try {
        setPrice(JSON.parse(e.data));
        setConnected(true);
      } catch { /* ignore parse errors */ }
    });

    es.onerror = () => setConnected(false);
    es.onopen = () => setConnected(true);

    return () => es.close();
  }, []);

  const data = price ?? fallback;
  return { data, connected };
}
