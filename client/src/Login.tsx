import { useState } from "react";
import { login, AuthUser } from "./api.js";

type FormState = "idle" | "loading" | "error";

export default function Login({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMessage("");
    try {
      const user = await login(email, password);
      onSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid email or password.");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 420 }}>
      <div className="card shadow-sm">
        <div className="card-header bg-success text-white">
          <h1 className="h5 mb-0">TikTockIT</h1>
        </div>
        <div className="card-body">
          <h2 className="h6 mb-3">Sign in to your account</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <div className="input-group">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {state === "error" && (
              <div className="alert alert-danger py-2" role="alert">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-success w-100"
              disabled={state === "loading"}
            >
              {state === "loading" ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}