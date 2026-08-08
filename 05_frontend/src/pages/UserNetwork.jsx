// User-data network — SEPARATE, REVERTIBLE ADD-ON PAGE.
// Upload a CSV and get a chemical–disease network back. Two shapes are accepted:
//   • an association list (chemical + disease columns) -> drawn as-is
//   • a compound list (chemical column only) -> scored by the model, edges = predictions
// Self-contained: its own Cytoscape instance + built-in 'cose' layout (no fcose),
// so it does not touch the Explorer page. To revert: delete this file, its route in
// App.jsx, its nav link in Brand.jsx, and the userNetwork method in api.js.
import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import { api, shortDisease } from '../api.js'

const LINK_COLOR = { known: '#059669', predicted: '#6366f1', user: '#64748b' }

export default function UserNetwork() {
  const elRef = useRef(null)
  const cyRef = useRef(null)
  const tipRef = useRef(null)
  const [file, setFile] = useState(null)
  const [minScore, setMinScore] = useState(0.5)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [net, setNet] = useState(null)

  useEffect(() => () => { cyRef.current && cyRef.current.destroy() }, [])

  async function build() {
    if (!file) return
    setBusy(true); setErr(''); setNet(null)
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
    try {
      const d = await api.userNetwork(file, minScore)
      setNet(d)
      setTimeout(() => renderGraph(d), 0)   // let the container mount first
    } catch (e) { setErr('' + e.message) } finally { setBusy(false) }
  }

  function renderGraph(d) {
    if (!elRef.current) return
    if (cyRef.current) { cyRef.current.destroy() }
    const weights = d.edges.map(e => e.weight).filter(w => typeof w === 'number')
    const wmin = weights.length ? Math.min(...weights) : 0
    const wmax = weights.length ? Math.max(...weights) : 1
    const wnorm = (w) => (typeof w !== 'number' || wmax === wmin) ? 2.6 : 1.4 + (w - wmin) / (wmax - wmin) * 5

    const els = [
      ...d.nodes.map(n => ({ data: { ...n, dlabel: n.ntype === 'disease' ? shortDisease(n.label) : n.label } })),
      ...d.edges.map(e => ({ data: { ...e, w: wnorm(e.weight), col: LINK_COLOR[e.link_type] || LINK_COLOR.user } })),
    ]
    const cy = cytoscape({
      container: elRef.current, elements: els, minZoom: 0.2, maxZoom: 3,
      style: [
        { selector: 'node[ntype="disease"]', style: { 'background-color': '#1e3a5f', label: 'data(dlabel)', color: '#fff', 'font-family': 'IBM Plex Sans', 'font-size': 12, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': 110, 'text-valign': 'center', 'text-halign': 'center', shape: 'round-rectangle', width: 128, height: 42, 'text-outline-width': 2, 'text-outline-color': '#1e3a5f', 'border-width': 2, 'border-color': '#fff', 'z-index': 20 } },
        { selector: 'node[ntype="chem"]', style: { 'background-color': '#059669', label: 'data(dlabel)', color: '#334155', 'font-family': 'IBM Plex Mono', 'font-size': 9, 'text-valign': 'bottom', 'text-margin-y': 2, 'text-wrap': 'wrap', 'text-max-width': 96, width: 18, height: 18, 'border-width': 1.5, 'border-color': '#fff', 'z-index': 6 } },
        { selector: 'edge', style: { 'curve-style': 'straight', width: 'data(w)', 'line-color': 'data(col)', opacity: 0.72 } },
        { selector: 'edge[link_type="predicted"]', style: { 'line-style': 'dashed' } },
      ],
    })
    cyRef.current = cy
    cy.layout({ name: 'cose', animate: false, padding: 50, nodeRepulsion: 9000, idealEdgeLength: 110, nodeDimensionsIncludeLabels: true }).run()
    cy.fit(undefined, 40)

    const tip = tipRef.current
    cy.on('mouseover', 'node,edge', ev => {
      const t = ev.target; let h = ''
      if (t.isNode() && t.data('ntype') === 'chem') h = `<b>${t.data('label')}</b>${t.data('pubchem_cid') ? `<br>PubChem CID ${t.data('pubchem_cid')}` : ''}`
      else if (t.isNode()) h = `<b>${t.data('label')}</b>`
      else { const e = t.data(); h = `<b>${e.source.slice(2)} → ${e.target.slice(2)}</b><br>${e.link_type}${typeof e.weight === 'number' ? ` · ${e.weight}` : ''}${e.n_pmids ? ` · ${e.n_pmids} refs` : ''}` }
      if (h) { tip.innerHTML = h; tip.style.display = 'block' }
    })
    cy.on('mousemove', ev => { tip.style.left = (ev.originalEvent.clientX + 14) + 'px'; tip.style.top = (ev.originalEvent.clientY + 14) + 'px' })
    cy.on('mouseout', 'node,edge', () => { tip.style.display = 'none' })
    if (import.meta.env && import.meta.env.DEV) window.__ucy = cy
  }

  function downloadCSV() {
    if (!net) return
    const cols = ['source_chemical', 'target_disease', 'link_type', 'weight']
    const rows = [cols.join(',')]
    net.edges.forEach(e => rows.push([e.source.slice(2), e.target.slice(2), e.link_type, e.weight ?? '']
      .map(v => { v = String(v).replace(/"/g, '""'); return /[",\n]/.test(v) ? `"${v}"` : v }).join(',')))
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    a.download = 'etiomap_user_network.csv'; a.click()
  }

  const m = net?.meta

  return (
    <main className="wrap fadein" style={{ paddingTop: 40, minHeight: '72vh' }}>
      <span className="eyebrow">Your data</span>
      <h1 className="serif" style={{ fontSize: 38, marginTop: 10 }}>Build a network from your own dataset.</h1>
      <p className="muted" style={{ maxWidth: 680, marginTop: 8, lineHeight: 1.7 }}>
        Upload a CSV and EtioMap draws the corresponding chemical–disease network. Two formats work:
      </p>
      <ul className="muted" style={{ maxWidth: 680, fontSize: 14.5, lineHeight: 1.8, paddingLeft: 20 }}>
        <li><b>Association list</b> — columns for a <span className="mono">chemical</span> and a <span className="mono">disease</span> (optional <span className="mono">weight</span> / <span className="mono">link_type</span>). Drawn exactly as given.</li>
        <li><b>Compound list</b> — just a <span className="mono">chemical</span> column. Each compound is resolved on PubChem and scored by the model against the six diseases; edges are <b>predictions</b> above the likelihood threshold.</li>
      </ul>

      <div className="card" style={{ padding: 22, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            {file ? file.name : 'Choose CSV file'}
            <input type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0]); setNet(null); setErr('') }} />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 }}>
            <label className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>Min likelihood <b style={{ color: 'var(--emerald-700)' }}>{minScore.toFixed(2)}</b> <span style={{ opacity: .7 }}>(compound-list mode)</span></label>
            <input type="range" min="0" max="1" step="0.01" value={minScore} onChange={e => setMinScore(+e.target.value)} style={{ width: 220, accentColor: 'var(--emerald)' }} />
          </div>
          <button className="btn btn-primary" onClick={build} disabled={busy || !file}>{busy ? <span className="spin" /> : 'Build network'}</button>
        </div>
        {err && <div style={{ color: 'var(--danger)', marginTop: 14, fontSize: 14 }}>⚠ {err}</div>}
      </div>

      {net && (
        <div className="fadein" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 13.5 }}>
              <span className={`tag ${net.mode === 'predict' ? 'tag-model' : 'tag-known'}`} style={{ marginRight: 8 }}>{net.mode === 'predict' ? 'predicted' : 'from your file'}</span>
              {m.n_chem} compound{m.n_chem === 1 ? '' : 's'} · {m.n_disease} disease{m.n_disease === 1 ? '' : 's'} · {m.n_edges} edge{m.n_edges === 1 ? '' : 's'}
              {m.unresolved?.length ? ` · ${m.unresolved.length} unresolved` : ''}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={downloadCSV}>Download network CSV</button>
          </div>
          <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--surface)' }}>
            <div ref={elRef} style={{ width: '100%', height: 520 }} />
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>{m.note}</p>
          {m.unresolved?.length ? <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Unresolved (no single PubChem structure): {m.unresolved.join(', ')}</p> : null}
        </div>
      )}
      <div ref={tipRef} style={{ position: 'fixed', zIndex: 60, pointerEvents: 'none', display: 'none', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, maxWidth: 260, boxShadow: 'var(--shadow)', color: 'var(--text)' }} />
    </main>
  )
}
