"""
Network rebuild driven by the KEGG enrichment results (the MetaboAnalyst-style
hypergeometric output), fixing the first-hit KEGG mapping bugs from the old
co-membership network.

Why this exists
---------------
The old network used "first KEGG hit for the chemical name", which mis-mapped
Adenosine -> ATP (C00002), Carbon -> CO2 (C00011), Epinephrine -> Noradrenaline,
inflating the graph with central-metabolite hubs. The enrichment file carries the
CORRECT KEGG IDs (resolved by MetaboAnalyst from PubChem) plus per-pathway FDR.

Pipeline
--------
1. Take the enrichment's compound x pathway membership as authoritative.
2. Keep only FDR-significant, specific pathways (drop giant overview maps).
3. Map each enrichment KEGG ID back to CTD chemical(s) via KEGG's own synonym
   list -> gives the correct common name AND the disease labels (from CTD).
4. Tag every compound: environmental / reagent / endogenous / drug / other.
5. Build chemical -> disease edges through shared SIGNIFICANT pathways, weighted
   by summed -log10(FDR). known = CTD-listed pair, else novel candidate.

Run: python rebuild_network_enrichment.py
"""
import os, time, json, requests, re
import pandas as pd
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CTD = os.path.join(ROOT, "_data", "Respiratory Diseases - Sheet1 (1).csv")
ENR = os.path.join(ROOT, "_data", "kegg_enrichment_all.csv")
CACHE = os.path.join(ROOT, "_cache", "kegg_compound_names.csv")
KEGG = "https://rest.kegg.jp"

FDR_CUT = 0.05
MAX_PATHWAY_SIZE = 200   # drop giant overview maps (Metabolic pathways=3250, etc.)
GLOBAL = {"map01100", "map01110", "map01120", "map01200", "map01210", "map01212",
          "map01220", "map01230", "map01232", "map01240", "map01250", "map01060",
          "map01061", "map01062", "map01063", "map01064", "map01065", "map01070"}

# "Currency"/cofactor metabolites: they participate in a huge share of pathways,
# so they spuriously link to every disease (e.g. Oxygen-> Asthma). They are not
# meaningful exposure candidates, so they are excluded from the network.
CURRENCY = {"C00001",  # H2O
            "C00002", "C00008", "C00020",  # ATP, ADP, AMP
            "C00003", "C00004", "C00005", "C00006",  # NAD+, NADH, NADPH, NADP+
            "C00007",  # O2 (Oxygen)
            "C00009", "C00013",  # phosphate, diphosphate
            "C00010",  # CoA
            "C00011",  # CO2
            "C00080",  # H+
            "C00014",  # NH3
            "C00288"}  # HCO3-

# ----------------------------------------------------------------- classifier
ENV_KW = ["pollut", "particulate", "smoke", "dust", "emission", "diesel", "exhaust",
          "asbestos", "soot", "ozone", "dioxin", "pesticide", "herbicide", "insecticide",
          "diisocyanate", "benzo", "pyrene", "phenanthrene", "naphthalene", "anthracene",
          "formaldehyde", "acetaldehyde", "acrolein", "styrene", "toluene", "xylene",
          "bisphenol", "phthalate", "nicotine", "tobacco", "arsenic", "cadmium", "nickel",
          "chromium", "chromate", "mercury", "lead", "vanadium", "silica", "quartz",
          "nitrogen dioxide", "sulfur dioxide", "nitrate", "nitrite", "nitric acid",
          "carbon monoxide", "carbon dioxide", "ammonia", "sulfur", "metal", "paraquat",
          "ddt", "atrazine", "chlorpyrifos", "malathion", "permethrin", "glyphosate",
          "ovalbumin", "diacetyl", "isocyanate"]
