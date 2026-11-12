import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "deployment" / "frontend"))

from server.agent.copilot import _question_domains


def test_data_question_selects_only_requested_domains():
    assert _question_domains("Explain energy and water use", ["energy", "water", "waste"]) == ["energy", "water"]


def test_sustainability_score_question_selects_sustainability():
    assert _question_domains("Why is the sustainability score changing?", ["energy", "sustainability"]) == ["sustainability"]


def test_unavailable_domain_is_not_selected():
    assert _question_domains("How is the campus parking delay?", ["energy", "water"]) == []
