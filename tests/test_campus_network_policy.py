import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "deployment" / "frontend"))
from server.campus_auth import campus_check, require_campus


def request_from(host):
    return SimpleNamespace(client=SimpleNamespace(host=host))


def test_off_campus_reporting_is_allowed_by_default(monkeypatch):
    monkeypatch.delenv("CARE_REQUIRE_CAMPUS_NETWORK", raising=False)
    monkeypatch.delenv("CAMPUS_IP_CIDRS", raising=False)
    monkeypatch.setenv("DASHBOARD_DEMO_MODE", "false")
    request = request_from("203.0.113.7")

    assert campus_check(request)["submission_allowed"] is True
    require_campus(request)


def test_campus_network_restriction_remains_an_opt_in(monkeypatch):
    monkeypatch.setenv("CARE_REQUIRE_CAMPUS_NETWORK", "true")
    monkeypatch.delenv("CAMPUS_IP_CIDRS", raising=False)
    monkeypatch.setenv("DASHBOARD_DEMO_MODE", "false")
    request = request_from("203.0.113.7")

    assert campus_check(request)["submission_allowed"] is False
    with pytest.raises(HTTPException) as error:
        require_campus(request)
    assert error.value.status_code == 403
