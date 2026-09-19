import { useEffect, useState } from "react";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  AdminUserRow,
} from "./api.js";

type UiState = "loading" | "success" | "error";
type PanelMode = "closed" | "create" | "edit";

interface Props {
  currentUserId: number;
}

export default function UserManagement({ currentUserId }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("REQUESTER");
  const [formActive, setFormActive] = useState(true);
  const [formPassword, setFormPassword] = useState("");

  const [formError, setFormError] = useState("");
  const [formState, setFormState] = useState<"idle" | "submitting">("idle");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    load();
  }, [search, roleFilter]);

  async function load() {
    setState("loading");
    try {
      const result = await getAdminUsers({ search, role: roleFilter });
      setUsers(result);
      setState("success");
    } catch {
      setState("error");
    }
  }

  function openCreatePanel() {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("REQUESTER");
    setFormActive(true);
    setFormPassword("");
    setFormError("");
    setPanelMode("create");
  }

  function openEditPanel(user: AdminUserRow) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormActive(user.isActive);
    setFormPassword("");
    setFormError("");
    setPanelMode("edit");
  }

  function closePanel() {
    setPanelMode("closed");
    setEditingUser(null);
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormState("submitting");
    try {
      await createAdminUser({
        name: formName,
        email: formEmail,
        role: formRole,
        isActive: formActive,
        initialPassword: formPassword,
      });
      setSuccessMessage("User created successfully.");
      closePanel();
      await load();
    } catch (err: any) {
      setFormError(err.message || "Unable to create user.");
    } finally {
      setFormState("idle");
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setFormError("");
    setFormState("submitting");
    try {
      await updateAdminUser(editingUser.id, {
        name: formName,
        email: formEmail,
        role: formRole,
        isActive: formActive,
      });
      setSuccessMessage("User updated successfully.");
      closePanel();
      await load();
    } catch (err: any) {
      setFormError(err.message || "Unable to update user.");
    } finally {
      setFormState("idle");
    }
  }

  async function handleResetPassword() {
    if (!editingUser || formPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    setFormError("");
    setFormState("submitting");
    try {
      await resetAdminUserPassword(editingUser.id, formPassword);
      setSuccessMessage("Password reset. User must change it at next login.");
      closePanel();
    } catch (err: any) {
      setFormError(err.message || "Unable to reset password.");
    } finally {
      setFormState("idle");
    }
  }

  const isSelf = editingUser?.id === currentUserId;
  const isLastActiveAdmin =
    editingUser?.role === "ADMINISTRATOR" &&
    editingUser?.isActive &&
    users.filter((u) => u.role === "ADMINISTRATOR" && u.isActive).length <= 1;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Users</h4>
        <button className="btn btn-success" onClick={openCreatePanel}>
          + Create User
        </button>
      </div>

      {successMessage && (
        <div className="alert alert-success py-2" role="alert">
          {successMessage}
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 240 }}
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="REQUESTER">Requester</option>
          <option value="IT_STAFF">IT Staff</option>
          <option value="ADMINISTRATOR">Administrator</option>
        </select>
      </div>

      {state === "loading" && <p>Loading users…</p>}
      {state === "error" && (
        <div className="alert alert-danger">
          Unable to load users.{" "}
          <button className="btn btn-sm btn-outline-danger" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {state === "success" && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className="badge bg-secondary-subtle text-secondary-emphasis">{u.role}</span>
                </td>
                <td>
                  <span className={`badge ${u.isActive ? "bg-success-subtle text-success-emphasis" : "bg-danger-subtle text-danger-emphasis"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => openEditPanel(u)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {panelMode !== "closed" && (
        <div
          className="position-fixed top-0 end-0 h-100 bg-white shadow p-4"
          style={{ width: 380, overflowY: "auto" }}
        >
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">{panelMode === "create" ? "Create New User" : "Edit User"}</h5>
            <button className="btn-close" onClick={closePanel}></button>
          </div>

          <form onSubmit={panelMode === "create" ? handleCreateSubmit : handleEditSubmit}>
            <div className="mb-3">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-control"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-control"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Role *</label>
              <select
                className="form-select"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                disabled={isLastActiveAdmin}
              >
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
              {isLastActiveAdmin && (
                <div className="form-text text-warning">Cannot change role of the last active Administrator.</div>
              )}
            </div>
            <div className="mb-3 form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                checked={formActive}
                disabled={isSelf || isLastActiveAdmin}
                onChange={(e) => setFormActive(e.target.checked)}
              />
              <label className="form-check-label">Active</label>
              {isSelf && <div className="form-text text-warning">You cannot deactivate your own account.</div>}
              {isLastActiveAdmin && !isSelf && (
                <div className="form-text text-warning">Cannot deactivate the last active Administrator.</div>
              )}
            </div>

            {panelMode === "create" && (
              <div className="mb-3">
                <label className="form-label">Initial Password *</label>
                <input
                  type="password"
                  className="form-control"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            )}

            {formError && <div className="alert alert-danger py-2">{formError}</div>}

            <button className="btn btn-success w-100 mb-2" type="submit" disabled={formState === "submitting"}>
              {formState === "submitting" ? "Saving…" : "Save User"}
            </button>
          </form>

          {panelMode === "edit" && (
            <div className="border-top pt-3 mt-3">
              <label className="form-label small">Set New Initial Password</label>
              <input
                type="password"
                className="form-control mb-2"
                placeholder="New password (min 8 chars)"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
              <button
                className="btn btn-outline-warning w-100"
                onClick={handleResetPassword}
                disabled={formState === "submitting"}
              >
                Reset Password
              </button>
            </div>
          )}

          <button className="btn btn-link w-100 mt-3" onClick={closePanel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}