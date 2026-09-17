import { useState } from "react";
import { changePassword } from "./api.js";

type FormState = "idle" | "loading" | "error";

function checkStrength(pwd: string) {
  return {
    length: pwd.length >= 8,
    case: /[a-z]/.test(pwd) && /[A-Z]/.test(pwd),
    numberAndSpecial: /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd),
  };
}

export default function ChangePassword({ onSuccess }: { onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const strength = checkStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) {
      setErrorMessage("New password and confirmation do not match.");
      setState("error");
      return;
    }
    setState("loading");
    setErrorMessage("");
    try {
      await changePassword(currentPassword, newPassword);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to change password.");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 420 }}>
      <div className="card shadow-sm">
        <div className="card-header bg-success text-white">
          <h1 className="h5 mb-0">Change Your Password</h1>
        </div>
        <div className="card-body">
          <p className="text-muted small">You must change your password to continue.</p>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Current (temporary) password</label>
              <input
                type="password"
                className="form-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">New password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm new password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <ul className="list-unstyled small mb-3">
              <li className={strength.length ? "text-success" : "text-muted"}>
                {strength.length ? "✓" : "○"} At least 8 characters
              </li>
              <li className={strength.case ? "text-success" : "text-muted"}>
                {strength.case ? "✓" : "○"} Upper and lower case letters
              </li>
              <li className={strength.numberAndSpecial ? "text-success" : "text-muted"}>
                {strength.numberAndSpecial ? "✓" : "○"} A number and a special character
              </li>
            </ul>

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
              {state === "loading" ? "Saving…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}