# Generated campus datasets

`generate_all.py` creates the CSVs in this folder for 1,296 hourly timestamps from 2026-08-17 through 2026-10-09 (Asia/Kolkata).

- Building energy is derived from the included measured source at `energy_dataset/energy_dataset/all_buildings_power.csv`. The historical hourly pattern is replayed over the output window; it is not a live 2026 meter feed.
- Weather, air quality, occupancy, water, waste, traffic, assets, safety events, and registry assumptions are synthetic. Weather and air quality are populated even when optional API files are absent.
- Derived tables are linked to those inputs and preserve the generator's allocation and consistency checks. Blank event timestamps or IDs mean “not applicable” for that row, such as no pickup or no predicted overflow.
- `validation_report.txt` records coverage, row counts, and cross-table checks.

These are realistic synthetic dashboard datasets, not a substitute for live campus measurements.
