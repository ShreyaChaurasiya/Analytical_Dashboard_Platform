import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const sampleCsv = [
    "Month,Observed rainfall (mm),Normal rainfall (mm),Departure from normal (%)",
    "June,189.0,163.6,16",
    "July,240.8,289.2,-17",
    "August,204.2,261.3,-22",
    "September,131.8,173.4,-24",
].join("\n");

const quickStart = [
    "Analytical Dashboard Platform — quick start",
    "",
    "1. Sign in with the user ID and password provided to you.",
    "2. Open Dashboard and choose Upload dataset.",
    "3. Review the detected columns and data quality notes.",
    "4. Run an analysis, then open Reports to review the result.",
    "",
    "Example file: ADP India rainfall sample (historical 2015 data).",
].join("\n");

function Header({ variant = "app" }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        try { return window.localStorage.getItem("adp-authenticated") === "true"; }
        catch { return false; }
    });
    const [textSize, setTextSize] = useState(() => {
        try { return window.localStorage.getItem("adp-text-size") || "default"; }
        catch { return "default"; }
    });
    const [darkMode, setDarkMode] = useState(() => {
        try { return window.localStorage.getItem("adp-theme") === "dark"; }
        catch { return false; }
    });

    useEffect(() => {
        document.documentElement.dataset.adpTextSize = textSize;
        document.documentElement.dataset.adpTheme = darkMode ? "dark" : "light";
        try {
            window.localStorage.setItem("adp-text-size", textSize);
            window.localStorage.setItem("adp-theme", darkMode ? "dark" : "light");
        } catch { /* The controls remain usable if browser storage is disabled. */ }
    }, [textSize, darkMode]);

    useEffect(() => {
        const refreshAuthState = () => {
            try { setIsAuthenticated(window.localStorage.getItem("adp-authenticated") === "true"); }
            catch { setIsAuthenticated(false); }
        };
        window.addEventListener("storage", refreshAuthState);
        window.addEventListener("adp-auth-changed", refreshAuthState);
        return () => {
            window.removeEventListener("storage", refreshAuthState);
            window.removeEventListener("adp-auth-changed", refreshAuthState);
        };
    }, []);

    const navItems = [
        { label: "Home", to: "/" },
        { label: "Dashboard", to: "/dashboard" },
        { label: "About", to: "/about" },
        { label: "Help", to: "/help" },
    ];

    const closeMenus = () => {
        setIsMenuOpen(false);
        setIsDownloadOpen(false);
    };

    const handleLogout = () => {
        try { window.localStorage.removeItem("adp-authenticated"); }
        catch { /* Continue to the login page if storage is unavailable. */ }
        window.dispatchEvent(new Event("adp-auth-changed"));
        closeMenus();
        navigate("/login", { replace: true });
    };

    return (
        <header className={`site-header site-header-${variant}`}>
            <div className="site-accessibility-bar">
                <a className="skip-link" href="#main-content">Skip to main content</a>
                <span className="site-accessibility-note">Centre for Development of Advanced Computing (C-DAC), Delhi</span>
                <div className="site-accessibility-controls" aria-label="Accessibility controls">
                    <span>Text size</span>
                    <button type="button" aria-label="Decrease text size" aria-pressed={textSize === "small"} title="Decrease text size" onClick={() => setTextSize("small")}>A−</button>
                    <button type="button" aria-label="Default text size" aria-pressed={textSize === "default"} title="Default text size" onClick={() => setTextSize("default")}>A</button>
                    <button type="button" aria-label="Increase text size" aria-pressed={textSize === "large"} title="Increase text size" onClick={() => setTextSize("large")}>A+</button>
                    <button type="button" aria-label="Toggle dark mode" aria-pressed={darkMode} title="Toggle dark mode" onClick={() => setDarkMode((enabled) => !enabled)}>◐</button>
                </div>
            </div>

            <div className="site-header-main">
                <Link to="/" className="site-brand" onClick={closeMenus}>
                    <span className="site-brand-text">
                        <strong>Analytical Dashboard Platform</strong>
                        <small>Centre for Development of Advanced Computing (C-DAC), Delhi</small>
                    </span>
                </Link>

                <div className="site-header-actions">
                    <div className="site-download-menu">
                        <button type="button" className="site-download-button" aria-expanded={isDownloadOpen} aria-haspopup="menu" onClick={() => setIsDownloadOpen((open) => !open)}>
                            Download <span aria-hidden="true">⌄</span>
                        </button>
                        {isDownloadOpen && <div className="site-download-dropdown" role="menu">
                            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`} download="adp-rainfall-example.csv" role="menuitem" onClick={() => setIsDownloadOpen(false)}>Rainfall sample · CSV</a>
                            <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(quickStart)}`} download="adp-quick-start.txt" role="menuitem" onClick={() => setIsDownloadOpen(false)}>Quick start guide</a>
                        </div>}
                    </div>
                    {!isAuthenticated && <Link className="site-auth-button" to="/login" onClick={closeMenus}>Login</Link>}
                    {isAuthenticated ? (
                        <button type="button" className="site-auth-button site-auth-button-primary" onClick={handleLogout}>Logout</button>
                    ) : (
                        <Link className="site-auth-button site-auth-button-primary" to="/registration" onClick={closeMenus}>Register</Link>
                    )}
                </div>

                <button type="button" className="site-menu-toggle" aria-expanded={isMenuOpen} aria-controls="site-navigation" onClick={() => setIsMenuOpen((open) => !open)}>
                    <span aria-hidden="true">☰</span><span>Menu</span>
                </button>
            </div>

            <nav id="site-navigation" className={`site-nav${isMenuOpen ? " open" : ""}`} aria-label="Main navigation">
                <div className="site-nav-inner">
                    {navItems.map((item) => <Link key={item.label} className={pathname === item.to ? "active" : ""} to={item.to} onClick={closeMenus}>{item.label}</Link>)}
                </div>
            </nav>
        </header>
    );
}

export default Header;
