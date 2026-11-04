import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

function LoginOtp() {
    const navigate = useNavigate();
    const location = useLocation();
    const challengeId = location.state?.challengeId;
    const email = location.state?.email || "your registered email";
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [resendIn, setResendIn] = useState(60);

    useEffect(() => {
        if (!challengeId) {
            navigate("/login", { replace: true });
        }
    }, [challengeId, navigate]);

    useEffect(() => {
        if (resendIn <= 0) return undefined;
        const timer = window.setTimeout(() => setResendIn((remaining) => remaining - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [resendIn]);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        if (!/^\d{6}$/.test(code.trim())) {
            setError("Enter the 6-digit code sent to your email");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await apiRequest("/api/auth/login/verify-otp", {
                method: "POST",
                body: JSON.stringify({ challenge_id: challengeId, code: code.trim() }),
            });
            window.localStorage.setItem("adp-access-token", result.access_token);
            window.localStorage.setItem("adp-authenticated", "true");
            window.dispatchEvent(new Event("adp-auth-changed"));
            if (result.password_reset_required) {
                navigate("/reset-password", { replace: true });
                return;
            }

            try {
                const preferences = await apiRequest("/api/settings", { token: result.access_token });
                navigate(
                    preferences.default_landing_page === "dashboard" ? "/dashboard" : "/",
                    { replace: true },
                );
            } catch (settingsError) {
                navigate("/", {
                    replace: true,
                    state: {
                        settingsError: `Signed in, but your landing-page preference could not be loaded: ${settingsError.message}`,
                    },
                });
            }
        } catch (submitError) {
            setError(submitError.message || "We could not verify that code. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function resendCode() {
        setError("");
        setIsResending(true);
        try {
            await apiRequest("/api/auth/login/resend-otp", {
                method: "POST",
                body: JSON.stringify({ challenge_id: challengeId }),
            });
            setCode("");
            setResendIn(60);
        } catch (resendError) {
            setError(resendError.message || "We could not send a new code. Please try again.");
        } finally {
            setIsResending(false);
        }
    }

    if (!challengeId) return null;

    return (
        <main className="login-page">
            <section className="login-card">
                <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="back-button"
                    aria-label="Return to sign in"
                >
                    ←
                </button>
                <h1>Enter OTP</h1>
                <form onSubmit={handleSubmit}>
                    <p className="login-signup">We sent a 6-digit code to {email}. The code expires in 10 minutes.</p>
                    <label>
                        Email verification code
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            pattern="[0-9]{6}"
                            placeholder="Enter the 6-digit code"
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            required
                        />
                    </label>
                    {error && <p className="login-error" role="alert">{error}</p>}
                    <button className="login-submit" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Verifying…" : "Verify"}
                    </button>
                    <button
                        type="button"
                        className="login-resend"
                        onClick={resendCode}
                        disabled={isResending || resendIn > 0}
                    >
                        {isResending
                            ? "Sending…"
                            : resendIn > 0
                                ? `Resend code in ${resendIn}s`
                                : "Resend code"}
                    </button>
                </form>
            </section>
        </main>
    );
}

export default LoginOtp;
