import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        const identifier = username.trim();
        if (!identifier) {
            setError("Enter your username or email");
            return;
        }
        if (!password) {
            setError("Enter your password");
            return;
        }
        if (identifier.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
            setError("Enter a valid email address or username");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await apiRequest("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username: identifier, password }),
            });
            navigate("/login/otp", {
                state: { challengeId: result.challenge_id, email: result.email },
            });
        } catch (submitError) {
            setError(submitError.message || "Sign in failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                <h1>Log in</h1>
                <form onSubmit={handleSubmit} autoComplete="off">
                    <label>
                        Username or Email
                        <input
                            type="text"
                            placeholder="Username or example@gmail.com"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoComplete="username"
                            required
                        />
                    </label>
                    <label>
                        Password
                        <span className="login-password">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </span>
                    </label>

                    {error && <p className="login-error" role="alert">{error}</p>}

                    <Link className="login-forgot" to="/forget-password">Forgot password</Link>
                    <button className="login-submit" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Signing in…" : "Sign In"}
                    </button>
                </form>

                <p className="login-note">
                    By continuing, you agree to the Privacy Policy &amp; Cookie Policy.
                </p>

                <div className="login-register-wrapper">
                    <p className="login-register">
                        New user?{" "}
                        <Link to="/registration">Create Account</Link>
                    </p>
                </div>
            </section>
        </main>
    );
}

export default Login;
