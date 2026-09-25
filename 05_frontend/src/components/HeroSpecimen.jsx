// Hero specimen — REVERTIBLE. Replaces the abstract MoleculeArt with a real
// worked example: formaldehyde's structure and its model-predicted likelihood
// across the six diseases, with literature-confirmed links marked. The numbers
// are REAL — the model scores come from full_grid_predictions.csv and the
// "cited" flags from the curated network (network_data.json) — baked in here so
// the homepage needs no backend call (stays instant even on a cold start).
//
// To revert: restore `<MoleculeArt />` (and its import) in pages/Home.jsx and
// delete this file.

// score = trained-model predicted likelihood; cited = a known, PubMed-referenced
// association in the curated network.
const ROWS = [
  { d: 'Pneumonia', s: 0.90, cited: true, ref: 'https://pubmed.ncbi.nlm.nih.gov/21983654/' },
  { d: 'Asthma', s: 0.76, cited: true, ref: 'https://pubmed.ncbi.nlm.nih.gov/?term=11519088+OR+12212974+OR+17002712+OR+17594875+OR+23671638' },
  { d: 'COPD', s: 0.21, cited: false },
  { d: 'Bronchitis', s: 0.05, cited: false },
  { d: 'Allergic rhinitis', s: 0.03, cited: false },
  { d: 'Bronchogenic carcinoma', s: 0.01, cited: false },
]

export default function HeroSpecimen() {
  return (
    <figure className="spec">
      <style>{`
        .spec{margin:0;width:100%;max-width:440px}
        .spec-head{display:flex;align-items:center;gap:14px;justify-content:center}
        .spec-name{font-weight:600;font-size:16px;color:var(--navy)}
        .spec-formula{font-family:var(--mono);font-size:12.5px;color:var(--text-3);margin-top:1px}
        .spec-tag{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.06em;
                  text-transform:uppercase;color:#b45309;background:#fdf2e0;border:1px solid #f4dcb0;
                  border-radius:2px;padding:1px 6px;margin-top:6px}
        .spec-arrows{display:block;margin:4px auto 8px;width:160px}
        .spec-rows{display:flex;flex-direction:column;gap:9px}
        .spec-row{display:grid;grid-template-columns:104px 1fr 30px;align-items:center;gap:10px}
        .spec-dis{font-size:11.5px;color:var(--text-2);text-align:right;line-height:1.15}
        .spec-ref{color:var(--emerald);font-size:9px;font-weight:700;vertical-align:super;
                  text-decoration:none;margin-left:2px}
        .spec-ref:hover{text-decoration:underline}
        .spec-track{height:12px;background:var(--muted);border-radius:2px;overflow:hidden}
        .spec-fill{height:100%;border-radius:2px;transform-origin:left;background:var(--navy)}
        .spec-fill.cited{background:var(--emerald)}
        .spec-val{font-family:var(--mono);font-size:11.5px;color:var(--text-2);font-variant-numeric:tabular-nums}
        .spec-cap{font-size:11.5px;color:var(--text-3);line-height:1.55;margin-top:15px;text-align:left}
        .spec-cap b{color:var(--emerald);font-weight:600}
        @media (prefers-reduced-motion: no-preference){
          .spec-fill{animation:specgrow .7s cubic-bezier(.2,.7,.2,1) both}
        }
        @keyframes specgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
      `}</style>

      <figcaption className="spec-head">
        <svg width="74" height="62" viewBox="0 0 74 62" fill="none" aria-hidden="true">
          {/* formaldehyde, H2C=O — drawn as a real skeletal structure */}
          <text x="37" y="15" textAnchor="middle" fontFamily="var(--sans)" fontSize="12.5" fill="var(--navy)">O</text>
          <line x1="34" y1="21" x2="34" y2="33" stroke="var(--navy)" strokeWidth="1" />
          <line x1="40" y1="21" x2="40" y2="33" stroke="var(--navy)" strokeWidth="1" />
          <text x="37" y="44" textAnchor="middle" fontFamily="var(--sans)" fontSize="12.5" fill="var(--navy)">C</text>
          <line x1="32" y1="44" x2="17" y2="54" stroke="var(--navy)" strokeWidth="1" />
          <line x1="42" y1="44" x2="57" y2="54" stroke="var(--navy)" strokeWidth="1" />
          <text x="13" y="59" textAnchor="middle" fontFamily="var(--sans)" fontSize="11.5" fill="var(--text-3)">H</text>
          <text x="61" y="59" textAnchor="middle" fontFamily="var(--sans)" fontSize="11.5" fill="var(--text-3)">H</text>
        </svg>
        <span style={{ textAlign: 'left' }}>
          <span className="spec-name" style={{ display: 'block' }}>Formaldehyde</span>
          <span className="spec-formula" style={{ display: 'block' }}>CH₂O</span>
          <span className="spec-tag">environmental</span>
        </span>
      </figcaption>

      {/* connectors fanning from the molecule down into the chart */}
      <svg className="spec-arrows" height="26" viewBox="0 0 160 26" fill="none" aria-hidden="true">
        <g stroke="var(--border-strong)" strokeWidth="1">
          <path d="M80 2 L34 20" /><path d="M80 2 L80 20" /><path d="M80 2 L126 20" />
        </g>
        <g fill="var(--border-strong)">
          <path d="M34 24 l-3.2 -6 l6.4 0 z" /><path d="M80 24 l-3.2 -6 l6.4 0 z" /><path d="M126 24 l-3.2 -6 l6.4 0 z" />
        </g>
      </svg>

      <div className="spec-rows">
        {ROWS.map((r, i) => (
          <div className="spec-row" key={r.d}>
            <div className="spec-dis">
              {r.d}
              {r.ref && (
                <a className="spec-ref" href={r.ref} target="_blank" rel="noopener noreferrer"
                   title="View the literature on PubMed">[1]</a>
              )}
            </div>
            <div className="spec-track">
              <div className={'spec-fill' + (r.cited ? ' cited' : '')}
                   style={{ width: (r.s * 100) + '%', animationDelay: (i * 70) + 'ms' }} />
            </div>
            <div className="spec-val">{r.s.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <p className="spec-cap">
        A demo of analyzing formaldehyde across all six diseases. Bars are the model’s predictions and
        their likelihood; <b>green denotes links also shown in the literature</b> (asthma, pneumonia).
      </p>
    </figure>
  )
}
