# Full 0/1 vs. Actual Dataset — What's Happening

This compares the **full grid of every disease × chemical pair** (the complete
"list of 0s and 1s") against the real CTD associations, and explains why the
XGBoost accuracy was low.

## The ground-truth grid (`full_association_grid.csv`)

| Quantity | Value |
|---|---|
| Diseases | 6 |
| Unique chemicals | 474 |
| Total pairs (the full 0/1 list) | **2,844** |
| Positives (label = 1) | 609 (21.4%) |
| Negatives (label = 0) | 2,235 (78.6%) |
| Imbalance (neg : pos) | 3.7 : 1 |

Positives per disease: Asthma 220, Pneumonia 204, COPD 74, Allergic Rhinitis 61,
Bronchitis 34, Bronchogenic Carcinoma 16.

## The core problem (this is "what's happening")

Each chemical is associated with this many diseases:

| # diseases | # chemicals |
|---|---|
| 1 | **388** |
| 2 | 51 |
| 3 | 24 |
| 4 | 8 |
| 5 | 3 |

**82% of chemicals appear with exactly one disease.** The old model's only
inputs were the *identity* of the disease and the chemical (one-hot encoded
IDs). When a positive pair for a single-disease chemical lands in the test set,
that chemical has **no other positive example in the training data** — so an
identity-only model has literally nothing to generalise from and predicts 0.
That is the structural reason accuracy and recall stayed low. It is **not**
fixable with SMOTE, class weights, or hyper-parameter tuning, because the
information needed simply isn't in the features.

Two ways out, both now in progress:
1. **Give the model real chemistry** — molecular descriptors / fingerprints per
   chemical (folder `02_model`). Then "similar chemicals cause similar diseases"
   becomes learnable.
2. **Use the pathway network** — link chemicals to diseases through shared
   biological pathways (folder `03_network`).

## How to grade your real model output

`comparison_analysis.py` includes `compare_predictions(grid, pred)`. Export your
model's predictions over the full grid as a CSV with columns
`DiseaseName, ChemicalID, pred_label`, then:

```python
from comparison_analysis import load_clean, build_full_grid, compare_predictions
df = load_clean(); grid, *_ = build_full_grid(df)
pred = pd.read_csv("my_model_predictions.csv")
compare_predictions(grid, pred, "pred_label", "prediction_comparison.xlsx")
```

You get overall accuracy/precision/recall/F1, a **per-disease** confusion
breakdown, and full **false-positive / false-negative lists with chemical
names** — so you can see exactly which pairs the model gets wrong.

`prediction_comparison.xlsx` now holds the **real trained-model output** over the
full grid (regenerate with `python run_real_comparison.py`): **accuracy 0.890,
precision/recall/F1 0.736** (TP 360, TN 1728, FP 129, FN 129). That is up from the
old illustrative identity-only ceiling of acc 0.55 / recall 0.26. The honest
generalization metric for the model is the grouped-by-chemical **ROC-AUC 0.811**
(see `../RESULTS.md` and `../02_model/`).
