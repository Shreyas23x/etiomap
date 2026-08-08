"""
Build the CTD-expanded chemical-disease dataset for EtioMap.

For each of the 6 respiratory diseases we pull CTD report='chems' (curated +
gene-inferred). We keep:
  (a) tier='curated'        -> DirectEvidence non-empty (CTD-curated link)
  (b) tier='gene_inferred'  -> InferenceScore >= SCORE_MIN, then keep only the
                               top TOP_N unique chemicals per disease (ranked by
                               each chemical's best InferenceScore). For those
                               chemicals we retain every qualifying chemical-gene
                               row, because multi-gene support is itself a
                               confidence signal we want to surface.

Output: ctd_expanded_chem_disease.csv with columns
  Disease, ChemicalName, ChemicalID, CasRN, tier, InferenceGeneSymbol,
  InferenceScore, gene_count, PubMedIDs

Raw per-disease TSVs are cached under raw/ so reruns don't re-hit the captcha.
"""
import csv
import os
import sys

from ctd_client import fetch

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
os.makedirs(RAW, exist_ok=True)

SCORE_MIN = 50.0
TOP_N = 150

# CTD MeSH id -> display name matching the master sheet's DiseaseName
DISEASES = [
    ("D001249", "Asthma"),
    ("D011014", "Pneumonia"),
    ("D029424", "Pulmonary Disease, Chronic Obstructive"),
    ("D001991", "Bronchitis"),
    ("D065631", "Rhinitis, Allergic"),
    ("D002283", "Carcinoma, Bronchogenic"),
]


def get_raw(mesh):
    path = os.path.join(RAW, f"chems_{mesh}.tsv")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        with open(path, encoding="utf-8") as f:
            return f.read()
    text = fetch(
        {
            "inputType": "disease",
            "inputTerms": mesh,
            "report": "chems",
            "format": "tsv",
            "action": "Download",
        }
    )
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    return text


def parse_rows(text):
    lines = text.splitlines()
    header = lines[0].lstrip("#").strip().split("\t")
    for line in lines[1:]:
        if not line.strip():
            continue
        vals = line.split("\t")
        if len(vals) != len(header):
            continue
        yield dict(zip(header, vals))


def load_existing_chem_ids():
    master = os.path.join(
        HERE, "..", "_data", "Respiratory Diseases - Sheet1 (1).csv"
    )
    ids = set()
    with open(master, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cid = row["ChemicalID"].strip()
            if cid:
                ids.add(cid)
    return ids


def main():
    existing = load_existing_chem_ids()
    out_rows = []
    summary = []
    new_chem_ids = set()
    all_kept_chem_ids = set()

    for mesh, disp in DISEASES:
        text = get_raw(mesh)
        rows = list(parse_rows(text))

        curated = []
        inferred = []  # chemical-gene rows with score >= SCORE_MIN
        for r in rows:
            de = r.get("DirectEvidence", "").strip()
            score_s = r.get("InferenceScore", "").strip()
            if de:
                curated.append(r)
            elif score_s:
                try:
                    sc = float(score_s)
                except ValueError:
                    continue
                if sc >= SCORE_MIN:
                    inferred.append((sc, r))

        # rank unique chemicals by best inferred score, take top TOP_N
        best = {}  # ChemicalID -> best score
        gene_count = {}  # ChemicalID -> number of qualifying gene rows
        for sc, r in inferred:
            cid = r["ChemicalID"]
            best[cid] = max(best.get(cid, 0.0), sc)
            gene_count[cid] = gene_count.get(cid, 0) + 1
        top_chems = sorted(best, key=lambda c: best[c], reverse=True)[:TOP_N]
        top_set = set(top_chems)

        n_curated_chems = len({r["ChemicalID"] for r in curated})
        n_inferred_raw_chems = len(best)
        n_inferred_kept = len(top_set)

        # emit curated rows (one per chemical, dedup by ChemicalID keeping evidence)
        seen_cur = set()
        for r in curated:
            cid = r["ChemicalID"]
            if cid in seen_cur:
                continue
            seen_cur.add(cid)
            all_kept_chem_ids.add(cid)
            if cid not in existing:
                new_chem_ids.add(cid)
            out_rows.append(
                {
                    "Disease": disp,
                    "ChemicalName": r["ChemicalName"],
                    "ChemicalID": cid,
                    "CasRN": r.get("CasRN", ""),
                    "tier": "curated",
                    "InferenceGeneSymbol": "",
                    "InferenceScore": "",
                    "gene_count": "",
                    "PubMedIDs": r.get("PubMedIDs", ""),
                }
            )

        # emit gene-inferred rows for top chemicals (all qualifying gene rows)
        for sc, r in sorted(inferred, key=lambda x: x[0], reverse=True):
            cid = r["ChemicalID"]
            if cid not in top_set:
                continue
            all_kept_chem_ids.add(cid)
            if cid not in existing:
                new_chem_ids.add(cid)
            out_rows.append(
                {
                    "Disease": disp,
                    "ChemicalName": r["ChemicalName"],
                    "ChemicalID": cid,
                    "CasRN": r.get("CasRN", ""),
                    "tier": "gene_inferred",
                    "InferenceGeneSymbol": r.get("InferenceGeneSymbol", ""),
                    "InferenceScore": r.get("InferenceScore", ""),
                    "gene_count": gene_count.get(cid, ""),
                    "PubMedIDs": r.get("PubMedIDs", ""),
                }
            )

        summary.append(
            {
                "disease": disp,
                "mesh": mesh,
                "raw_rows": len(rows),
                "curated_chems": n_curated_chems,
                "inferred_chems_ge_min": n_inferred_raw_chems,
                "inferred_chems_kept": n_inferred_kept,
            }
        )
        print(
            f"{disp:42s} raw={len(rows):6d}  curated_chems={n_curated_chems:4d}  "
            f"inferred>=50={n_inferred_raw_chems:5d}  kept={n_inferred_kept:3d}"
        )

    out_path = os.path.join(HERE, "ctd_expanded_chem_disease.csv")
    cols = [
        "Disease", "ChemicalName", "ChemicalID", "CasRN", "tier",
        "InferenceGeneSymbol", "InferenceScore", "gene_count", "PubMedIDs",
    ]
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(out_rows)

    print("\n=== TOTALS ===")
    print(f"output rows               : {len(out_rows)}")
    print(f"unique chemicals kept     : {len(all_kept_chem_ids)}")
    print(f"existing (current 474)    : {len(existing)}")
    print(f"NEW chemicals vs current  : {len(new_chem_ids)}")
    print(f"written -> {out_path}")

    # write a small summary csv for the docs
    with open(os.path.join(HERE, "expansion_summary.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["disease", "mesh", "raw_rows", "curated_chems",
                        "inferred_chems_ge_min", "inferred_chems_kept"],
        )
        w.writeheader()
        w.writerows(summary)


if __name__ == "__main__":
    main()
