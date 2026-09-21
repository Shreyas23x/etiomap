// Thin API layer. In dev, Vite proxies /api -> FastAPI (see vite.config.js).
const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

// The backend runs on a free host that sleeps after inactivity and can take
// ~30-90s to cold-start. GET requests transparently retry through that window —
// on network errors and on 502/503/504 gateway responses — so a waking server
// resolves to real data instead of a failure. Non-GET requests (score, uploads)
// are never auto-retried, to avoid duplicate submissions.
const J = async (url, opts) => {
  const isGet = !opts || !opts.method || String(opts.method).toUpperCase() === 'GET'
  const deadline = Date.now() + 120000
  let delay = 2500
  for (;;) {
    try {
      const r = await fetch(url, opts)
      if (!r.ok) {
        if (isGet && [502, 503, 504].includes(r.status) && Date.now() < deadline) {
          await sleep(delay); delay = Math.min(delay * 1.5, 8000); continue
        }
        let msg = r.status
        try { msg = (await r.json()).detail || msg } catch {}
        throw new Error(msg)
      }
      return r.json()
    } catch (e) {
      // fetch() rejects with a TypeError on network failure (server still waking)
      if (isGet && e instanceof TypeError && Date.now() < deadline) {
        await sleep(delay); delay = Math.min(delay * 1.5, 8000); continue
      }
      throw e
    }
  }
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
