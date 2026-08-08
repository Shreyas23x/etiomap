"""User-data network builder  — SEPARATE, REVERTIBLE ADD-ON MODULE.

Turns a user-uploaded CSV into a chemical–disease network the frontend can draw.
It is intentionally self-contained: it defines its own APIRouter and does NOT
modify any existing engine. To revert this feature entirely, delete this file and
remove the two marked lines in app/main.py (import + include_router).

Two auto-detected input shapes:

  1. EDGE list  — the CSV has both a chemical column and a disease column
                  (optional weight/link_type columns). We render exactly the
                  associations the user supplied. Nothing is inferred.

  2. COMPOUND list — the CSV has only a chemical column. We resolve each compound
                  via PubChem, score it against the six diseases with the trained
                  model (reusing app.score), and draw an edge wherever the
                  predicted likelihood >= min_score. These edges are PREDICTIONS.

Response: {mode, nodes, edges, diseases, meta} in the id convention the explorer
uses ("C:<name>" chemical nodes, "D:<disease>" disease nodes).
"""
import io
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
import pandas as pd

router = APIRouter(prefix="/api/user-network", tags=["user-network"])

# flexible header matching (lower-cased, stripped of '#')
CHEM_COLS = {"chemical", "chemicalname", "compound", "name", "chem", "chemical_name"}
DIS_COLS = {"disease", "diseasename", "condition", "target", "disease_name"}
WEIGHT_COLS = {"weight", "score", "likelihood", "sig_weight", "value", "strength"}
TYPE_COLS = {"link_type", "type", "evidence", "kind"}

MAX_COMPOUNDS = 60          # PubChem lookups are live; keep it bounded
MAX_EDGE_ROWS = 2000


def _norm(c):
    return str(c).strip().lstrip("#").strip().lower()


def _pick(cols, wanted):
    for c in cols:
        if _norm(c) in wanted:
            return c
    return None


def _read_csv(text):
    try:
        df = pd.read_csv(io.StringIO(text), comment="#")
    except Exception:
        # one-name-per-line fallback -> single 'chemical' column
        names = [l.strip() for l in text.splitlines() if l.strip()]
        return pd.DataFrame({"chemical": names})
    return df


def _edge_network(df, chem_col, dis_col, weight_col, type_col):
    """Render exactly the user's chemical–disease associations."""
    rows = df[[c for c in (chem_col, dis_col, weight_col, type_col) if c]].copy()
    rows = rows.dropna(subset=[chem_col, dis_col])
    rows = rows.head(MAX_EDGE_ROWS)

    nodes, seen = [], set()
    edges = []
    diseases = set()
    for i, r in rows.iterrows():
        chem = str(r[chem_col]).strip()
        dis = str(r[dis_col]).strip()
        if not chem or not dis:
            continue
        cid, did = "C:" + chem, "D:" + dis
        if cid not in seen:
            seen.add(cid)
            nodes.append({"id": cid, "label": chem, "ntype": "chem", "cclass": "user"})
        if did not in seen:
            seen.add(did)
            nodes.append({"id": did, "label": dis, "ntype": "disease"})
        diseases.add(dis)
        w = None
        if weight_col is not None:
            w = pd.to_numeric(pd.Series([r[weight_col]]), errors="coerce").iloc[0]
            w = None if pd.isna(w) else float(w)
        lt = str(r[type_col]).strip() if type_col is not None and pd.notna(r[type_col]) else "user"
        edges.append({"id": f"ue{i}", "source": cid, "target": did,
                      "weight": w, "link_type": lt})
    return {"mode": "edges", "nodes": nodes, "edges": edges,
            "diseases": sorted(diseases),
            "meta": {"n_chem": sum(1 for n in nodes if n["ntype"] == "chem"),
                     "n_disease": len(diseases), "n_edges": len(edges),
                     "unresolved": [], "weighted": weight_col is not None,
                     "note": "Network drawn directly from the associations in your file."}}


def _predict_network(names, min_score):
    """Resolve compounds via PubChem, score against the six diseases, draw edges >= min_score."""
    from app import model, score
    if not model.is_ready():
        raise HTTPException(503, "Model artifacts not loaded; cannot score an uploaded "
                                 "compound list. Provide a chemical+disease CSV instead.")
    names = [n for n in dict.fromkeys(n.strip() for n in names) if n][:MAX_COMPOUNDS]
    nodes, seen = [], set()
    edges = []
    diseases = set()
    unresolved = []
    for idx, name in enumerate(names):
        res = score.score_compound(name)
        if not res.get("resolved"):
            unresolved.append(name)
            continue
        cid = "C:" + name
        if cid not in seen:
            seen.add(cid)
            nodes.append({"id": cid, "label": name, "ntype": "chem",
                          "cclass": "user", "pubchem_cid": res.get("cid")})
        for s in res.get("scores", []):
            if s["likelihood"] < min_score:
                continue
            dis = s["disease"]
            did = "D:" + dis
            if did not in seen:
                seen.add(did)
                nodes.append({"id": did, "label": dis, "ntype": "disease"})
            diseases.add(dis)
            edges.append({"id": f"pe{idx}:{dis}", "source": cid, "target": did,
                          "weight": s["likelihood"],
                          "link_type": "known" if s.get("known") else "predicted",
                          "n_pmids": s.get("n_pmids", 0),
                          "pmids": s.get("pmids", []),
                          "pubmed_url": s.get("pubmed_url")})
    # drop chem nodes that ended with no edge (all below threshold)
    linked = {e["source"] for e in edges}
    nodes = [n for n in nodes if n["ntype"] != "chem" or n["id"] in linked]
    return {"mode": "predict", "nodes": nodes, "edges": edges,
            "diseases": sorted(diseases),
            "meta": {"n_chem": len(linked), "n_disease": len(diseases),
                     "n_edges": len(edges), "unresolved": unresolved,
                     "min_score": min_score, "weighted": True,
                     "note": ("Edges are MODEL PREDICTIONS: each uploaded compound scored "
                              "against the six diseases; an edge is drawn where the predicted "
                              f"likelihood ≥ {min_score:.2f}. 'known' edges also match a curated "
                              "CTD pair (with references).")}}


@router.post("/build")
async def build(file: UploadFile = File(...),
                min_score: float = Query(0.5, ge=0.0, le=1.0)):
    """Build a network from an uploaded CSV (edge list OR compound list)."""
    raw = (await file.read()).decode("utf-8", errors="ignore")
    if not raw.strip():
        raise HTTPException(400, "Uploaded file is empty.")
    df = _read_csv(raw)
    if df.empty:
        raise HTTPException(400, "No rows found in the uploaded file.")

    chem_col = _pick(df.columns, CHEM_COLS) or df.columns[0]
    dis_col = _pick(df.columns, DIS_COLS)
    weight_col = _pick(df.columns, WEIGHT_COLS)
    type_col = _pick(df.columns, TYPE_COLS)

    if dis_col is not None:
        net = _edge_network(df, chem_col, dis_col, weight_col, type_col)
    else:
        names = [str(v).strip() for v in df[chem_col].dropna().tolist() if str(v).strip()]
        if not names:
            raise HTTPException(400, "No compound names found in the file.")
        net = _predict_network(names, min_score)

    if not net["edges"]:
        raise HTTPException(422, "Could not build any edges from this file. For a compound "
                                 "list, lower the minimum likelihood; for an association list, "
                                 "include both a chemical and a disease column.")
    return net
