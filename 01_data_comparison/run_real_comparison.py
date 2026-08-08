"""
Replace the illustrative baseline in prediction_comparison.xlsx with the REAL
trained-model output over the full disease x chemical grid.

Reads 02_model/model_artifacts/full_grid_predictions.csv (produced by
run_model_local.py) and grades it against the ground-truth grid via
comparison_analysis.compare_predictions.

Run:  python run_real_comparison.py
"""
import os
import pandas as pd
from comparison_analysis import load_clean, build_full_grid, compare_predictions

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PRED = os.path.join(ROOT, "02_model", "model_artifacts", "full_grid_predictions.csv")
OUT = os.path.join(HERE, "prediction_comparison.xlsx")

df = load_clean()
grid, *_ = build_full_grid(df)
pred = pd.read_csv(PRED)
pred["ChemicalID"] = pred["ChemicalID"].astype(str).str.strip()

print(f"Grid pairs: {len(grid)} | model-scored pairs: {len(pred)} "
      f"(chemicals PubChem couldn't resolve are not scored)")
m, per_dis = compare_predictions(grid, pred, "pred_label", OUT)
print("\nPer-disease breakdown:")
print(per_dis.to_string(index=False))
