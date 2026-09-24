// Homepage feature tiles — REVERTIBLE LOCAL EXPERIMENT.
// A CTD-style grid: a soft-tinted tile with a line-art icon on top, then a
// title and description below, each card linking to that tool's page.
//
// To REMOVE completely: delete this file and the two marked lines in
// pages/Home.jsx (the `import FeatureCards` line and the `<FeatureCards />`).
import { Link } from 'react-router-dom'
import { SHOW_EXPOSURE_RISK } from '../features.js'

const svg = (children) => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const ICONS = {
  bars: svg(<>
    <line x1="4" y1="20" x2="20" y2="20" />
    <rect x="6" y="11" width="3" height="9" />
    <rect x="11" y="7" width="3" height="13" />
    <rect x="16" y="4" width="3" height="16" />
  </>),
  // Black-and-white network graph (monochrome version of the coloured node diagram):
  // dark edges + white-filled, dark-outlined nodes, drawn with its own colours
  // rather than the tile's accent.
  network: (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="#1f2937" strokeWidth="1.1">
        <line x1="10" y1="4" x2="20" y2="3.6" />
        <line x1="10" y1="4" x2="4" y2="13" />
        <line x1="10" y1="4" x2="10.6" y2="16.4" />
        <line x1="10" y1="4" x2="15" y2="12" />
        <line x1="20" y1="3.6" x2="15" y2="12" />
        <line x1="4" y1="13" x2="10.6" y2="16.4" />
        <line x1="4" y1="13" x2="3.6" y2="21" />
        <line x1="10.6" y1="16.4" x2="15" y2="12" />
        <line x1="10.6" y1="16.4" x2="3.6" y2="21" />
        <line x1="10.6" y1="16.4" x2="21" y2="19" />
        <line x1="15" y1="12" x2="21" y2="19" />
      </g>
      <g fill="#fff" stroke="#1f2937" strokeWidth="1.2">
        <circle cx="10" cy="4" r="1.9" />
        <circle cx="20" cy="3.6" r="1.5" />
        <circle cx="4" cy="13" r="1.5" />
        <circle cx="10.6" cy="16.4" r="1.7" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="3.6" cy="21" r="1.5" />
        <circle cx="21" cy="19" r="1.5" />
      </g>
    </svg>
  ),
  data: svg(<>
    <path d="M13 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V9z" />
    <path d="M13 3v6h6" />
    <path d="M12 18v-6" />
    <path d="M9.5 14.5 12 12l2.5 2.5" />
  </>),
  pin: svg(<>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </>),
}

const FEATURES = [
  { to: '/analyze', title: 'Analyze', icon: 'bars', tint: '#eef4fe', color: '#2563eb',
    desc: 'Rank the chemicals most associated with a respiratory disease, or score one compound across all six diseases with predicted likelihoods as per the model.' },
  { to: '/explorer', title: 'Network', icon: 'network', tint: '#edfbf2', color: '#16a34a',
    desc: 'Discover the pathway network to understand how a chemical may be associated to a disease through shared, enriched biological pathways (with literature references).' },
  { to: '/your-data', title: 'Data', icon: 'data', tint: '#f3f0fd', color: '#7c3aed',
    desc: 'Upload your own CSV of compounds, which can then be scored against the six diseases and used to build a network from your data.' },
  ...(SHOW_EXPOSURE_RISK ? [{
    to: '/air', title: 'Exposure Risk', icon: 'pin', tint: '#fce9e1', color: '#c73a1a',
    desc: 'Pick a location in India to pull live air quality data and connect each pollutant to the respiratory diseases that they are most associated with.',
  }] : []),
]

export default function FeatureCards() {
  return (
    <section className="wrap" style={{ marginTop: 72 }}>
      <style>{`
        .fc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:22px;margin-top:22px}
        .fc-card{display:block;text-decoration:none;color:inherit}
        .fc-card:hover,.fc-card:focus{text-decoration:none;color:inherit}
        .fc-tile{display:flex;align-items:center;justify-content:center;height:148px;border-radius:14px;
                 transition:transform .15s ease,box-shadow .15s ease}
        .fc-card:hover .fc-tile{transform:translateY(-3px);box-shadow:0 10px 26px rgba(2,6,23,.09)}
        .fc-title{font-size:18px;font-weight:600;margin:15px 0 6px;color:var(--text)}
        .fc-card:hover .fc-title{text-decoration:underline;text-underline-offset:2px}
        .fc-desc{font-size:14px;line-height:1.6;margin:0;text-decoration:none}
      `}</style>
      <span className="eyebrow">Explore EtioMap</span>
      <div className="fc-grid">
        {FEATURES.map((f) => (
          <Link key={f.to} to={f.to} className="fc-card">
            <div className="fc-tile" style={{ background: f.tint, color: f.color }}>{ICONS[f.icon]}</div>
            <div className="fc-title">{f.title}</div>
            <p className="fc-desc muted">{f.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
