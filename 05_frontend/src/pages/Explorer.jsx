import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { Logo } from '../components/Brand.jsx'
import { api, shortDisease, CLASS_COLOR } from '../api.js'

cytoscape.use(fcose)

const DIS_COLORS = ['#1e3a5f', '#0e7490', '#7c3aed', '#be123c', '#047857', '#b45309']
const DIS_R = 560

export default function Explorer() {
  const cyEl = useRef(null)
  const cy = useRef(null)
  const edgeBy = useRef({})
  const data = useRef(null)
  const selected = useRef(new Set())     // edge ids queued for CSV
  const sel = useRef({ node: null, edge: null })  // current focus selection
  const tipRef = useRef(null)

  const [classesList, setClasses] = useState([])
  const [f, setF] = useState({ classes: {}, known: true, novel: true, sig: 0, disease: '', modelOn: false, modelMin: 0.5, expandOn: false })
  const fRef = useRef(f); fRef.current = f
  const [counts, setCounts] = useState('loading…')
  const [detail, setDetail] = useState(null)
  const [selCount, setSelCount] = useState(0)
  const [inclModel, setInclModel] = useState(false)
  const [leftW, setLeftW] = useState(262)

  // drag-to-resize the left toolbar
  function startResize(e) {
    e.preventDefault()
    const move = ev => setLeftW(Math.max(210, Math.min(560, ev.clientX)))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); cy.current && cy.current.resize() }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const diseasePos = (i, n) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return { x: Math.cos(a) * DIS_R, y: Math.sin(a) * DIS_R } }

  useEffect(() => {
    api.networkFull().then(d => {
      data.current = d
      const cls = {}; d.classes.forEach(c => cls[c] = true)
      setClasses(d.classes)
      // set fRef synchronously so the first apply() (inside build) sees every class
      // enabled — otherwise the initial render shows 0/0/0 until "Show all" is clicked
      const ns = { ...fRef.current, classes: cls }
      fRef.current = ns; setF(ns)
      build(d)
    }).catch(e => setCounts('failed to load: ' + e.message))
    return () => { cy.current && cy.current.destroy() }
    // eslint-disable-next-line
  }, [])

  function build(d) {
    const els = []
    const n = d.disease_nodes.length
    d.disease_nodes.forEach((dn, i) => els.push({ data: { id: dn.id, label: shortDisease(dn.label), ntype: 'disease', color: DIS_COLORS[i % DIS_COLORS.length], known: dn.known, novel: dn.novel }, position: diseasePos(i, n) }))
    d.chemical_nodes.forEach(c => els.push({ data: { id: c.id, label: c.label, ntype: 'chem', cclass: c.compound_class, color: CLASS_COLOR[c.compound_class] || '#64748b', degree: c.degree } }))
    d.edges.forEach((e, i) => { const id = 'e' + i; edgeBy.current[id] = e; els.push({ data: { id, source: 'C:' + e.KEGG_ID, target: 'D:' + e.Disease, ltype: e.link_type, sig: e.sig_weight, model: e.model_score, cclass: e.compound_class, disease: e.Disease } }) })

    cy.current = cytoscape({
      container: cyEl.current, elements: els, minZoom: 0.1, maxZoom: 3,
      boxSelectionEnabled: true, selectionType: 'additive',
      style: [
        { selector: 'node[ntype="disease"]', style: { 'background-color': 'data(color)', 'label': 'data(label)', 'color': '#fff', 'font-family': 'Libre Franklin', 'font-size': 10.5, 'font-weight': 600, 'text-wrap': 'wrap', 'text-max-width': 78, 'text-valign': 'center', 'text-halign': 'center', 'shape': 'ellipse', 'width': 90, 'height': 90, 'text-outline-width': 2, 'text-outline-color': 'data(color)', 'border-width': 3, 'border-color': '#fff', 'z-index': 20 } },
        { selector: 'node[ntype="chem"]', style: { 'background-color': 'data(color)', 'label': 'data(label)', 'color': '#334155', 'font-family': 'IBM Plex Mono', 'font-size': 8.5, 'text-valign': 'bottom', 'text-margin-y': 2, 'text-wrap': 'wrap', 'text-max-width': 90, 'width': 'mapData(degree,1,6,14,34)', 'height': 'mapData(degree,1,6,14,34)', 'border-width': 1.5, 'border-color': '#fff', 'z-index': 6 } },
        { selector: 'node[ntype="path"]', style: { 'background-color': '#e0f2fe', 'shape': 'round-rectangle', 'label': 'data(label)', 'color': '#155e75', 'font-family': 'IBM Plex Mono', 'font-size': 8, 'text-valign': 'center', 'text-wrap': 'wrap', 'text-max-width': 104, 'width': 116, 'height': 28, 'border-width': 1, 'border-color': '#0e7490', 'z-index': 14 } },
        { selector: 'edge', style: { 'curve-style': 'straight', 'width': 'mapData(sig,1,50,1.2,5.5)', 'line-color': '#059669', 'opacity': 0.5, 'z-index': 1 } },
        { selector: 'edge[ltype="novel_candidate"]', style: { 'line-color': '#94a3b8', 'line-style': 'dashed', 'opacity': 0.4 } },
        { selector: 'edge[ntype="path"]', style: { 'line-color': '#0ea5e9', 'width': 1.6, 'opacity': 0.85, 'line-style': 'dotted', 'z-index': 12 } },
        { selector: 'node.dim', style: { 'opacity': 0.16 } },
        { selector: 'edge.dim', style: { 'opacity': 0.05 } },
        { selector: 'node.hl', style: { 'opacity': 1 } },
        { selector: 'edge.hl', style: { 'opacity': 0.95 } },
        { selector: 'node.sel', style: { 'border-width': 3.5, 'border-color': '#059669' } },
        { selector: '.hidden', style: { 'display': 'none' } },
      ],
    })
    if (import.meta.env && import.meta.env.DEV) window.__cy = cy.current
    layout(); wire(); apply()
  }

  function layout() {
    const d = data.current, n = d.disease_nodes.length
    const snap = () => d.disease_nodes.forEach((dn, i) => { const x = cy.current.getElementById(dn.id); if (x) x.position(diseasePos(i, n)) })
    snap(); cy.current.nodes('[ntype="disease"]').lock()
    const fixed = d.disease_nodes.map((dn, i) => ({ nodeId: dn.id, position: diseasePos(i, n) }))
    const l = cy.current.layout({ name: 'fcose', animate: false, fit: false, randomize: true, nodeSeparation: 220, idealEdgeLength: 210, nodeRepulsion: 17000, nodeDimensionsIncludeLabels: true, fixedNodeConstraint: fixed })
    l.one('layoutstop', () => { snap(); cy.current.nodes('[ntype="disease"]').unlock(); cy.current.fit(undefined, 60) })
    l.run()
  }

  function passEdge(e) {
    const s = fRef.current
    if (!s.known && e.link_type === 'known') return false
    if (!s.novel && e.link_type === 'novel_candidate') return false
    if (e.sig_weight < s.sig) return false
    if (!s.classes[e.compound_class]) return false
    if (s.modelOn) { const m = e.model_score == null ? -1 : e.model_score; if (m < s.modelMin) return false }
    return true   // disease is a FOCUS (dim), not a hard filter; see refreshHighlight
  }

  function apply() {
    if (!cy.current) return
    const vis = new Set(), vd = new Set(); let ne = 0
    cy.current.batch(() => {
      cy.current.edges('[!ntype]').forEach(ed => { const e = edgeBy.current[ed.id()]; const ok = passEdge(e); ed.toggleClass('hidden', !ok); if (ok) { ne++; vis.add('C:' + e.KEGG_ID); vd.add('D:' + e.Disease) } })
      cy.current.nodes('[ntype="chem"]').forEach(nd => nd.toggleClass('hidden', !vis.has(nd.id())))
      cy.current.nodes('[ntype="disease"]').forEach(nd => nd.toggleClass('hidden', !vd.has(nd.id())))
    })
    refreshHighlight()
    setCounts(`${vis.size} compounds · ${vd.size} diseases · ${ne} associations`)
  }

  // unified highlight: a clicked compound/edge, else the focused disease, dims the rest faintly
  function refreshHighlight() {
    const cyc = cy.current; if (!cyc) return
    cyc.elements().removeClass('dim hl sel')
    const s = fRef.current
    let focus = null, selnodes = null
    if (sel.current.group && selected.current.size) {
      let edges = cyc.collection()
      selected.current.forEach(id => { const ed = cyc.getElementById(id); if (ed && ed.length && !ed.hasClass('hidden')) edges = edges.union(ed) })
      if (edges.length) { selnodes = edges.connectedNodes('[ntype="chem"]'); focus = edges.union(edges.connectedNodes()) }
    } else if (sel.current.node) {
      selnodes = cyc.getElementById('C:' + sel.current.node)
      const edges = cyc.edges('[!ntype]').not('.hidden').filter(ed => edgeBy.current[ed.id()].KEGG_ID === sel.current.node)
      focus = edges.union(selnodes).union(edges.connectedNodes())
    } else if (sel.current.edge) {
      const ed = cyc.getElementById(sel.current.edge)
      if (ed.length && !ed.hasClass('hidden')) focus = ed.union(ed.connectedNodes())
    } else if (s.disease) {
      const dn = cyc.getElementById('D:' + s.disease)
      const edges = cyc.edges('[!ntype]').not('.hidden').filter(ed => edgeBy.current[ed.id()].Disease === s.disease)
      focus = edges.union(dn).union(edges.connectedNodes())
    }
    if (focus) {
      cyc.elements().not('.hidden').not('[ntype="path"]').addClass('dim')
      focus.removeClass('dim').addClass('hl')
      if (selnodes && selnodes.length) selnodes.removeClass('dim').addClass('sel')
    }
  }

  // set fRef synchronously (works from React AND Cytoscape event contexts), then re-apply
  function update(patch) { const ns = { ...fRef.current, ...patch }; fRef.current = ns; setF(ns); setTimeout(apply, 0) }
  function setClass(c, v) { const ns = { ...fRef.current, classes: { ...fRef.current.classes, [c]: v } }; fRef.current = ns; setF(ns); setTimeout(apply, 0) }
  function setFocus(real) { sel.current = { node: null, edge: null }; selected.current.clear(); setSelCount(0); setDetail(null); clearPath(); update({ disease: real }) }
  function preset(kind) {
    const cls = {}; classesList.forEach(c => cls[c] = kind === 'env' ? c === 'environmental' : true)
    sel.current = { node: null, edge: null }; selected.current.clear(); setSelCount(0); setDetail(null); clearPath()
    const ns = { ...fRef.current, classes: cls, known: true, novel: kind !== 'known', sig: 0, disease: '' }
    fRef.current = ns; setF(ns); setTimeout(apply, 0)
  }

  function wire() {
    const tip = tipRef.current
    cy.current.on('mouseover', 'node,edge', ev => {
      const t = ev.target; let h = ''
      if (t.isNode() && t.data('ntype') === 'chem') h = `<b>${t.data('label')}</b><br>${t.data('cclass')} · ${t.data('degree')} link(s)`
      else if (t.isNode() && t.data('ntype') === 'disease') h = `<b>${t.data('label')}</b><br>${t.data('known')} known · ${t.data('novel')} novel<br><span style="color:#94a3b8">click to focus</span>`
      else if (t.isNode() && t.data('ntype') === 'path') h = `pathway<br><b>${t.data('full') || t.data('label')}</b>` + (t.data('kegg') ? `<br><span style="color:#94a3b8">KEGG ${t.data('kegg')} · click to cite</span>` : '')
      else if (t.isEdge() && edgeBy.current[t.id()]) { const e = edgeBy.current[t.id()]; h = `<b>${e.ChemicalName} → ${shortDisease(e.Disease)}</b><br>${e.link_type === 'known' ? 'known' : 'novel candidate'} · sig ${e.sig_weight}` + (e.model_score != null ? `<br>model ${e.model_score}` : '') + (e.n_pmids ? `<br>${e.n_pmids} reference(s)` : '') }
      if (h) { tip.innerHTML = h; tip.style.display = 'block' }
    })
    cy.current.on('mousemove', ev => { tip.style.left = (ev.originalEvent.clientX + 14) + 'px'; tip.style.top = (ev.originalEvent.clientY + 14) + 'px' })
    cy.current.on('mouseout', 'node,edge', () => tip.style.display = 'none')
    cy.current.on('tap', 'edge[!ntype]', ev => showEdge(ev.target.id()))
    cy.current.on('tap', 'node[ntype="chem"]', ev => { const o = ev.originalEvent; if (!(o && o.shiftKey)) selected.current.clear(); showChem(ev.target) })
    cy.current.on('tap', 'node[ntype="disease"]', ev => { const real = ev.target.id().slice(2); setFocus(fRef.current.disease === real ? '' : real) })
    cy.current.on('tap', 'node[ntype="path"]', ev => { const n = ev.target; setDetail({ type: 'path', full: n.data('full') || n.data('label'), kegg: n.data('kegg'), diseases: n.data('diseases') }) })
    cy.current.on('tap', ev => { if (ev.target === cy.current) { sel.current = { node: null, edge: null }; selected.current.clear(); setDetail(null); setSelCount(0); clearPath(); refreshHighlight() } })
    // marquee box selection (shift-drag): buffer the box-selected eles, flush after the boxselect events fire
    const boxBuf = []
    cy.current.on('boxselect', 'node[ntype="chem"], edge[!ntype]', ev => boxBuf.push(ev.target))
    cy.current.on('boxend', () => setTimeout(() => { if (boxBuf.length) { commitGroup(boxBuf.slice()); boxBuf.length = 0 } }, 0))
  }

  // add box-selected compounds (all their visible edges) and edges to the download set, as a group
  function commitGroup(eles) {
    eles.forEach(el => {
      if (el.isEdge()) { if (!el.hasClass('hidden')) selected.current.add(el.id()) }
      else { const kid = el.id().slice(2); cy.current.edges('[!ntype]').not('.hidden').filter(ed => edgeBy.current[ed.id()].KEGG_ID === kid).forEach(ed => selected.current.add(ed.id())) }
    })
    cy.current.elements().unselect()                 // drop native selection; we use our own .sel/.hl styling
    sel.current = { node: null, edge: null, group: true }
    setSelCount(selected.current.size); setDetail(groupSummary()); clearPath(); refreshHighlight()
  }
  function groupSummary() {
    const cset = new Set(), dset = new Set(); let known = 0, novel = 0
    selected.current.forEach(id => { const e = edgeBy.current[id]; if (!e) return; cset.add(e.KEGG_ID); dset.add(e.Disease); if (e.link_type === 'known') known++; else novel++ })
    return { type: 'group', n: selected.current.size, nc: cset.size, nd: dset.size, known, novel }
  }
  function selectAllVisible() {
    if (!cy.current) return
    cy.current.edges('[!ntype]').not('.hidden').forEach(ed => selected.current.add(ed.id()))
    sel.current = { node: null, edge: null, group: true }
    setSelCount(selected.current.size); setDetail(selected.current.size ? groupSummary() : null); clearPath(); refreshHighlight()
  }
  function clearSelection() {
    sel.current = { node: null, edge: null }; selected.current.clear(); setSelCount(0); setDetail(null)
    if (cy.current) { cy.current.elements().unselect(); refreshHighlight() }
  }

  function showChem(node) {
    const kid = node.id().slice(2)
    sel.current = { node: kid, edge: null }
    const edges = cy.current.edges('[!ntype]').not('.hidden').filter(ed => edgeBy.current[ed.id()].KEGG_ID === kid)
    edges.forEach(ed => selected.current.add(ed.id())); setSelCount(selected.current.size)
    const assoc = edges.map(ed => edgeBy.current[ed.id()]).sort((a, b) => b.sig_weight - a.sig_weight)
    setDetail({ type: 'chem', label: node.data('label'), kegg: kid, cclass: node.data('cclass'), assoc })
    refreshHighlight()
    if (fRef.current.expandOn) expandPathways(node)
  }
  function showEdge(id) {
    const e = edgeBy.current[id]
    sel.current = { node: null, edge: id }
    selected.current = new Set([id]); setSelCount(1)
    setDetail({ type: 'edge', e })
    refreshHighlight()
  }

  function clearPath() { if (cy.current) { cy.current.remove('[ntype="path"]'); cy.current.remove('edge[ntype="path"]') } }
  // expand pathways for the selected compound; placed manually between it and its diseases
  function expandPathways(node) {
    clearPath()
    const cyc = cy.current, kid = node.id().slice(2), cpos = node.position()
    const edges = cyc.edges('[!ntype]').not('.hidden').filter(ed => edgeBy.current[ed.id()].KEGG_ID === kid)
    const pmap = {}
    edges.forEach(ed => { const e = edgeBy.current[ed.id()]; (e.pathways || '').split('; ').filter(Boolean).forEach(pw => { (pmap[pw] = pmap[pw] || new Set()).add(e.Disease) }) })
    // show the pathways that bridge the most diseases first; cap to keep it readable
    const pws = Object.keys(pmap).sort((a, b) => pmap[b].size - pmap[a].size).slice(0, 14)
    if (!pws.length) { setDetail({ type: 'hint', text: `${node.data('label')} has no mapped pathways to expand.` }); return }
    const add = []
    pws.forEach((pw, i) => {
      let ax = 0, ay = 0, k = 0
      pmap[pw].forEach(d => { const dn = cyc.getElementById('D:' + d); if (dn.length) { ax += dn.position('x'); ay += dn.position('y'); k++ } })
      ax /= (k || 1); ay /= (k || 1)
      const t = 0.42
      const bx = cpos.x + (ax - cpos.x) * t, by = cpos.y + (ay - cpos.y) * t
      const ang = (i / Math.max(pws.length, 1)) * 2 * Math.PI + 0.6
      const px = bx + Math.cos(ang) * 95, py = by + Math.sin(ang) * 95
      const pid = (data.current.meta && data.current.meta.pathway_ids || {})[pw] || null
      add.push({ data: { id: 'P:' + pw, label: pw.length > 22 ? pw.slice(0, 21) + '…' : pw, full: pw, kegg: pid, diseases: [...pmap[pw]].map(shortDisease).join(', '), ntype: 'path' }, position: { x: px, y: py } })
      add.push({ data: { id: 'pe:' + kid + ':' + pw, source: node.id(), target: 'P:' + pw, ntype: 'path' } })
      pmap[pw].forEach(d => add.push({ data: { id: 'pe2:' + pw + ':' + d, source: 'P:' + pw, target: 'D:' + d, ntype: 'path' } }))
    })
    cyc.add(add)
    // make the expansion unmistakable: zoom to the compound, its diseases and the new pathway nodes
    const foc = node.union(edges.connectedNodes()).union(cyc.$('[ntype="path"]'))
    cyc.animate({ fit: { eles: foc, padding: 90 }, duration: 350, easing: 'ease-out' })
  }
  function toggleExpand(v) {
    update({ expandOn: v }); clearPath()
    const node = sel.current.node ? cy.current.getElementById('C:' + sel.current.node) : null
    if (v && node && node.length) expandPathways(node)
    else if (v) setDetail({ type: 'hint', text: 'Select a compound in the graph; its pathways will then appear between it and its diseases.' })
  }

  function download() {
    const cols = ['ChemicalName', 'KEGG_ID', 'Disease', 'link_type', 'compound_class', 'sig_weight', 'shared_pathways', ...(inclModel ? ['model_score'] : []), 'evidence', 'n_pmids', 'pathways', 'pmids', 'pubmed_url']
    const rows = [cols.join(',')]
    selected.current.forEach(id => { const e = edgeBy.current[id]; rows.push(cols.map(c => { let v = e[c]; if (Array.isArray(v)) v = v.join(' '); v = (v == null ? '' : String(v)).replace(/"/g, '""'); return /[",\n]/.test(v) ? `"${v}"` : v }).join(',')) })
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = 'etiomap_associations.csv'; a.click()
  }

  const SW = ({ c }) => <span style={{ width: 11, height: 11, borderRadius: 3, background: c, display: 'inline-block', flex: '0 0 auto' }} />

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', background: 'var(--bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <Logo size={24} />
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>network explorer</span>
        <div style={{ flex: 1 }} />
        <NavLink to="/" end className="navlink">Home</NavLink>
        <NavLink to="/analyze" className="navlink">Analyze</NavLink>
        <NavLink to="/explorer" className="navlink">Network</NavLink>
        <NavLink to="/your-data" className="navlink">Data</NavLink>
        <NavLink to="/air" className="navlink">Exposure Risk</NavLink>
        <NavLink to="/about" className="navlink">About</NavLink>
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />
        <button className="btn btn-ghost btn-sm" onClick={() => cy.current && cy.current.fit(undefined, 60)}>Reset view</button>
        <button className="btn btn-ghost btn-sm" onClick={() => layout()}>Re-layout</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: `${leftW}px 1fr 300px`, minHeight: 0, position: 'relative' }}>
        {/* drag handle to resize the left toolbar */}
        <div onMouseDown={startResize} title="Drag to resize"
          style={{ position: 'absolute', left: leftW - 3, top: 0, bottom: 0, width: 7, cursor: 'col-resize', zIndex: 30 }}
          onMouseEnter={e => e.currentTarget.firstChild.style.background = 'var(--emerald)'}
          onMouseLeave={e => e.currentTarget.firstChild.style.background = 'transparent'}>
          <div style={{ width: 2, height: '100%', margin: '0 auto', background: 'transparent', transition: 'background .15s' }} />
        </div>
        <aside style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 16 }}>
          <Grp title="Quick presets">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all', 'Show all'], ['env', 'Environmental'], ['known', 'Known only']].map(([k, l]) => (
                <button key={k} className="btn btn-ghost btn-sm" style={{ flex: 1, minWidth: 80 }} onClick={() => preset(k)}>{l}</button>
              ))}
            </div>
          </Grp>
          <Grp title="Focus disease">
            <select className="input" style={{ padding: 8, fontSize: 13 }} value={f.disease} onChange={e => setFocus(e.target.value)}>
              <option value="">All diseases</option>
              {(data.current?.diseases || []).map(d => <option key={d} value={d}>{shortDisease(d)}</option>)}
            </select>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Or click a disease in the graph. Others fade, not vanish.</div>
          </Grp>
          <Grp title={<>Pathway score <b className="mono" style={{ color: 'var(--emerald-700)' }}>{f.sig.toFixed(1)}</b></>}>
            <input type="range" min="0" max="50" step="0.5" value={f.sig} onChange={e => update({ sig: +e.target.value })} style={{ width: '100%', accentColor: 'var(--emerald)' }} />
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>summed −log10(FDR) across shared pathways</div>
            <div style={{ marginTop: 12 }}>
              <Toggle label="Expand pathways" on={f.expandOn} onClick={() => toggleExpand(!f.expandOn)} />
              <div className="muted" style={{ fontSize: 11 }}>Select a compound, then expand to see the pathways it acts through.</div>
            </div>
          </Grp>
          <Grp title="Compound class">
            {classesList.map(c => (
              <label key={c} style={row}><input type="checkbox" checked={!!f.classes[c]} onChange={e => setClass(c, e.target.checked)} /><SW c={CLASS_COLOR[c]} />{c}</label>
            ))}
          </Grp>
          <Grp title="Association type">
            <label style={row}><input type="checkbox" checked={f.known} onChange={e => update({ known: e.target.checked })} /><span style={{ width: 16, borderTop: '3px solid var(--known)' }} /> Known (curated)</label>
            <label style={row}><input type="checkbox" checked={f.novel} onChange={e => update({ novel: e.target.checked })} /><span style={{ width: 16, borderTop: '3px dashed var(--novel)' }} /> Novel candidate</label>
          </Grp>
          <Grp title="Group select">
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={selectAllVisible}>Select all visible</button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={selCount === 0} onClick={clearSelection}>Clear</button>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>Shift-drag a box on the graph to select many associations at once. Selected: <b className="num">{selCount}</b>.</div>
          </Grp>
          <Grp title="Layers">
            <Toggle label="Model predictions" on={f.modelOn} onClick={() => update({ modelOn: !f.modelOn })} />
            {f.modelOn && <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0' }}>min score {f.modelMin.toFixed(2)}
              <input type="range" min="0" max="1" step="0.01" value={f.modelMin} onChange={e => update({ modelMin: +e.target.value })} style={{ width: '100%', accentColor: 'var(--emerald)' }} /></div>}
          </Grp>
        </aside>

        <div style={{ position: 'relative', minHeight: 0 }}>
          <div ref={cyEl} style={{ width: '100%', height: '100%' }} />
          <div className="mono" style={{ position: 'absolute', top: 12, left: 14, fontSize: 11.5, color: 'var(--text-2)', background: 'rgba(255,255,255,.82)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', pointerEvents: 'none' }}>{counts}</div>
          <div style={{ position: 'absolute', bottom: 14, right: 16, fontSize: 12, background: 'rgba(255,255,255,.92)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', pointerEvents: 'none', lineHeight: 1.75, boxShadow: 'var(--shadow-sm)' }}>
            <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 5 }}>Legend</div>
            {classesList.map(c => <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7 }}><SW c={CLASS_COLOR[c]} />{c}</div>)}
            <div style={{ marginTop: 5, display: 'flex', gap: 12 }}><span><span style={{ display: 'inline-block', width: 16, borderTop: '3px solid var(--known)', verticalAlign: 'middle' }} /> known</span><span><span style={{ display: 'inline-block', width: 16, borderTop: '3px dashed var(--novel)', verticalAlign: 'middle' }} /> novel</span></div>
          </div>
        </div>

        <aside style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {!detail && <><h3 style={{ fontSize: 15, marginBottom: 6 }}>Details</h3><p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>Click a compound or an edge to inspect the association, its shared pathways, the model score, and the literature sources. Click a disease to focus it. Shift-click compounds to multi-select, or shift-drag a box on the graph to group-select many at once, then download with references.</p></>}
            {detail?.type === 'chem' && <DetailChem d={detail} onPick={showEdge} edgeBy={edgeBy} />}
            {detail?.type === 'edge' && <DetailEdge e={detail.e} />}
            {detail?.type === 'group' && <DetailGroup d={detail} onClear={clearSelection} />}
            {detail?.type === 'path' && <DetailPath d={detail} />}
            {detail?.type === 'hint' && <p className="muted fadein" style={{ fontSize: 13, lineHeight: 1.7 }}>{detail.text}</p>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 10, color: 'var(--text-2)' }}>
            <input type="checkbox" checked={inclModel} onChange={e => setInclModel(e.target.checked)} /> Include model score in CSV
          </label>
          <button className="btn btn-primary" disabled={selCount === 0} onClick={download} style={{ marginTop: 8, justifyContent: 'center' }}>Download selected ({selCount}) CSV</button>
        </aside>
      </div>
      <div ref={tipRef} style={{ position: 'fixed', zIndex: 60, pointerEvents: 'none', display: 'none', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, maxWidth: 260, boxShadow: 'var(--shadow)', color: 'var(--text)' }} />
    </div>
  )
}

