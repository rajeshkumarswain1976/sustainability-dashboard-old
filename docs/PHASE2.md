# Phase 2: replay intelligence

The eight domain analyzers return current records, KPIs, candidates, hotspots, forecast references, context, and data-source classification. Candidates carry facts and replay context. The pipeline stores them as alerts with `status=candidate`, `level=NULL`, and `confidence=NULL`. It does not assign severity, choose actions, or call a decision provider.

Thresholds and holidays are configured in `config/sectors/college.yaml`. Energy spikes use the same hour and weekday from at least four prior weeks, a 2.5 standard-deviation threshold, and a standard-deviation floor of 5% of the median. The supplied October 7 overnight HVAC event is also annotated in the replay source, so its candidate facts state whether the numeric threshold or the replay annotation triggered it. October 9 heavy rain is a separate candidate from flood risk because the recorded flood-risk values remain below the configured threshold of 60.

Forecasts use `HistGradientBoostingRegressor` for building energy, campus water, and gate parking. A 7-day holdout compares model MAE with the same-hour-last-week baseline. The API serves the seasonal baseline whenever it has lower or equal MAE. Each response includes 24 future hours and a residual band. Models are retrained after at least 24 replay hours, or when replay seeks backward.

Replay controls: `POST /replay/start`, `/replay/pause`, `/replay/seek`, `/replay/speed`; `GET /replay/state`, `/stream`, and `/alerts`. `GET /stream?as_of=<IST timestamp>` emits one SSE tick. Without `as_of`, it streams from the stored cursor while replay is running. `GET /alerts` accepts `since` and `as_of` and only returns candidates visible by that replay time.

Run the Phase 2 tests with `.venv\Scripts\python.exe -m pytest tests/test_phase2.py -q`. They use an isolated SQLite database built from selected source rows. Apply the alert schema migration to Neon with `.venv\Scripts\python.exe -m app.db schema` using `DATABASE_URL_DIRECT`.
