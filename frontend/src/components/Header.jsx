import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

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
    const navigate = useNavigate();
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        try { return Boolean(window.localStorage.getItem("adp-access-token")); }
        catch { return false; }
    });
    const [settingsError, setSettingsError] = useState("");
    const [textSize, setTextSize] = useState(() => {
        try { return window.localStorage.getItem("adp-text-size") || "default"; }
        catch { return "default"; }
    });
    const [contrastMode, setContrastMode] = useState(() => {
        try { return window.localStorage.getItem("adp-contrast") || "standard"; }
        catch { return "standard"; }
    });
    const [reduceMotion, setReduceMotion] = useState(() => {
        try { return window.localStorage.getItem("adp-reduce-motion") === "true"; }
        catch { return false; }
    });
    const [darkMode, setDarkMode] = useState(() => {
        try { return window.localStorage.getItem("adp-theme") === "dark"; }
        catch { return false; }
    });

    useEffect(() => {
        document.documentElement.dataset.adpTextSize = textSize;
        document.documentElement.dataset.adpTheme = darkMode ? "dark" : "light";
        document.documentElement.dataset.adpContrast = contrastMode;
        document.documentElement.dataset.adpReduceMotion = String(reduceMotion);
        try {
            window.localStorage.setItem("adp-text-size", textSize);
            window.localStorage.setItem("adp-theme", darkMode ? "dark" : "light");
            window.localStorage.setItem("adp-contrast", contrastMode);
            window.localStorage.setItem("adp-reduce-motion", String(reduceMotion));
        } catch { /* The controls remain usable if browser storage is disabled. */ }
    }, [textSize, darkMode, contrastMode, reduceMotion]);

    useEffect(() => {
        let isCurrent = true;
        const applySettings = (settings) => {
            if (!settings) return;
            setTextSize(settings.text_size);
            setDarkMode(settings.theme === "dark");
            setContrastMode(settings.contrast_mode);
            setReduceMotion(settings.reduce_motion);
        };
        const refreshSettings = (event) => applySettings(event.detail);
        window.addEventListener("adp-settings-changed", refreshSettings);

        const token = window.localStorage.getItem("adp-access-token");
        if (token) {
            apiRequest("/api/settings", { token })
                .then((settings) => {
                    if (isCurrent) applySettings(settings);
                })
                .catch((error) => {
                    if (isCurrent) setSettingsError(error.message || "Account display settings could not be loaded.");
                });
        }

        return () => {
            isCurrent = false;
            window.removeEventListener("adp-settings-changed", refreshSettings);
        };
    }, [isAuthenticated]);

    useEffect(() => {
        const refreshAuthState = () => {
            try { setIsAuthenticated(Boolean(window.localStorage.getItem("adp-access-token"))); }
            catch { setIsAuthenticated(false); }
        };
        window.addEventListener("storage", refreshAuthState);
        window.addEventListener("adp-auth-changed", refreshAuthState);
        return () => {
            window.removeEventListener("storage", refreshAuthState);
            window.removeEventListener("adp-auth-changed", refreshAuthState);
        };
    }, []);

    const saveDisplaySetting = async (field, value) => {
        setSettingsError("");
        const token = window.localStorage.getItem("adp-access-token");
        if (!token) {
            if (field === "text_size") setTextSize(value);
            else if (field === "theme") setDarkMode(value === "dark");
            else if (field === "contrast_mode") setContrastMode(value);
            else if (field === "reduce_motion") setReduceMotion(value);
            return;
        }

        try {
            const result = await apiRequest("/api/settings", {
                method: "PATCH",
                token,
                body: JSON.stringify({ [field]: value }),
            });
            setTextSize(result.text_size);
            setDarkMode(result.theme === "dark");
            setContrastMode(result.contrast_mode);
            setReduceMotion(result.reduce_motion);
            window.dispatchEvent(new CustomEvent("adp-settings-changed", { detail: result }));
        } catch (error) {
            setSettingsError(error.message || "Your display setting could not be saved.");
        }
    };

    const closeMenus = () => {
        setIsDownloadOpen(false);
    };

    const handleLogout = () => {
        try {
            window.localStorage.removeItem("adp-authenticated");
            window.localStorage.removeItem("adp-access-token");
        }
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
                    <button type="button" aria-label="Decrease text size" aria-pressed={textSize === "small"} title="Decrease text size" onClick={() => saveDisplaySetting("text_size", "small")}>A−</button>
                    <button type="button" aria-label="Default text size" aria-pressed={textSize === "default"} title="Default text size" onClick={() => saveDisplaySetting("text_size", "default")}>A</button>
                    <button type="button" aria-label="Increase text size" aria-pressed={textSize === "large"} title="Increase text size" onClick={() => saveDisplaySetting("text_size", "large")}>A+</button>
                    <button type="button" aria-label="Toggle dark mode" aria-pressed={darkMode} title="Toggle dark mode" onClick={() => saveDisplaySetting("theme", darkMode ? "light" : "dark")}>◐</button>
                </div>
            </div>
            {settingsError && <p className="site-settings-error" role="alert">{settingsError}</p>}

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

            </div>
        </header>
    );
}

export default Header;
