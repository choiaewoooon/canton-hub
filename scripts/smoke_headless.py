#!/usr/bin/env python3
"""헤드리스(claude -p) 전환 스모크 테스트 — Mac에서 실행.

실제 `claude -p`를 호출해 뉴스 요약+분류 / 트윗 분류가 정상 동작하는지(구독 인증 ·
바이너리 경로 · JSON 파싱까지) 한 번에 확인한다. API 키 불필요.

실행:
    cd ~/project/Ozzycanton/canton-hub
    venv/bin/python scripts/smoke_headless.py
"""
import asyncio
import sys
import time
from pathlib import Path

# repo 루트를 import 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from claude_cli import CLAUDE_BIN, run_claude  # noqa: E402
from news_summarizer import CATEGORY_KEYS, classify_text, summarize_and_classify  # noqa: E402


async def main() -> int:
    print(f"CLAUDE_BIN = {CLAUDE_BIN}")
    if not Path(CLAUDE_BIN).exists():
        print(f"  ⚠️  {CLAUDE_BIN} 가 없음 — CLAUDE_BIN 환경변수로 경로를 지정하세요.")

    # 1) 원시 claude -p 호출 (인증/경로 확인)
    t = time.perf_counter()
    raw = await run_claude("한 단어로만 답해. 정상 동작하면: OK")
    print(f"\n[1] run_claude        → {raw!r}   ({time.perf_counter() - t:.1f}s)")

    # 2) 실제 뉴스 1건 요약+분류 (전체 파이프라인)
    t = time.perf_counter()
    news = await summarize_and_classify(
        "Canton Network creator raises $355M in funding round led by a16z crypto",
        "Digital Asset, the developer behind Canton Network, raised $355 million "
        "led by a16z crypto with participation from ADIA and other institutions.",
    )
    print(f"[2] summarize+classify → {news}   ({time.perf_counter() - t:.1f}s)")

    # 3) 트윗 분류
    t = time.perf_counter()
    cat = await classify_text(
        "CIP-0112 Approved: Canton Token Standard V2 with privacy-enhanced batch settlement"
    )
    print(f"[3] classify_text     → {cat!r}   ({time.perf_counter() - t:.1f}s)")

    ok = bool(raw) and bool(news.get("summary_ko")) and news.get("category") in CATEGORY_KEYS
    print("\n결과:", "✅ 헤드리스 정상 동작 (API 없이 구독으로 요약됨)"
          if ok else "⚠️  일부 폴백 — 위 로그/`claude` 로그인 상태를 확인하세요.")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
