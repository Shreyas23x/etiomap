import { useEffect, useMemo, useState, Fragment } from 'react'
import { api, shortDisease, CLASS_COLOR } from '../api.js'

const MODES = [
  ['disease', 'By disease'],
  ['compound', 'By compound'],
  ['upload', 'Upload list'],
]

function Likelihood({ v }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="lbar"><i style={{ width: `${Math.round(v * 100)}%` }} /></div>
      <span className="num" style={{ fontSize: 13, color: 'var(--text-2)', minWidth: 38 }}>{(v * 100).toFixed(0)}%</span>
    </div>
  )
}

const refLink = { color: 'var(--emerald-700)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }

// numbered in-text references, each hyperlinked to its PubMed article
function References({ ev }) {
  if (ev.kind === 'known') {
    const pmids = ev.pmids || []
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {pmids.length
          ? pmids.map((p, i) => (
            <a key={p} href={`https://pubmed.ncbi.nlm.nih.gov/${p}/`} target="_blank" rel="noreferrer"
              style={refLink} title={`PubMed ${p}`}>[{i + 1}]</a>
          ))
          : <span className="muted" style={{ fontSize: 12 }}>no reference on file</span>}
      </span>
    )
  }
  if (ev.kind === 'model') return <span className="tag tag-model">prediction</span>
  return <span className="tag tag-novel">candidate</span>
}

