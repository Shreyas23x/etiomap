# EtioMap — project handoff

A continuation guide so a fresh session (human or Claude) can pick up the project
with full context. EtioMap maps **environmental chemicals → respiratory diseases**
two independent ways — a trained ML model and a biological-pathway network — and
serves both behind one API with a React front end.

---

## 1. How to run it locally (exact commands)

Two servers. Open **two terminals**.

**Terminal 1 — backend API (FastAPI, needs Python with xgboost):**
```
cd "C:\Users\Shreyas\Desktop\Claude Capstone\Chemical Disease Associations\04_backend"
python -m uvicorn app.main:app --port 8000 --reload
```
(Use the same `python` that has xgboost/fastapi installed — on this machine that is
the Microsoft-Store Python 3.11 that `python` resolves to in a normal terminal.)

**Terminal 2 — front end (Vite/React):**
```
cd "C:\Users\Shreyas\Desktop\Claude Capstone\Chemical Disease Associations\05_frontend"
npm install        # first time only
npm run dev
```
Then open **http://localhost:5173**. Vite proxies `/api/*` to the backend on
`:8000` (see `05_frontend/vite.config.js`), so both must be running.

Health check: `http://127.0.0.1:8000/api/health` → `{"status":"ok","model_ready":true,...}`.

---

## 2. Repository layout

```
Chemical Disease Associations/
  _data/                         source CSVs (CTD per-disease + master sheet) + kegg_enrichment_all.csv
  _cache/                        cached PubChem CID map, KEGG name maps, coverage scripts
  01_data_comparison/            full 0/1 grid vs actual + FINDINGS.md + comparison harness
  02_model/                      run_model_local.py + model_artifacts/ (trained XGBoost + features)
  03_network/                    network build scripts + network_data_v2.json + network_full.json
  04_backend/                    FastAPI app (app/*.py), data/ (artifacts copied here), static/ (old demo)
  05_frontend/                   Vite + React app (the real website)
  RESULTS.md                     headline numbers and methodology
  HANDOFF.md                     this file
```

## 3. Data + pipeline

- **Source:** CTD (Comparative Toxicogenomics Database) curated chemical–disease
  associations for **6 respiratory diseases** (Asthma, Pneumonia, COPD, Bronchitis,
  Allergic rhinitis, Bronchogenic carcinoma) → **474 unique chemicals**, 609 pairs.
  Master file: `_data/Respiratory Diseases - Sheet1 (1).csv` (has PubMed IDs +
  DirectEvidence per pair).
- **Model features:** each chemical resolved to a PubChem CID, then 8 molecular
  descriptors fetched (MW, XLogP, TPSA, H-bond donors/acceptors, rotatable bonds,
  heavy atoms, complexity). `02_model/run_model_local.py` (cache in `_cache/`).
- **Network:** built from the MetaboAnalyst-style **KEGG enrichment** file
  (`_data/kegg_enrichment_all.csv`) — the authoritative compound→pathway mapping
  with FDR. `03_network/rebuild_network_enrichment.py` keeps only FDR-significant,
  specific pathways, **excludes currency/cofactor metabolites** (Oxygen, CO2, ATP,
  NAD(P)(H), H2O, Pi… — see the `CURRENCY` set; they spuriously link to everything),
  tags each compound (environmental / drug / endogenous / other), and emits
  `network_data_v2.json`. `03_network/enrich_network_full.py` then attaches CTD
  PubMed sources + model scores → `04_backend/data/network_full.json`.
  Current size: **44 compounds, 150 edges** (≈60 known + ≈90 novel candidates).

## 4. The model (XGBoost)

- Trained on `disease one-hot + chemical descriptors` → P(association); works both
  directions (rank chemicals for a disease, or score a chemical across diseases).
- **Validation:** 5-fold **StratifiedGroupKFold grouped by chemical** — test
  chemicals never appear in their training fold. Held-out **ROC-AUC ≈0.81**
  (vs ≈0.73 for a leaky random-pair split). The labels are known CTD curations; the
  chemical is hidden from the model during training and revealed only to score.
- Artifacts in `02_model/model_artifacts/` (and copied to `04_backend/data/model_artifacts/`):
  `xgb_disease_chemical.json`, `feature_cols.json`, `diseases.json`,
  `chemical_features.csv`, `metrics.json`, `full_grid_predictions.csv`.

