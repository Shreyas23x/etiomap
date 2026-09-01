// pollutant-map add-on (revertible): pinpoint a location in India, pull live
// air-quality (Open-Meteo, via the backend), and connect the measured pollutants
// to EtioMap's six respiratory diseases. Revert = delete this file + the marked
// lines in App.jsx / Brand.jsx / api.js, and `npm remove leaflet`.
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api, shortDisease } from '../api.js'

// A few of India's most air-quality-relevant cities for quick jumps.
const CITIES = [
  ['New Delhi', 28.61, 77.20], ['Mumbai', 19.08, 72.88], ['Kolkata', 22.57, 88.36],
  ['Chennai', 13.08, 80.27], ['Bengaluru', 12.97, 77.59], ['Hyderabad', 17.39, 78.49],
  ['Lucknow', 26.85, 80.95], ['Kanpur', 26.45, 80.33], ['Ahmedabad', 23.03, 72.58],
  ['Patna', 25.59, 85.14],
]

const pinIcon = L.divIcon({
  className: '', iconSize: [28, 40], iconAnchor: [14, 38],
  html: `<div style="position:relative;width:28px;height:40px">
    <div style="position:absolute;left:5px;top:26px;width:18px;height:8px;border-radius:50%;
      background:rgba(15,23,42,.28);filter:blur(1.5px)"></div>
    <div style="position:absolute;left:4px;top:2px;width:20px;height:20px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:var(--emerald,#059669);border:2.5px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.35)">
      <div style="position:absolute;left:5.5px;top:5.5px;width:6px;height:6px;border-radius:50%;
        background:#fff;transform:rotate(45deg)"></div>
    </div>
  </div>`,
})

function fmt(v) {
  if (v == null) return 'N/A'
  return v >= 100 ? Math.round(v) : v.toFixed(1)
}

export default function PollutantMap() {
  const mapEl = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const halo = useRef(null)
  const [point, setPoint] = useState(null)   // { lat, lon, label }
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function runAt(lat, lon, label = '') {
    setBusy(true); setErr(''); setData(null)
    setPoint({ lat, lon, label })
    if (map.current) {
      if (marker.current) marker.current.setLatLng([lat, lon])
      else marker.current = L.marker([lat, lon], { icon: pinIcon, zIndexOffset: 1000 }).addTo(map.current)
      if (halo.current) halo.current.setLatLng([lat, lon])
      else halo.current = L.circleMarker([lat, lon], {
        radius: 16, color: 'var(--emerald)', weight: 1.5, opacity: .5,
        fillColor: 'var(--emerald)', fillOpacity: .12,
      }).addTo(map.current)
    }
    try { setData(await api.pollutantMap(lat.toFixed(4), lon.toFixed(4), label)) }
    catch (e) { setErr('' + e.message) } finally { setBusy(false) }
  }

  useEffect(() => {
    if (map.current || !mapEl.current) return
    const m = L.map(mapEl.current, { minZoom: 4, maxZoom: 13, zoomControl: true, scrollWheelZoom: true })
    // Esri light-gray canvas: clean, muted, detailed, and KEYLESS (CARTO's tiles
    // now require an API key). Base layer + a labels/reference overlay.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16, attribution: 'Tiles © Esri',
    }).addTo(m)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16, attribution: '',
    }).addTo(m)
    m.fitBounds([[7, 68], [35.5, 97.5]])            // frame the Indian subcontinent
    m.setMaxBounds([[5, 66], [37.5, 99.5]])
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(m)
    m.on('click', (e) => runAt(e.latlng.lat, e.latlng.lng))
    map.current = m
    setTimeout(() => m.invalidateSize(), 60)
    return () => { m.remove(); map.current = null; marker.current = null; halo.current = null }
  }, [])

  return (
    <main className="wrap fadein" style={{ paddingTop: 40, minHeight: '72vh' }}>
      <span className="eyebrow">Exposure Risk · India</span>
      <h1 className="serif" style={{ fontSize: 38, marginTop: 10 }}>Choose a location to find air risk features</h1>
      <p className="muted" style={{ maxWidth: 640, marginTop: 8 }}>
        Click anywhere on the map of India. EtioMap pulls the live pollutant levels at that point
        and connects them to the six respiratory diseases; gases are scored by the model, and
        particulates carry established epidemiological weights.
      </p>

      {/* city quick-jumps */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 18 }}>
        {CITIES.map(([name, la, lo]) => (
          <button key={name} className="btn btn-ghost btn-sm"
            onClick={() => { map.current?.setView([la, lo], 9); runAt(la, lo, name) }}
            style={{ fontSize: 12.5 }}>{name}</button>
        ))}
      </div>

      <div className="air-grid" style={{ marginTop: 16 }}>
        {/* MAP */}
        <div className="card" style={{ padding: 8, overflow: 'hidden' }}>
          <div ref={mapEl} style={{ height: 460, width: '100%', borderRadius: 10, background: 'var(--muted)' }} />
          <div className="muted" style={{ fontSize: 12, padding: '8px 6px 2px' }}>
            {point ? <>Selected: <b className="mono">{point.lat.toFixed(3)}, {point.lon.toFixed(3)}</b>{point.label ? ` · ${point.label}` : ''}</>
              : 'Click the map or pick a city to begin.'}
          </div>
        </div>

        {/* RESULTS */}
        <div>
          {busy && <div className="card" style={{ padding: 26, display: 'flex', alignItems: 'center', gap: 10 }}><span className="spin" /> Reading air quality…</div>}
          {err && <div className="card" style={{ padding: 20, color: 'var(--danger)', fontSize: 14 }}>⚠ {err}</div>}
          {!busy && !data && !err && (
            <div className="card" style={{ padding: 26 }}>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                Nothing selected yet. Pick a city above or tap anywhere on the map, and EtioMap shows
                that spot's current air quality, which respiratory diseases its pollution is most
                linked to, and simple steps to protect yourself.
              </p>
            </div>
          )}
          {data && <Results data={data} />}
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginTop: 16, lineHeight: 1.6 }}>
        Air-quality data: Open-Meteo (keyless). Disease associations for gases (NO₂, SO₂, O₃, CO, NH₃)
        come from the EtioMap model; particulate (PM2.5, PM10, dust) associations come from established
        curated literature associations, labelled <b>curated</b>. This is a research and awareness signal, not medical advice.
      </p>
    </main>
  )
}

