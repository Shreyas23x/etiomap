import { Link } from 'react-router-dom'
import { MoleculeArt } from '../components/Brand.jsx'

const stats = [
  { n: '450+', l: 'chemicals mapped' },
  { n: '6', l: 'respiratory diseases' },
  { n: '600+', l: 'interactions observed' },
]

const steps = [
  ['Choose or upload', 'Select a disease, name a compound, or upload a CSV of your own chemicals.'],
  ['Predict + explain', 'A descriptor-based model predicts likely associations, and a KEGG pathway network explains how a compound links to disease.'],
  ['Ranked & referenced', 'Get ranked likelihoods, related compounds, and downloadable results with PubMed references.'],
]

export default function Home() {
  return (
    <main className="fadein">
      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="wrap hero-grid" style={{ paddingTop: 60, paddingBottom: 40 }}>
          <div>
            <span className="eyebrow">Chemical etiology of respiratory disease</span>
            <h1 className="serif" style={{ fontSize: 'clamp(38px,5.2vw,60px)', marginTop: 18, lineHeight: 1.05 }}>
              Map the chemicals<br />behind the disease.
            </h1>
            <p className="muted" style={{ fontSize: 18.5, marginTop: 22, maxWidth: 560 }}>
              EtioMap visualizes the interactions and pathways associated with environmental
              chemicals and respiratory diseases. We use machine learning models to predict how
              different compounds may affect respiratory diseases and identify key biological
              pathways linked to these effects.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
              <Link to="/analyze" className="btn btn-primary">Get started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link to="/explorer" className="btn btn-ghost">Explore the network</Link>
            </div>
          </div>
          <div className="hero-art"><MoleculeArt /></div>
        </div>
      </section>

      {/* STATS */}
      <section className="wrap">
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '6px 0' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ padding: '22px 26px', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
              <div className="serif" style={{ fontSize: 36, color: 'var(--navy)', fontWeight: 600 }}>{s.n}</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section className="wrap" style={{ marginTop: 72 }}>
        <div className="card" style={{ padding: 36 }}>
          <span className="eyebrow">How it works</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, marginTop: 22 }}>
            {steps.map(([t, d], i) => (
              <div key={i}>
                <div className="mono" style={{ fontSize: 13, color: 'var(--emerald-700)', fontWeight: 500 }}>{String(i + 1).padStart(2, '0')}</div>
                <h3 style={{ fontSize: 18, margin: '8px 0' }}>{t}</h3>
                <p className="muted" style={{ fontSize: 14.5 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap" style={{ marginTop: 40 }}>
        <div style={{ background: 'var(--navy)', borderRadius: 'var(--radius-lg)', padding: '44px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h2 className="serif" style={{ color: '#fff', fontSize: 28 }}>Start mapping associations.</h2>
            <p style={{ color: '#cbd5e1', marginTop: 6, fontSize: 15.5 }}>Score a compound, rank a disease, or explore the whole network.</p>
          </div>
          <Link to="/analyze" className="btn btn-primary">Get started</Link>
        </div>
      </section>
    </main>
  )
}
