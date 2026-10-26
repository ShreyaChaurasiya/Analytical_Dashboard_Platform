import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const initialForm = {
    accountType: "",
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    organization: "",
    jobTitle: "",
    address: "",
    identityType: "",
    identityNumber: "",
};

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
            organization: form.organization.trim() || null,
            jobTitle: form.jobTitle.trim() || null,
            address: form.address.trim() || null,
            identityType: form.identityType || null,
            identityNumber: form.identityNumber.trim() || null,
        };

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!(response.headers.get("content-type") || "").includes("application/json")) {
                throw new Error("Registration service is not connected yet. Your details have not been saved.");
            }
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.detail || "We could not submit your registration. Please try again.");
            }
            setSubmitted(true);
        } catch (submitError) {
            setError(
                submitError instanceof TypeError
                    ? "Registration service is not connected yet. Your details have not been saved."
                    : submitError.message
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <main className="registration-page">
                <section className="registration-card registration-success" aria-labelledby="registration-success-heading">
                    <div className="registration-success-icon" aria-hidden="true">✓</div>
                    <p className="login-eyebrow">REGISTRATION RECEIVED</p>
                    <h1 id="registration-success-heading">Thanks, {form.fullName.trim().split(" ")[0]}.</h1>
                    <p className="login-description" role="status">Your registration request was submitted. Taking you to login…</p>
                    <Link className="registration-button registration-button-link" to="/login">Go to login now</Link>
                </section>
            </main>
        );
    }

    return (
        <main className="registration-page">
            <section className="registration-card" aria-labelledby="registration-heading">
                <header className="registration-header">
                    <h1 id="registration-heading">Create your account</h1>
                    <p className="login-description"> Fields marked <span aria-hidden="true">*</span> are required.</p>
                </header>

                <form className="registration-form" onSubmit={handleSubmit}>
                    <fieldset className="registration-account-type">
                        <legend>Who will use the platform?</legend>
                        <div className="registration-choice-row">
                            <label className={`registration-choice${form.accountType === "individual" ? " is-selected" : ""}`}>
                                <input type="radio" name="accountType" value="individual" checked={form.accountType === "individual"} onChange={updateField} />
                                <span className="registration-choice-icon" aria-hidden="true">◉</span>
                                <span><strong>Individual</strong><small>Register for yourself</small></span>
                            </label>
                            <label className={`registration-choice${form.accountType === "organization" ? " is-selected" : ""}`}>
                                <input type="radio" name="accountType" value="organization" checked={form.accountType === "organization"} onChange={updateField} />
                                <span className="registration-choice-icon" aria-hidden="true">▦</span>
                                <span><strong>Company</strong><small>Register for an organization</small></span>
                            </label>
                        </div>
                    </fieldset>

                    <div className="registration-fields">
                        <label className="registration-field registration-field-wide" htmlFor="registration-name">
                            <span className="registration-field-label">Full name <span aria-hidden="true">*</span></span>
                            <input id="registration-name" name="fullName" autoComplete="name" value={form.fullName} onChange={updateField} placeholder="Your full name" maxLength={120} required />
                        </label>
                        <label className="registration-field" htmlFor="registration-email">
                            <span className="registration-field-label">Work or personal email <span aria-hidden="true">*</span></span>
                            <input id="registration-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="name@example.com" maxLength={254} required />
                        </label>
                        <label className="registration-field" htmlFor="registration-phone">
                            <span className="registration-field-label">Phone number <span aria-hidden="true">*</span></span>
                            <input id="registration-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={updateField} placeholder="+91 98765 43210" maxLength={20} pattern="[+0-9() .-]{7,20}" title="Enter a valid phone number" required />
                        </label>
                        <label className="registration-field" htmlFor="registration-dob">
                            Date of birth <span className="registration-optional">(optional)</span>
                            <input id="registration-dob" name="dateOfBirth" type="date" autoComplete="bday" value={form.dateOfBirth} onChange={updateField} max={new Date().toISOString().slice(0, 10)} />
                        </label>
                        {form.accountType === "organization" && (
                            <>
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

                    <details className="registration-identity">
                        <summary>Identity details <span>Optional · only add if your organization requires it</span></summary>
                        <div className="registration-fields registration-identity-fields">
                            <label className="registration-field" htmlFor="registration-identity-type">
                                Document type
                                <select id="registration-identity-type" name="identityType" value={form.identityType} onChange={updateField}>
                                    <option value="">Select document type</option>
                                    <option value="employee_id">Employee ID</option>
                                    <option value="student_id">Student ID</option>
                                    <option value="other">Other organization ID</option>
                                </select>
                            </label>
                            <label className="registration-field" htmlFor="registration-identity-number">
                                Document number
                                <input id="registration-identity-number" name="identityNumber" value={form.identityNumber} onChange={updateField} placeholder="Enter ID number" maxLength={80} autoComplete="off" />
                            </label>
                        </div>
                        <p className="registration-privacy-note">Do not enter government ID numbers or upload identity documents here.</p>
                    </details>

                    <p className="registration-account-note">Your account uses the User role. A user ID and temporary password are issued separately; you can change the password after signing in.</p>
                    {error && <p className="registration-error" role="alert">{error}</p>}
                    <button className="registration-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting…" : "Submit registration"}
                        {!isSubmitting && <span aria-hidden="true">→</span>}
                    </button>
                </form>

                <p className="registration-signin">Already have an account? <Link to="/login">Sign in</Link></p>
            </section>
        </main>
    );
}

export default Registration;
