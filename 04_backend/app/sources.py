"""CTD ground-truth lookup: for any (disease, chemical) tell whether it is a
KNOWN curated association and return its PubMed citations + evidence type.

Used to label model/score results correctly: a high model score on a pair that
is ALSO a curated CTD association should show "known" with its sources, while a
pair with no curation is an honest model prediction with no citation.
"""
import os
import pandas as pd
from collections import defaultdict

CTD = os.path.join(os.path.dirname(__file__), "..", "..", "_data",
                   "Respiratory Diseases - Sheet1 (1).csv")

_state = {"loaded": False, "by_id": {}, "by_name": {}}


def _load():
    if _state["loaded"]:
        return
    _state["loaded"] = True
    try:
        df = pd.read_csv(CTD)
        df.columns = [c.strip().lstrip("#").strip() for c in df.columns]
        by_id = defaultdict(lambda: {"pmids": set(), "evidence": set()})
        by_name = defaultdict(lambda: {"pmids": set(), "evidence": set()})
        for _, r in df.iterrows():
            d = str(r["DiseaseName"]).strip()
            cid = str(r["ChemicalID"]).strip()
            nm = str(r["ChemicalName"]).strip().lower()
            pmids = [p.strip() for p in str(r.get("PubMedIDs", "")).split("|")
                     if p.strip() and p.strip().lower() != "nan"]
            ev = str(r.get("DirectEvidence", "")).strip()
            for key, store in (((d, cid), by_id), ((d, nm), by_name)):
                store[key]["pmids"].update(pmids)
                if ev and ev.lower() != "nan":
                    store[key]["evidence"].add(ev)
        _state["by_id"] = dict(by_id)
        _state["by_name"] = dict(by_name)
    except Exception as e:  # _data not shipped, etc.
        _state["error"] = str(e)


def info(disease, chemical_id=None, chemical_name=None):
    """Return {known, n_pmids, pmids, evidence, pubmed_url} for a pair."""
    _load()
    rec = None
    if chemical_id and (disease, str(chemical_id).strip()) in _state["by_id"]:
        rec = _state["by_id"][(disease, str(chemical_id).strip())]
    elif chemical_name and (disease, str(chemical_name).strip().lower()) in _state["by_name"]:
        rec = _state["by_name"][(disease, str(chemical_name).strip().lower())]
    if not rec:
        return {"known": False, "n_pmids": 0, "pmids": [], "evidence": [], "pubmed_url": None}
    pmids = sorted(rec["pmids"])
    return {"known": True, "n_pmids": len(pmids), "pmids": pmids[:25],
            "evidence": sorted(rec["evidence"]),
            "pubmed_url": ("https://pubmed.ncbi.nlm.nih.gov/?term=" + "+OR+".join(pmids[:25]))
            if pmids else None}
