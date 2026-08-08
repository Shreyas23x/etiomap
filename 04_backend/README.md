# 04 — FastAPI Backend

One API over both prediction engines:

| Engine | Direction | Source | Status |
|---|---|---|---|
| **network** | chemical ↔ disease via shared KEGG pathways | `data/network_data.json` | ✅ works now (real data) |
| **model** | disease → chemical (XGBoost) | `data/model_artifacts/` | ⚙ active once you add artifacts |

## Run
```bash
cd 04_backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/ for the demo UI, or http://127.0.0.1:8000/docs for Swagger.

## Endpoints
- `GET /api/health` — status + whether the model is loaded
- `GET /api/diseases` — all diseases
- `GET /api/disease/{disease}/chemicals?source=network|model&limit=20&novel_only=false`
  — ranked chemicals for a disease
- `GET /api/chemical/{name}/diseases` — diseases linked to a chemical
- `GET /api/network?disease=...&max_edges=150` — graph nodes/links (common-name labels)

## Enabling the model endpoint
1. Run `02_model/disease_chemical_model.ipynb` in Colab (its last cell exports
   `model_artifacts/`).
2. Copy that folder to `04_backend/data/model_artifacts/`.
3. Restart uvicorn → `source=model` now returns XGBoost rankings. Until then the
   API serves the network engine and `source=model` returns 503.

## ⚠ Reminder — merge with your own mockup
`static/index.html` is a **minimal reference UI** so the API is usable out of the
box. Per your note: **we still need to bring in your existing mockup and merge it
with this backend.** The front end only needs these JSON endpoints, so your mockup
can replace `static/index.html` and call the same `/api/*` routes.

## Tested
The `network` engine and all query logic were run and verified with the real
seed data. The FastAPI/uvicorn layer is syntax-checked; install the requirements
to serve it (this environment has no network for pip, so it couldn't be booted
here).
