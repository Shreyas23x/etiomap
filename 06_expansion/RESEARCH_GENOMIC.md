# RESEARCH_GENOMIC — a chemical → gene → disease layer

**Question.** Can we add a genomic mechanism layer that links a chemical to a disease
*through the genes both touch*, and is it trustworthy enough to ship?

**Short answer.** Feasibility: **YES** — CTD already encodes the chemical→gene→disease
triangle, and we pulled it this run. Trustworthiness: **conditional**. The data is a
real mechanistic hypothesis generator, but the inference is dominated by **generic
inflammation genes**, so it is **non-specific and not causal**. Ship it only as an
explicitly-labelled *hypothesis* layer, separated from curated etiology — never folded
into the model's predictions or counted as evidence.

---

## 1. Feasibility & data in hand

The same CTD `report=chems` pull (see `RESEARCH_EXPANSION.md` for the API + ALTCHA
captcha workaround) **is** the genomic link: each gene-inferred row carries the
`InferenceGeneSymbol` that connects the chemical to the disease, plus an
`InferenceScore`. We don't need a second endpoint to draw chemical→gene→disease.

- `disease→genes_curated` works too (Asthma: 91 curated genes w/ PubMedIDs) if we
  want a *curated* gene backbone instead of the inferred one.
- `chem→gene` (report `cgixns`) works but is enormous per chemical
  (Benzo(a)pyrene ≈56k rows across all organisms) — would need Homo-sapiens filtering
  + aggregation. Not needed for the tripartite view; the `chems` report already
  gives the disease-relevant genes.

In our thresholded set (`ctd_expanded_chem_disease.csv`, score ≥ 50, top-150/disease)
the gene-inferred edges span Asthma/Pneumonia/COPD only; the three small diseases
yield none at this threshold.

## 2. The trust problem (the part the user asked me to scrutinise)

**The inference genes are generic.** Across all kept inferred edges the top linking
genes are:

```
TNF 116 · IL6 115 · IL1B 104 · CCL2 98 · HMOX1 94 · TGFB1 91 · IL4 84 · NOS2 70 ...
```

For Asthma, **TNF, IL6, and IL1B each link ~65 of the 65** inferred chemicals.
Translation: the "mechanism" is almost always "this compound moves a core
inflammatory cytokine, and so does asthma." That is true of nearly every bioactive
small molecule. Consequences:

1. **Low specificity.** A shared TNF/IL6 edge barely narrows anything down.
2. **Selection / reverse-causation bias.** The compounds that score highest are
   research probes (SB203580, LY294002, U0126, Wortmannin…) and drugs (Acetylcysteine,
   Pioglitazone…) — associated *because they were used to perturb those very genes in
   the disease's own literature*, or because they *treat* it. Inferred ≠ causal;
   here it is often anti-causal.
3. **`InferenceScore` rewards promiscuity.** Score rises with the *number* of shared
   genes, so multi-target compounds inflate regardless of biological specificity. The
   1,699-vs-65 inflation in `RESEARCH_EXPANSION.md` is the same effect at the dataset
   level.

**Confidence verdict:** useful for *hypothesis generation and mechanistic context*,
**not** as evidence of environmental etiology and **not** as model input.

## 3. What makes a gene-inferred edge actually worth showing

Apply, in order:
1. **Threshold** `InferenceScore ≥ 50` (already; keeps 65/42/10 chemicals).
2. **Identity filter** — drop non-discrete terms ("Water", "ROS", "Phytochemicals"),
   research probes, and disease therapeutics (per `classify_new.py` categories). This
   is the step that separates the ~18 real environmental candidates from the ~55 not.
3. **Corroboration, ideally:** prefer chemicals that are *also* pathway-novel in the
   KEGG network, or supported by a non-generic gene (something past TNF/IL6/IL1B), or
   multi-gene with ≥1 specific gene (e.g. CYP1A1 for PAHs, EPHX for epoxide handlers).
4. **Label honestly:** "gene-inferred candidate (unvalidated; mechanism = gene X)".

## 4. Concrete integration plan (tripartite layer)

Keep it a *distinct, opt-in* layer so it cannot be mistaken for curated etiology.

**Data**
- New artifact `06_expansion/genomic_edges.json`: nodes = {chemical, gene, disease};
  edges = chemical→gene (from CTD inferred) and gene→disease (curated `genes_curated`
  backbone where possible, else the inferred link). Carry `InferenceScore`,
  `gene_count`, `PubMedIDs`, and the `classify_new` category. Build script:
  `build_genomic_layer.py` (to add), reusing `ctd_client.py`.
- Restrict the *chemical* set to the vetted **environmental_candidate** subset by
  default; allow toggling the rest behind a warning.

**Backend (`04_backend/app/`)**
- New `genomic.py` with `@lru_cache` loader (remember the restart-after-regenerate
  gotcha) and routes `/api/genomic/graph`, `/api/genomic/chemical/{name}`,
  `/api/genomic/disease/{d}`. Keep it *out* of `/api/score` and `/api/network` so the
  model and the curated network stay clean.

**Explorer (`05_frontend`)**
- New node type **gene** (third tier) + a top-level toggle "Show gene-inferred layer
  (hypotheses)". Gene nodes styled distinctly (e.g. square, muted); chemical→gene→
  disease edges dotted/amber and clearly *not* the solid-emerald (known) /
  dashed-gray (pathway-novel) styles already in use.
- A persistent caption: "Gene-inferred associations are computational hypotheses
  (CTD), not curated evidence — many are research probes or therapeutics."
- Reuse the existing focus/expand/group-select machinery; gene nodes participate in
  expand only, hidden by default.

**About page**
- Add a third bullet next to model / curated-network: "Gene-inferred layer — what it
  is, the TNF/IL6/IL1B specificity caveat, and why it is hypotheses not evidence."

## 5. Recommendation

- **Ship the tripartite layer as an off-by-default, clearly-labelled hypothesis
  view**, populated by the **vetted environmental_candidate subset only** by default.
- **Do not** merge gene-inferred chemicals into the curated chemical list, the model
  training data, or the validation counts.
- **Prefer the curated gene backbone** (`genes_curated`) for the gene→disease half
  when drawing the triangle, so at least one leg is curated.
- Treat `InferenceScore` as a sortable hint, not a probability.

Net: the genomic layer is worth building **as mechanism/context**, with strong
labelling and filtering — its value is explaining *why* a few real candidates might
matter, not inflating the chemical count.
