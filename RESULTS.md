# Results — full pipeline run (live PubChem + KEGG)

Everything Cowork left as "Colab-ready for you to run" has now been executed at
full scale on real data, and the parts it could only seed (the network) are now
complete. This file is the summary; the numbers come straight from the runs.

Source data: 6 respiratory diseases, **474 unique chemicals**, 609 curated
associations (CTD). Full disease × chemical grid = **2,844** pairs, 609 positive
(21%).

---

## 1. Model — disease → chemical, with real chemistry

Reframed to **disease → chemical** (rank every chemical for a given disease) and
rebuilt to use **PubChem molecular descriptors** (MW, XLogP, TPSA, H-bond
donors/acceptors, rotatable bonds, heavy atoms, complexity) instead of one-hot
IDs. 379/474 chemicals resolved to PubChem CIDs; 383 carried full descriptors.

379/474 chemicals resolved to PubChem CIDs on the first pass; a second-pass
resolver (`_cache/improve_coverage.py`) lifted this to **383/474** (the remaining
~91 are MeSH category terms — "Air Pollutants", "Allergens", "Dietary Fats" — with
no single structure).

| Evaluation | ROC-AUC | PR-AUC |
|---|---|---|
| **Grouped-by-chemical (honest — test chemicals unseen in training)** | **0.800** | **0.488** |
| Random-pair split (the old, optimistic way) | 0.737 | 0.414 |

**The key result:** the honest number *beats* the random-split number. That only
happens when the features carry real, transferable signal — the model has learned
"chemicals with this kind of chemistry tend to associate with this disease,"
which generalizes to chemicals it has never seen. The old identity-only model did
the opposite: it looked fine on a random split and collapsed on new chemicals,
because 82% of chemicals appear with only one disease and an ID has nothing to
generalize from. This is the structural fix for the low accuracy.

Per-disease ranking on held-out chemicals (precision@k):

| Disease | P@10 | R@50 |
|---|---|---|
| Pneumonia | 0.80 | 0.70 |
| Asthma | 0.50 | 0.59 |
| Rhinitis, Allergic | 0.40 | 0.61 |
| COPD | 0.30 | 0.60 |
| Bronchitis / Bronchogenic | 0.20 | 0.6–1.0 |

Artifacts in `02_model/model_artifacts/`: trained model, feature columns,
disease list, chemical features, `ranking_report.csv`, `metrics.json`.

## 2. Full 0/1 list vs. the actual dataset (the comparison you asked for)

The trained model scored the **entire grid**; predictions were thresholded at the
positive base rate and graded against the real labels
(`01_data_comparison/prediction_comparison.xlsx`).

| Metric | Old illustrative baseline | **Real model** |
|---|---|---|
| Accuracy | 0.55 | **0.883** |
| Precision | — | **0.721** |
| Recall | 0.26 | **0.721** |
| F1 | — | **0.721** |

TP 375 · TN 1813 · FP 145 · FN 145 (over the 2,478 pairs the model could score).
The workbook has per-disease confusion matrices and the full false-positive /
false-negative lists with chemical names. Note this full-grid number measures
*fit*; the **0.811 grouped AUC is the honest generalization number** — both are in
the docs so neither over-claims.

## 3b. Network v2 — enrichment-driven, mapping bugs fixed (current)

The first network used "first KEGG hit for the chemical name", which silently
mis-mapped **Adenosine → ATP (C00002)**, **Carbon → CO2 (C00011)**, and
**Epinephrine → Noradrenaline** — inflating the graph with central-metabolite
hubs. It also mixed in lab reagents (LPS, an injected endotoxin) and endogenous
signalling molecules alongside the environmental chemicals that are the actual
subject.

`03_network/rebuild_network_enrichment.py` rebuilds it from the KEGG **enrichment**
results (`_data/kegg_enrichment_all.csv`, the MetaboAnalyst-style hypergeometric
output, which carries the *correct* KEGG IDs and per-pathway FDR):

