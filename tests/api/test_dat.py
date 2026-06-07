"""Route tests for /api/analytics/dat."""
from fastapi.testclient import TestClient

from api.main import app


def test_dat_endpoint_200_and_shape():
    client = TestClient(app)
    resp = client.get("/api/analytics/dat")
    assert resp.status_code == 200
    data = resp.json()
    assert "companies" in data
    assert isinstance(data["companies"], list)
    assert "company_count" in data


def test_dat_empty_fallback_shape():
    """캐시 미스여도 빈 폴백 shape을 200으로 반환 (500 금지)."""
    client = TestClient(app)
    data = client.get("/api/analytics/dat").json()
    # company_count는 항상 존재하고 companies는 리스트
    assert isinstance(data.get("companies"), list)
    assert data.get("company_count") == len(data["companies"])
