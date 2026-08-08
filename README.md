# Chemical–Disease Associations — Restructured Project

Predicting and explaining which chemicals are associated with respiratory
diseases, using two complementary engines built from the same CTD data.

```
01_data_comparison/  Full 0/1 grid vs. actual data + diagnosis of the old model
02_model/            Disease → chemical XGBoost model with REAL chemical features
03_network/          Combined chemical → disease network (pathway middleman removed)
04_backend/          FastAPI backend serving both, with a demo UI
_data/               Source CSVs (CTD exports)
```

## The story in one paragraph
The original XGBoost model scored low because its only inputs were the *identities*
of the chemical and disease — and 82% of chemicals appear with just one disease, so
there was nothing to generalise from (see `01_data_comparison/FINDINGS.md`). The fix
runs on two tracks: (1) give the model **real chemistry** — PubChem molecular
descriptors per chemical (`02_model`); and (2) link chemicals to diseases through
**shared biological pathways** instead of memorised IDs (`03_network`). The
`04_backend` API exposes both, returning ranked chemicals per disease and an
explorable chemical→disease graph labelled with common names.

## Status — everything below has now been run at full scale
See **`RESULTS.md`** for the headline numbers. All four stages were executed
locally against live PubChem + KEGG (not just the seed), artifacts are committed,
and the backend was verified end-to-end.

| Stage | Real output |
|---|---|
| Coverage | PubChem **383/474** CIDs · KEGG **290/474** IDs (after a second-pass resolver; the rest are MeSH category terms like "Air Pollutants" with no structure/pathway) |
| Model | Honest grouped-by-chemical **ROC-AUC ≈0.80**; full-grid 0/1 comparison **acc 0.883, F1 0.721** |
| Network | **290/474** chemicals mapped to KEGG → **366 edges** (135 known + 231 novel candidates), all 6 diseases |
| Backend | All endpoints live, `model_ready: true`, demo UI served |

> Coverage was expanded with `_cache/improve_coverage.py` (CAS retry + salt/qualifier
> stripping for PubChem; exact-match + cleaned-name + synonym aliases for KEGG).
> KEGG *drugs* are deliberately excluded — they only link to drug-class maps
> (e.g. "Macrolides"), not metabolic pathways, so including them would create
> meaningless shared-pathway edges.

## How to re-run / reproduce
Local runnable scripts (used here, cache to `_cache/` so PubChem/KEGG hit once):
1. `python 02_model/run_model_local.py` → `02_model/model_artifacts/`
2. `python 03_network/run_network_local.py` → `03_network/network_data.json`
3. `python 01_data_comparison/run_real_comparison.py` → real `prediction_comparison.xlsx`
4. `cd 04_backend && pip install -r requirements.txt && uvicorn app.main:app --reload`

The Colab notebooks (`*.ipynb`) contain the same logic for anyone running in Drive;
the `run_*_local.py` scripts are the desktop equivalents and produced the committed
artifacts.

## Open item — your website mockup
The backend is ready to merge with your own front-end mockup: it just needs the
`/api/*` endpoints (see `04_backend/README.md`). Share the mockup and it can
replace the reference `static/index.html`.
