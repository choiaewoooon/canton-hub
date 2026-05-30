"use client";

import { useEffect, useState } from "react";

/**
 * 일정 간격으로 현재 시각(ms)을 갱신해 상대시간 표시를 실시간으로 흐르게 한다.
 * 데이터 재요청과 무관하게 "N분 전" 같은 라벨이 멈추지 않도록 컴포넌트를 리렌더한다.
 */
export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
