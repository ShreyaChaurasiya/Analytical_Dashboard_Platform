import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

function isStrongPassword(password) {
    return password.length >= 8
        && /[A-Za-z]/.test(password)
        && /\d/.test(password)
        && /[^A-Za-z0-9]/.test(password);
}

function ResetPassword() {
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        if (!isStrongPassword(newPassword)) {
            setError("Password must include a letter, a number, a special character, and at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        const token = window.localStorage.getItem("adp-access-token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        setIsSubmitting(true);
        try {
            await apiRequest("/api/auth/change-password", {
                method: "POST",
                token,
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                }),
            });
            navigate("/", { replace: true });
        } catch (submitError) {
            setError(submitError.message || "We could not change your password. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                <h1>Change your password</h1>
                <p className="login-signup">For your security, change the temporary password before continuing.</p>
                <form onSubmit={handleSubmit}>
                    <label>
                        Current password
                        <input
                            type="password"
                            autoComplete="current-password"
                            minLength={8}
                            maxLength={128}
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            required
                        />
                    </label>
                    <label>
                        New password
                        <input
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
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
                        {isSubmitting ? "Updating…" : "Change password"}
                    </button>
                </form>
            </section>
        </main>
    );
}

export default ResetPassword;
