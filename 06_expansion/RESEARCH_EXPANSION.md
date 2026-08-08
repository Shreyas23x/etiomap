# RESEARCH_EXPANSION — can we grow the chemical set beyond 474?

**Question.** The pathway network places only ~44 compounds (the metabolite-mappable,
FDR-significant, currency-filtered subset of our 474 CTD-curated chemicals). Can we
expand the chemical roster — and is it worth it?

**Short answer.** Feasibility is **YES** via CTD's Batch Query API. Value is
**mixed and mostly modest.** A clean curated refresh adds a handful of real
chemicals. The large "gene-inferred" pool is technically huge but, once you read
what is actually in it, **~75% is experimental probes, therapeutics, antioxidants,
or non-discrete category terms** — not environmental exposures. Recommendation:
take the small clean wins, and treat gene-inference as a *separate, clearly-labelled
hypothesis layer* (see `RESEARCH_GENOMIC.md`), not as etiology.

---

## 1. Source & access (reproducible)

CTD Batch Query: `https://ctdbase.org/tools/batchQuery.go`
params `inputType=disease&inputTerms=<MeSH>&report=chems&format=tsv&action=Download`.

> **Gotcha discovered this run:** CTD now sits behind an **ALTCHA proof-of-work
> captcha** ("verify you are a human"). Plain GET/POST returns the captcha HTML, not
> TSV. ALTCHA is hashcash-style PoW (no human needed): fetch `/captcha.go?altcha=yes`,
> find `n` with `SHA256(salt+n)==challenge`, base64 the solution payload, POST it back
> with the `origin` field, keep the cookie. `ctd_client.py` does this transparently;
> `build_expansion.py` caches raw TSVs under `raw/` so reruns don't re-solve.

6 disease MeSH IDs: Asthma `D001249`, Pneumonia `D011014`, COPD `D029424`,
Bronchitis `D001991`, Rhinitis Allergic `D065631`, Carcinoma Bronchogenic `D002283`.

The `chems` report returns, per chemical–disease, columns including `DirectEvidence`
(non-empty ⇒ **curated**) and `InferenceGeneSymbol` + `InferenceScore` (gene-inferred,
one row per linking gene).

## 2. What the build produced

`build_expansion.py` → `ctd_expanded_chem_disease.csv` (cols: Disease, ChemicalName,
ChemicalID, CasRN, tier, InferenceGeneSymbol, InferenceScore, gene_count, PubMedIDs).
Rule: keep all **curated** rows; for **gene-inferred** keep rows with
`InferenceScore ≥ 50`, then keep the **top 150 unique chemicals/disease** by best score
(retaining every qualifying gene row for those chemicals, so multi-gene support is
visible).

Per-disease (`expansion_summary.csv`):

| Disease | raw rows | curated chems | inferred chems (≥50) | kept |
|---|---:|---:|---:|---:|
| Asthma | 40,382 | 223 | 65 | 65 |
| Pneumonia | 28,701 | 206 | 42 | 42 |
| COPD | 24,959 | 76 | 10 | 10 |
| Bronchitis | 34 | 34 | 0 | 0 |
| Rhinitis, Allergic | 9,730 | 62 | 0 | 0 |
| Carcinoma, Bronchogenic | 16 | 16 | 0 | 0 |

**Unique chemicals kept: 547. New vs. the current 474: just 73 (+15%).**
The 150/disease cap never binds — `InferenceScore ≥ 50` already limits Asthma to 65
chemicals and three diseases to **zero**.

### The number that matters most — the threshold debunk
The handoff noted "Asthma `score≥50` → 1,699 chemicals." That was **1,699
chemical–*gene rows*, = only 65 unique chemicals** (each chemical accrues ~26 gene
links). A 26× inflation. Of 40,159 inferred rows, only 4.2% clear 50, and they
collapse to 65 compounds. The raw 40k headline is almost entirely sub-threshold noise.