REAGENT_KW = ["lipopolysaccharide", "endotoxin", "antigen", "allergen", " alum", "ovalbumin"]
ENDO_KW = ["adenosine", "acetylcholine", "histamine", "dopamine", "serotonin",
           "cyclic amp", "cyclic gmp", "amp", "gmp", "atp", "adp", "nitric oxide",
           "glutathione", "prostaglandin", "leukotriene", "adrenaline", "noradrenaline",
           "epinephrine", "norepinephrine", "cortisol", "corticosterone", "aldosterone",
           "estrogen", "estradiol", "testosterone", "melatonin", "taurine", "creatinine",
           "urate", "uric acid", "cholesterol", "arachidonic", "retinol", "folate",
           "oxygen", "hydrogen peroxide", "adenine", "guanine", "choline", "betaine"]


def classify(names, therapeutic):
    blob = " ".join(names).lower()
    for kw in ENV_KW:
        if kw in blob:
            return "environmental"
    for kw in REAGENT_KW:
        if kw in blob:
            return "reagent"
    for kw in ENDO_KW:
        if re.search(r"\b" + re.escape(kw) + r"\b", blob):
            return "endogenous"
    if therapeutic:
        return "drug"
    return "other"


def kget(path):
    for _ in range(3):
        try:
            r = requests.get(f"{KEGG}/{path}", timeout=25)
            if r.status_code == 200:
                return r.text
        except Exception:
            time.sleep(0.5)
    return ""


# ----------------------------------------------------------------- load CTD
df = pd.read_csv(CTD)
df.columns = [c.strip().lstrip("#").strip() for c in df.columns]
for c in ["DiseaseName", "ChemicalName", "DirectEvidence"]:
    df[c] = df[c].astype(str).str.strip()
name_diseases = defaultdict(set)
name_therap = defaultdict(bool)
for _, r in df.iterrows():
    name_diseases[r.ChemicalName].add(r.DiseaseName)
    if "therapeutic" in r.DirectEvidence.lower():
        name_therap[r.ChemicalName] = True
ctd_names = sorted(name_diseases)
ctd_lower = {n.lower(): n for n in ctd_names}

# ----------------------------------------------------------------- enrichment
enr = pd.read_csv(ENR)
enr["pid"] = enr["Pathway ID"].str.replace("path:", "", regex=False)
keep = enr[(enr["FDR (BH)"] < FDR_CUT) &
           (enr["K (pathway size)"] <= MAX_PATHWAY_SIZE) &
           (~enr["pid"].isin(GLOBAL))].copy()
print(f"pathways: {len(enr)} -> kept {len(keep)} (FDR<{FDR_CUT}, size<={MAX_PATHWAY_SIZE}, no overview maps)")

cpd_paths = defaultdict(dict)     # kegg_id -> {pathway_name: neglog10fdr}
path_compounds = {}
all_cids = set()
for _, r in keep.iterrows():
    cids = str(r["Compound IDs"]).split(";")
    nlf = float(r["-log10(FDR)"])
    cids = [c for c in cids if c not in CURRENCY]   # drop currency/cofactor metabolites
    path_compounds[r["Pathway Name"]] = cids
    for c in cids:
        cpd_paths[c][r["Pathway Name"]] = nlf
        all_cids.add(c)
print("compounds in kept pathways:", len(all_cids), "(currency metabolites excluded)")

# ----------------------------------------------------------------- KEGG names
if os.path.exists(CACHE):
    nm = pd.read_csv(CACHE)
else:
    rows = []
    for i, cid in enumerate(sorted(all_cids)):
        txt = kget(f"get/{cid}")
        common, syns = cid, []
        for line in txt.split("\n"):
            if line.startswith("NAME"):
                raw = line.replace("NAME", "").strip()
                syns = [s.strip().rstrip(";").strip() for s in raw.split(";") if s.strip()]
                # continuation lines
                common = syns[0] if syns else cid
                break
        rows.append({"kegg_id": cid, "common_name": common, "synonyms": "|".join(syns)})
        if (i + 1) % 20 == 0:
            print(f"  names {i+1}/{len(all_cids)}")
        time.sleep(0.05)
    nm = pd.DataFrame(rows)
    nm.to_csv(CACHE, index=False)
