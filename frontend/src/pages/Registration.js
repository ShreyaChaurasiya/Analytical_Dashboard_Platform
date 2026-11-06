import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

const initialForm = {
    accountType: "",
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    organization: "",
    jobTitle: "",
    address: "",
};

function RegistrationIntro() {
    return (
        <aside className="registration-aside" aria-label="Registration steps">
            <p className="registration-aside-kicker">Analytical Dashboard Platform</p>
            <h2>Set up your account.</h2>
            <p className="registration-aside-copy">A few details help us create your user profile and send your sign-in credentials securely.</p>
            <ol className="registration-steps">
                <li><span>01</span><div><strong>Your details</strong><small>Contact information for your account</small></div></li>
                <li><span>02</span><div><strong>Organization profile</strong><small>Only for company accounts</small></div></li>
                <li><span>03</span><div><strong>Secure sign-in</strong><small>Verify your email, then change the temporary password</small></div></li>
            </ol>
            <p className="registration-aside-note">Date of birth and address are optional.</p>
        </aside>
    );
}

function Registration() {
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!submitted) return undefined;
        const redirectTimer = window.setTimeout(() => navigate("/login", { replace: true }), 2500);
        return () => window.clearTimeout(redirectTimer);
    }, [submitted, navigate]);

    function updateField(event) {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
        setError("");
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        const payload = {
            ...form,
            fullName: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            dateOfBirth: form.dateOfBirth || null,
            organization: form.organization.trim() || null,
            jobTitle: form.jobTitle.trim() || null,
            address: form.address.trim() || null,
        };

        try {
            await apiRequest("/api/auth/register", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            setSubmitted(true);
        } catch (submitError) {
            setError(submitError.message || "We could not submit your registration. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <main className="registration-page">
                <div className="registration-shell registration-shell-success">
                    <RegistrationIntro />
                    <section className="registration-card registration-success" aria-labelledby="registration-success-heading">
                        <div className="registration-success-icon" aria-hidden="true">✓</div>
                        <p className="registration-eyebrow">REGISTRATION RECEIVED</p>
                        <h1 id="registration-success-heading">Thanks, {form.fullName.trim().split(" ")[0]}.</h1>
                        <p className="login-description" role="status">Your registration was submitted. Check {form.email.trim()} for your username and temporary password. Sign in, verify the email code, and change the temporary password before opening the dashboard.</p>
                        <Link className="registration-button registration-button-link" to="/login">Go to login now</Link>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="registration-page">
          <div className="registration-shell">
            <RegistrationIntro />
            <section className="registration-card" aria-labelledby="registration-heading">
                <header className="registration-header">
                    <p className="registration-eyebrow">ACCOUNT REGISTRATION</p>
                    <div className="registration-title-row">
                        <div>
                            <h1 id="registration-heading">Create your account</h1>
                            <p className="login-description">Enter your details to request a user account.</p>
                        </div>
                        <p className="registration-required-note"><span aria-hidden="true">*</span> Required</p>
                    </div>
                </header>

                <form className="registration-form" onSubmit={handleSubmit}>
                    <fieldset className="registration-account-type">
                        <legend className="registration-section-title">Account type</legend>
                        <p className="registration-section-copy">Choose how you will use the platform.</p>
                        <div className="registration-choice-row">
                            <label className={`registration-choice${form.accountType === "individual" ? " is-selected" : ""}`}>
                                <input type="radio" name="accountType" value="individual" checked={form.accountType === "individual"} onChange={updateField} required />
                                <span className="registration-choice-copy"><strong>Individual</strong><small>Personal account for your own analysis work</small></span>
                            </label>
                            <label className={`registration-choice${form.accountType === "organization" ? " is-selected" : ""}`}>
                                <input type="radio" name="accountType" value="organization" checked={form.accountType === "organization"} onChange={updateField} />
                                <span className="registration-choice-copy"><strong>Company</strong><small>Account for an organization or business</small></span>
                            </label>
                        </div>
                    </fieldset>

                    <div className="registration-fields">
                        <div className="registration-fields-heading">
                            <h2>Your details</h2>
                            <p>We’ll use these details for account communication.</p>
                        </div>
                        <label className="registration-field" htmlFor="registration-name">
                            <span className="registration-field-label">Full name <span aria-hidden="true">*</span></span>
                            <input id="registration-name" name="fullName" autoComplete="name" value={form.fullName} onChange={updateField} placeholder="Your full name" maxLength={120} required />
                        </label>
                        <label className="registration-field" htmlFor="registration-email">
                            <span className="registration-field-label">Work or personal email <span aria-hidden="true">*</span></span>
                            <input id="registration-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="name@example.com" maxLength={254} required />
                        </label>
                        <label className="registration-field" htmlFor="registration-phone">
                            <span className="registration-field-label">Phone number <span aria-hidden="true">*</span></span>
                            <input id="registration-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={updateField} placeholder="+91 98765 43210" minLength={7} maxLength={20} title="Enter a phone number with 7 to 20 characters" required />
                        </label>
                        <label className="registration-field" htmlFor="registration-dob">
                            Date of birth <span className="registration-optional">(optional)</span>
                            <input id="registration-dob" name="dateOfBirth" type="date" autoComplete="bday" value={form.dateOfBirth} onChange={updateField} max={new Date().toISOString().slice(0, 10)} />
                        </label>
                        {form.accountType === "organization" && (
                            <>
                                <div className="registration-fields-heading registration-fields-heading-spaced">
                                    <h2>Organization profile</h2>
                                    <p>Tell us where you work and the role you serve.</p>
                                </div>
                                <label className="registration-field" htmlFor="registration-company">
                                    <span className="registration-field-label">Company name <span aria-hidden="true">*</span></span>
                                    <input id="registration-company" name="organization" autoComplete="organization" value={form.organization} onChange={updateField} placeholder="Organization name" maxLength={160} required />
                                </label>
                                <label className="registration-field" htmlFor="registration-role">
                                    <span className="registration-field-label">Your role or job title <span aria-hidden="true">*</span></span>
                                    <input id="registration-role" name="jobTitle" autoComplete="organization-title" value={form.jobTitle} onChange={updateField} placeholder="e.g. Data Analyst" maxLength={120} required />
                                </label>
                            </>
                        )}
                        <label className="registration-field registration-field-wide" htmlFor="registration-address">
                            Address <span className="registration-optional">(optional)</span>
                            <textarea id="registration-address" name="address" autoComplete="street-address" value={form.address} onChange={updateField} placeholder="Street, city, state, postal code" rows="2" maxLength={500} />
                        </label>
                    </div>

                    <div className="registration-account-note">
                        <strong>What happens next</strong>
                        <p>Your username and temporary password will be emailed after registration. Sign in with those details, verify the email code, then change the temporary password before opening the dashboard.</p>
                    </div>
                    {error && <p className="registration-error" role="alert">{error}</p>}
                    <button className="registration-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting…" : "Submit registration"}
                        {!isSubmitting && <span aria-hidden="true">→</span>}
                    </button>
                </form>

                <p className="registration-signin">Already have an account? <Link to="/login">Sign in</Link></p>
            </section>
          </div>
        </main>
    );
}

export default Registration;
