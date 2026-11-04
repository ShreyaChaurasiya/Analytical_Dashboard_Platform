import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

const defaults = {
    full_name: "",
    email: "",
    username: "",
    phone: "",
    account_type: "",
    organization: "",
    job_title: "",
    account_status: "",
    account_created_at: null,
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "rainfall",
    dashboard_default_dataset_id: null,
    dashboard_analysis_view: "overview",
    dashboard_time_range: "all",
    dashboard_report_format: "pdf",
};

const dashboardFields = [
    "dashboard_default_dataset_id",
    "dashboard_analysis_view",
    "dashboard_time_range",
    "dashboard_report_format",
];

const profileDefaults = {
    full_name: "",
    phone: "",
    organization: "",
    job_title: "",
};

const emailChangeDefaults = {
    new_email: "",
    current_password: "",
    code: "",
};

const accountDeleteDefaults = {
    current_password: "",
    confirmation_name: "",
};

function Settings({ scope = "account" }) {
    const navigate = useNavigate();
    const isDashboardSettings = scope === "dashboard";
    const [settings, setSettings] = useState(defaults);
    const [profile, setProfile] = useState(profileDefaults);
    const [emailChange, setEmailChange] = useState(emailChangeDefaults);
    const [emailChallenge, setEmailChallenge] = useState(null);
    const [accountDelete, setAccountDelete] = useState(accountDeleteDefaults);
    const [isAccountDeleteOpen, setIsAccountDeleteOpen] = useState(false);
    const [datasets, setDatasets] = useState([]);
    const [datasetPendingDelete, setDatasetPendingDelete] = useState(null);
    const [deletingDatasetId, setDeletingDatasetId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isStartingEmailChange, setIsStartingEmailChange] = useState(false);
    const [isVerifyingEmailChange, setIsVerifyingEmailChange] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const applyDisplayPreferences = useCallback((value) => {
        document.documentElement.dataset.adpTextSize = value.text_size;
        document.documentElement.dataset.adpTheme = value.theme;
        document.documentElement.dataset.adpContrast = value.contrast_mode;
        document.documentElement.dataset.adpReduceMotion = String(value.reduce_motion);
        try {
            window.localStorage.setItem("adp-text-size", value.text_size);
            window.localStorage.setItem("adp-theme", value.theme);
            window.localStorage.setItem("adp-contrast", value.contrast_mode);
            window.localStorage.setItem("adp-reduce-motion", String(value.reduce_motion));
        } catch {
            setError("Display preferences are active for this page but could not be stored in this browser.");
        }
    }, []);

    useEffect(() => {
        let isCurrent = true;
        const token = window.localStorage.getItem("adp-access-token");
        const requests = [
            apiRequest("/api/settings", { token }),
            apiRequest("/api/datasets", { token }),
        ];

        Promise.all(requests)
            .then(([result, datasetRows]) => {
                if (!isCurrent) return;
                const loadedSettings = { ...defaults, ...result };
                applyDisplayPreferences(loadedSettings);
                if (
                    isDashboardSettings
                    && loadedSettings.dashboard_default_dataset_id !== null
                    && !datasetRows.some((item) => item.id === loadedSettings.dashboard_default_dataset_id)
                ) {
                    loadedSettings.dashboard_default_dataset_id = null;
                }
                setSettings(loadedSettings);
                setProfile({
                    full_name: loadedSettings.full_name || "",
                    phone: loadedSettings.phone || "",
                    organization: loadedSettings.organization || "",
                    job_title: loadedSettings.job_title || "",
                });
                setDatasets(datasetRows);
            })
            .catch((loadError) => {
                if (isCurrent) setError(loadError.message || "Settings could not be loaded.");
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [isDashboardSettings, applyDisplayPreferences]);

    const updateField = (event) => {
        const { name, value } = event.target;
        setSettings((current) => ({
            ...current,
            [name]: name === "dashboard_default_dataset_id" && value
                ? Number(value)
                : name === "dashboard_default_dataset_id"
                    ? null
                    : value,
        }));
        setMessage("");
    };

    const saveSettings = async () => {
        setIsSaving(true);
        setError("");
        setMessage("");
        const fields = isDashboardSettings ? dashboardFields : [
            "theme",
            "text_size",
            "contrast_mode",
            "reduce_motion",
            "default_landing_page",
            "home_featured_sample",
        ];
        const changes = Object.fromEntries(fields.map((field) => [field, settings[field]]));

        try {
            const result = await apiRequest("/api/settings", {
                method: "PATCH",
                token: window.localStorage.getItem("adp-access-token"),
                body: JSON.stringify(changes),
            });
            setSettings({ ...defaults, ...result });
            applyDisplayPreferences(result);
            window.dispatchEvent(new CustomEvent("adp-settings-changed", { detail: result }));
            setMessage("Your settings have been saved to your account.");
        } catch (saveError) {
            setError(saveError.message || "Your settings could not be saved.");
        } finally {
            setIsSaving(false);
        }
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        setIsSavingProfile(true);
        setError("");
        setMessage("");
        try {
            const result = await apiRequest("/api/settings/profile", {
                method: "PATCH",
                token: window.localStorage.getItem("adp-access-token"),
                body: JSON.stringify(profile),
            });
            setSettings({ ...defaults, ...result });
            applyDisplayPreferences(result);
            setProfile({
                full_name: result.full_name,
                phone: result.phone,
                organization: result.organization || "",
                job_title: result.job_title || "",
            });
            window.dispatchEvent(new CustomEvent("adp-settings-changed", { detail: result }));
            setMessage("Your account details have been saved.");
        } catch (saveError) {
            setError(saveError.message || "Your account details could not be saved.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const startEmailChange = async (event) => {
        event.preventDefault();
        setIsStartingEmailChange(true);
        setError("");
        setMessage("");
        try {
            const result = await apiRequest("/api/settings/email-change", {
                method: "POST",
                token: window.localStorage.getItem("adp-access-token"),
                body: JSON.stringify({
                    new_email: emailChange.new_email,
                    current_password: emailChange.current_password,
                }),
            });
            setEmailChallenge(result);
            setMessage(result.message);
        } catch (requestError) {
            setError(requestError.message || "Email verification could not be started.");
        } finally {
            setIsStartingEmailChange(false);
        }
    };

    const verifyEmailChange = async (event) => {
        event.preventDefault();
        if (!emailChallenge) return;
        setIsVerifyingEmailChange(true);
        setError("");
        setMessage("");
        try {
            const result = await apiRequest("/api/settings/email-change/verify", {
                method: "POST",
                token: window.localStorage.getItem("adp-access-token"),
                body: JSON.stringify({
                    challenge_id: emailChallenge.challenge_id,
                    code: emailChange.code,
                }),
            });
            setSettings((current) => ({ ...current, email: result.email }));
            setEmailChange(emailChangeDefaults);
            setEmailChallenge(null);
            setMessage(result.message);
        } catch (verifyError) {
            setError(verifyError.message || "Your new email could not be verified.");
        } finally {
            setIsVerifyingEmailChange(false);
        }
    };

    const cancelEmailChange = () => {
        setEmailChallenge(null);
        setEmailChange(emailChangeDefaults);
        setError("");
        setMessage("Email change cancelled. Your current sign-in email is unchanged.");
    };

    const deleteDataset = async () => {
        if (!datasetPendingDelete) return;
        const dataset = datasetPendingDelete;
        setDeletingDatasetId(dataset.id);
        setError("");
        setMessage("");
        try {
            await apiRequest(`/api/datasets/${encodeURIComponent(dataset.id)}`, {
                method: "DELETE",
                token: window.localStorage.getItem("adp-access-token"),
            });
            setDatasets((current) => current.filter((item) => item.id !== dataset.id));
            setDatasetPendingDelete(null);
            setMessage(`Dataset “${dataset.name}” and its associated analysis and reports were deleted.`);
        } catch (deleteError) {
            setError(deleteError.message || "The dataset could not be deleted.");
        } finally {
            setDeletingDatasetId(null);
        }
    };

    const deleteAccount = async (event) => {
        event.preventDefault();
        setIsDeletingAccount(true);
        setError("");
        setMessage("");
        try {
            const result = await apiRequest("/api/settings/account", {
                method: "DELETE",
                token: window.localStorage.getItem("adp-access-token"),
                body: JSON.stringify(accountDelete),
            });
            window.localStorage.removeItem("adp-authenticated");
            window.localStorage.removeItem("adp-access-token");
            window.dispatchEvent(new Event("adp-auth-changed"));
            const notification = result.notification_sent
                ? " A confirmation email was sent."
                : " The account was deleted, but the confirmation email could not be sent.";
            const cleanup = result.storage_cleanup_complete
                ? ""
                : " Some stored files could not be removed; contact the person who manages this platform.";
            navigate("/login", {
                replace: true,
                state: { accountNotice: `${result.message}${notification}${cleanup}` },
            });
        } catch (deleteError) {
            setError(deleteError.message || "Your account could not be deleted.");
            setIsDeletingAccount(false);
        }
    };

    const cancelAccountDeletion = () => {
        setIsAccountDeleteOpen(false);
        setAccountDelete(accountDeleteDefaults);
        setError("");
        setMessage("Account deletion cancelled. Your account and data are unchanged.");
    };

    const signOut = () => {
        window.localStorage.removeItem("adp-authenticated");
        window.localStorage.removeItem("adp-access-token");
        window.dispatchEvent(new Event("adp-auth-changed"));
        navigate("/login", { replace: true });
    };

    return (
        <main className="settings-page" aria-labelledby="settings-heading">
            {isLoading ? (
                <p className="settings-loading" role="status">Loading your settings…</p>
            ) : (
                <div className={`settings-layout${isDashboardSettings ? " is-dashboard-settings" : " is-no-category-nav"}`}>
                <div className="settings-main-column">
                <header className="settings-heading">
                    <p className="dashboard-eyebrow">{isDashboardSettings ? "DASHBOARD / PREFERENCES" : "ACCOUNT / SETTINGS"}</p>
                    <h1 id="settings-heading">{isDashboardSettings ? "Dashboard settings" : "Settings"}</h1>
                    <p>
                        {isDashboardSettings
                            ? "Choose how your dashboard opens and how new reports are prepared."
                            : "Manage your account, security, privacy, accessibility, and workspace preferences."}
                    </p>
                </header>

                <nav className="settings-scope-nav" aria-label="Settings sections">
                    <Link
                        to="/settings"
                        className={!isDashboardSettings ? "is-active" : ""}
                        aria-current={!isDashboardSettings ? "page" : undefined}
                    >
                        Account settings
                    </Link>
                    <Link
                        to="/dashboard/settings"
                        className={isDashboardSettings ? "is-active" : ""}
                        aria-current={isDashboardSettings ? "page" : undefined}
                    >
                        Dashboard settings
                    </Link>
                </nav>

                {error && <p className="settings-message is-error" role="alert">{error}</p>}
                {message && <p className="settings-message is-success" role="status">{message}</p>}
                <div className="settings-form settings-content">
                    {isDashboardSettings ? (
                        <>
                            <section className="settings-card" aria-labelledby="dashboard-defaults-heading">
                                <div className="settings-card-heading">
                                    <h2 id="dashboard-defaults-heading">Dashboard defaults</h2>
                                    <p>These are applied when you open the dashboard. You can still change its filters at any time.</p>
                                </div>
                                <label className="settings-field">
                                    Default dataset
                                    <select
                                        name="dashboard_default_dataset_id"
                                        value={settings.dashboard_default_dataset_id ?? ""}
                                        onChange={updateField}
                                    >
                                        <option value="">All uploaded datasets</option>
                                        {datasets.map((dataset) => (
                                            <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="settings-field">
                                    Opening analysis view
                                    <select name="dashboard_analysis_view" value={settings.dashboard_analysis_view} onChange={updateField}>
                                        <option value="overview">Overview</option>
                                        <option value="activity">Data activity</option>
                                        <option value="summary">Data summary</option>
                                    </select>
                                </label>
                                <label className="settings-field">
                                    Default time range
                                    <select name="dashboard_time_range" value={settings.dashboard_time_range} onChange={updateField}>
                                        <option value="all">All available data</option>
                                        <option value="7">Last 7 days</option>
                                        <option value="30">Last 30 days</option>
                                    </select>
                                </label>
                            </section>
                            <section className="settings-card" aria-labelledby="report-defaults-heading">
                                <div className="settings-card-heading">
                                    <h2 id="report-defaults-heading">Report defaults</h2>
                                    <p>Choose the format preselected when you create a report.</p>
                                </div>
                                <label className="settings-field">
                                    Preferred report format
                                    <select name="dashboard_report_format" value={settings.dashboard_report_format} onChange={updateField}>
                                        <option value="pdf">PDF</option>
                                        <option value="xlsx">Excel (.xlsx)</option>
                                    </select>
                                </label>
                            </section>
                        </>
                    ) : (
                        <>
                            <section className="settings-card" id="settings-account" aria-labelledby="account-details-heading">
                                <div className="settings-card-heading">
                                    <h2 id="account-details-heading">Account information</h2>
                                    <p>Update your contact and organization details. Your user ID is assigned by the platform.</p>
                                </div>
                                <form className="settings-profile-form" onSubmit={saveProfile}>
                                    <label className="settings-field">
                                        Full name
                                        <input name="full_name" value={profile.full_name} maxLength={120} required onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))} />
                                    </label>
                                    <label className="settings-field">
                                        Phone
                                        <input name="phone" type="tel" value={profile.phone} maxLength={20} required onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} />
                                    </label>
                                    <label className="settings-field">
                                        Organization
                                        <input name="organization" value={profile.organization} maxLength={160} onChange={(event) => setProfile((current) => ({ ...current, organization: event.target.value }))} />
                                    </label>
                                    <label className="settings-field">
                                        Job title
                                        <input name="job_title" value={profile.job_title} maxLength={120} onChange={(event) => setProfile((current) => ({ ...current, job_title: event.target.value }))} />
                                    </label>
                                    <div className="settings-profile-actions">
                                        <button className="workspace-primary-button" type="submit" disabled={isSavingProfile}>
                                            {isSavingProfile ? "Saving account…" : "Save account details"}
                                        </button>
                                    </div>
                                </form>
                                <div className="settings-account-details">
                                    <div><span>Email (used for sign-in verification)</span><strong>{settings.email}</strong></div>
                                    <div><span>User ID</span><strong>{settings.username || "Not set"}</strong></div>
                                    <div><span>Account type</span><strong>{settings.account_type || "Not provided"}</strong></div>
                                    <div>
                                        <span>Member since</span>
                                        <strong>{settings.account_created_at
                                            ? new Date(settings.account_created_at).toLocaleDateString()
                                            : "Not available"}
                                        </strong>
                                    </div>
                                </div>
                                <div className="settings-email-change">
                                    <div className="settings-card-heading">
                                        <h3>Sign-in email</h3>
                                        <p>Changing this address requires your current password and a verification code sent to the new address.</p>
                                    </div>
                                    {!emailChallenge ? (
                                        <form className="settings-email-form" onSubmit={startEmailChange}>
                                            <label className="settings-field">
                                                New email address
                                                <input
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    value={emailChange.new_email}
                                                    onChange={(event) => setEmailChange((current) => ({ ...current, new_email: event.target.value }))}
                                                />
                                            </label>
                                            <label className="settings-field">
                                                Current password
                                                <input
                                                    type="password"
                                                    autoComplete="current-password"
                                                    required
                                                    value={emailChange.current_password}
                                                    onChange={(event) => setEmailChange((current) => ({ ...current, current_password: event.target.value }))}
                                                />
                                            </label>
                                            <div className="settings-profile-actions">
                                                <button className="settings-secondary-button" type="submit" disabled={isStartingEmailChange}>
                                                    {isStartingEmailChange ? "Sending code…" : "Verify new email"}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <form className="settings-email-form" onSubmit={verifyEmailChange}>
                                            <p className="settings-email-code-note" role="status">
                                                Enter the 6-digit code sent to {emailChallenge.masked_email}. It expires in 10 minutes.
                                            </p>
                                            <label className="settings-field">
                                                Email verification code
                                                <input
                                                    inputMode="numeric"
                                                    autoComplete="one-time-code"
                                                    pattern="[0-9]{6}"
                                                    maxLength={6}
                                                    required
                                                    value={emailChange.code}
                                                    onChange={(event) => setEmailChange((current) => ({ ...current, code: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                                />
                                            </label>
                                            <div className="settings-profile-actions">
                                                <button className="settings-secondary-button" type="button" onClick={cancelEmailChange} disabled={isVerifyingEmailChange}>Cancel</button>
                                                <button className="workspace-primary-button" type="submit" disabled={isVerifyingEmailChange}>
                                                    {isVerifyingEmailChange ? "Verifying…" : "Confirm email change"}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </section>
                            <section className="settings-card" id="settings-security" aria-labelledby="security-heading">
                                <div className="settings-card-heading">
                                    <h2 id="security-heading">Security</h2>
                                    <p>Manage your password and understand how sign-in to your account is protected.</p>
                                </div>
                                <div className="settings-security-row">
                                    <div>
                                        <strong>Password</strong>
                                        <span>Change your password using your current password.</span>
                                    </div>
                                    <Link to="/reset-password">Change password</Link>
                                </div>
                                <div className="settings-security-row">
                                    <div>
                                        <strong>Email verification</strong>
                                        <span>A one-time code is required when you sign in.</span>
                                    </div>
                                    <span className="settings-security-status">Enabled</span>
                                </div>
                                <div className="settings-security-row">
                                    <div>
                                        <strong>This browser</strong>
                                        <span>Sign out to remove this browser's saved access token.</span>
                                    </div>
                                    <button className="settings-secondary-button" type="button" onClick={signOut}>
                                        Sign out
                                    </button>
                                </div>
                            </section>
                            <section className="settings-card" id="settings-display" aria-labelledby="display-heading">
                                <div className="settings-card-heading">
                                    <h2 id="display-heading">Display and accessibility</h2>
                                    <p>Choose readable display options. They are applied across the signed-in workspace.</p>
                                </div>
                                <label className="settings-field">
                                    Color theme
                                    <select name="theme" value={settings.theme} onChange={updateField}>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </label>
                                <label className="settings-field">
                                    Text size
                                    <select name="text_size" value={settings.text_size} onChange={updateField}>
                                        <option value="small">Small</option>
                                        <option value="default">Default</option>
                                        <option value="large">Large</option>
                                    </select>
                                </label>
                                <label className="settings-field">
                                    Contrast
                                    <select name="contrast_mode" value={settings.contrast_mode} onChange={updateField}>
                                        <option value="standard">Standard</option>
                                        <option value="high">High contrast</option>
                                    </select>
                                </label>
                                <label className="settings-check-field">
                                    <input
                                        type="checkbox"
                                        name="reduce_motion"
                                        checked={settings.reduce_motion}
                                        onChange={(event) => {
                                            setSettings((current) => ({ ...current, reduce_motion: event.target.checked }));
                                            setMessage("");
                                        }}
                                    />
                                    <span><strong>Reduce motion</strong><small>Limit decorative transitions and animations.</small></span>
                                </label>
                            </section>
                            <section className="settings-card" id="settings-preferences" aria-labelledby="landing-preferences-heading">
                                <div className="settings-card-heading">
                                    <h2 id="landing-preferences-heading">Starting page</h2>
                                    <p>Choose the first page to open after you sign in.</p>
                                </div>
                                <label className="settings-field">
                                    After sign-in, open
                                    <select name="default_landing_page" value={settings.default_landing_page} onChange={updateField}>
                                        <option value="home">Home</option>
                                        <option value="dashboard">Dashboard</option>
                                    </select>
                                </label>
                            </section>
                            <section className="settings-card" aria-labelledby="home-preferences-heading">
                                <div className="settings-card-heading">
                                    <h2 id="home-preferences-heading">Home page</h2>
                                    <p>Pick the public-data example shown first on Home. The sample is historical and is not a live government feed.</p>
                                </div>
                                <label className="settings-field">
                                    Featured example
                                    <select name="home_featured_sample" value={settings.home_featured_sample} onChange={updateField}>
                                        <option value="rainfall">India rainfall · IMD</option>
                                        <option value="cpi">Consumer prices · MoSPI</option>
                                        <option value="market">Market returns · NSE Indices</option>
                                        <option value="education">Education statistics · UDISE+</option>
                                        <option value="health">Health indicators · NFHS</option>
                                        <option value="aqi">Air quality · CPCB</option>
                                    </select>
                                </label>
                            </section>
                            <section className="settings-card" id="settings-privacy" aria-labelledby="privacy-data-heading">
                                <div className="settings-card-heading">
                                    <h2 id="privacy-data-heading">Privacy and your data</h2>
                                    <p>Your datasets, reports, and dashboard downloads are stored for your account and can be removed here or from their respective pages.</p>
                                </div>
                                <div className="settings-privacy-list">
                                    <div><strong>Stored on this platform</strong><span>Uploaded datasets, analysis results, generated reports, and dashboard summary downloads are stored on the server.</span></div>
                                    <div><strong>Downloaded files</strong><span>Report and dashboard downloads remain on this platform until deleted, and a copy is also saved to your device.</span></div>
                                    <div><strong>Account deletion</strong><span>Deleting your account permanently removes its database records and server-stored files. Copies already saved to your device must be removed there.</span></div>
                                </div>
                                <p className="settings-data-note">Deleting a dataset also removes your saved dashboard summary downloads. Deleting a report or dashboard download from the app does not erase the copy on your device.</p>
                                <div className="settings-dataset-controls">
                                    <h3>Your datasets</h3>
                                    <p>Remove a dataset and its versions, analyses, quality findings, and generated reports from your account.</p>
                                    {datasets.length ? (
                                        <ul>
                                            {datasets.map((dataset) => (
                                                <li key={dataset.id}>
                                                    <span>
                                                        <strong>{dataset.name}</strong>
                                                        <small>{dataset.file_type || "Data file"} · {dataset.original_filename}</small>
                                                    </span>
                                                    {datasetPendingDelete?.id === dataset.id ? (
                                                        <span className="settings-delete-confirmation" role="group" aria-label={`Confirm deletion of ${dataset.name}`}>
                                                            <span>This cannot be undone.</span>
                                                            <button className="settings-secondary-button" type="button" onClick={() => setDatasetPendingDelete(null)} disabled={deletingDatasetId === dataset.id}>Cancel</button>
                                                            <button className="settings-danger-button" type="button" onClick={deleteDataset} disabled={deletingDatasetId === dataset.id}>
                                                                {deletingDatasetId === dataset.id ? "Deleting…" : "Permanently delete"}
                                                            </button>
                                                        </span>
                                                    ) : (
                                                        <button className="settings-secondary-button" type="button" onClick={() => setDatasetPendingDelete(dataset)}>
                                                            Remove dataset
                                                        </button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="settings-datasets-empty">No datasets are currently stored in your account.</p>
                                    )}
                                </div>
                                <div className="settings-data-actions">
                                    <Link to="/dashboard">Manage datasets</Link>
                                    <Link to="/reports">Manage reports</Link>
                                </div>
                                <section className="settings-danger-zone" aria-labelledby="delete-account-heading">
                                    <div>
                                        <h3 id="delete-account-heading">Delete account</h3>
                                        <p>Permanently delete your account, datasets, analyses, quality findings, and generated reports. Downloaded copies on your devices cannot be removed by this action.</p>
                                    </div>
                                    {!isAccountDeleteOpen ? (
                                        <button className="settings-danger-button" type="button" onClick={() => { setIsAccountDeleteOpen(true); setMessage(""); }}>
                                            Delete my account
                                        </button>
                                    ) : (
                                        <form className="settings-delete-account-form" onSubmit={deleteAccount}>
                                            <p>This cannot be undone. Confirm your current password and type your full account name exactly as shown in Account information.</p>
                                            <label className="settings-field">
                                                Current password
                                                <input
                                                    type="password"
                                                    autoComplete="current-password"
                                                    required
                                                    value={accountDelete.current_password}
                                                    onChange={(event) => setAccountDelete((current) => ({ ...current, current_password: event.target.value }))}
                                                />
                                            </label>
                                            <label className="settings-field">
                                                Type your account name: <strong>{settings.full_name}</strong>
                                                <input
                                                    autoComplete="off"
                                                    required
                                                    value={accountDelete.confirmation_name}
                                                    onChange={(event) => setAccountDelete((current) => ({ ...current, confirmation_name: event.target.value }))}
                                                />
                                            </label>
                                            <div className="settings-profile-actions">
                                                <button className="settings-secondary-button" type="button" onClick={cancelAccountDeletion} disabled={isDeletingAccount}>Cancel deletion</button>
                                                <button className="settings-danger-button" type="submit" disabled={isDeletingAccount}>
                                                    {isDeletingAccount ? "Deleting account…" : "Permanently delete account"}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </section>
                            </section>
                        </>
                    )}
                    <div className="settings-actions">
                        <button className="workspace-primary-button" type="button" onClick={saveSettings} disabled={isSaving}>
                            {isSaving ? "Saving…" : "Save settings"}
                        </button>
                        <span>Settings are saved to your account.</span>
                    </div>
                </div>
                </div>
                </div>
            )}
        </main>
    );
}

export default Settings;