name_of = dict(zip(nm.kegg_id, nm.common_name))
syn_of = {r.kegg_id: str(r.synonyms).lower().split("|") for _, r in nm.iterrows()}

# ----------------------------------------------------------------- map KEGG id -> CTD names/diseases
kegg_ctd = defaultdict(set)
for cid in all_cids:
    cands = set(syn_of.get(cid, [])) | {name_of.get(cid, "").lower()}
    for s in cands:
        s = s.strip()
        if s and s in ctd_lower:
            kegg_ctd[cid].add(ctd_lower[s])
kegg_diseases = {c: set().union(*[name_diseases[n] for n in ns]) if ns else set()
                 for c, ns in kegg_ctd.items()}
matched = sum(1 for c in all_cids if kegg_ctd.get(c))
print(f"enrichment compounds matched back to CTD names: {matched}/{len(all_cids)}")

# compound class
kegg_class = {}
for cid in all_cids:
    names = list(kegg_ctd.get(cid, set())) + [name_of.get(cid, "")]
    therap = any(name_therap.get(n) for n in kegg_ctd.get(cid, set()))
    kegg_class[cid] = classify(names, therap)

# ----------------------------------------------------------------- disease pathway profiles
disease_paths = defaultdict(lambda: defaultdict(float))
for cid, paths in cpd_paths.items():
    for d in kegg_diseases.get(cid, set()):
        for p, w in paths.items():
            disease_paths[d][p] = max(disease_paths[d][p], w)

# ----------------------------------------------------------------- edges
known = set((d, c) for c in all_cids for d in kegg_diseases.get(c, set()))
rows = []
for cid, paths in cpd_paths.items():
    cname = name_of.get(cid, cid)
    if not kegg_ctd.get(cid):
        continue   # cannot place a disease without a CTD link
    for d, prof in disease_paths.items():
        shared = set(paths) & set(prof)
        if not shared:
            continue
        weight = round(sum(paths[p] for p in shared), 3)
        rows.append({"ChemicalName": cname, "KEGG_ID": cid, "Disease": d,
                     "shared_pathways": len(shared),
                     "sig_weight": weight,
                     "compound_class": kegg_class[cid],
                     "link_type": "known" if (d, cid) in known else "novel_candidate",
                     "pathways": "; ".join(sorted(shared))})
edges = pd.DataFrame(rows).sort_values(["Disease", "sig_weight"], ascending=[True, False])
edges.to_csv(os.path.join(HERE, "combined_chemical_disease_edges_v2.csv"), index=False)

# ----------------------------------------------------------------- export
diseases = sorted(disease_paths)
classes = {c: kegg_class[c] for c in all_cids if kegg_ctd.get(c)}
json.dump({"diseases": diseases,
           "edges": edges.to_dict(orient="records"),
           "kegg_name": {c: name_of[c] for c in all_cids},
           "compound_class": classes,
           "meta": {"source": "kegg_enrichment_all.csv", "fdr_cut": FDR_CUT,
                    "max_pathway_size": MAX_PATHWAY_SIZE,
                    "kept_pathways": int(len(keep))}},
          open(os.path.join(HERE, "network_data_v2.json"), "w"), indent=1)

print("\nedges:", len(edges),
      "| known", int((edges.link_type == "known").sum()),
      "| novel", int((edges.link_type == "novel_candidate").sum()))
print("compound classes:")
print(edges.drop_duplicates("KEGG_ID")["compound_class"].value_counts().to_string())
print("\ntop environmental edges:")
env = edges[edges.compound_class == "environmental"].head(12)
print(env[["ChemicalName", "Disease", "shared_pathways", "sig_weight", "link_type"]].to_string(index=False))
print("DONE")
