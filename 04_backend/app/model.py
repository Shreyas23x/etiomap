"""Disease -> chemical ranking from the trained XGBoost model.

Loads artifacts exported by 02_model/disease_chemical_model.ipynb:
    model_artifacts/xgb_disease_chemical.json
    model_artifacts/feature_cols.json
    model_artifacts/diseases.json
    model_artifacts/chemical_features.csv
Put that folder at 04_backend/data/model_artifacts/ (or set MODEL_DIR).
If the artifacts are absent, is_ready() is False and the API falls back to the
network endpoints.
"""
import json, os
import numpy as np
import pandas as pd

MODEL_DIR = os.environ.get(
    "MODEL_DIR",
    os.path.join(os.path.dirname(__file__), "..", "data", "model_artifacts"),
)
PROPS = ["MolecularWeight", "XLogP", "TPSA", "HBondDonorCount",
         "HBondAcceptorCount", "RotatableBondCount", "HeavyAtomCount", "Complexity"]

_state = {"loaded": False, "model": None, "cols": None, "diseases": None, "feats": None}


def _try_load():
    if _state["loaded"]:
        return
    _state["loaded"] = True
    try:
        import xgboost as xgb
        m = xgb.XGBClassifier()
        m.load_model(os.path.join(MODEL_DIR, "xgb_disease_chemical.json"))
        _state["model"] = m
        _state["cols"] = json.load(open(os.path.join(MODEL_DIR, "feature_cols.json")))
        _state["diseases"] = json.load(open(os.path.join(MODEL_DIR, "diseases.json")))
        feats = pd.read_csv(os.path.join(MODEL_DIR, "chemical_features.csv"))
        for p in PROPS:
            feats[p] = pd.to_numeric(feats.get(p), errors="coerce")
            feats[p] = feats[p].fillna(feats[p].median())
        _state["feats"] = feats
    except Exception as e:  # missing artifacts or xgboost
        _state["error"] = str(e)


def is_ready():
    _try_load()
    return _state["model"] is not None


def rank_chemicals(disease, limit=20):
    _try_load()
    if _state["model"] is None:
        raise RuntimeError("Model artifacts not loaded. Run the model notebook "
                           "and copy model_artifacts/ into 04_backend/data/.")
    feats, cols = _state["feats"].copy(), _state["cols"]
    oh = pd.DataFrame(0, index=feats.index,
                      columns=[c for c in cols if c.startswith("dis_")])
    col = f"dis_{disease}"
    if col in oh.columns:
        oh[col] = 1
    X = pd.concat([oh.reset_index(drop=True),
                   feats[PROPS].reset_index(drop=True)], axis=1)
    X = X.reindex(columns=cols, fill_value=0)
    feats = feats.reset_index(drop=True)
    feats["score"] = _state["model"].predict_proba(X)[:, 1]
    out = feats.sort_values("score", ascending=False).head(limit)
    recs = out[["ChemicalName", "ChemicalID", "score"]].to_dict(orient="records")
    from app import sources
    for r in recs:  # tag known curated pairs with their CTD citations
        r.update(sources.info(disease, chemical_id=r["ChemicalID"],
                              chemical_name=r["ChemicalName"]))
    return recs
