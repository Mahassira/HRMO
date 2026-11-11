# HRMO data platform

A small data pipeline and warehouse on top of HRMO: three sources are loaded, cleaned and shaped into a star schema, with data-quality checks on every run.

```bash
pip install -r requirements.txt
python generate_sources.py          # creates fictitious source files in sources/
python pipeline/run_pipeline.py     # loads them into warehouse.db and writes out/quality_report.md
python -m unittest discover -s tests -v
python benchmark.py
```

Full explanation: [English](../docs/en/data-pipeline.md) · [العربية](../docs/ar/data-pipeline.md)
