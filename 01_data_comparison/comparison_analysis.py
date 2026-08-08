"""
Full 0/1 association grid vs. actual dataset — diagnostic comparison.

What this does
--------------
1. Cleans the master CTD export (Respiratory Diseases - Sheet1).
2. Builds the FULL grid of every (disease x chemical) pair with its TRUE
   label (1 = known association in the CSV, 0 = not present).  This is the
   ground-truth "list of 0s and 1s" the model is graded against.
3. Diagnoses *why* an ID-only classifier struggles (sparsity / single-disease
   chemicals / class imbalance) with concrete numbers.
4. Provides compare_predictions(): drop in your model's predicted labels and
   get a full confusion breakdown + false-positive / false-negative lists with
   real chemical names, per disease, exported to Excel.

Run: python comparison_analysis.py
"""
import os
import pandas as pd
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "_data", "Respiratory Diseases - Sheet1 (1).csv")
OUT_GRID = os.path.join(HERE, "full_association_grid.csv")


def load_clean():
    df = pd.read_csv(SRC)
    df.columns = [c.strip().lstrip("#").strip() for c in df.columns]
    # canonical names: ChemicalName, ChemicalID, CasRN, DiseaseName, DirectEvidence, PubMedIDs
    df["DiseaseName"] = df["DiseaseName"].astype(str).str.strip()
    df["ChemicalName"] = df["ChemicalName"].astype(str).str.strip()
    df["ChemicalID"] = df["ChemicalID"].astype(str).str.strip()
    df = df.drop_duplicates(subset=["DiseaseName", "ChemicalID"]).reset_index(drop=True)
    return df


def build_full_grid(df):
    diseases = sorted(df["DiseaseName"].unique())
    chems = df[["ChemicalID", "ChemicalName"]].drop_duplicates("ChemicalID")
    chem_ids = sorted(chems["ChemicalID"].unique())
    name_map = dict(zip(chems["ChemicalID"], chems["ChemicalName"]))

    pos = set(zip(df["DiseaseName"], df["ChemicalID"]))
    rows = []
    for d in diseases:
        for c in chem_ids:
            rows.append((d, c, name_map[c], int((d, c) in pos)))
    grid = pd.DataFrame(rows, columns=["DiseaseName", "ChemicalID", "ChemicalName", "actual_label"])
    return grid, diseases, chem_ids, name_map


def diagnose(df, grid, diseases, chem_ids):
    n_d, n_c = len(diseases), len(chem_ids)
    total = n_d * n_c
    pos = int(grid["actual_label"].sum())
    print("=" * 70)
    print("GROUND-TRUTH GRID  (this IS the full list of 0s and 1s)")
    print("=" * 70)
    print(f"Diseases: {n_d}   Unique chemicals: {n_c}")
    print(f"Total disease x chemical pairs: {total}")
    print(f"Positives (label=1): {pos}  ({100*pos/total:.1f}%)")
    print(f"Negatives (label=0): {total-pos}  ({100*(total-pos)/total:.1f}%)")
    print(f"Class imbalance ratio (neg:pos): {(total-pos)/pos:.1f} : 1")

    print("\nPositives per disease:")
    print(df["DiseaseName"].value_counts().to_string())

    # how many diseases each chemical is linked to
    per_chem = df.groupby("ChemicalID")["DiseaseName"].nunique()
    print("\nHow many diseases each chemical is associated with:")
    print(per_chem.value_counts().sort_index().to_string())
    single = int((per_chem == 1).sum())
    print(f"\n--> {single} of {n_c} chemicals ({100*single/n_c:.0f}%) appear with EXACTLY ONE disease.")
    print("    For those, a held-out positive pair has no other signal in the")
    print("    training data: an identity-only model cannot recover it.  This is")
    print("    the structural reason accuracy/recall stay low regardless of")
    print("    SMOTE, class weights, or hyper-parameter search.")
    return {
        "diseases": n_d, "chemicals": n_c, "pairs": total,
        "positives": pos, "negatives": total - pos,
        "single_disease_chemicals": single,
    }


