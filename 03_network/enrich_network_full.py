"""
Enrich the v2 network for the interactive viz:
  - per KNOWN edge: CTD sources (PubMed IDs + evidence type) + a PubMed link
  - per edge: XGBoost model score for that (disease, chemical), where available
  - keep the FDR-significant pathway list (for the 'expand pathways' toggle)
Writes 04_backend/data/network_full.json consumed by static/network.html.

Run: python enrich_network_full.py
"""
import os, json
import pandas as pd
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CTD = os.path.join(ROOT, "_data", "Respiratory Diseases - Sheet1 (1).csv")
V2 = os.path.join(HERE, "network_data_v2.json")
NAMES = os.path.join(ROOT, "_cache", "kegg_compound_names.csv")
PREDS = os.path.join(ROOT, "02_model", "model_artifacts", "full_grid_predictions.csv")
ENRICH = os.path.join(ROOT, "_data", "kegg_enrichment_all.csv")
OUT = os.path.join(ROOT, "04_backend", "data", "network_full.json")

# ---- pathway name -> KEGG map id (for the 'cite this pathway' link in the explorer)
pathway_ids = {}
if os.path.exists(ENRICH):
    en = pd.read_csv(ENRICH)
    for _, r in en.iterrows():
        nm_ = str(r["Pathway Name"]).strip()
        pid = str(r["Pathway ID"]).strip().replace("path:", "")
        if nm_ and pid and nm_ not in pathway_ids:
            pathway_ids[nm_] = pid

nd = json.load(open(V2))
edges = nd["edges"]
name_of = nd["kegg_name"]
cls_of = nd["compound_class"]

# ---- CTD: (name, disease) -> pubmed ids + evidence ; name -> ChemicalID
df = pd.read_csv(CTD)
df.columns = [c.strip().lstrip("#").strip() for c in df.columns]
for c in ["DiseaseName", "ChemicalName", "ChemicalID", "DirectEvidence", "PubMedIDs"]:
    df[c] = df[c].astype(str).str.strip()
src = defaultdict(lambda: {"pmids": set(), "evidence": set()})
name_to_ctdid = {}
for _, r in df.iterrows():
    name_to_ctdid[r.ChemicalName.lower()] = r.ChemicalID
    key = (r.ChemicalName.lower(), r.DiseaseName)
    if r.PubMedIDs and r.PubMedIDs.lower() != "nan":
        for p in r.PubMedIDs.split("|"):
            p = p.strip()
            if p:
                src[key]["pmids"].add(p)
    if r.DirectEvidence and r.DirectEvidence.lower() != "nan":
        src[key]["evidence"].add(r.DirectEvidence)

# ---- KEGG id -> CTD chemical names (synonym match)
nm = pd.read_csv(NAMES)
ctd_names = set(df.ChemicalName)
ctd_lower = {n.lower(): n for n in ctd_names}
kegg_ctd = defaultdict(set)
for _, r in nm.iterrows():
    syns = [r.common_name] + str(r.synonyms).split("|")
    for s in syns:
        s = str(s).strip().lower()
        if s in ctd_lower:
            kegg_ctd[r.kegg_id].add(ctd_lower[s])

# ---- model scores: (disease, ChemicalID) -> score
mscore = {}
if os.path.exists(PREDS):
    p = pd.read_csv(PREDS)
    for _, r in p.iterrows():
        mscore[(str(r.DiseaseName), str(r.ChemicalID).strip())] = float(r.score)

# ---- build enriched edges
out_edges = []
for e in edges:
    kid, dis = e["KEGG_ID"], e["Disease"]
    ctd_nms = kegg_ctd.get(kid, set())
    pmids, evid = set(), set()
    for n in ctd_nms:
        s = src.get((n.lower(), dis))
        if s:
            pmids |= s["pmids"]
            evid |= s["evidence"]
    # model score: best over matched CTD ids
    ms = None
    for n in ctd_nms:
        cid = name_to_ctdid.get(n.lower())
        if cid and (dis, cid) in mscore:
            ms = max(ms or 0, mscore[(dis, cid)])
    ee = dict(e)
    ee["pmids"] = sorted(pmids)[:25]
    ee["n_pmids"] = len(pmids)
    ee["evidence"] = sorted(evid)
    ee["model_score"] = round(ms, 4) if ms is not None else None
    ee["pubmed_url"] = ("https://pubmed.ncbi.nlm.nih.gov/?term=" +
                        "+OR+".join(sorted(pmids)[:25])) if pmids else None
    out_edges.append(ee)

# ---- node tables
chem_nodes, dis_set = {}, set()
deg = defaultdict(int)
for e in out_edges:
    deg[e["KEGG_ID"]] += 1
    dis_set.add(e["Disease"])
for e in out_edges:
    kid = e["KEGG_ID"]
    if kid not in chem_nodes:
        chem_nodes[kid] = {"id": "C:" + kid, "kegg_id": kid,
                           "label": name_of.get(kid, kid),
                           "compound_class": cls_of.get(kid, "other"),
                           "degree": deg[kid]}
disease_nodes = [{"id": "D:" + d, "label": d, "type": "disease",
                  "known": sum(1 for e in out_edges if e["Disease"] == d and e["link_type"] == "known"),
                  "novel": sum(1 for e in out_edges if e["Disease"] == d and e["link_type"] == "novel_candidate")}
                 for d in sorted(dis_set)]

full = {
    "diseases": sorted(dis_set),
    "disease_nodes": disease_nodes,
    "chemical_nodes": list(chem_nodes.values()),
    "edges": out_edges,
    "classes": sorted(set(cls_of.values())),
    "meta": {**nd.get("meta", {}), "pathway_ids": pathway_ids},
}
json.dump(full, open(OUT, "w"), indent=1)

known = sum(1 for e in out_edges if e["link_type"] == "known")
with_src = sum(1 for e in out_edges if e["n_pmids"] > 0)
with_model = sum(1 for e in out_edges if e["model_score"] is not None)
print(f"wrote {OUT}")
print(f"edges {len(out_edges)} | known {known} | with PubMed sources {with_src} | with model score {with_model}")
print(f"chemical nodes {len(chem_nodes)} | disease nodes {len(disease_nodes)}")
print("sample known edge with sources:")
for e in out_edges:
    if e["n_pmids"] > 2 and e["model_score"] is not None:
        print(f"  {e['ChemicalName']} -> {e['Disease']} | {e['n_pmids']} PMIDs | evidence {e['evidence']} | model {e['model_score']}")
        break