## 5. Backend (`04_backend/app/`)

- `main.py` — FastAPI routes: `/api/health`, `/api/diseases`, `/api/classes`,
  `/api/disease/{d}/chemicals?source=network|model&classes=…`,
  `/api/chemical/{name}/diseases`, `/api/network`, `/api/network/full`,
  `/api/score` (POST names), `/api/score/csv` (POST file).
- `network.py` — serves `network_data.json`; **note `_load()` is `@lru_cache`, so
  restart the backend after regenerating the network data.**
- `model.py` — loads XGBoost artifacts, `rank_chemicals(disease)`, attaches `known`+sources.
- `score.py` — scores arbitrary compounds via live PubChem lookup + the model.
- `sources.py` — CTD ground-truth lookup (known pair → PubMed citations + evidence).

## 6. Front end (`05_frontend/src/`)

- Vite + React Router. Pages: `Home`, `Analyze` (by disease / by compound / upload
  list), `Explorer` (Cytoscape graph), `About` (model vs network + FAQs incl. the
  validation-split explanation).
- Theme: light "Swiss-Modernism" (`theme.css`). Fonts: **Newsreader** (display),
  **Libre Franklin** (body), **IBM Plex Mono** (data) — loaded in `index.html`.
- Explorer features: 6 disease **circular** hubs on a fixed ring, force-laid
  chemicals; filters (class / known-novel / significance / focus disease);
  click-to-focus (dims others, never hides); **expand pathways** (chemical→pathway→
  disease, capped to 14, animates into view); **group select** (box-drag / select-all)
  + CSV download with optional model-score column. Known edges = solid emerald,
  novel = dashed gray.
- Dev-only `window.__cy` is exposed (`import.meta.env.DEV`) for debugging.

## 7. Gotchas / lessons

- Restart the backend after changing `network_data.json` (lru_cache).
- In `Explorer.jsx`, `update()` sets `fRef` **synchronously** before `setF` so
  Cytoscape-event handlers (not React events) don't hit a stale-state race.
- KEGG `find/compound` returns **bare** ids (no `cpd:` prefix) and the old
  "first hit" matching mis-mapped Adenosine→ATP, Carbon→CO2 — the network is now
  built from the curated enrichment file's correct ids instead.
- `preview_screenshot` tends to time out on the live Cytoscape canvas; verify via
  `preview_eval` / `window.__cy` / `preview_inspect` instead.
- Backend needs xgboost (Store Python); the preview tool can't spawn the Store
  Python (EPERM) so a separate Python 3.11 has fastapi/uvicorn/pandas for previews.

## 8. Open items / roadmap

- **Group-selection** polish (a spawnable task chip exists).
- **More compounds / pathways** — RESEARCH DONE (`06_expansion/RESEARCH_EXPANSION.md`).
  Conclusion: a CTD pull expands the 474 by only **+73 chemicals (+15%)**, of which
  **just 25% are genuine environmental exposures**; the rest are research probes,
  therapeutics, antioxidants, or category terms. Recommend adopting the ~8 clean
  curated-refresh chemicals; do NOT bulk-add gene-inferred. (NB: CTD now needs the
  ALTCHA captcha solver in `06_expansion/ctd_client.py`.)
- **Genomic layer** — RESEARCH DONE (`06_expansion/RESEARCH_GENOMIC.md`). Feasible via
  CTD (the inferred rows already carry the gene mechanism), but inference is dominated
  by generic genes (TNF/IL6/IL1B link ~all chemicals) ⇒ non-specific, not causal.
  Recommend building chemical→gene→disease ONLY as an off-by-default, clearly-labelled
  "gene-inferred candidate" hypothesis layer (vetted env subset, gene = 3rd node tier),
  never folded into the model or curated counts. **Live integration not built — awaiting
  user sign-off.** Build artifacts: `06_expansion/{ctd_client,build_expansion,classify_new}.py`,
  `ctd_expanded_chem_disease.csv`, `expansion_summary.csv`.
- The shared-pathway method still surfaces some biologically loose novel candidates
  (pathway co-membership ≠ causation); they are clearly labelled "novel candidate".
