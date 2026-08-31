"""PubMed abstract scan: SEPARATE, REVERTIBLE ADD-ON MODULE.

Unlike the CTD references (pre-curated, shipped in a CSV), this module goes to
PubMed live and SCOURS REAL ABSTRACTS: it searches for the compound (and its
PubChem name synonyms, i.e. 'similar' names) together with the disease, fetches
each hit's abstract, and keeps only those whose abstract actually mentions BOTH
the compound and the disease. Every returned reference is tagged source='scoured'
so the UI can distinguish it from CTD-curated references.

This is the honest answer to "what if a paper just mentions the compound but does
not assert the association": here we at least verify co-mention in the abstract
(still not a claim of causation, a human should read it, but far better than an
unverified curation link).

To revert: delete this file and the two marked lines in app/main.py.
"""
import re
import xml.etree.ElementTree as ET
import requests
from fastapi import APIRouter, Query, HTTPException

router = APIRouter(prefix="/api/pubmed", tags=["pubmed-scan"])

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

# disease -> title/abstract search terms (our six respiratory diseases)
DISEASE_TERMS = {
    "Asthma": ["asthma"],
    "Bronchitis": ["bronchitis"],
    "Pneumonia": ["pneumonia"],
    "Pulmonary Disease, Chronic Obstructive": ["chronic obstructive pulmonary", "copd", "emphysema"],
    "Rhinitis, Allergic": ["allergic rhinitis", "rhinitis", "hay fever"],
    "Carcinoma, Bronchogenic": ["bronchogenic carcinoma", "lung cancer", "lung carcinoma"],
}


def _get(url, params=None, timeout=20):
    try:
        r = requests.get(url, params=params, timeout=timeout)
        if r.status_code == 200:
            return r
    except Exception:
        pass
    return None


def _has(term, text):
    """Whole-token (case-insensitive) presence, so 'PM' doesn't match 'symptoms'."""
    t = re.escape(term.lower().strip())
    if not t:
        return False
    return re.search(r"(?<![a-z0-9])" + t + r"(?![a-z0-9])", text) is not None


def _synonyms(compound, limit=6):
    """Compound name + a few PubChem synonyms (the 'similar-named' forms)."""
    syns = [compound]
    r = _get(f"{PUG}/compound/name/{requests.utils.quote(compound)}/synonyms/JSON")
    if r:
        try:
            lst = r.json()["InformationList"]["Information"][0]["Synonym"]
            for s in lst:
                s = s.strip()
                if 2 < len(s) < 40 and s.lower() not in [x.lower() for x in syns]:
                    syns.append(s)
                if len(syns) >= limit:
                    break
        except Exception:
            pass
    return syns


def _resolve_cid(name):
    r = _get(f"{PUG}/compound/name/{requests.utils.quote(name)}/cids/JSON")
    if r:
        try:
            return r.json()["IdentifierList"]["CID"][0]
        except Exception:
            pass
    return None


def _similar_names(compound, k=5, threshold=90):
    """Top structurally-similar compounds via PubChem 2D similarity → [{cid, name}]."""
    cid = _resolve_cid(compound)
    if not cid:
        return []
    r = _get(f"{PUG}/compound/fastsimilarity_2d/cid/{cid}/cids/JSON",
             {"Threshold": threshold, "MaxRecords": k + 6})
    cids = []
    if r:
        try:
            cids = r.json()["IdentifierList"]["CID"]
        except Exception:
            cids = []
    cids = [c for c in cids if c != cid][:k]
    out = []
    for c in cids:
        rr = _get(f"{PUG}/compound/cid/{c}/property/Title/JSON")
        nm = None
        if rr:
            try:
                nm = rr.json()["PropertyTable"]["Properties"][0].get("Title")
            except Exception:
                nm = None
        if nm and 2 < len(nm) < 40:
            out.append({"cid": c, "name": nm.strip()})
    return out


def _esearch(term, retmax):
    r = _get(f"{EUTILS}/esearch.fcgi",
             {"db": "pubmed", "retmode": "json", "retmax": retmax, "term": term})
    if not r:
        return []
    try:
        return r.json()["esearchresult"]["idlist"]
    except Exception:
        return []


def _efetch_abstracts(ids):
    """pmid -> {title, abstract} via efetch XML."""
    if not ids:
        return {}
    r = _get(f"{EUTILS}/efetch.fcgi", {"db": "pubmed", "retmode": "xml", "id": ",".join(ids)})
    out = {}
    if not r:
        return out
    try:
        root = ET.fromstring(r.text)
        for art in root.findall(".//PubmedArticle"):
            pmid = art.findtext(".//PMID") or ""
            te = art.find(".//ArticleTitle")
            title = "".join(te.itertext()).strip() if te is not None else ""
            abst = " ".join("".join(a.itertext()) for a in art.findall(".//AbstractText")).strip()
            if pmid:
                out[pmid] = {"title": title, "abstract": abst}
    except Exception:
        pass
    return out


@router.get("/scan")
def scan(compound: str = Query(..., description="compound name or CID"),
         disease: str = Query(..., description="one of the six diseases"),
         retmax: int = Query(10, ge=1, le=25),
         similar: bool = Query(True, description="also search PubChem name synonyms"),
         structural: bool = Query(False, description="also search structurally-similar (2D) compounds")):
    """Scour PubMed abstracts for real references co-mentioning the compound and disease.

    Match tiers, most specific first: 'exact' (the compound itself), 'synonym' (a PubChem
    name synonym), 'analog' (a structurally-similar compound, only when structural=True).
    """
    compound = (compound or "").strip()
    if not compound:
        raise HTTPException(400, "compound is required")
    dterms = DISEASE_TERMS.get(disease, [disease.lower()])
    cterms = _synonyms(compound) if similar else [compound]     # cterms[0] == compound
    syn_terms = cterms[1:]
    analogs = _similar_names(compound) if structural else []
    analog_names = [a["name"] for a in analogs]

    all_terms = list(dict.fromkeys(cterms + analog_names))       # de-dup, keep order
    c_or = " OR ".join(f'"{t}"[tiab]' for t in all_terms)
    d_or = " OR ".join(f'"{d}"[tiab]' for d in dterms)
    term = f"({c_or}) AND ({d_or})"

    ids = _esearch(term, retmax)
    arts = _efetch_abstracts(ids)

    results = []
    for pmid in ids:
        a = arts.get(pmid)
        if not a:
            continue
        text = (a["title"] + " " + a["abstract"]).lower()
        if not any(_has(d, text) for d in dterms):
            continue
        # classify by most specific compound match present in the abstract
        if _has(compound, text):
            mt, mc = "exact", compound
        elif any(_has(s, text) for s in syn_terms):
            mt, mc = "synonym", next(s for s in syn_terms if _has(s, text))
        elif any(_has(an, text) for an in analog_names):
            mt, mc = "analog", next(an for an in analog_names if _has(an, text))
        else:
            continue
        results.append({
            "pmid": pmid,
            "title": a["title"],
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "matched_compound": mc,
            "match_type": mt,
            "exact": mt == "exact",
            "has_abstract": bool(a["abstract"]),
            "source": "scoured",
        })

    return {
        "compound": compound, "disease": disease, "search_term": term,
        "n_searched": len(ids), "n_verified": len(results),
        "similar_terms": syn_terms if similar else [],
        "analog_terms": analog_names,
        "results": results,
        "note": ("Live PubMed search; each result's abstract was verified to mention both a "
                 "compound term (exact / synonym / structural analog) and the disease. "
                 "Source = scoured, not CTD-curated. Co-mention is not proof of association; "
                 "read the paper."),
    }