function Results({ data }) {
  const { aqi, pollutants, disease_risk, prevention, location } = data
  return (
    <div className="fadein" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* AQI header */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ minWidth: 64, textAlign: 'center' }}>
          <div className="num serif" style={{ fontSize: 34, fontWeight: 600, color: aqi.color, lineHeight: 1 }}>{aqi.us_aqi ?? 'N/A'}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 3 }}>US AQI</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--navy)' }}>{location.label || `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`}</div>
          <div style={{ fontWeight: 600, color: aqi.color, fontSize: 13.5, marginTop: 2 }}>{aqi.band}</div>
        </div>
      </div>

      {/* disease risk */}
      <div className="card" style={{ padding: 20 }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 12 }}>
          Respiratory-disease risk at this location
        </div>
        {disease_risk.length ? disease_risk.map(d => (
          <div key={d.disease} style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{shortDisease(d.disease)}</span>
              <span className="num" style={{ fontSize: 12, color: 'var(--text-3)' }}>{d.score}</span>
            </div>
            <div className="lbar"><i style={{ width: `${d.score}%` }} /></div>
            {d.drivers.length > 0 &&
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>driven by {d.drivers.join(', ')}</div>}
          </div>
        )) : <span className="muted" style={{ fontSize: 13 }}>No pollutant exceeds its guideline here, so modelled risk is negligible.</span>}
        <div className="muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
          Relative scores (top disease = 100). Each pollutant's contribution scales with how far it
          exceeds its WHO guideline; gas associations come from the EtioMap model and lead the ranking,
          while particulates corroborate at half weight from established literature associations. Absolute severity is the AQI above.
        </div>
      </div>

      {/* pollutants */}
      <div className="card" style={{ padding: 20 }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 12 }}>
          Measured pollutants
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          {pollutants.map(p => {
            const over = p.exceedance && p.exceedance >= 1
            return (
              <div key={p.key} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '9px 11px', background: over ? 'rgba(220,38,38,.05)' : 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  <span className={`tag ${p.kind === 'curated' ? 'tag-known' : 'tag-model'}`} style={{ fontSize: 9 }}>{p.kind === 'curated' ? 'curated' : 'model'}</span>
                </div>
                <div className="num" style={{ fontSize: 17, fontWeight: 600, marginTop: 3, color: over ? 'var(--danger)' : 'var(--navy)' }}>
                  {fmt(p.value)} <span className="muted" style={{ fontSize: 10, fontWeight: 400 }}>{p.unit}</span>
                </div>
                <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                  {p.who_guideline ? <>{p.level}{p.exceedance ? ` · ${p.exceedance}× WHO` : ''}</> : 'no WHO guideline'}
                </div>
                {p.diseases.length > 0 &&
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 5, lineHeight: 1.4 }}>
                    {p.diseases.map(d => shortDisease(d.disease)).slice(0, 2).join(', ')}
                  </div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* prevention */}
      <div className="card" style={{ padding: 20 }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 10 }}>
          Preventive measures
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {prevention.map((t, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)' }}>{t}</li>)}
        </ul>
      </div>
    </div>
  )
}
