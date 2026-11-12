import pandas as pd
from sqlalchemy import Float, String

from app.db import _domain_column_type
from app.analytics.repository import _normalize_sustainability_scores


def test_neon_text_backed_sustainability_scores_use_string_result_types():
    for column in ("climate_score", "sustainability_score"):
        assert isinstance(_domain_column_type("sustainability", column, ["62.19"]), String)
    assert isinstance(_domain_column_type("energy_floor_hourly", "energy_kwh", ["12.5"]), Float)


def test_neon_text_backed_sustainability_scores_are_normalized_after_fetch():
    frame = pd.DataFrame({
        "climate_score": ["62.19", "not-a-score"],
        "sustainability_score": ["58.54", "50.0"],
    })

    result = _normalize_sustainability_scores(frame)

    assert result["climate_score"].iloc[0] == 62.19
    assert pd.isna(result["climate_score"].iloc[1])
    assert result["sustainability_score"].iloc[0] == 58.54
    assert pd.api.types.is_numeric_dtype(result["sustainability_score"])
