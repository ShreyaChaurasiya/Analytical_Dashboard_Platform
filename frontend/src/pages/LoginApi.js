import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

function LoginApi() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const name = username.trim();
    if (!name || !password) {
      setError("Enter your username and password");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Login failed. Check your credentials.");
      window.localStorage.setItem("access_token", data.access_token);
      window.localStorage.setItem("must_change_password", String(Boolean(data.must_change_password)));
      navigate("/home", { replace: true });
    } catch (loginError) {
      setError(loginError.message || "Unable to connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Log in</h1>
        <form onSubmit={handleSubmit} autoComplete="off">
          <label>Username or Email<input type="text" placeholder="your username or email" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
          <label>Password<span className="login-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button></span></label>
          {error && <p className="login-error">{error}</p>}
          <Link className="login-forgot" to="/forget-password">Forgot password</Link>
          <button className="login-submit" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
        </form>
        <p className="login-register">New user? <Link to="/registration">Create Account</Link></p>
      </section>
    </main>
  );
}

export default LoginApi;
