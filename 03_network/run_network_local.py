"""
Local, runnable version of combined_network.ipynb.

Builds the direct chemical -> disease network for ALL chemicals (not just the
~50-compound seed Cowork precomputed). Maps chemical names to KEGG compound IDs,
fetches pathway membership, collapses pathway<->chemical and pathway<->disease
layers on shared pathways into direct edges, labels nodes with common names, and
writes the full network_data.json + edges CSV + interactive HTML.

Run:  python run_network_local.py
"""
import os, time, json, requests
import pandas as pd
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV = os.path.join(ROOT, "_data", "Respiratory Diseases - Sheet1 (1).csv")
CACHE_DIR = os.path.join(ROOT, "_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
NAME_CACHE = os.path.join(CACHE_DIR, "name_to_kegg.csv")

KEGG = "https://rest.kegg.jp"
# overview / global maps that link almost everything -> drop them
GLOBAL = {"01100", "01110", "01120", "01200", "01210", "01212", "01220", "01230",
          "01232", "01240", "01250", "01060", "01061", "01062", "01063", "01064",
          "01065", "01070"}


def kget(path):
    for _ in range(3):
        try:
            r = requests.get(f"{KEGG}/{path}", timeout=30)
            if r.status_code == 200:
                return r.text
        except Exception:
            time.sleep(1)
    return ""


# ---------------------------------------------------------------- load data
df = pd.read_csv(CSV)
df.columns = [c.strip().lstrip("#").strip() for c in df.columns]
df["DiseaseName"] = df["DiseaseName"].astype(str).str.strip()
df["ChemicalName"] = df["ChemicalName"].astype(str).str.strip()
df = df.drop_duplicates(["DiseaseName", "ChemicalName"]).reset_index(drop=True)
print(df.shape, "| diseases:", df.DiseaseName.nunique(), "| chemicals:", df.ChemicalName.nunique())


# ---------------------------------------------------------------- name -> KEGG id
def name_to_kegg(name):
    # KEGG free-text compound search. The find endpoint returns BARE ids
    # ("C07481\tCaffeine; ..."), not the "cpd:" prefix the link endpoint uses.
    txt = kget(f"find/compound/{requests.utils.quote(name)}")
    for line in txt.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        cid = line.split("\t")[0].replace("cpd:", "").strip()
        if len(cid) == 6 and cid[0] == "C" and cid[1:].isdigit():
            return cid
    return None


names = sorted(df.ChemicalName.unique())
if os.path.exists(NAME_CACHE):
    m = pd.read_csv(NAME_CACHE)
    print("loaded cached KEGG name map")
else:
    rows = []
    for i, n in enumerate(names):
        rows.append({"ChemicalName": n, "KEGG_ID": name_to_kegg(n)})
        if (i + 1) % 25 == 0:
            print(i + 1, "/", len(names))
        time.sleep(0.1)
    m = pd.DataFrame(rows)
    m.to_csv(NAME_CACHE, index=False)

m = m.dropna(subset=["KEGG_ID"])
print("mapped", len(m), "/", len(names), "chemicals to KEGG IDs")
name_of = dict(zip(m.KEGG_ID, m.ChemicalName))


# ---------------------------------------------------------------- chemical -> pathways
ids = m.KEGG_ID.tolist()
cpd_paths = defaultdict(set)
for k in range(0, len(ids), 25):
    batch = "+".join(ids[k:k + 25])
    for line in kget(f"link/pathway/{batch}").strip().split("\n"):
        if "\t" not in line:
            continue
        c, p = line.split("\t")
        p = p.replace("path:map", "")
        if p not in GLOBAL:
            cpd_paths[c.replace("cpd:", "")].add(p)
    time.sleep(0.1)
print("compounds with pathways:", len(cpd_paths))


# ---------------------------------------------------------------- collapse to direct edges
cid_disease = defaultdict(set)
for _, r in df.merge(m, on="ChemicalName").iterrows():
    cid_disease[r.KEGG_ID].add(r.DiseaseName)
dis_paths = defaultdict(set)
for cid, ds in cid_disease.items():
    for d in ds:
        dis_paths[d] |= cpd_paths.get(cid, set())

known = set((d, c) for c, ds in cid_disease.items() for d in ds)
rows = []
for cid, paths in cpd_paths.items():
    if not paths:
        continue
    for d, dp in dis_paths.items():
        sh = paths & dp
        if not sh:
            continue
        rows.append({"ChemicalName": name_of.get(cid, cid), "KEGG_ID": cid, "Disease": d,
                     "shared_pathways": len(sh), "jaccard": round(len(sh) / len(paths | dp), 4),
                     "link_type": "known" if (d, cid) in known else "novel_candidate"})
edges = pd.DataFrame(rows).sort_values(["Disease", "shared_pathways"], ascending=[True, False])
edges.to_csv(os.path.join(HERE, "combined_chemical_disease_edges.csv"), index=False)
print("edges:", len(edges),
      "| known", int((edges.link_type == "known").sum()),
      "| novel", int((edges.link_type == "novel_candidate").sum()))

# id -> name map for the backend / reverse lookup
pd.DataFrame({"KEGG_ID": list(name_of.keys()),
             "ChemicalName": list(name_of.values())}).to_csv(
    os.path.join(HERE, "kegg_id_to_name.csv"), index=False)


# ---------------------------------------------------------------- backend export
json.dump({"diseases": sorted(dis_paths),
           "edges": edges.to_dict(orient="records"),
           "kegg_name": name_of},
          open(os.path.join(HERE, "network_data.json"), "w"), indent=1)
print("wrote network_data.json")


# ---------------------------------------------------------------- interactive HTML
try:
    from pyvis.network import Network
    net = Network(height="720px", width="100%", bgcolor="#ffffff", notebook=False, cdn_resources="in_line")
    top = edges.sort_values("shared_pathways", ascending=False).head(200)
    for d in top.Disease.unique():
        net.add_node("D:" + d, label=d, shape="box", color="#c0392b", size=26)
    for _, r in top.iterrows():
        nid = "C:" + r.KEGG_ID
        net.add_node(nid, label=r.ChemicalName, shape="dot",
                     color="#2980b9" if r.link_type == "known" else "#27ae60",
                     size=10 + 2 * r.shared_pathways,
                     title=f"{r.ChemicalName} ({r.KEGG_ID}) - {r.link_type}")
        net.add_edge(nid, "D:" + r.Disease, value=int(r.shared_pathways),
                     color="#95a5a6" if r.link_type == "known" else "#2ecc71")
    net.force_atlas_2based()
    # write_html uses the platform default codec (cp1252 on Windows) and chokes
    # on unicode in compound names -> generate + write as UTF-8 explicitly.
    html = net.generate_html()
    with open(os.path.join(HERE, "chemical_disease_network.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("wrote chemical_disease_network.html")
except Exception as e:
    print("pyvis HTML skipped:", e)
print("DONE")
