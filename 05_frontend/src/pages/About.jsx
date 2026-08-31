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
        <span className="eyebrow">How it works</span>
        <h1 className="serif" style={{ fontSize: 'clamp(34px,4.6vw,52px)', marginTop: 14, lineHeight: 1.06, maxWidth: 760 }}>
          Two engines, one question: which chemicals drive respiratory disease?
        </h1>
        <p className="muted" style={{ fontSize: 18, marginTop: 20, maxWidth: 680 }}>
          EtioMap answers that two independent ways: a machine-learning <b>model</b> and a
          biological-pathway <b>network</b>. They are deliberately separate, and reading them
          together is the point. Here is what each does, and where its limits are.
        </p>
      </section>

      {/* TWO ENGINES */}
      <Section eyebrow="The two engines" title="Model vs. network: they answer differently">
        <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card" style={{ padding: 24 }}>
            <div className="tag tag-model" style={{ marginBottom: 10 }}>model</div>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>Predicted likelihood</h3>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
              A machine-learning model. It looks only at a chemical's <b>molecular properties</b>
              (size, lipophilicity, polar surface area, H-bonding, complexity) plus the disease, and
              outputs a probability of association. It is a statistical pattern-matcher over chemistry;
              it knows nothing about biology or mechanism.
            </p>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div className="tag tag-known" style={{ marginBottom: 10 }}>network</div>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>Shared biological pathways</h3>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
              A graph built from biology. A chemical links to a disease when they share
              <b> significantly enriched metabolic pathways</b>. Every link names the pathways it travels
              through, and every <i>known</i> link carries its published literature references. This engine
              explains <b>how</b>; the model only estimates <b>whether</b>.
            </p>
          </div>
        </div>
      </Section>

      {/* THE MODEL */}
      <Section eyebrow="The model" title="What the model does, and doesn't">
        <div className="card" style={{ padding: 26 }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.8, margin: 0 }}>
            The model learns from the disease together with the chemical's <b>molecular properties</b>,
            labelled by whether the pair is a known association. Because both the disease and the chemical
            are inputs, it works in <b>both directions</b>: fix a disease and rank chemicals, or fix a
            chemical and score it across all six diseases. The Analyze page exposes both.
          </p>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.8, marginTop: 14 }}>
            <b>Why this kind of model?</b> For this setting, a few hundred chemicals described by a handful
            of chemical properties, it is a strong, honest default: it captures non-linear patterns, resists
            overfitting on small data, and stays interpretable. Richer approaches (learning directly from
            molecular structure, or adding protein-target information) could push further, but they need
            more data and are on the roadmap, not a quick win. For the current dataset, a heavier model
            would likely overfit rather than improve.
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section eyebrow="Good questions" title="The things that trip people up">
        <Faq q="If the model never saw those chemicals, how do you know its predictions are right?">
          <b>Because we always knew the true answer; we just hid it from the model.</b> Every chemical in
          the training data has a known label (associated with a disease, or not). "Held out" means we
          remove a chemical's labels while <i>training</i>, then reveal them only to <i>score</i> the model's
          guesses. The chemical is new to the model, not unknown to us, so we can check each prediction
          against the real label and measure how often it is right.
        </Faq>
        <Faq q="How was it validated?">
          <b>By testing on chemicals it was never trained on.</b> We repeatedly split the chemicals into
          groups, train on most of them, and test on the ones held back, so a test chemical's pairs never
          appear in its own training data. Averaging performance across those splits gives an honest read
          on how it does on genuinely new chemistry, rather than on look-alikes it had already seen. The
          model you query on the site is then trained on all the data. One honest caveat: the truly
          <b> novel candidates</b> (pairs with no prior evidence) have no ground truth, so they are
          unvalidated hypotheses by definition.
        </Faq>
        <Faq q="If the model predicts a link, how does it know the pathway it acts through?">
          <b>It doesn't, and it shouldn't.</b> The model only sees molecular properties; it has no concept
          of pathways. The "acts through these pathways" text comes entirely from the separate <b>network</b>
          engine. So a pure model prediction has no mechanism attached. When a novel candidate shows pathways,
          that link was proposed by the network (shared pathways), and the model score is just an extra,
          independent opinion on the same pair.
        </Faq>
        <Faq q="Why do some Known links disappear when I turn on Model predictions and raise the minimum score?">
          <b>Because that toggle filters every edge by the model's confidence, not by evidence type.</b>
          Raising the threshold hides any edge the model scores below it, including a known, referenced
          association that the model happens to rate low. Turn the toggle off to judge links purely on
          evidence and pathway strength.
        </Faq>
        <Faq q="Why is a chemical with no reference shown under the “Pathway Score” method?">
          <b>Because the network proposes links from biology, not from references.</b> A compound with no
          reference can still share significantly enriched metabolic pathways with a disease; that is a
          <b> candidate</b>, the network's actual prediction. Known links carry their published references;
          everything else is a candidate, or on the likelihood tab a "prediction."
        </Faq>
        <Faq q="Which signal should I trust?">
          <b>Read them together.</b> A link that is both a <i>known</i> association and a high model score is
          the most solid. A novel candidate with strong shared-pathway evidence is a hypothesis worth
          following. A high model score with no pathway and no reference is the weakest: interesting, but
          unexplained. None of this is a clinical or diagnostic claim.
        </Faq>
        <Faq q="If it's not a clinical or diagnostic claim, who is it for and how would a researcher use it?">
          <b>It's a discovery and prioritisation tool, not a decision tool.</b> "Not clinical or
          diagnostic" means it says nothing about an individual patient and proves no causation; it is not
          for the clinic or for regulation. What it <i>is</i> for: helping environmental-health,
          toxicology, and pharmacology researchers decide <b>what to study next</b> when there are far more
          chemical–disease pairs than anyone can test. Concretely:
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
            <li><b>Shortlist candidates.</b> Rank which environmental chemicals to bring into a costly
              assay or epidemiology study for a given disease, instead of guessing.</li>
            <li><b>Get a mechanism lead.</b> The pathway layer proposes <i>how</i> a chemical might act,
              which suggests what to measure: a starting hypothesis for bench work.</li>
            <li><b>Enter the literature fast.</b> Known links carry their references, so a known
              association is one click from its evidence.</li>
            <li><b>Spot cross-disease patterns and structure signals.</b> A chemical flagged across several
              respiratory diseases, or a model score that says "this kind of chemistry tends to associate,"
              flags compounds worth a closer look, including ones no one has tested yet.</li>
          </ul>
          The output is always a <b>ranked hypothesis</b> a human expert then validates, never an answer
          to act on directly.
        </Faq>
      </Section>

      <section className="wrap" style={{ marginTop: 44 }}>
        <div style={{ background: 'var(--navy)', borderRadius: 'var(--radius-lg)', padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
          <div>
            <h2 className="serif" style={{ color: '#fff', fontSize: 26 }}>See it on real data.</h2>
            <p style={{ color: '#cbd5e1', marginTop: 6, fontSize: 15 }}>Explore the network, or rank a disease's chemical drivers.</p>
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
