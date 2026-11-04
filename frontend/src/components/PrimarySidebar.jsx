import { useState } from "react";
import { NavLink } from "react-router-dom";

function PrimarySidebar({ includeSettings = true, includeSettingsCategories = false }) {
    const [isOpen, setIsOpen] = useState(true);
    const links = [
        { label: "Home", to: "/", end: true },
        { label: "Dashboard", to: "/dashboard" },
        { label: "About", to: "/about" },
        { label: "Help", to: "/help" },
        ...(includeSettings ? [{ label: "Settings", to: "/settings" }] : []),
    ];

    return (
        <>
            <aside className={`workspace-sidebar site-primary-sidebar${isOpen ? "" : " is-collapsed"}`} aria-label="Main sidebar" aria-hidden={!isOpen}>
                <div className="workspace-sidebar-header">
                    <button
                        className="workspace-hide-control"
                        type="button"
                        aria-label="Hide workspace"
                        aria-expanded={isOpen}
                        onClick={() => setIsOpen(false)}
                    >
                        ☰
                    </button>
                </div>
                <nav className="site-primary-nav" aria-label="Main navigation">
                    {links.map((link) => (
                        <NavLink
                            key={link.label}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) => `workspace-nav-link${isActive ? " active" : ""}`}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>
                {includeSettingsCategories && (
                    <>
                        <div className="workspace-sidebar-divider" />
                        <nav className="site-primary-nav" aria-label="Settings categories">
                            <a className="workspace-nav-link" href="#settings-account">Account</a>
                            <a className="workspace-nav-link" href="#settings-security">Security</a>
                            <a className="workspace-nav-link" href="#settings-privacy">Privacy &amp; data</a>
                            <a className="workspace-nav-link" href="#settings-display">Display &amp; accessibility</a>
                            <a className="workspace-nav-link" href="#settings-preferences">Home preferences</a>
                        </nav>
                    </>
                )}
            </aside>
            {!isOpen && (
                <button
                    className="workspace-show-control site-primary-show-control"
                    type="button"
                    aria-label="Show workspace"
                    onClick={() => setIsOpen(true)}
                >
                    ☰
                </button>
            )}
        </>
    );
}

export default PrimarySidebar;
