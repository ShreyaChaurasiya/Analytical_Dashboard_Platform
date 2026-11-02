import { Link } from "react-router-dom";

const officialLinks = [
  {
    title: "About C-DAC",
    description: "Official overview of C-DAC and its role in research and development.",
    href: "https://www.cdac.in/index.aspx?id=about",
  },
  {
    title: "Vision, mission and values",
    description: "The official vision, mission and core values that guide C-DAC.",
    href: "https://www.cdac.in/?id=VisionMission",
  },
  {
    title: "C-DAC contact directory",
    description: "Official centre locations and contact information, including Delhi.",
    href: "https://www.cdac.in/index.aspx?id=contact",
  },
];

function About() {
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <p className="about-eyebrow">ABOUT THE PLATFORM</p>
          <h1>Make analysis easier to understand.</h1>
          <p className="about-lead">
            Analytical Dashboard Platform helps teams prepare datasets, inspect data quality,
            explore findings, and present results with the context people need to trust them.
          </p>
          <div className="about-actions">
            <Link className="about-button about-button-primary" to="/register">Get started</Link>
            <Link className="about-button about-button-secondary" to="/help">Visit help centre</Link>
          </div>
        </div>
        <div className="about-hero-panel" aria-label="Platform workflow">
          <p className="about-panel-kicker">A connected workflow</p>
          <h2>From source file to clear result</h2>
          <div className="about-workflow-list">
            <div><span>01</span><strong>Prepare</strong><p>Upload a structured dataset and review its shape.</p></div>
            <div><span>02</span><strong>Check</strong><p>Identify missing values, inconsistencies, and quality notes.</p></div>
            <div><span>03</span><strong>Present</strong><p>Turn the result into a dashboard or report with source context.</p></div>
          </div>
        </div>
      </section>

      <section className="about-section about-context-grid">
        <div>
          <p className="about-eyebrow">OUR CONTEXT</p>
          <h2>Built around responsible use of data</h2>
        </div>
        <div className="about-section-copy">
          <p>
            The platform is designed as an analytical workspace for clear, traceable communication.
            It encourages users to record the source, period, units, assumptions, and limitations
            behind a result instead of presenting an unexplained chart.
          </p>
          <p>
            This project uses C-DAC, Delhi as its institutional context. C-DAC is a premier
            research and development organisation of the Ministry of Electronics and Information
            Technology (MeitY), working in information technology, electronics, and associated areas.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="about-section-heading">
          <p className="about-eyebrow">WHAT WE SUPPORT</p>
          <h2>Useful at every stage of an analysis</h2>
        </div>
        <div className="about-feature-grid">
          <article><span className="about-feature-number">01</span><h3>Prepare a dataset</h3><p>Bring a CSV or TSV file into one workspace and review columns, row counts, and sample values.</p></article>
          <article><span className="about-feature-number">02</span><h3>Review quality</h3><p>Capture completeness and data-quality observations before interpreting patterns or comparing groups.</p></article>
          <article><span className="about-feature-number">03</span><h3>Explain findings</h3><p>Keep summaries, reports, source notes, and the underlying data connected for future readers.</p></article>
        </div>
      </section>

      <section className="about-section about-principles">
        <div className="about-section-heading">
          <p className="about-eyebrow">DESIGN PRINCIPLES</p>
          <h2>Clarity is part of the result</h2>
        </div>
        <div className="about-principle-list">
          <div><strong>Source-first</strong><p>Record where the data came from and what period it covers.</p></div>
          <div><strong>Accessible by default</strong><p>Use readable layouts, clear labels, keyboard-friendly controls, and meaningful content structure.</p></div>
          <div><strong>Honest interpretation</strong><p>Show units, baselines, limitations, and enough context to avoid misleading conclusions.</p></div>
        </div>
      </section>

      <section className="about-section about-official">
        <div className="about-section-heading">
          <p className="about-eyebrow">OFFICIAL REFERENCES</p>
          <h2>Learn more about C-DAC</h2>
          <p>Read the official sources for institutional information, mission, values, and contact details.</p>
        </div>
        <div className="about-reference-grid">
          {officialLinks.map((item) => (
            <a key={item.title} className="about-reference-card" href={item.href} target="_blank" rel="noreferrer">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
              <em>Open official source ↗</em>
            </a>
          ))}
        </div>
      </section>

      <section className="about-contact">
        <div>
          <p className="about-eyebrow">C-DAC DELHI</p>
          <h2>Need institutional information?</h2>
          <p>For official C-DAC information, use the contact directory and sources above. For platform access, contact your platform administrator.</p>
        </div>
        <address>Plot no. 20, FC-33<br />Institutional Area, Jasola<br />New Delhi - 110025, India</address>
      </section>
    </div>
  );
}

export default About;
