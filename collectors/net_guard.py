"""
호스트 단위 DNS/연결 서킷 브레이커.

## 왜 필요한가 (2026-07-29 전체 마비 사고)

`api.bybit.com`의 `getaddrinfo`가 30초 동안 멈췄다가 gaierror로 실패했다
(한국망에서 이름 자체가 막힘 — `dig`는 즉시 응답하고 CNAME 대상인 CloudFront 주소는
0.03초에 풀리는데 이름으로는 30초 행). 여기서 프로세스 전체가 죽는 연쇄가 발생했다:

1. uvloop은 DNS를 **libuv 스레드풀에 넘긴다 — 기본 크기 4개**
2. httpx의 5초 타임아웃은 파이썬 쪽 await만 취소한다.
   **OS의 getaddrinfo는 취소가 불가능해 스레드는 30초 내내 잡혀 있다**
3. 실시간 가격 수집이 5초마다 bybit을 3번(spot/perp/funding) 두드렸다 →
   넣는 속도가 빠지는 속도(30초)를 앞질러 스레드풀이 영구 포화
4. **프로세스 안의 다른 모든 DNS가 그 뒤에 줄 서서 굶었다** →
   CoinGecko·Kraken·CantonScan·stooq·Yahoo까지 전부 ConnectTimeout
   → 대시보드의 가격·시총·거래량이 전부 N/A, 차트 4일 정지

당시 스택 샘플이 `uv__getaddrinfo_work → getaddrinfo → mdns_addrinfo → _mdns_search_ex`에
100% 잡혀 있었고, SYN_SENT 소켓은 0개였다(TCP 연결 시도조차 못 감).
매일 05:00 자동 재시작이 무력했던 것도 재시작 30초 뒤 다시 포화됐기 때문이다.

## 대책

죽은 호스트를 기억해 두고 쿨다운 동안 **요청을 아예 내보내지 않는다.**
요청이 나가지 않으면 libuv 스레드도 잡히지 않으므로, 한 거래소가 막혀도
나머지 수집기는 멀쩡히 돈다. 실패가 반복되면 쿨다운을 늘려 5초마다 두드리는 일을 막는다.

연결 단계 실패(ConnectError/ConnectTimeout)만 차단 대상이다.
읽기 지연(ReadTimeout)이나 5xx는 연결 자체는 된 것이므로 차단하지 않는다.

## 사용법

수집기에서 `httpx.AsyncClient(...)` 대신 `net_guard.make_client(...)`를 쓰면 된다.
쿨다운 중인 호스트는 `HostInCooldown`(= httpx.ConnectError 하위)으로 즉시 실패하므로,
"예외는 내부에서 삼키고 None 반환"이라는 수집기 규약(../CLAUDE.md §0)이 그대로 적용된다.
"""
import logging
import time

import httpx

logger = logging.getLogger(__name__)

# 첫 실패 후 쿨다운(초). 실패가 이어지면 2배씩 늘어난다.
BASE_COOLDOWN = 60.0
MAX_COOLDOWN = 900.0  # 15분

# 시계는 테스트에서 갈아끼울 수 있도록 모듈 속성으로 둔다.
_clock = time.monotonic

# host -> (blocked_until, 연속 실패 횟수)
_state: dict[str, tuple[float, int]] = {}

# 차단 대상으로 볼 예외 — "그 호스트에 붙지 못했다"는 신호만 고른다.
_CONNECT_FAILURES = (httpx.ConnectError, httpx.ConnectTimeout)


class HostInCooldown(httpx.ConnectError):
    """쿨다운 중인 호스트로 요청이 시도됐을 때 즉시 발생. 네트워크로 나가지 않는다."""


def reset() -> None:
    """서킷 상태 전체 초기화 (테스트/수동 복구용)."""
    _state.clear()


def _cooldown_for(streak: int) -> float:
    return min(BASE_COOLDOWN * (2 ** (streak - 1)), MAX_COOLDOWN)


def cooldown_remaining(host: str) -> float:
    """해당 호스트가 앞으로 몇 초 더 차단되는지. 차단 중이 아니면 0."""
    entry = _state.get(host)
    if not entry:
        return 0.0
    return max(0.0, entry[0] - _clock())


def is_blocked(host: str) -> bool:
    return cooldown_remaining(host) > 0


def record_failure(host: str) -> None:
    """연결 실패를 기록하고 쿨다운을 건다(반복될수록 길어짐)."""
    _, streak = _state.get(host, (0.0, 0))
    streak += 1
    cooldown = _cooldown_for(streak)
    _state[host] = (_clock() + cooldown, streak)
    logger.warning(
        f"net_guard: {host} 연결 실패 {streak}회 → {cooldown:.0f}초간 호출 차단 "
        f"(이 호스트 때문에 다른 수집기까지 멈추는 것을 막기 위함)"
    )


def record_success(host: str) -> None:
    """살아난 호스트의 실패 스트릭을 지운다."""
    if _state.pop(host, None) is not None:
        logger.info(f"net_guard: {host} 복구됨 — 차단 해제")


class GuardedTransport(httpx.AsyncBaseTransport):
    """실제 트랜스포트를 감싸 호스트별 서킷을 적용한다."""

    def __init__(self, inner: httpx.AsyncBaseTransport):
        self._inner = inner

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        host = request.url.host

        if is_blocked(host):
            # 여기서 끝낸다 — DNS 조회조차 하지 않으므로 libuv 스레드가 잡히지 않는다.
            raise HostInCooldown(
                f"{host} 쿨다운 중 ({cooldown_remaining(host):.0f}초 남음)",
                request=request,
            )

        try:
            response = await self._inner.handle_async_request(request)
        except _CONNECT_FAILURES:
            record_failure(host)
            raise

        record_success(host)
        return response

    async def aclose(self) -> None:
        await self._inner.aclose()


def make_client(**kwargs) -> httpx.AsyncClient:
    """서킷 브레이커가 걸린 AsyncClient. `httpx.AsyncClient(...)`와 인자 호환."""
    inner = httpx.AsyncHTTPTransport()
    return httpx.AsyncClient(transport=GuardedTransport(inner), **kwargs)
