# 02 — Disease → Chemical Model

`disease_chemical_model.ipynb` — open in Google Colab, run top to bottom.

## What changed vs. the old notebook
- **Direction:** disease → chemical. `rank_chemicals_for_disease("Asthma")` returns
  the top candidate chemicals, which is what the website needs.
- **Real features:** each chemical now carries 8 PubChem molecular descriptors
  (MW, XLogP, TPSA, H-bond donors/acceptors, rotatable bonds, heavy atoms,
  complexity) instead of a one-hot ID. This is the actual fix for low accuracy —
  the model can now generalise from chemistry to chemicals it has never seen.
- **Honest evaluation:** a *grouped* split on `ChemicalID` (test chemicals unseen
  in training). The notebook prints both the grouped score and the old
  random-pair score so you can see how much the old setup was inflated.
- **Ranking metrics:** precision@k / recall@k per disease.
- **Artifacts exported** to `model_artifacts/` for the FastAPI backend:
  `xgb_disease_chemical.json`, `feature_cols.json`, `diseases.json`,
  `chemical_features.csv`.

## Notes
- PubChem CID resolution (cell 3) and descriptor fetch (cell 4) are cached to your
  Drive, so they run slowly once and instantly thereafter.
- Adjust the `CSV` path in cell 2 to wherever the master sheet lives in your Drive.
- Some inorganic/mixture entries (e.g. "Asbestos", "Air Pollutants") won't resolve
  to a single PubChem CID; their descriptors are median-imputed and flagged by a
  missing CID in `chemical_cid_map.csv`.
