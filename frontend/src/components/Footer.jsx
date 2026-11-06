import { Link } from "react-router-dom";
import { isSignedIn } from "./RequireAuth";

function Footer({ variant }) {
    const year = new Date().getFullYear();
    const signedIn = isSignedIn();

    return (
        <footer className={`site-footer site-footer-${variant}`}>
            <div className="site-footer-grid">
                <div className="site-footer-column site-footer-about">
                    <Link to="/" className="site-footer-title">Analytical Dashboard Platform</Link>
                    <p>Prepare datasets, review analysis, and present findings with their sources and context.</p>
                    <address>Centre for Development of Advanced Computing (C-DAC), Delhi</address>
                </div>

                <nav className="site-footer-column" aria-label="Platform links">
                    <h2>Platform</h2>
                    {signedIn && <Link to="/dashboard">Dashboard</Link>}
                    {signedIn && <Link to="/upload">Upload dataset</Link>}
                    {signedIn && <Link to="/reports">Reports</Link>}
                </nav>

                <nav className="site-footer-column" aria-label="Resources">
                    <h2>Resources</h2>
                    <Link to="/#home-topics">Data examples</Link>
                    <Link to="/#home-guides">Analysis guide</Link>
                </nav>

                <nav className="site-footer-column" aria-label="Help and support">
                    <h2>Help &amp; support</h2>
                    <Link to="/help">Help centre</Link>
                    <Link to="/#home-help">Frequently asked questions</Link>
                    <Link to="/about">About the platform</Link>
                </nav>

                <div className="site-footer-column site-footer-contact">
                    <h2>Contact</h2>
                    <address>C-DAC, Delhi<br />Create an account or use Forgot password for account access.</address>
                </div>
            </div>

            <div className="site-footer-bottom">
                <span>© {year} Analytical Dashboard Platform, C-DAC. All rights reserved.</span>
                <span className="site-footer-note">Public examples are historical and include source notes.</span>
            </div>
        </footer>
    );
}

export default Footer;