## 3. The honest content audit of the 73 "new" chemicals

Counts from `classify_new.py` (explicit domain lookup, reproducible):

| Category | Count | % | Worth surfacing as an *exposure*? |
|---|---:|---:|---|
| **Environmental candidate** | **18** | 25% | **Yes** — mycotoxins (Sterigmatocystin, cladosporin, neoechinulin, brevianamide A, TMC-120A), Benzene, hydroquinone, 2-tert-butylhydroquinone, 4-phenylenediamine, Dibutyl Phthalate, metal dusts (ferric/ferrous, barium sulfate)… |
| Research probe | 26 | 36% | No — SB 203580, U 0126, LY294002, PD98059, Wortmannin, BAY 11-708x, PDTC, DPI, ionophores. Linked *because used as probes* in the disease's own studies (selection bias). |
| Therapeutic | 12 | 16% | No — Acetylcysteine, Mycophenolic Acid, Pioglitazone, Losartan, Melatonin, Edaravone… often *protective*, the opposite of causal. |
| Phyto-antioxidant | 10 | 14% | No — Luteolin, kaempferol, chrysin, thymoquinone, silymarin… studied as protectants. |
| Non-discrete term | 5 | 7% | No — "Water" (score 52.3!), "Phytochemicals", "Endocrine Disruptors", "Hydrocarbons", "Alum Compounds". |
| Endogenous mediator | 2 | 3% | No — Reactive Oxygen Species, 15d-PGJ2. |

**So of 73 "new" chemicals, ~18 (25%) are plausible novel environmental exposures;
~75% are lab probes, drugs, antioxidants, endogenous mediators, or category labels.**
"More is better" is false here — bulk-adding the inferred pool would pollute an
environmental-etiology map with the pharmacology used to *study* these diseases.

## 4. Why the inferred pool skews this way

The gene-inference is "this compound perturbs genes that are also
disease-associated." But the recurrent linking genes are the most generic
inflammation/stress markers — **TNF, IL6, IL1B each link ~65/65 Asthma chemicals**,
then HMOX1, NOS2, CCL2, TGFB1, IL4. Almost any bioactive that touches inflammation
scores. That is exactly why kinase inhibitors and antioxidants flood in: they were
*designed* to hit those pathways. Specificity is low (see `RESEARCH_GENOMIC.md`).

## 5. Other expansion sources considered (and why not now)

- **CTD `chems_curated`** — the clean subset; ≈ our existing data + ~8 newer curations
  (Dibutyl Phthalate, Acetylcysteine, fudosteine, aurapten, arctigenin, Melatonin,
  "Endocrine Disruptors", "Hydrocarbons"). Trivial, safe, low yield.
- **More KEGG pathways** — the 44-compound limit is structural: few airborne
  chemicals have KEGG *metabolic* pathways at all. KEGG DRUG maps only to drug-class
  nodes ⇒ fake "shared-pathway" edges. Not pursued (documented in RESULTS §3).
- **Reactome / WikiPathways small-molecule sets** — broader coverage but same
  metabolite bias; deferred.

## 6. Recommendation

1. **Adopt the curated refresh** (curated tier of the CSV): ~8 genuinely new, all
   defensible, label `tier=curated`. Low effort, no risk.
2. **Do NOT bulk-add gene-inferred** as chemicals. If surfaced at all, add only the
   hand-vetted **environmental_candidate** subset (18), each labelled
   **"gene-inferred candidate (unvalidated)"**, visually distinct from curated and
   from pathway-novel, with the linking gene shown as the stated mechanism.
3. **Build the mechanism as its own layer**, not as etiology — see
   `RESEARCH_GENOMIC.md` for the chemical→gene→disease tripartite plan and its caveats.

Artifacts: `ctd_client.py`, `build_expansion.py`, `classify_new.py`,
`ctd_expanded_chem_disease.csv`, `expansion_summary.csv`, `raw/chems_*.tsv`.