// Disease-level references: curated refs for related compounds, plus an on-demand
// live PubMed scour for the queried compound, each block labelled by its source.
function DiseaseRefs({ edges, disease, compound }) {
  const [scan, setScan] = useState(null)   // { loading } | { error } | { data }
  const [struct, setStruct] = useState(false)   // also search structural analogs
  async function runScan() {
    setScan({ loading: true })
    try { setScan({ data: await api.pubmedScan(compound, disease, true, struct) }) }
    catch (e) { setScan({ error: '' + e.message }) }
  }
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 8 }}>
        References for {shortDisease(disease)}
      </div>

      {/* CTD-curated block */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="tag tag-known">CTD</span>
          <span className="muted" style={{ fontSize: 11 }}>curated references for related compounds (human-curated dataset)</span>
        </div>
        {edges && edges.length ? edges.map(e => (
          <div key={e.ChemicalName} style={{ fontSize: 12.5, padding: '4px 0', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 500, minWidth: 150 }}>{e.ChemicalName}</span>
            {e.pmids && e.pmids.length
              ? e.pmids.map((p, i) => (
                <a key={p} href={`https://pubmed.ncbi.nlm.nih.gov/${p}/`} target="_blank" rel="noreferrer" style={refLink} title={`PubMed ${p}`}>[{i + 1}]</a>
              ))
              : <span className="muted">candidate, no reference for this disease</span>}
          </div>
        )) : <span className="muted" style={{ fontSize: 12 }}>No related compounds.</span>}
      </div>

      {/* Scoured (live PubMed) block */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span className="tag tag-model">scoured</span>
          <span className="muted" style={{ fontSize: 11 }}>live PubMed abstracts mentioning <b>{compound}</b> + {shortDisease(disease)}</span>
          <label className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={struct} onChange={e => setStruct(e.target.checked)} /> include structural analogs
          </label>
          <button className="btn btn-ghost btn-sm" onClick={runScan} disabled={scan?.loading}>
            {scan?.loading ? <span className="spin" /> : `Scan PubMed for ${compound}`}</button>
        </div>
        {scan?.error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>⚠ {scan.error}</div>}
        {scan?.data && (scan.data.results.length ? (
          <div>
            {scan.data.results.map((r, i) => (
              <div key={r.pmid} style={{ fontSize: 12.5, padding: '4px 0', display: 'flex', gap: 8, alignItems: 'baseline', borderBottom: '1px solid var(--border)' }}>
                <a href={r.url} target="_blank" rel="noreferrer" style={refLink} title={`PubMed ${r.pmid}`}>[{i + 1}]</a>
                <span style={{ fontSize: 12, flex: 1 }}>{r.title || `PMID ${r.pmid}`}
                  {r.match_type === 'analog' && <span className="muted"> (structural analog: {r.matched_compound})</span>}
                  {r.match_type === 'synonym' && <span className="muted"> (via “{r.matched_compound}”)</span>}
                </span>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
              {scan.data.n_verified} of {scan.data.n_searched} PubMed hits verified to mention both in the abstract.
              {scan.data.similar_terms?.length ? ` Synonyms searched: ${scan.data.similar_terms.slice(0, 4).join(', ')}.` : ''}
              {scan.data.analog_terms?.length ? ` Structural analogs searched: ${scan.data.analog_terms.slice(0, 4).join(', ')}.` : ''}
            </div>
          </div>
        ) : <div className="muted" style={{ fontSize: 12 }}>No abstracts found that mention both {compound} and {shortDisease(disease)}.</div>)}
      </div>
    </div>
  )
}

// Related-compound names; click a name to reveal its PubMed references for this disease.
function RelatedCompounds({ edges }) {
  const [open, setOpen] = useState(null)
  if (!edges || !edges.length) return <span className="muted">None</span>
  const oe = open ? edges.find(e => e.ChemicalName === open) : null
  const pmids = oe?.pmids || []
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 4px' }}>
        {edges.map((e, i) => (
          <span key={e.ChemicalName}>
            <button type="button" onClick={() => setOpen(open === e.ChemicalName ? null : e.ChemicalName)}
              title="Show references"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                color: open === e.ChemicalName ? 'var(--emerald-700)' : 'var(--text-2)', fontWeight: open === e.ChemicalName ? 600 : 400,
                textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}>
              {e.ChemicalName}</button>{i < edges.length - 1 ? ',' : ''}
          </span>
        ))}
      </div>
      {oe && (
        <div style={{ marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="muted">{oe.ChemicalName} → {shortDisease(oe.Disease)}:</span>
          {pmids.length
            ? pmids.map((p, i) => (
              <a key={p} href={`https://pubmed.ncbi.nlm.nih.gov/${p}/`} target="_blank" rel="noreferrer"
                style={refLink} title={`PubMed ${p}`}>[{i + 1}]</a>
            ))
            : <span className="muted">candidate, no reference for this disease</span>}
        </div>
      )}
    </div>
  )
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => {
    const v = (c == null ? '' : String(c)).replace(/"/g, '""')
    return /[",\n]/.test(v) ? `"${v}"` : v
  }).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename; a.click()
}

export default function Analyze() {
  const [mode, setMode] = useState('disease')
  const [diseases, setDiseases] = useState([])
  const [net, setNet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // by-disease
  const [disease, setDisease] = useState('')
  const [source, setSource] = useState('model')
  const [dRows, setDRows] = useState(null)
  // by-compound
  const [cname, setCname] = useState('')
  const [cRes, setCRes] = useState(null)
  const [openDisease, setOpenDisease] = useState(null)   // by-compound: disease row expanded to all its references
  // upload
  const [file, setFile] = useState(null)
  const [uRes, setURes] = useState(null)

  useEffect(() => {
    api.diseases().then(d => { setDiseases(d); setDisease(d[0]) }).catch(() => {})
    api.networkFull().then(setNet).catch(() => {})
  }, [])

  const relatedByDisease = useMemo(() => {
    const m = {}
    if (net) for (const e of net.edges) {
      (m[e.Disease] = m[e.Disease] || []).push(e)
    }
    for (const d in m) m[d].sort((a, b) => b.sig_weight - a.sig_weight)
    return m
  }, [net])

  const related = (d, n = 4) => (relatedByDisease[d] || []).slice(0, n).map(e => e.ChemicalName)
  const relatedEdges = (d, n = 4) => (relatedByDisease[d] || []).slice(0, n)
  // per-disease "References" cell for CSV: each related compound with its PubMed article URLs
  const relatedRefsCell = (d) => relatedEdges(d).map(e =>
    `${e.ChemicalName}: ${(e.pmids && e.pmids.length) ? e.pmids.map(p => `https://pubmed.ncbi.nlm.nih.gov/${p}/`).join(' ') : 'no reference'}`
  ).join(' | ')

  // (disease, chemical name) -> network edge, used to attach pathway-network sources
  const srcMap = useMemo(() => {
    const m = {}
    if (net) for (const e of net.edges) m[`${e.Disease}||${(e.ChemicalName || '').toLowerCase()}`] = e
    return m
  }, [net])

  // Resolve the correct evidence for a by-disease row given the active source.
  function rowEvidence(c) {
    if (source === 'model') {
      return c.known ? { kind: 'known', pmids: c.pmids || [], url: c.pubmed_url, n: c.n_pmids }
                     : { kind: 'model' }
    }
    const e = srcMap[`${disease}||${(c.ChemicalName || '').toLowerCase()}`]
    if (c.link_type === 'known') return { kind: 'known', pmids: e?.pmids || [], url: e?.pubmed_url, n: e?.n_pmids }
    return { kind: 'novel' }
  }
  const EVID_LABEL = { known: 'curated', model: 'prediction', novel: 'candidate' }
  const refUrls = (ev) => (ev.pmids && ev.pmids.length)
    ? ev.pmids.map(p => `https://pubmed.ncbi.nlm.nih.gov/${p}/`).join(' ')
    : (ev.url || '')

  async function runDisease() {
    setBusy(true); setErr(''); setDRows(null)
    try {
      const r = await api.diseaseChemicals(disease, { source, limit: 25 })
      setDRows(r.chemicals)
    } catch (e) { setErr('' + e.message) } finally { setBusy(false) }
  }
  async function runCompound() {
    if (!cname.trim()) return
    setBusy(true); setErr(''); setCRes(null)
    try {
      const r = await api.score([cname.trim()])
      setCRes(r.results[0])
    } catch (e) { setErr('' + e.message) } finally { setBusy(false) }
  }
  async function runUpload() {
    if (!file) return
    setBusy(true); setErr(''); setURes(null)
    try {
      const r = await api.scoreCsv(file)
      setURes(r)
    } catch (e) { setErr('' + e.message) } finally { setBusy(false) }
  }

  return (
    <main className="wrap fadein" style={{ paddingTop: 40, minHeight: '72vh' }}>
      <span className="eyebrow">Analyze</span>
      <h1 className="serif" style={{ fontSize: 38, marginTop: 10 }}>Find what links a chemical to a disease.</h1>
      <p className="muted" style={{ maxWidth: 620, marginTop: 8 }}>
        Rank the chemical drivers of a disease, score a single compound across all six diseases, or upload your own list.
      </p>

      {/* segmented control */}
      <div style={{ display: 'inline-flex', background: 'var(--muted)', borderRadius: 12, padding: 4, marginTop: 24, gap: 4 }}>
        {MODES.map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} className="btn btn-sm"
            style={{ background: mode === k ? 'var(--surface)' : 'transparent', color: mode === k ? 'var(--navy)' : 'var(--text-2)', boxShadow: mode === k ? 'var(--shadow-sm)' : 'none', border: 'none' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 26, marginTop: 16 }}>
        {/* BY DISEASE */}
        {mode === 'disease' && (
          <div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 280px' }}>
                <label className="fld">Disease</label>
                <select className="input" value={disease} onChange={e => { setDisease(e.target.value); setDRows(null); setErr('') }}>
                  {diseases.map(d => <option key={d} value={d}>{shortDisease(d)}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 240px' }}>
                <label className="fld">Methods</label>
                <select className="input" value={source} onChange={e => { setSource(e.target.value); setDRows(null); setErr('') }}>
                  <option value="model">Predicted likelihood</option>
                  <option value="network">Pathway Score</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={runDisease} disabled={busy}>{busy ? <span className="spin" /> : 'Rank compounds'}</button>
            </div>
            {dRows && (
              <div className="fadein" style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="muted" style={{ fontSize: 13.5 }}>{dRows.length} compounds for <b style={{ color: 'var(--navy)' }}>{shortDisease(disease)}</b></span>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(`etiomap_${disease}.csv`,
                    [['Chemical', source === 'model' ? 'Likelihood' : 'Pathway score', 'Reference type', 'References'],
                     ...dRows.map(c => { const ev = rowEvidence(c); return [c.ChemicalName, source === 'model' ? c.score : c.sig_weight, EVID_LABEL[ev.kind], refUrls(ev)] })])}>Download CSV</button>
                </div>
                <table className="data">
                  <thead><tr><th>#</th><th>Compound</th><th>{source === 'model' ? 'Likelihood' : 'Pathway score'}</th><th>Source</th></tr></thead>
                  <tbody>
                    {dRows.map((c, i) => (
                      <tr key={i}>
                        <td className="num" style={{ color: 'var(--text-3)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{c.ChemicalName}</td>
                        <td style={{ minWidth: 150 }}>{source === 'model' ? <Likelihood v={c.score} /> : <span className="num">{c.sig_weight}</span>}</td>
                        <td><References ev={rowEvidence(c)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {source === 'network' && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                    <b>Pathway score</b> is the summed −log10(FDR) over the KEGG pathways a compound and disease
                    share; an aggregate measure of how many strongly-enriched pathways they have in common,
                    not a single p-value. Higher means more shared enriched pathways. <b>Curated</b> rows come
                    straight from the CTD dataset with their PubMed references; <b>candidate</b> rows are
                    dataset pairs proposed by shared pathways but not yet curated.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* BY COMPOUND */}
        {mode === 'compound' && (
          <div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 360px' }}>
                <label className="fld">Compound name (or PubChem CID)</label>
                <input className="input" value={cname} placeholder="e.g. benzo(a)pyrene, formaldehyde, PM…" onChange={e => setCname(e.target.value)} onKeyDown={e => e.key === 'Enter' && runCompound()} />
              </div>
              <button className="btn btn-primary" onClick={runCompound} disabled={busy}>{busy ? <span className="spin" /> : 'Analyze'}</button>
            </div>
            {cRes && (
              <div className="fadein" style={{ marginTop: 22 }}>
                {!cRes.resolved ? (
                  <div className="muted" style={{ padding: '18px 0' }}>Couldn't resolve <b>{cRes.query}</b> to a PubChem structure; it may be a mixture or category (e.g. "air pollutants") with no single molecule to model.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
                      <span className="muted" style={{ fontSize: 13.5 }}>Results for <b style={{ color: 'var(--navy)' }}>{cRes.query}</b> <span className="mono" style={{ color: 'var(--text-3)' }}>· CID {cRes.cid}</span></span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(`etiomap_${cRes.query}.csv`,
                          [['Disease', 'Likelihood', 'Related compounds'], ...cRes.scores.map(s => [shortDisease(s.disease), s.likelihood, related(s.disease).join(' | ')])])}>Download CSV</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(`etiomap_${cRes.query}_with_references.csv`,
                          [['Disease', 'Likelihood', 'Related compounds', 'References'], ...cRes.scores.map(s => [shortDisease(s.disease), s.likelihood, related(s.disease).join(' | '), relatedRefsCell(s.disease)])])}>Download + references</button>
                      </div>
                    </div>
                    <table className="data">
                      <thead><tr><th>Disease</th><th>Likelihood</th><th>Related compounds <span className="muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(click for references)</span></th></tr></thead>
                      <tbody>
                        {cRes.scores.map((s, i) => (
                          <Fragment key={i}>
                            <tr>
                              <td style={{ fontWeight: 500 }}>
                                <button type="button" onClick={() => setOpenDisease(openDisease === s.disease ? null : s.disease)}
                                  title="Show all references for this disease"
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 500, color: openDisease === s.disease ? 'var(--emerald-700)' : 'var(--navy)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}>
                                  {shortDisease(s.disease)}</button>
                              </td>
                              <td style={{ minWidth: 160 }}><Likelihood v={s.likelihood} /></td>
                              <td style={{ fontSize: 13 }}><RelatedCompounds edges={relatedEdges(s.disease)} /></td>
                            </tr>
                            {openDisease === s.disease && (
                              <tr>
                                <td colSpan={3} style={{ background: 'var(--muted)', padding: '10px 12px' }}>
                                  <DiseaseRefs edges={relatedEdges(s.disease, 8)} disease={s.disease} compound={cRes.query} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* UPLOAD */}
        {mode === 'upload' && (
          <div>
            <label className="fld">Upload a CSV or text file of compounds (one per row, or a “ChemicalName” column)</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                {file ? file.name : 'Choose file'}
                <input type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0]); setURes(null) }} />
              </label>
              <button className="btn btn-primary" onClick={runUpload} disabled={busy || !file}>{busy ? <span className="spin" /> : 'Score list'}</button>
              <span className="muted" style={{ fontSize: 12.5 }}>Up to 200 compounds. Resolved live against PubChem.</span>
            </div>
            {uRes && (
              <div className="fadein" style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="muted" style={{ fontSize: 13.5 }}>{uRes.results.filter(r => r.resolved).length}/{uRes.count} resolved</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV('etiomap_scored.csv',
                    [['Compound', 'CID', 'Disease', 'Likelihood'], ...uRes.results.flatMap(r => r.resolved ? r.scores.map(s => [r.query, r.cid, shortDisease(s.disease), s.likelihood]) : [[r.query, '', 'unresolved', '']])])}>Download CSV</button>
                </div>
                <table className="data">
                  <thead><tr><th>Compound</th><th>Top disease</th><th>Likelihood</th><th>Also implicated</th></tr></thead>
                  <tbody>
                    {uRes.results.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{r.query}</td>
                        {r.resolved ? <>
                          <td>{shortDisease(r.top.disease)}</td>
                          <td style={{ minWidth: 150 }}><Likelihood v={r.top.likelihood} /></td>
                          <td className="muted" style={{ fontSize: 13 }}>{r.scores.slice(1, 3).map(s => `${shortDisease(s.disease)} ${(s.likelihood * 100).toFixed(0)}%`).join(', ')}</td>
                        </> : <td colSpan={3} className="muted" style={{ fontSize: 13 }}>unresolved (no single PubChem structure)</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {err && <div style={{ color: 'var(--danger)', marginTop: 16, fontSize: 14 }}>⚠ {err}</div>}
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
        Likelihood is the model's predicted probability of association from molecular descriptors; it is a research signal, not a clinical or diagnostic claim.
      </p>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
        The bracketed numbers in the Source column, <span className="num" style={{ color: 'var(--emerald-700)', fontWeight: 600 }}>[1] [2] [3]</span>, are references: each provides evidence of that compound and its association with the respective disease in the published literature. Click any number to open the cited article on PubMed.
      </p>
    </main>
  )
}
