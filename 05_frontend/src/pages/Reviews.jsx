// Reviews page (LOCAL only for now). Shows testimonials with a generic anonymous
// avatar, a bold name + role line, and a short comment below. The list below is
// placeholder content — replace REVIEWS with real submissions when you collect them.

// No reviews yet — the grid below is hidden until real submissions come in.
// Placeholder content kept for reference; restore into REVIEWS when collected:
// { name: 'A. Sharma', work: 'Environmental Health Researcher',
//   comment: 'A fast way to shortlist which pollutants to bring into a study. The pathway view makes the mechanism hypotheses concrete.' },
// { name: 'R. Menon', work: 'Toxicology PhD Student',
//   comment: 'I like that known links carry their PubMed references, so I can jump straight to the evidence instead of guessing.' },
// { name: 'Dr. L. Fernandes', work: 'Pulmonologist',
//   comment: 'Clear that it is a research signal, not a clinical claim. The likelihood scores are a useful starting point for discussion.' },
// { name: 'K. Iyer', work: 'Data Scientist, Public Health',
//   comment: 'The compound-scoring and CSV upload saved me a lot of manual lookup work. Would love a downloadable API next.' },
// { name: 'S. Rao', work: 'Graduate Student, Cheminformatics',
//   comment: 'The network explorer is genuinely fun to browse, and grouping by shared pathways surfaced links I had not considered.' },
// { name: 'M. Gupta', work: 'Air Quality Analyst',
//   comment: 'The exposure map connecting local pollution to respiratory risk is a nice touch for communicating findings to non-experts.' },
const REVIEWS = [
  { name: 'Samvrit Krovvidi', work: 'Undergraduate, Molecular and Cell Biology @ UCSD',
    comment: 'Interesting concept, useful in disease research as a student in the field of molecular components of disease.' },
  { name: 'Narayana Rao Sripada', work: 'AI Respiratory & Environmental Health Surveillance, India',
    comment: 'EtioMap is helpful because it connects environmental exposures with respiratory health by identifying the biological processes through which environmental chemicals may contribute to or worsen respiratory diseases.' },
  { name: 'Dr. V. S. Reddy', work: 'Oral & Maxillofacial Surgeon, Healthcare Hospital',
    comment: 'Well structured and user friendly.' },
  { name: 'Dr. Sridevi Chinta', work: 'Dentist, India',
    comment: 'The best feature for me was the easily accessible literature in the Analyze and Network sections.' },
]

function Avatar() {
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <rect width="42" height="42" rx="2" fill="var(--muted-2)" />
      <circle cx="21" cy="16" r="7" fill="var(--text-3)" />
      <path d="M8 39a13 13 0 0 1 26 0Z" fill="var(--text-3)" />
    </svg>
  )
}

export default function Reviews() {
  return (
    <main className="wrap fadein" style={{ paddingTop: 40, minHeight: '72vh' }}>
      <span className="eyebrow">Reviews</span>
      <h1 className="serif" style={{ fontSize: 38, marginTop: 10 }}>What does the scientific community think?</h1>
      <p className="muted" style={{ maxWidth: 620, marginTop: 8 }}>
        Feedback from researchers, students, and clinicians who have used EtioMap.
      </p>

      <a
        href="https://forms.gle/C1UaLSAaAiDY26Pn8"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{ marginTop: 18 }}
      >
        Leave your own review
        <span aria-hidden="true" style={{ fontSize: 13 }}>↗</span>
      </a>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16, marginTop: 24 }}>
        {REVIEWS.map((r, i) => (
          <div key={i} className="card" style={{ padding: 18, display: 'flex', gap: 13, alignItems: 'flex-start' }}>
            <Avatar />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {r.name} <span style={{ color: 'var(--text-2)' }}>· {r.work}</span>
              </div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.55 }}>{r.comment}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
