import { Link } from "react-router-dom";

const steps = [
  ["01", "Create an account", "Register with your details, then use the issued user ID and temporary password to sign in."],
  ["02", "Upload your file", "Open Upload dataset and choose a CSV or TSV file with one row per observation."],
  ["03", "Review the check", "Inspect the detected columns, row count, blank cells, and quality notes before analysis."],
  ["04", "Read the result", "Open the dashboard or reports area to review findings and keep the source context attached."],
];

const faqs = [
  ["What file formats are supported?", "The current workflow is designed for CSV and TSV files. Use a header row with clear column names and avoid merged cells or presentation-only formatting."],
  ["How should I structure my dataset?", "Use one row for each observation and one column for each field, measure, category, or date. Keep units consistent within a column."],
  ["What should I do when a file has blank cells?", "Review whether blanks mean missing, not applicable, or unknown. Do not silently replace them with zero unless that is correct for the data."],
  ["Why can’t I open the Dashboard?", "The Dashboard is intended for signed-in users. Confirm that you completed login and that the API service is running before trying again."],
  ["Can I use sensitive personal data?", "Only upload data that your organisation has permission to process. Remove unnecessary personal identifiers and follow your organisation’s data-protection rules."],
  ["Where do I get my user ID or temporary password?", "User credentials are issued separately by the platform administrator. Contact the administrator if you have not received them or need a reset."],
];

function Help() {
  return (
    <div className="help-page">
      <section className="help-hero">
        <div>
          <p className="about-eyebrow">HELP CENTRE</p>
          <h1>Move from a file to a clear finding.</h1>
          <p className="help-lead">Use this guide to prepare your data, understand the platform workflow, and resolve common problems.</p>
        </div>
        <div className="help-hero-note">
          <strong>Need access?</strong>
          <p>Sign in with the credentials issued for your account. New users can start with registration.</p>
          <div className="help-hero-links"><Link to="/login">Sign in</Link><Link to="/register">Register</Link></div>
        </div>
      </section>

      <section className="help-section">
        <div className="help-section-heading">
          <p className="about-eyebrow">QUICK START</p>
          <h2>Your first four steps</h2>
          <p>Follow the same sequence each time so your analysis remains easy to review.</p>
        </div>
        <div className="help-step-grid">
          {steps.map(([number, title, description]) => (
            <article key={number} className="help-step-card">
              <span>{number}</span><h3>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="help-section help-two-column">
        <div>
          <p className="about-eyebrow">PREPARE YOUR DATA</p>
          <h2>A good file makes a better analysis.</h2>
        </div>
        <div className="help-checklist">
          <div><strong>Use descriptive headers</strong><p>Prefer names such as <code>date</code>, <code>district</code>, and <code>rainfall_mm</code> over unnamed or duplicated columns.</p></div>
          <div><strong>Keep values consistent</strong><p>Do not mix units, date formats, or spellings in the same column.</p></div>
          <div><strong>Keep the source note</strong><p>Record the publisher, period, geography, and any transformations applied before upload.</p></div>
          <div><strong>Protect private information</strong><p>Remove identifiers that are not required for the analytical question.</p></div>
        </div>
      </section>

      <section className="help-section help-support-grid">
        <div className="help-support-card">
          <p className="about-eyebrow">TROUBLESHOOTING</p>
          <h2>Something is not working?</h2>
          <div className="help-troubleshooting-list">
            <p><strong>Page does not load:</strong> confirm that the frontend development server is running and refresh the page.</p>
            <p><strong>API request fails:</strong> confirm that the FastAPI backend and PostgreSQL database are running.</p>
            <p><strong>Upload is rejected:</strong> check the file extension, header row, encoding, and whether the file is empty.</p>
            <p><strong>Login fails:</strong> check the issued user ID and password, then contact the administrator if the account is locked or expired.</p>
          </div>
        </div>
        <div className="help-support-card help-support-card-dark">
          <p className="about-eyebrow">ACCOUNT SUPPORT</p>
          <h2>Need help from an administrator?</h2>
          <p>Your administrator can verify account status, issue credentials, and help with password resets. Do not share your password in a support request.</p>
          <a className="about-button about-button-secondary" href="mailto:support@example.com">Contact support</a>
        </div>
      </section>

      <section className="help-section help-faq-section">
        <div className="help-section-heading">
          <p className="about-eyebrow">COMMON QUESTIONS</p>
          <h2>Frequently asked questions</h2>
        </div>
        <div className="help-faq-list">
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
        </div>
      </section>

      <section className="help-footer-note"><strong>Still unsure?</strong><span>Start with a small, non-sensitive sample file and review the quality check before working with a larger dataset.</span><Link to="/upload">Open Upload dataset →</Link></section>
    </div>
  );
}

export default Help;
