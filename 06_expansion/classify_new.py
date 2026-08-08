"""
Classify the NEW chemicals (not in the current 474) that the CTD expansion
surfaces, so the research docs can cite reproducible counts rather than a
hand tally. Classification is by an explicit curated lookup (domain judgement),
falling back to 'unreviewed'. The point is to quantify how much of the
gene-inferred expansion is genuine environmental exposure vs. experimental
probe / therapeutic / non-discrete term.
"""
import csv
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# category -> set of ChemicalNames (as they appear in CTD)
CATS = {
    # mold / fungal metabolites you can actually inhale -> genuine novel env. candidates
    "environmental_candidate": {
        "TMC 120A", "Mycotoxins", "brevianamide A", "neoechinulin A",
        "cladosporin", "neoechinulin", "Sterigmatocystin",
        "Benzene", "hydroquinone", "2-tert-butylhydroquinone",
        "Dinitrochlorobenzene", "4-phenylenediamine", "Barium Sulfate",
        "ferric oxide", "ferrous sulfate", "Dibutyl Phthalate",
        "Pyruvaldehyde", "Croton Oil",
    },
    # research-tool compounds: kinase/pathway inhibitors, ionophores, probes.
    # associated with the disease BECAUSE they were used as probes in its study.
    "research_probe": {
        "SB 203580", "U 0126", "BAY 11-7085",
        "3-(4-methylphenylsulfonyl)-2-propenenitrile",  # BAY 11-7082 family
        "Wortmannin", "diphenyleneiodonium", "Indirubin E804",
        "7-bromoindirubin-3'-oxime", "iodopravadoline",
        "4-(4-fluorophenyl)-2-(4-hydroxyphenyl)-5-(4-p",  # SB202190 (truncated)
        "2-(4-morpholinyl)-8-phenyl-4H-1-benzopyran-4-",  # LY294002 (truncated)
        "2-(2-amino-3-methoxyphenyl)-4H-1-benzopyran-4",  # PD98059 (truncated)
        "ethyl 6-(N-(2-chloro-4-fluorophenyl)sulfamoyl",  # T-5224 (truncated)
        "2-chloro-5-nitrobenzanilide", "Tosylphenylalanyl Chloromethyl Ketone",
        "pyrrolidine dithiocarbamic acid", "Buthionine Sulfoximine",
        "Calcimycin", "Colforsin", "6,2',4'-trimethoxyflavone", "TAK-875",
        "bardoxolone methyl", "Trinitrobenzenesulfonic Acid", "Oxazolone",
        "Zymosan", "cobaltiprotoporphyrin", "Wortmannin",
    },
    # therapeutics / drugs (treat or modulate disease; often protective)
    "therapeutic": {
        "Mycophenolic Acid", "Acetylcysteine", "Pioglitazone", "Losartan",
        "Mifepristone", "Melatonin", "Edaravone", "Silymarin", "fudosteine",
        "Dinoprostone", "Eicosapentaenoic Acid", "andrographolide",
        "Mifepristone",
    },
    # phytochemical antioxidants studied largely as protective agents
    "phyto_antioxidant": {
        "Luteolin", "kaempferol", "chrysin", "thymoquinone", "morroniside",
        "3,3',4,5'-tetrahydroxystilbene", "coagulin-L", "arctigenin",
        "aurapten", "Carnosine",
    },
    # endogenous mediators (not exogenous exposures)
    "endogenous": {
        "15-deoxy-delta(12,14)-prostaglandin J2", "Reactive Oxygen Species",
    },
    # non-discrete terms / categories / artifacts
    "non_discrete": {
        "Water", "Phytochemicals", "Alum Compounds", "Endocrine Disruptors",
        "Hydrocarbons",
    },
}

LOOKUP = {}
for c, names in CATS.items():
    for n in names:
        LOOKUP[n] = c


def main():
    existing = set()
    with open(os.path.join(HERE, "..", "_data",
                           "Respiratory Diseases - Sheet1 (1).csv"),
              encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["ChemicalID"].strip():
                existing.add(r["ChemicalID"].strip())

    new = {}
    with open(os.path.join(HERE, "ctd_expanded_chem_disease.csv"),
              encoding="utf-8") as f:
        for r in csv.DictReader(f):
            cid = r["ChemicalID"]
            if cid in existing:
                continue
            nm = r["ChemicalName"]
            if cid not in new:
                new[cid] = nm

    counts = {}
    unreviewed = []
    for cid, nm in new.items():
        cat = LOOKUP.get(nm)
        if cat is None:
            # try truncated-prefix match
            for k, v in LOOKUP.items():
                if nm.startswith(k) or k.startswith(nm[:30]):
                    cat = v
                    break
        if cat is None:
            cat = "unreviewed"
            unreviewed.append(nm)
        counts[cat] = counts.get(cat, 0) + 1

    print(f"TOTAL new unique chemicals: {len(new)}")
    for c in sorted(counts, key=lambda x: -counts[x]):
        print(f"  {c:24s} {counts[c]}")
    if unreviewed:
        print("\nUNREVIEWED:")
        for n in unreviewed:
            print("  ", n)


if __name__ == "__main__":
    main()
