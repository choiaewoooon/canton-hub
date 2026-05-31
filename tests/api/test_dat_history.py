"""Tests for the DAT mNAV history append helper (hour-bucket dedup)."""
import importlib


def test_append_dat_history_dedups_by_hour(tmp_path, monkeypatch):
    import api.scheduler as sched
    importlib.reload(sched)
    monkeypatch.setattr(sched, "_DAT_HISTORY_FILE", tmp_path / "dat_history.json")

    # same hour bucket → overwrite (one point kept per ticker per hour)
    sched._append_dat_history("CNTN", "2026-06-01T10:05:00+00:00", 1.40)
    sched._append_dat_history("CNTN", "2026-06-01T10:55:00+00:00", 1.45)
    hist = sched._load_dat_history()
    cntn = [p for p in hist if p["ticker"] == "CNTN"]
    assert len(cntn) == 1
    assert cntn[0]["mnav"] == 1.45  # latest within the hour wins

    # new hour bucket → append
    sched._append_dat_history("CNTN", "2026-06-01T11:01:00+00:00", 1.50)
    cntn = [p for p in sched._load_dat_history() if p["ticker"] == "CNTN"]
    assert len(cntn) == 2


def test_append_dat_history_skips_none_mnav(tmp_path, monkeypatch):
    import api.scheduler as sched
    importlib.reload(sched)
    monkeypatch.setattr(sched, "_DAT_HISTORY_FILE", tmp_path / "dat_history.json")
    sched._append_dat_history("CNTN", "2026-06-01T10:05:00+00:00", None)
    assert sched._load_dat_history() == []
