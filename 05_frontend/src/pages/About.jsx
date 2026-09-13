import { Link } from 'react-router-dom'

function Section({ eyebrow, title, children }) {
  return (
    <section className="wrap" style={{ marginTop: 56 }}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {title && <h2 className="serif" style={{ fontSize: 30, marginTop: 10, marginBottom: 18 }}>{title}</h2>}
      {children}
    </section>
  )
}

function Faq({ q, children }) {
  return (
    <div className="card" style={{ padding: 22, marginBottom: 14 }}>
      <h3 style={{ fontSize: 17, marginBottom: 8 }}>{q}</h3>
      <div className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

export default function About() {
  return (
    <main className="fadein" style={{ minHeight: '72vh', paddingBottom: 40 }}>
      <section className="wrap" style={{ paddingTop: 56 }}>
        <span className="eyebrow">How EtioMap works</span>
        <p style={{ fontSize: 18, marginTop: 14, maxWidth: 720, lineHeight: 1.6, color: 'var(--text)' }}>
          EtioMap answers the question {'"which chemicals drive respiratory disease?"'} in two independent
          ways. First, a machine-learning <b>model</b> and, second, a biological-pathway <b>network</b>. They
          are deliberately separate, and the best way to read them is to read them together. Here is what each
          one does, and where their limits are.
        </p>
      </section>

      {/* TWO ENGINES */}
      <Section eyebrow="The two engines" title="Model vs. Network">
        <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card" style={{ padding: 24 }}>
            <div className="tag tag-model" style={{ marginBottom: 10 }}>model</div>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>Predicted likelihood</h3>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
              Machine learning model. It takes into account the <b>molecular properties</b> of a chemical
              (size, lipophilicity, polar surface area, H-bonding, complexity) and the disease and gives a
              probability of association. It is a statistical pattern matcher over chemistry and knows
              nothing about biology or mechanism.
            </p>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div className="tag tag-known" style={{ marginBottom: 10 }}>network</div>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>Shared biological pathways</h3>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
              A graphical biological representation. A chemical is linked to a disease if they share
              <b> significantly enriched metabolic pathways</b>. All links are named and show the pathways
              they run through. All known links have their published literature references. This engine
              describes <b>how</b> chemical–disease associations happen.
            </p>
          </div>
        </div>
      </Section>

      {/* THE MODEL */}
      <Section eyebrow="The model" title="The capabilities of the EtioMap model">
        <div className="card" style={{ padding: 26 }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.8, margin: 0 }}>
            The model learns from the disease and the <b>molecular properties</b> of the chemical with known
            association pairs labeled. Since both disease and chemical are inputs, it works <b>both ways</b>:
            fix a disease and rank chemicals, or fix a chemical and score it across all six diseases.
          </p>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.8, marginTop: 14 }}>
            <b>Why this type of model?</b> It is an honest default for this setting of a few hundred chemicals
            described by a handful of chemical properties. It picks up non-linear patterns, resists
            overfitting on small data, and remains interpretable. More sophisticated approaches (learning
            directly from the structure of molecules, or adding protein-target information) have the potential
            to go further but require more data and are on the roadmap. For the current dataset, a richer
            model would overfit rather than improve.
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section title="FAQ">
        <Faq q="If the model never saw those chemicals, how do you know its predictions are right?">
          <b>We always knew the true answer and just hid it from the model during training.</b> Every
          chemical in the training data has a known label (associated with a disease, or not). We take off
          the chemical's labels for training, but then reveal them to score the model's guesses. The chemical
          is new to the model, not unknown to us, so we can check each prediction against the real label and
          measure how often it is right.
        </Faq>
        <Faq q="How was it validated?">
          <b>It was validated by testing on chemicals it was untrained on.</b> We perform multiple splits of
          chemicals into training and test sets such that a test chemical's pairs do not appear in its
          training set. Averaging the results across splits gives an unbiased estimator of the performance on
          a genuinely novel chemical as opposed to similar ones that appeared in training. The model you query
          on the website, however, is trained on all the data. The truly <b>novel candidates</b> (with no
          prior evidence) have no ground truth and therefore can only be considered unverified hypotheses.
        </Faq>
        <Faq q="If the model predicts a link, how does it know the pathway it acts through?">
          <b>It doesn't, and it shouldn't.</b> The model has no notion of pathways: it only knows molecular
          properties. All the "acts through these pathways" information comes from the separate <b>network</b>
          engine. Thus, a pure model prediction has no mechanism. In the case of a novel candidate, the fact
          that it has these pathways means that that link was proposed by the network (shared pathways) and
          the model score is a separate and independent opinion on the same pair.
        </Faq>
        <Faq q="Why do some Known links disappear when I turn on Model predictions and raise the minimum score?">
          <b>The toggle filters every edge by the model confidence, not by the evidence type.</b> By adjusting
          the threshold, you can hide any edge with the model score below the threshold, including the one that
          has a known, cited association but low model confidence. Toggle it off to evaluate the associations
          based on the evidence and the pathway they are connected by.
        </Faq>
        <Faq q="Why is a chemical with no reference shown under the “Pathway Score” method?">
          <b>The chemical is shown because the network proposes links from biology and not from references.</b>
          A compound with no reference can still share significantly enriched metabolic pathways with a
          disease: that is a <b>candidate</b>, the network's actual prediction. Known links have their
          published references, and so everything else is a candidate or on the likelihood tab as a
          "prediction."
        </Faq>
        <Faq q="Which signal, pathway score or predicted likelihood, should I trust?">
          <b>Read them together.</b> A link that is both a <i>known</i> association and has a high model score
          is the best kind. A novel candidate with high shared-pathway evidence is also a compelling
          hypothesis. A high model score but with no pathway or reference is an intriguing lead. None of these
          are clinical or diagnostic claims of any kind.
        </Faq>
        <Faq q="If it's not a clinical or diagnostic claim, who is it for and how would a researcher use it?">
          <b>It is a discovery, prioritization tool, not a decision tool.</b> "Not clinical or diagnostic"
          means it does not make statements regarding an individual patient, nor does it assert causation, nor
          is it for the clinic, for regulation. What it <i>is</i> for instead is helping environmental-health,
          toxicology, and pharmacology researchers decide which of the many chemical–disease pairs to study
          next, given that there are far more pairs than anyone can test. Simply put:
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
            <li><b>Shortlist chemical candidates to prioritize:</b> which environmental chemicals to take
              forward for costly assays or epidemiology studies for a given disease, rather than randomly.</li>
            <li><b>Get a mechanism lead:</b> the pathway layer suggests <i>how</i> a chemical may act, which
              highlights what to measure. This may act as a lead for bench work.</li>
            <li><b>Fast literature discovery:</b> known associations carry their references, so a known link
              is just a click away from its supporting evidence.</li>
            <li><b>Cross-disease patterns and structure-based signals:</b> a chemical highlighted across
              multiple respiratory diseases, or by a model suggesting that "this sort of chemistry is
              associated with", provides targets for closer inspection, including untried compounds.</li>
          </ul>
          The output is always a <b>ranked hypothesis</b> for a human expert to evaluate, rather than an
          actionable answer.
        </Faq>
      </Section>

      <section className="wrap" style={{ marginTop: 44 }}>
        <div style={{ background: 'var(--navy)', borderRadius: 'var(--radius-lg)', padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
          <div>
            <h2 className="serif" style={{ color: '#fff', fontSize: 26 }}>See it on real data.</h2>
            <p style={{ color: '#cbd5e1', marginTop: 6, fontSize: 15 }}>Explore the network or analyze your chemical/respiratory disease data.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/explorer" className="btn btn-primary">Open explorer</Link>
            <Link to="/analyze" className="btn btn-ghost" style={{ background: 'transparent', color: '#fff', borderColor: '#475569' }}>Analyze</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
