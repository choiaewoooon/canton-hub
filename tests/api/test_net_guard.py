"""
net_guard(호스트 단위 DNS/연결 서킷 브레이커) 테스트.

회귀 대상 사고(2026-07-29): api.bybit.com의 getaddrinfo가 30초 행 →
uvloop의 libuv 스레드풀(기본 4개)이 포화 → 프로세스 안 모든 DNS가 굶어
CoinGecko·CantonScan까지 전부 ConnectTimeout. 자세한 경위는 net_guard 모듈 docstring 참조.
"""
import httpx
import pytest

from collectors import net_guard


@pytest.fixture(autouse=True)
def _clean_state():
    net_guard.reset()
    yield
    net_guard.reset()


@pytest.fixture
def clock(monkeypatch):
    """테스트가 시간을 직접 굴릴 수 있게 단조 시계를 대체한다."""
    class Clock:
        def __init__(self):
            self.t = 1000.0

        def __call__(self):
            return self.t

        def advance(self, seconds):
            self.t += seconds

    c = Clock()
    monkeypatch.setattr(net_guard, "_clock", c)
    return c


# ---------------------------------------------------------------- 상태 로직


def test_fresh_host_is_not_blocked():
    assert net_guard.is_blocked("api.coingecko.com") is False


def test_host_is_blocked_after_connect_failure(clock):
    net_guard.record_failure("api.bybit.com")
    assert net_guard.is_blocked("api.bybit.com") is True


def test_cooldown_expires(clock):
    net_guard.record_failure("api.bybit.com")
    assert net_guard.is_blocked("api.bybit.com") is True

    clock.advance(net_guard.BASE_COOLDOWN + 1)
    assert net_guard.is_blocked("api.bybit.com") is False


def test_cooldown_escalates_on_repeated_failure(clock):
    """계속 죽은 호스트를 5초마다 두드리지 않도록 쿨다운이 늘어나야 한다."""
    net_guard.record_failure("api.bybit.com")
    first = net_guard.cooldown_remaining("api.bybit.com")

    clock.advance(first + 1)
    net_guard.record_failure("api.bybit.com")
    second = net_guard.cooldown_remaining("api.bybit.com")

    assert second > first
    assert second <= net_guard.MAX_COOLDOWN


def test_cooldown_is_capped(clock):
    for _ in range(20):
        net_guard.record_failure("api.bybit.com")
        clock.advance(net_guard.MAX_COOLDOWN + 1)
    net_guard.record_failure("api.bybit.com")
    assert net_guard.cooldown_remaining("api.bybit.com") <= net_guard.MAX_COOLDOWN


def test_success_clears_failure_streak(clock):
    net_guard.record_failure("api.kraken.com")
    clock.advance(net_guard.BASE_COOLDOWN + 1)

    net_guard.record_success("api.kraken.com")
    assert net_guard.is_blocked("api.kraken.com") is False

    # 스트릭이 초기화됐으니 다음 실패는 다시 최소 쿨다운이어야 한다.
    net_guard.record_failure("api.kraken.com")
    assert net_guard.cooldown_remaining("api.kraken.com") == pytest.approx(
        net_guard.BASE_COOLDOWN
    )


def test_hosts_are_independent(clock):
    net_guard.record_failure("api.bybit.com")
    assert net_guard.is_blocked("api.bybit.com") is True
    assert net_guard.is_blocked("api.coingecko.com") is False


# ---------------------------------------------------------------- 트랜스포트


def _request(url="https://api.bybit.com/v5/market/tickers"):
    return httpx.Request("GET", url)


class _RecordingTransport(httpx.AsyncBaseTransport):
    """inner 트랜스포트 스텁 — 호출 횟수를 세고 지정한 결과를 낸다."""

    def __init__(self, result):
        self.result = result
        self.calls = 0

    async def handle_async_request(self, request):
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


@pytest.mark.asyncio
async def test_transport_records_failure_on_connect_timeout(clock):
    inner = _RecordingTransport(httpx.ConnectTimeout("", request=_request()))
    tr = net_guard.GuardedTransport(inner)

    with pytest.raises(httpx.ConnectTimeout):
        await tr.handle_async_request(_request())

    assert net_guard.is_blocked("api.bybit.com") is True


@pytest.mark.asyncio
async def test_blocked_host_short_circuits_without_touching_network(clock):
    """핵심 회귀 방지: 쿨다운 중에는 inner 트랜스포트를 아예 호출하면 안 된다.

    요청이 나가지 않아야 libuv 스레드가 getaddrinfo에 잡히지 않는다.
    """
    inner = _RecordingTransport(httpx.ConnectTimeout("", request=_request()))
    tr = net_guard.GuardedTransport(inner)

    with pytest.raises(httpx.ConnectTimeout):
        await tr.handle_async_request(_request())
    assert inner.calls == 1

    for _ in range(5):
        with pytest.raises(net_guard.HostInCooldown):
            await tr.handle_async_request(_request())

    assert inner.calls == 1, "쿨다운 중 요청이 실제로 나갔다 — 스레드풀 포화가 재발한다"


@pytest.mark.asyncio
async def test_read_timeout_does_not_trip_breaker(clock):
    """읽기 지연은 서버가 느린 것 — 호스트를 차단하면 안 된다."""
    inner = _RecordingTransport(httpx.ReadTimeout("", request=_request()))
    tr = net_guard.GuardedTransport(inner)

    with pytest.raises(httpx.ReadTimeout):
        await tr.handle_async_request(_request())

    assert net_guard.is_blocked("api.bybit.com") is False


@pytest.mark.asyncio
async def test_http_error_status_does_not_trip_breaker(clock):
    """5xx는 연결이 된 것 — 차단 대상 아님."""
    inner = _RecordingTransport(httpx.Response(503, request=_request()))
    tr = net_guard.GuardedTransport(inner)

    resp = await tr.handle_async_request(_request())

    assert resp.status_code == 503
    assert net_guard.is_blocked("api.bybit.com") is False


@pytest.mark.asyncio
async def test_success_reopens_breaker(clock):
    inner = _RecordingTransport(httpx.ConnectTimeout("", request=_request()))
    tr = net_guard.GuardedTransport(inner)
    with pytest.raises(httpx.ConnectTimeout):
        await tr.handle_async_request(_request())

    clock.advance(net_guard.BASE_COOLDOWN + 1)
    inner.result = httpx.Response(200, request=_request())

    resp = await tr.handle_async_request(_request())
    assert resp.status_code == 200
    assert net_guard.is_blocked("api.bybit.com") is False


@pytest.mark.asyncio
async def test_make_client_returns_guarded_client():
    async with net_guard.make_client(timeout=5) as client:
        assert isinstance(client, httpx.AsyncClient)
        assert isinstance(client._transport, net_guard.GuardedTransport)
