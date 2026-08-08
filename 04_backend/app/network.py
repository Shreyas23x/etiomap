"""Chemical <-> disease network served from the enrichment-based KEGG graph (v2).

Edges are driven by FDR-significant KEGG pathways; every compound carries a
class tag (environmental / drug / endogenous / reagent / other) so the API can
default to the environmental-exposure subnetwork and reveal the rest on request.
"""
import json, os
from functools import lru_cache

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "network_data.json")

DEFAULT_CLASSES = ("environmental",)


@lru_cache(maxsize=1)
def _load():
    with open(DATA) as f:
        return json.load(f)


def diseases():
    return _load()["diseases"]


def classes():
    """All compound classes present, with counts."""
    cc = _load().get("compound_class", {})
    out = {}
    for v in cc.values():
        out[v] = out.get(v, 0) + 1
    return out


def _class_ok(edge, wanted):
    if not wanted:
        return True
    return edge.get("compound_class") in wanted


def _score(e):
    # sig_weight (summed -log10 FDR) is the primary rank; fall back to count
    return (e.get("sig_weight", 0), e.get("shared_pathways", 0))


def chemicals_for_disease(disease, limit=20, include_known=True, classes_filter=None):
    edges = _load()["edges"]
    rows = [e for e in edges if e["Disease"].lower() == disease.lower()
            and _class_ok(e, classes_filter)]
    if not include_known:
        rows = [e for e in rows if e["link_type"] == "novel_candidate"]
    rows.sort(key=_score, reverse=True)
    return rows[:limit]


def diseases_for_chemical(name, limit=20):
    edges = _load()["edges"]
    rows = [e for e in edges if e["ChemicalName"].lower() == name.lower()]
    rows.sort(key=_score, reverse=True)
    return rows[:limit]


def graph(disease=None, max_edges=150, classes_filter=None):
    """Nodes/edges for a front-end graph viz (common-name labels, class tags)."""
    edges = _load()["edges"]
    if disease:
        edges = [e for e in edges if e["Disease"].lower() == disease.lower()]
    edges = [e for e in edges if _class_ok(e, classes_filter)]
    edges = sorted(edges, key=_score, reverse=True)[:max_edges]
    nodes, seen = [], set()
    for e in edges:
        did = "D:" + e["Disease"]
        if did not in seen:
            seen.add(did)
            nodes.append({"id": did, "label": e["Disease"], "type": "disease"})
        cid = "C:" + e["KEGG_ID"]
        if cid not in seen:
            seen.add(cid)
            nodes.append({"id": cid, "label": e["ChemicalName"], "type": "chemical",
                          "kegg_id": e["KEGG_ID"],
                          "compound_class": e.get("compound_class", "other")})
    links = [{"source": "C:" + e["KEGG_ID"], "target": "D:" + e["Disease"],
              "weight": e.get("sig_weight", e.get("shared_pathways", 1)),
              "shared_pathways": e["shared_pathways"],
              "link_type": e["link_type"],
              "compound_class": e.get("compound_class", "other")} for e in edges]
    return {"nodes": nodes, "links": links}
