"""Compare stored Jev and rules decisions without sending new data to either provider."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_table, runtime_engine
from app.decision import jev


def report(rows: list[dict]) -> str:
    grouped = defaultdict(lambda: {"jev": [], "rules": []})
    for row in rows:
        if row["provider"] in {"jev", "rules"} and row["label"] is not None:
            grouped[(row["point"], row["state_hash"])][row["provider"]].append(row)
    per_point = defaultdict(list)
    for (point, _), providers in grouped.items():
        if providers["jev"] and providers["rules"]:
            j, r = providers["jev"][-1], providers["rules"][-1]
            per_point[point].append((j["label"] == r["label"], float(j["confidence"] or 0)))
    lines = ["Jev vs rules decision evaluation", "", "Agreement and probability bins use rules as a comparison proxy, not ground-truth calibration.",
             "A labeled validation set is required to measure true calibration.", ""]
    if not per_point:
        lines.append("No paired Jev/rules decisions found. Run replay with DECISION_PROVIDER=shadow, then rerun this script.")
    for point in sorted(jev.catalogue()["decisions"]):
        pairs = per_point[point]
        if not pairs:
            lines.append(f"{point}: n=0, agreement=not_evaluated, calibration=not_evaluated")
            continue
        agreement = sum(match for match, _ in pairs) / len(pairs)
        proxy_brier = sum((probability - int(match)) ** 2 for match, probability in pairs) / len(pairs)
        lines.extend([f"{point}: n={len(pairs)}, agreement={agreement:.3f}, proxy_brier={proxy_brier:.3f}, calibration=rules_proxy"])
        for lower, upper in ((0, 0.6), (0.6, 0.8), (0.8, 1.01)):
            group = [match for match, probability in pairs if lower <= probability < upper]
            if group:
                lines.append(f"  confidence [{lower:.1f},{min(upper, 1):.1f}]: n={len(group)}, proxy agreement={sum(group)/len(group):.3f}")
    return "\n".join(lines) + "\n"


def main() -> None:
    engine = runtime_engine()
    if engine is None:
        raise SystemExit("DATABASE_URL is required")
    table = get_table("decision_log")
    with Session(engine) as session:
        rows = [dict(row) for row in session.execute(select(table.c.point, table.c.state_hash, table.c.provider,
                                                             table.c.label, table.c.confidence)).mappings()]
    output = Path("docs/decision_eval.txt")
    output.write_text(report(rows), encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