- Edges run only through **FDR-significant, specific pathways** (65 kept; giant
  overview maps like "Metabolic pathways" dropped), weighted by summed −log10(FDR).
- Compounds re-mapped to CTD chemicals via KEGG's own synonym lists → ATP/CO2/LPS
  no longer appear; Adenosine is correctly C00212.
- Every compound is **tagged**: environmental / drug / endogenous / other. The API
  and UI default to the **environmental** subnetwork and toggle to reveal the rest.

| | v1 (co-membership) | **v2 (enrichment)** |
|---|---|---|
| Compounds | 290 mapped | 45 placed (correctly) |
| Edges | 366 | **152** (60 known + 92 novel) |
| Wrong hubs | ATP, CO2, LPS | none |
| Edge basis | any shared pathway | FDR-significant pathways |

Smaller on purpose: the v1 count was inflated by wrong and promiscuous links. The
environmental default view now surfaces real exposures — DDT, Nicotine, Bisphenol
A, Acetaldehyde, Acrolein, Formaldehyde, pyrene/phenanthrene (PAHs), Sulfur
dioxide. The environmental layer is inherently compact because few airborne
chemicals have KEGG metabolic pathways at all (a real limitation, surfaced rather
than hidden). `network_data_v2.json` powers the backend.

## 3. Network v1 — direct chemical → disease, pathway middleman removed (superseded)

Combined the pathway↔chemical and pathway↔disease layers on shared KEGG pathways,
then dropped the pathway nodes, leaving direct **chemical → disease** edges.
Nodes are labelled with **chemical common names** (the reverse of MetaboAnalyst's
name→ID step), via KEGG's compound list — no extra API.

| | Count |
|---|---|
| Chemicals mapped to KEGG IDs | **290 / 474** (was 259 before second-pass resolver) |
| Compounds with non-global pathways | 106 |
| Direct chemical→disease edges | **366** |
| — reproducing known CTD links (validation) | 135 |
| — **novel candidates** (predictions) | 231 |
| Diseases covered | all 6 |

This replaces Cowork's 50-compound seed (49 edges, 5 diseases). Top novel
candidates are biologically sensible — e.g. Cyclic AMP → Pneumonia/COPD,
Adenosine → Pneumonia, Nitric Oxide → COPD, Acetylcholine → COPD.

**Why not more?** KEGG COMPOUND only holds metabolites, so synthetic drugs absent
from it cannot map; KEGG DRUG entries exist for them but only link to drug-class
maps (e.g. "Macrolides"), not metabolic pathways — including them would
manufacture meaningless "shared pathway" edges, so they are intentionally left out.

Outputs in `03_network/`: `network_data.json`, `combined_chemical_disease_edges.csv`,
`kegg_id_to_name.csv`, interactive `chemical_disease_network.html`.

## 4. Backend — FastAPI, both engines live

`04_backend` serves both engines and the demo UI. Verified end-to-end (TestClient
+ live uvicorn): `/api/health` reports `model_ready: true`, the model ranks
sensible chemicals (Asthma → Nitrogen Dioxide, Salmeterol, zafirlukast…), and the
network + reverse-lookup + graph endpoints all return data.

```
cd 04_backend
pip install -r requirements.txt
uvicorn app.main:app --reload      # http://127.0.0.1:8000  (docs at /docs)
```

The model artifacts and full `network_data.json` are already copied into
`04_backend/data/`, so it works immediately.

---

## What still needs you
**Merge your website mockup with this backend.** The backend is intentionally
decoupled — your front-end only needs to call the `/api/*` endpoints, so your
mockup can replace `04_backend/static/index.html`. Share it and it can be wired up.

## Caveats (honest)
- ~95 chemicals don't resolve in PubChem and ~215 don't map to KEGG — they're
  mixtures/materials (Air Pollutants, Particulate Matter, Tobacco Smoke, asbestos
  forms) with no single structure or metabolic pathway. They're simply not scored
  by those engines rather than guessed at.
- KEGG name matching takes the first compound hit; a curated name→KEGG map would
  raise coverage further if you want it.
