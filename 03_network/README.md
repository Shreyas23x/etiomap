# 03 — Combined Chemical → Disease Network

Merges the two layers you built (pathway↔chemical and pathway↔disease) into a
**direct chemical → disease graph**, dropping the pathway nodes.

## Files
- `combined_network.ipynb` — full Colab pipeline: map chemical names → KEGG IDs,
  fetch pathway memberships, build each disease's pathway profile, collapse on
  shared pathways, draw an interactive `pyvis` network with **common-name labels**,
  export `network_data.json` for the backend.
- `combined_chemical_disease_edges.csv` — **real precomputed edges** for a
  50-compound seed (29 known + 20 novel candidates).
- `kegg_id_to_name.csv` — KEGG ID → common name (the reverse of MetaboAnalyst's
  name→ID mapping).
- `network_data.json` — compact graph the FastAPI backend loads.
- `chemical_disease_network_heatmap.png` — overview (● known, ○ novel candidate).

## How edges are scored
For chemical C and disease D, `shared_pathways = |paths(C) ∩ profile(D)|` and
`jaccard = |∩| / |∪|`. **Global/overview KEGG maps** (Metabolic pathways,
Biosynthesis of secondary metabolites, etc.) are excluded — they connect nearly
every compound and would create meaningless edges.

- `link_type = known` → edge reproduces a CTD association (validation).
- `link_type = novel_candidate` → chemical shares pathways with a disease it was
  **not** originally listed for → a prediction to follow up, complementing the model.

Example novel candidates surfaced: Adrenaline→Asthma (8 shared pathways),
Cortisol→Asthma (4) — both biologically plausible.

## Note on coverage
The precomputed seed covers ~50 KEGG-mapped compounds (those resolvable to KEGG
IDs). Running the notebook in Colab maps the full chemical list and regenerates
all files at full scale.
