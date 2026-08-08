"""Score ARBITRARY compounds (typed names or an uploaded CSV) against every
disease, using the trained XGBoost model + live PubChem descriptor lookup.

Reuses the artifacts already loaded by app.model. For each compound we resolve a
PubChem CID, fetch the same molecular descriptors the model was trained on, then
run the model once per disease to get a likelihood.
"""
import io
import requests
import pandas as pd
from functools import lru_cache

from app import model

PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"


def _get(url):
    try:
        r = requests.get(url, timeout=20)
        if r.status_code == 200:
            return r
    except Exception:
        pass
    return None


@lru_cache(maxsize=512)
def resolve_cid(name):
    name = (name or "").strip()
    if not name:
        return None
    # CAS / registry-style or plain name both go through the name endpoint
    r = _get(f"{PUG}/compound/name/{requests.utils.quote(name)}/cids/JSON")
    if r:
        j = r.json()
        cids = j.get("IdentifierList", {}).get("CID")
        if cids:
            return cids[0]
    return None


@lru_cache(maxsize=512)
def fetch_props(cid):
    props = ",".join(model.PROPS)
    r = _get(f"{PUG}/compound/cid/{cid}/property/{props}/CSV")
    if not r:
        return None
    try:
        df = pd.read_csv(io.StringIO(r.text))
        row = df.iloc[0].to_dict()
        return {p: row.get(p) for p in model.PROPS}
    except Exception:
        return None


def score_compound(name):
    """Return per-disease likelihoods for one compound name/CID string."""
    model._try_load()
    if model._state["model"] is None:
        raise RuntimeError("Model artifacts not loaded.")
    cid = resolve_cid(name)
    out = {"query": name, "resolved": cid is not None, "cid": cid,
           "scores": [], "top": None}
    if cid is None:
        return out
    props = fetch_props(cid)
    if props is None:
        out["resolved"] = False
        return out

    cols = model._state["cols"]
    diseases = model._state["diseases"]
    feats = model._state["feats"]
    # median fallback for any missing descriptor
    med = {p: pd.to_numeric(feats[p], errors="coerce").median() for p in model.PROPS}
    base = {p: (props[p] if pd.notna(props.get(p)) else med[p]) for p in model.PROPS}

    rows = []
    for d in diseases:
        row = {c: 0 for c in cols}
        col = f"dis_{d}"
        if col in row:
            row[col] = 1
        for p in model.PROPS:
            if p in row:
                row[p] = base[p]
        rows.append(row)
    X = pd.DataFrame(rows)[cols]
    probs = model._state["model"].predict_proba(X)[:, 1]
    from app import sources
    scored = sorted(
        [{"disease": d, "likelihood": round(float(p), 4),
          **sources.info(d, chemical_name=name)} for d, p in zip(diseases, probs)],
        key=lambda r: r["likelihood"], reverse=True)
    out["scores"] = scored
    out["top"] = scored[0] if scored else None
    return out


def score_many(names):
    return [score_compound(n) for n in names if str(n).strip()]


def parse_csv(text):
    """Pull a list of compound names from uploaded CSV text.
    Accepts a column named ChemicalName/Name/Compound, else the first column,
    and skips obvious header/comment rows."""
    try:
        df = pd.read_csv(io.StringIO(text), comment="#")
    except Exception:
        # fall back: one name per line
        return [l.strip() for l in text.splitlines() if l.strip()]
    if df.empty:
        return []
    cand = None
    for c in df.columns:
        cl = str(c).strip().lower().lstrip("#").strip()
        if cl in ("chemicalname", "name", "compound", "chemical"):
            cand = c
            break
    col = cand if cand is not None else df.columns[0]
    return [str(v).strip() for v in df[col].dropna().tolist() if str(v).strip()]
