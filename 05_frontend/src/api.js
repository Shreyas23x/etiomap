// Thin API layer. In dev, Vite proxies /api -> FastAPI (see vite.config.js).
const J = async (url, opts) => {
  const r = await fetch(url, opts)
  if (!r.ok) {
    let msg = r.status
    try { msg = (await r.json()).detail || msg } catch {}
    throw new Error(msg)
  }
  return r.json()
}

export const api = {
  health: () => J('/api/health'),
  diseases: () => J('/api/diseases'),
  classes: () => J('/api/classes'),
  networkFull: () => J('/api/network/full'),
  diseaseChemicals: (disease, { source = 'network', limit = 25, novel_only = false, classes = '' } = {}) =>
    J(`/api/disease/${encodeURIComponent(disease)}/chemicals?source=${source}&limit=${limit}&novel_only=${novel_only}&classes=${encodeURIComponent(classes)}`),
  chemicalDiseases: (name, limit = 25) =>
    J(`/api/chemical/${encodeURIComponent(name)}/diseases?limit=${limit}`),
  score: (compounds) =>
    J('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compounds }) }),
  scoreCsv: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return J('/api/score/csv', { method: 'POST', body: fd })
  },
  // user-network add-on (revertible): build a graph from an uploaded CSV
  userNetwork: (file, minScore = 0.5) => {
    const fd = new FormData(); fd.append('file', file)
    return J(`/api/user-network/build?min_score=${minScore}`, { method: 'POST', body: fd })
  },
  // pubmed-scan add-on (revertible): live-scour PubMed abstracts for a compound + disease
  pubmedScan: (compound, disease, similar = true, structural = false) =>
    J(`/api/pubmed/scan?compound=${encodeURIComponent(compound)}&disease=${encodeURIComponent(disease)}&similar=${similar}&structural=${structural}`),
  // pollutant-map add-on (revertible): live air-quality at a coordinate -> disease risk
  pollutantMap: (lat, lon, label = '') =>
    J(`/api/pollutant-map/air?lat=${lat}&lon=${lon}&label=${encodeURIComponent(label)}`),
}

export const DISEASE_SHORT = {
  'Pulmonary Disease, Chronic Obstructive': 'COPD',
  'Rhinitis, Allergic': 'Allergic rhinitis',
  'Carcinoma, Bronchogenic': 'Bronchogenic carcinoma',
}
export const shortDisease = (d) => DISEASE_SHORT[d] || d
export const CLASS_COLOR = { environmental: '#d97706', drug: '#2563eb', endogenous: '#7c3aed', other: '#64748b', reagent: '#db2777' }