const row = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', cursor: 'pointer' }
function Grp({ title, children }) {
  return <div style={{ marginBottom: 18 }}><div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 8 }}>{title}</div>{children}</div>
}
function Toggle({ label, on, onClick }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '5px 0' }}><span>{label}</span>
    <div onClick={onClick} style={{ position: 'relative', width: 38, height: 21, borderRadius: 11, background: on ? 'var(--emerald)' : 'var(--border-strong)', cursor: 'pointer', transition: '.2s' }}>
      <i style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 17, height: 17, background: '#fff', borderRadius: '50%', transition: '.2s' }} /></div></div>
}
function DetailChem({ d }) {
  const paths = [...new Set(d.assoc.flatMap(e => (e.pathways || '').split('; ').filter(Boolean)))]
  return <div className="fadein">
    <h3 style={{ fontSize: 17 }}>{d.label}</h3>
    <div className="mono muted" style={{ fontSize: 12 }}>KEGG {d.kegg} · <span style={{ color: CLASS_COLOR[d.cclass] }}>{d.cclass}</span></div>
    <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', margin: '12px 0 6px' }}>Disease associations</div>
    <div>{d.assoc.map((e, i) => (
      <div key={i} className="card" style={{ padding: 9, marginBottom: 7, fontSize: 12.5, boxShadow: 'none' }}>
        <div style={{ fontWeight: 500 }}>{shortDisease(e.Disease)} <span className={`tag ${e.link_type === 'known' ? 'tag-known' : 'tag-novel'}`}>{e.link_type === 'known' ? 'known' : 'novel'}</span></div>
        <div className="muted" style={{ fontSize: 12 }}>score {e.sig_weight}{e.model_score != null ? ` · likelihood ${e.model_score}` : ''}{e.n_pmids ? ` · ${e.n_pmids} refs` : ''}</div>
      </div>))}</div>
    {paths.length > 0 && <div style={{ marginTop: 12 }}>
      <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 6 }}>Pathways ({paths.length})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {paths.map(p => <span key={p} className="tag" style={{ background: '#e0f2fe', color: '#155e75', fontSize: 11, fontWeight: 500 }}>{p}</span>)}
      </div>
    </div>}
  </div>
}
function DetailGroup({ d, onClear }) {
  return <div className="fadein">
    <h3 style={{ fontSize: 16 }}>Group selection</h3>
    <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 4 }}>{d.n} association{d.n === 1 ? '' : 's'} across <b className="num">{d.nc}</b> compound{d.nc === 1 ? '' : 's'} and <b className="num">{d.nd}</b> disease{d.nd === 1 ? '' : 's'}.</p>
    <div style={{ margin: '8px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <span className="tag tag-known">{d.known} known</span>
      <span className="tag tag-novel">{d.novel} novel</span>
    </div>
    <button className="btn btn-ghost btn-sm" onClick={onClear} style={{ marginTop: 2 }}>Clear selection</button>
    <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Use the button below to export the whole group as one CSV.</p>
  </div>
}
function DetailPath({ d }) {
  return <div className="fadein">
    <div className="mono muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>KEGG pathway</div>
    <h3 style={{ fontSize: 16, marginTop: 4, lineHeight: 1.3 }}>{d.full}</h3>
    {d.diseases && <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 6 }}>Bridges: {d.diseases}</p>}
    {d.kegg
      ? <div style={{ marginTop: 10 }}><a href={`https://www.kegg.jp/pathway/${d.kegg}`} target="_blank" rel="noreferrer" style={{ color: 'var(--emerald-700)', fontSize: 13 }}>View pathway {d.kegg} on KEGG ↗</a></div>
      : <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>No KEGG map id on record.</p>}
    <p className="muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.6 }}>The compound and disease are linked through this pathway because both are enriched for it (hypergeometric FDR &lt; 0.05). The KEGG entry is the source reference.</p>
  </div>
}
function DetailEdge({ e }) {
  return <div className="fadein">
    <h3 style={{ fontSize: 16 }}>{e.ChemicalName} → {shortDisease(e.Disease)}</h3>
    <div style={{ margin: '8px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <span className={`tag ${e.link_type === 'known' ? 'tag-known' : 'tag-novel'}`}>{e.link_type === 'known' ? 'known association' : 'novel candidate'}</span>
      <span className="tag" style={{ background: (CLASS_COLOR[e.compound_class] || '#64748b') + '22', color: CLASS_COLOR[e.compound_class] }}>{e.compound_class}</span>
    </div>
    {[['Pathway score', e.sig_weight], ['Shared pathways', e.shared_pathways], ...(e.model_score != null ? [['Disease likelihood', e.model_score]] : []), ...(e.evidence?.length ? [['CTD evidence', e.evidence.join(', ')]] : []), ['References', e.n_pmids || 0]].map(([k, v], i) => (
      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', borderBottom: '1px solid var(--muted)' }}><span className="muted">{k}</span><span className="num">{v}</span></div>
    ))}
    <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 10 }}><b style={{ color: 'var(--navy)' }}>Acts through:</b><br />{(e.pathways || 'none').split('; ').join('  ·  ')}</div>
    {e.link_type === 'known'
      ? (e.pmids?.length
        ? <div style={{ marginTop: 10 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>References</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {e.pmids.map((p, i) => (
                <a key={p} href={`https://pubmed.ncbi.nlm.nih.gov/${p}/`} target="_blank" rel="noreferrer"
                  style={{ color: 'var(--emerald-700)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }} title={`PubMed ${p}`}>[{i + 1}] {p}</a>
              ))}
            </div>
          </div>
        : (e.pubmed_url
          ? <div style={{ marginTop: 10 }}><a href={e.pubmed_url} target="_blank" rel="noreferrer" style={{ color: 'var(--emerald-700)', fontSize: 13 }}>View {e.n_pmids} reference(s) on PubMed ↗</a></div>
          : <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>Curated association (CTD).</div>))
      : <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>Candidate: proposed by shared pathways, no direct reference yet.</div>}
  </div>
}
