import { Link } from 'react-router-dom'
import HeroSpecimen from '../components/HeroSpecimen.jsx'  // revertible: real worked-example hero (was MoleculeArt)
import FeatureCards from '../components/FeatureCards.jsx'  // revertible homepage feature-tiles experiment

const stats = [
  { n: '450+', l: 'chemicals mapped' },
  { n: '6', l: 'respiratory diseases' },
  { n: '600+', l: 'interactions observed' },
]

const steps = [
  ['Choose or upload', 'In the Analyze page, select a disease or name a compound to start finding associations. Upload your own CSV of chemicals in the Data page.'],
  ['Predict and explain', 'A descriptor-based model predicts likely associations on all present data and what you upload. In the Network page, a KEGG pathway network displays how a compound links to disease.'],
  ['Ranked and referenced', 'Get ranked likelihoods, related compounds, and downloadable results with PubMed references by exploring the Analyze and Data page.'],
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
          <div className="hero-art"><HeroSpecimen /></div>
        </div>
      </section>

      {/* STATS */}
      <section className="wrap">
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '6px 0', borderRadius: 0 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ padding: '22px 26px', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
              <div className="serif" style={{ fontSize: 36, color: 'var(--navy)', fontWeight: 600 }}>{s.n}</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE TILES (revertible experiment — remove this line + the import above) */}
      <FeatureCards />

      {/* HOW */}
      <section className="wrap" style={{ marginTop: 72 }}>
        <div className="card" style={{ padding: 36, borderRadius: 0 }}>
          <span className="eyebrow">How it works</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, marginTop: 22 }}>
            {steps.map(([t, d], i) => (
              <div key={i}>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{t}</h3>
                <p className="muted" style={{ fontSize: 14.5 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  )
}
