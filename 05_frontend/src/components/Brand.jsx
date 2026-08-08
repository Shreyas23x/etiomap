import { NavLink, Link } from 'react-router-dom'

export function Logo({ size = 26, color = 'var(--navy)' }) {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 1.6l9 5.2v10.4l-9 5.2-9-5.2V6.8z" stroke="var(--emerald)" strokeWidth="1.5" />
        <path d="M12 6.4l4.8 2.8v5.6L12 17.6l-4.8-2.8V9.2z" stroke={color} strokeWidth="1.2" opacity=".55" />
      </svg>
      <span style={{ fontFamily: 'var(--serif)', fontSize: size * 0.82, fontWeight: 600, color, letterSpacing: '-.01em' }}>EtioMap</span>
    </Link>
  )
}

export function NavBar() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Logo />
        <div style={{ flex: 1 }} />
        <NavLink to="/" end className="navlink">Home</NavLink>
        <NavLink to="/analyze" className="navlink">Analyze</NavLink>
        <NavLink to="/explorer" className="navlink">Network</NavLink>
        <NavLink to="/your-data" className="navlink">Your data</NavLink>{/* user-network add-on (revertible) */}
        <NavLink to="/air" className="navlink">Air &amp; risk</NavLink>{/* pollutant-map add-on (revertible) */}
        <NavLink to="/about" className="navlink">About</NavLink>
        <Link to="/analyze" className="btn btn-primary btn-sm" style={{ marginLeft: 6 }}>Get started</Link>
      </div>
    </nav>
  )
}

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', marginTop: 72, background: 'var(--surface)' }}>
      <div className="wrap" style={{ padding: '34px 28px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
        <Logo size={22} />
        <span className="muted" style={{ fontSize: 13.5 }}>Mapping the chemical etiology of respiratory disease.</span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Data: CTD · KEGG · PubChem &nbsp;|&nbsp; Model: XGBoost
        </span>
      </div>
    </footer>
  )
}

// Hero chemistry illustration: one continuous terpenoid chain threading into a
// benzene ring (echoes the brand mark). Drawn as connected paths — no breaks.
export function MoleculeArt({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 440 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <radialGradient id="emHalo" cx="62%" cy="44%" r="62%">
          <stop offset="0" stopColor="#ecfdf5" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="262" cy="172" r="158" fill="url(#emHalo)" />
      {/* continuous terpenoid chain, ending exactly on the ring's left vertex (253,206) */}
      <path d="M20 246 L62 224 L104 246 L146 224 L188 246 L230 224 L253 206"
        stroke="var(--emerald)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* methyl branches off the chain */}
      <path d="M62 224 L62 192 M146 224 L146 192 M230 224 L230 192"
        stroke="var(--emerald)" strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
      {/* benzene ring — starts at the same left vertex, so the figure is one piece */}
      <path d="M253 206 L279 161 L331 161 L357 206 L331 251 L279 251 Z"
        stroke="var(--navy)" strokeWidth="2.8" strokeLinejoin="round" />
      {/* aromatic inner bonds */}
      <path d="M285 168 L323 168 M345 206 L326 239 M271 206 L290 239"
        stroke="var(--navy)" strokeWidth="2" opacity=".42" strokeLinecap="round" />
      {/* ring atoms */}
      <g fill="#ffffff" stroke="var(--navy)" strokeWidth="1.7">
        <circle cx="253" cy="206" r="4.6" /><circle cx="279" cy="161" r="4.6" /><circle cx="331" cy="161" r="4.6" />
        <circle cx="357" cy="206" r="4.6" /><circle cx="331" cy="251" r="4.6" /><circle cx="279" cy="251" r="4.6" />
      </g>
      {/* chain atoms */}
      <g fill="var(--emerald)"><circle cx="62" cy="224" r="3.6" /><circle cx="146" cy="224" r="3.6" /><circle cx="230" cy="224" r="3.6" /><circle cx="104" cy="246" r="3.6" /><circle cx="188" cy="246" r="3.6" /></g>
    </svg>
  )
}
