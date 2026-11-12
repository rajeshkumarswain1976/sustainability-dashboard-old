import pandas as pd
from pathlib import Path

from scripts.validate_synthetic_datasets import validate_folder
from scripts.generate_synthetic_datasets import expand_events


def test_active_synthetic_dataset_passes_full_validation():
    assert validate_folder(strict=True) == []


def test_sustainability_factors_are_derived_bounded_and_provenanced():
    frame = pd.read_csv(Path(__file__).resolve().parents[1] / "datasets" / "sustainability.csv")
    scores = [column for column in frame if column.endswith("_score")]
    assert len(scores) == 10
    assert frame[scores].notna().all().all()
    assert frame[scores].apply(lambda series: series.between(0, 100).all()).all()
    assert frame[scores].nunique().gt(1).all()
    assert frame["data_source"].eq("synthetic_derived").all()
    assert (frame["sustainability_score"] - frame[[column for column in scores if column != "sustainability_score"]].mean(axis=1)).abs().max() < 0.02


def test_validation_rejects_duplicate_keys_and_non_synthetic_provenance(tmp_path):
    pd.DataFrame([
        {"incident_id": "INC1", "timestamp": "2026-01-01 00:00:00+05:30", "data_source": "measured"},
        {"incident_id": "INC1", "timestamp": "2026-01-01 01:00:00+05:30", "data_source": "synthetic"},
    ]).to_csv(tmp_path / "safety_incidents.csv", index=False)
    errors = validate_folder(tmp_path, strict=False)
    assert any("duplicate keys" in item for item in errors)
    assert any("non-synthetic provenance" in item for item in errors)


def test_validation_rejects_unapproved_missing_values(tmp_path):
    pd.DataFrame([{
        "building_id": "B1", "building_label": None, "data_source": "synthetic_assumed",
    }]).to_csv(tmp_path / "registry_buildings.csv", index=False)
    errors = validate_folder(tmp_path, strict=True)
    assert any("registry_buildings.building_label" in item for item in errors)


def test_safety_event_resampling_is_repeatable_for_fixed_seed():
    source = pd.DataFrame([{
        "incident_id": "INC00001", "timestamp": "2026-08-17 00:00:00+05:30",
        "data_source": "synthetic", "location": "North Walk",
    }])
    start = pd.Timestamp("2025-11-11 00:00:00+05:30")
    end = pd.Timestamp("2026-11-10 23:00:00+05:30")
    assert expand_events("safety_incidents", source, start, end, __import__("random").Random(73)).equals(
        expand_events("safety_incidents", source, start, end, __import__("random").Random(73))
    )
