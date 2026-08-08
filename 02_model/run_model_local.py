"""
Local, runnable version of disease_chemical_model.ipynb.

Same logic as the Colab notebook, but reads the master CSV from ../_data and
caches everything under ../_cache so the slow PubChem calls run only once.
Produces real artifacts in 02_model/model_artifacts/ and prints the honest
(grouped-by-chemical) vs optimistic (random-pair) evaluation.

Run:  python run_model_local.py
"""
import os, time, json, requests
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import StratifiedGroupKFold, GroupShuffleSplit
from sklearn.metrics import roc_auc_score, average_precision_score

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV = os.path.join(ROOT, "_data", "Respiratory Diseases - Sheet1 (1).csv")
CACHE_DIR = os.path.join(ROOT, "_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
ART = os.path.join(HERE, "model_artifacts")
os.makedirs(ART, exist_ok=True)

CID_CACHE = os.path.join(CACHE_DIR, "chemical_cid_map.csv")
FEAT_CACHE = os.path.join(CACHE_DIR, "chemical_features.csv")

PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
PROPS = ["MolecularWeight", "XLogP", "TPSA", "HBondDonorCount",
         "HBondAcceptorCount", "RotatableBondCount", "HeavyAtomCount", "Complexity"]


# ---------------------------------------------------------------- load data
df = pd.read_csv(CSV)
df.columns = [c.strip().lstrip("#").strip() for c in df.columns]
for c in ["DiseaseName", "ChemicalName", "ChemicalID", "CasRN"]:
    df[c] = df[c].astype(str).str.strip()
df = df.drop_duplicates(["DiseaseName", "ChemicalID"]).reset_index(drop=True)
print(df.shape, "| diseases:", df.DiseaseName.nunique(), "| chemicals:", df.ChemicalID.nunique())


# ---------------------------------------------------------------- resolve CIDs
def _get(url):
    try:
        r = requests.get(url, timeout=20)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def resolve_cid(name, cas):
    if cas and cas.lower() not in ("nan", ""):
        j = _get(f"{PUG}/compound/xref/RegistryID/{requests.utils.quote(cas)}/cids/JSON")
        if j and j.get("IdentifierList", {}).get("CID"):
            return j["IdentifierList"]["CID"][0]
    if name and name.lower() not in ("nan", ""):
        j = _get(f"{PUG}/compound/name/{requests.utils.quote(name)}/cids/JSON")
        if j and j.get("IdentifierList", {}).get("CID"):
            return j["IdentifierList"]["CID"][0]
    return None


chem = df[["ChemicalID", "ChemicalName", "CasRN"]].drop_duplicates("ChemicalID").reset_index(drop=True)

if os.path.exists(CID_CACHE):
    cid_map = pd.read_csv(CID_CACHE, dtype=str)
    print("loaded cached CID map")
else:
    cids = []
    for i, row in chem.iterrows():
        cids.append(resolve_cid(row["ChemicalName"], row["CasRN"]))
        if (i + 1) % 25 == 0:
            print(f"{i+1}/{len(chem)} resolved")
        time.sleep(0.12)
    cid_map = chem.copy()
    cid_map["CID"] = cids
    cid_map.to_csv(CID_CACHE, index=False)

cid_map["CID"] = pd.to_numeric(cid_map["CID"], errors="coerce")
print("resolved CIDs:", int(cid_map["CID"].notna().sum()), "/", len(cid_map))


# ---------------------------------------------------------------- fetch descriptors
if os.path.exists(FEAT_CACHE):
    feats = pd.read_csv(FEAT_CACHE)
    print("loaded cached features")
else:
    valid = cid_map.dropna(subset=["CID"]).copy()
    valid["CID"] = valid["CID"].astype(int)
    rows = []
    ids = valid["CID"].astype(str).tolist()
    for k in range(0, len(ids), 100):
        chunk = ",".join(ids[k:k + 100])
        url = f"{PUG}/compound/cid/{chunk}/property/{','.join(PROPS)}/CSV"
        try:
            rows.append(pd.read_csv(url))
        except Exception as e:
            print("descriptor batch failed:", e)
        time.sleep(0.2)
    props_df = pd.concat(rows, ignore_index=True)
    feats = valid.merge(props_df, on="CID", how="left")
    feats.to_csv(FEAT_CACHE, index=False)
print("features:", feats.shape)


# ---------------------------------------------------------------- build grid
diseases = sorted(df.DiseaseName.unique())
pos = set(zip(df.DiseaseName, df.ChemicalID))
base = feats.set_index("ChemicalID")
grid = []
for d in diseases:
    for cid_chem in base.index:
        grid.append((d, cid_chem))
grid = pd.DataFrame(grid, columns=["DiseaseName", "ChemicalID"])
grid["label"] = [int((d, c) in pos) for d, c in zip(grid.DiseaseName, grid.ChemicalID)]
grid = grid.merge(feats, on="ChemicalID", how="left")
for p in PROPS:
    grid[p] = pd.to_numeric(grid[p], errors="coerce")
    grid[p] = grid[p].fillna(grid[p].median())

dis_oh = pd.get_dummies(grid["DiseaseName"], prefix="dis")
X = pd.concat([dis_oh, grid[PROPS]], axis=1)
y = grid["label"].values
groups = grid["ChemicalID"].values
feature_cols = X.columns.tolist()
print("X:", X.shape, "| positives:", int(y.sum()), "/", len(y))


# ---------------------------------------------------------------- train / eval
def fit_xgb(Xtr, ytr, Xva, yva):
    spw = (ytr == 0).sum() / max((ytr == 1).sum(), 1)
    m = XGBClassifier(
        n_estimators=600, learning_rate=0.05, max_depth=4,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=2.0,
        min_child_weight=2, objective="binary:logistic",
        eval_metric="aucpr", scale_pos_weight=spw,
        tree_method="hist", random_state=42)
    m.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
    return m


sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
aucs, aps = [], []
for tr, te in sgkf.split(X, y, groups):
    m = fit_xgb(X.iloc[tr], y[tr], X.iloc[te], y[te])
    p = m.predict_proba(X.iloc[te])[:, 1]
    aucs.append(roc_auc_score(y[te], p))
    aps.append(average_precision_score(y[te], p))
honest_auc, honest_ap = float(np.mean(aucs)), float(np.mean(aps))
print(f"GROUPED-by-chemical (honest):  ROC-AUC {honest_auc:.3f} | PR-AUC {honest_ap:.3f}")

from sklearn.model_selection import StratifiedKFold
skf = StratifiedKFold(5, shuffle=True, random_state=42)
a2, p2 = [], []
for tr, te in skf.split(X, y):
    m = fit_xgb(X.iloc[tr], y[tr], X.iloc[te], y[te])
    pr = m.predict_proba(X.iloc[te])[:, 1]
    a2.append(roc_auc_score(y[te], pr))
    p2.append(average_precision_score(y[te], pr))
opt_auc, opt_ap = float(np.mean(a2)), float(np.mean(p2))
print(f"RANDOM-pair split (optimistic): ROC-AUC {opt_auc:.3f} | PR-AUC {opt_ap:.3f}")


# ---------------------------------------------------------------- ranking report
def ranking_report(ks=(10, 20, 50)):
    gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    tr, te = next(gss.split(X, y, groups))
    m = fit_xgb(X.iloc[tr], y[tr], X.iloc[te], y[te])
    test = grid.iloc[te].copy()
    test["score"] = m.predict_proba(X.iloc[te])[:, 1]
    out = []
    for d, g in test.groupby("DiseaseName"):
        g = g.sort_values("score", ascending=False)
        npos = int(g.label.sum())
        if npos == 0:
            continue
        row = {"disease": d, "test_chems": len(g), "actual_pos": npos}
        for k in ks:
            topk = g.head(k)
            row[f"P@{k}"] = round(topk.label.mean(), 3)
            row[f"R@{k}"] = round(topk.label.sum() / npos, 3)
        out.append(row)
    return pd.DataFrame(out)


rep = ranking_report()
print("\nPer-disease ranking quality (held-out chemicals):")
print(rep.to_string(index=False))
rep.to_csv(os.path.join(ART, "ranking_report.csv"), index=False)


# ---------------------------------------------------------------- final + export
final = fit_xgb(X, y, X, y)
final.save_model(os.path.join(ART, "xgb_disease_chemical.json"))
json.dump(feature_cols, open(os.path.join(ART, "feature_cols.json"), "w"))
json.dump(diseases, open(os.path.join(ART, "diseases.json"), "w"))
feats.to_csv(os.path.join(ART, "chemical_features.csv"), index=False)
json.dump({"honest_roc_auc": honest_auc, "honest_pr_auc": honest_ap,
           "optimistic_roc_auc": opt_auc, "optimistic_pr_auc": opt_ap,
           "positives": int(y.sum()), "pairs": int(len(y)),
           "chemicals": int(df.ChemicalID.nunique()), "diseases": len(diseases)},
          open(os.path.join(ART, "metrics.json"), "w"), indent=2)
print("\nSaved artifacts to", ART)


# ---------------------------------------------------------------- full-grid predictions for the comparison task
grid_pred = grid[["DiseaseName", "ChemicalID"]].copy()
grid_pred["score"] = final.predict_proba(X)[:, 1]
# Pick a threshold matching the positive base rate so 0/1 counts are comparable.
thr = np.quantile(grid_pred["score"], 1 - y.mean())
grid_pred["pred_label"] = (grid_pred["score"] >= thr).astype(int)
grid_pred.to_csv(os.path.join(ART, "full_grid_predictions.csv"), index=False)
print(f"Wrote full_grid_predictions.csv (threshold={thr:.3f}, "
      f"predicted positives={int(grid_pred.pred_label.sum())})")
print("DONE")