def compare_predictions(grid, pred, pred_label_col="pred_label", out_xlsx=None):
    """
    grid : full grid with actual_label (from build_full_grid)
    pred : DataFrame with columns DiseaseName, ChemicalID, <pred_label_col>
           (your model's 0/1 output over the same pairs)
    Returns merged frame and writes an Excel workbook with per-disease
    confusion matrices and the FP / FN lists (with chemical names).
    """
    m = grid.merge(pred[["DiseaseName", "ChemicalID", pred_label_col]],
                   on=["DiseaseName", "ChemicalID"], how="inner")
    y, p = m["actual_label"].values, m[pred_label_col].values
    tp = int(((y == 1) & (p == 1)).sum()); tn = int(((y == 0) & (p == 0)).sum())
    fp = int(((y == 0) & (p == 1)).sum()); fn = int(((y == 1) & (p == 0)).sum())
    acc = (tp + tn) / len(m)
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    print(f"\nOVERALL  acc={acc:.3f}  precision={prec:.3f}  recall={rec:.3f}  f1={f1:.3f}")
    print(f"TP={tp} TN={tn} FP={fp} FN={fn}")

    per_dis = []
    for d, g in m.groupby("DiseaseName"):
        yy, pp = g["actual_label"].values, g[pred_label_col].values
        per_dis.append({
            "DiseaseName": d, "n_pairs": len(g), "actual_pos": int(yy.sum()),
            "TP": int(((yy == 1) & (pp == 1)).sum()),
            "FP": int(((yy == 0) & (pp == 1)).sum()),
            "FN": int(((yy == 1) & (pp == 0)).sum()),
            "TN": int(((yy == 0) & (pp == 0)).sum()),
        })
    per_dis = pd.DataFrame(per_dis)
    fps = m[(m["actual_label"] == 0) & (m[pred_label_col] == 1)]
    fns = m[(m["actual_label"] == 1) & (m[pred_label_col] == 0)]

    if out_xlsx:
        with pd.ExcelWriter(out_xlsx) as xl:
            pd.DataFrame([{"accuracy": acc, "precision": prec, "recall": rec,
                           "f1": f1, "TP": tp, "TN": tn, "FP": fp, "FN": fn}]).to_excel(
                xl, sheet_name="overall", index=False)
            per_dis.to_excel(xl, sheet_name="per_disease", index=False)
            fps.to_excel(xl, sheet_name="false_positives", index=False)
            fns.to_excel(xl, sheet_name="false_negatives", index=False)
        print(f"Wrote {out_xlsx}")
    return m, per_dis


if __name__ == "__main__":
    df = load_clean()
    grid, diseases, chem_ids, name_map = build_full_grid(df)
    grid.to_csv(OUT_GRID, index=False)
    print(f"Wrote full grid: {OUT_GRID}  ({len(grid)} rows)\n")
    stats = diagnose(df, grid, diseases, chem_ids)

    # ---- Illustrative leakage-free baseline so the comparison has numbers ----
    # "Predict 1 if this chemical is associated with ANY disease in the training
    #  fold" -- mirrors what an ID-only model effectively learns.  Shows the
    #  ceiling.  Replace `pred` with your real model output and re-run.
    print("\n" + "=" * 70)
    print("ILLUSTRATIVE leakage-free baseline (replace with your model output)")
    print("=" * 70)
    rng = np.random.default_rng(42)
    g = grid.copy()
    # simulate a held-out test fold = 15% of pairs
    test_mask = rng.random(len(g)) < 0.15
    train = g[~test_mask]
    chem_pos_in_train = set(train[train["actual_label"] == 1]["ChemicalID"])
    dis_rate = train.groupby("DiseaseName")["actual_label"].mean().to_dict()
    g_test = g[test_mask].copy()
    # predict 1 if chemical was ever positive in train AND disease base-rate high
    med = pd.Series(dis_rate).median()
    pred = g_test[["DiseaseName", "ChemicalID"]].copy()
    pred["pred_label"] = (
        g_test["ChemicalID"].isin(chem_pos_in_train).values
        & (g_test["DiseaseName"].map(dis_rate) > med).values
    ).astype(int)
    grid_test = g_test[["DiseaseName", "ChemicalID", "ChemicalName", "actual_label"]]
    out_xlsx = os.path.join(HERE, "prediction_comparison.xlsx")
    compare_predictions(grid_test, pred, "pred_label", out_xlsx)
