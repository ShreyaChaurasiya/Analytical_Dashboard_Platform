import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";

function isStrongPassword(password) {
    return password.length >= 8
        && /[A-Za-z]/.test(password)
        && /\d/.test(password)
        && /[^A-Za-z0-9]/.test(password);
}

function ForgetPassword() {
    const [email, setEmail] = useState("");
    const [challengeId, setChallengeId] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState("email");
    const [isComplete, setIsComplete] = useState(false);

    async function requestCode(event) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);
        try {
            const result = await apiRequest("/api/auth/password/forgot", {
                method: "POST",
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            setChallengeId(result.challenge_id);
            setCode("");
            setPassword("");
            setConfirmPassword("");
            setStep("code");
        } catch (requestError) {
            setError(requestError.message || "We could not send a reset code. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    function continueToPassword(event) {
        event.preventDefault();
        setError("");
        if (!/^\d{6}$/.test(code.trim())) {
            setError("Enter the 6-digit code sent to your email.");
            return;
        }
        setStep("password");
    }

    async function resetPassword(event) {
        event.preventDefault();
        setError("");
        if (!isStrongPassword(password)) {
            setError("Password must include a letter, a number, a special character, and at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);
        try {
            await apiRequest("/api/auth/password/reset", {
                method: "POST",
                body: JSON.stringify({
                    challenge_id: challengeId,
                    code: code.trim(),
                    new_password: password,
                }),
            });
            setIsComplete(true);
        } catch (resetError) {
            setError(resetError.message || "We could not reset your password. Request a new code and try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                <h1>Reset your password</h1>
                {isComplete ? (
                    <>
                        <p className="login-description" role="status">Your password has been updated. You can now sign in with your new password.</p>
                        <p className="login-signup"><Link to="/login">Return to login</Link></p>
                    </>
                ) : (
                    <>
                        {step === "email" && (
                            <form onSubmit={requestCode}>
                                <p className="login-signup">Enter your account email and we’ll send a reset code if it matches an active account.</p>
                                <label>
                                    Email
                                    <input
                                        type="email"
                                        autoComplete="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        required
                                    />
                                </label>
                                {error && <p className="login-error" role="alert">{error}</p>}
                                <button className="login-submit" type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Sending…" : "Send reset code"}
                                </button>
                            </form>
                        )}

                        {step === "code" && (
                            <form onSubmit={continueToPassword}>
                                <p className="login-signup">Enter the 6-digit code sent to {email}.</p>
                                <label>
                                    Email verification code
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        pattern="[0-9]{6}"
                                        value={code}
                                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                        required
                                    />
                                </label>
                                {error && <p className="login-error" role="alert">{error}</p>}
                                <button className="login-submit" type="submit">Continue</button>
                                <button className="login-resend" type="button" onClick={() => setStep("email")}>
                                    Request a new code
                                </button>
                            </form>
                        )}

                        {step === "password" && (
                            <form onSubmit={resetPassword}>
                                <p className="login-signup">Choose a new password.</p>
                                <label>
                                    New password
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        minLength={8}
                                        maxLength={128}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        required
                                    />
                                </label>
                                <label>
                                    Confirm new password
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        minLength={8}
                                        maxLength={128}
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        required
                                    />
                                </label>
                                {error && <p className="login-error" role="alert">{error}</p>}
                                <button className="login-submit" type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Updating…" : "Update password"}
                                </button>
                                <button className="login-resend" type="button" onClick={() => setStep("code")}>
                                    Change verification code
                                </button>
                            </form>
                        )}
                    </>
                )}
                {!isComplete && (
                    <p className="login-signup">Back to <Link to="/login">Log in</Link></p>
                )}
            </section>
        </main>
    );
}

export default ForgetPassword;
