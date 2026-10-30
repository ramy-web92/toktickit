// Lab 4 — Actions Taken panel on Ticket Detail (docs/lab-04/ui-spec.md §4).
// IT Staff / Administrator: list, create, view/edit, start, complete, cancel.
// Requester: read-only list (canEdit = false).
import { useEffect, useRef, useState } from "react";
import {
  ActionInput,
  ActionStatus,
  ActionTakenData,
  ApiError,
  createAction,
  getActions,
  transitionAction,
  updateAction,
} from "./api.js";

export interface AssigneeOption {
  id: number;
  name: string;
}

interface Props {
  ticketId: number;
  canEdit: boolean;
  ticketStatus: string;
  currentUserId?: number;
  assignees?: AssigneeOption[];
  /** Called after any successful change, so the parent can refresh the Ticket summary. */
  onChanged?: () => void;
}

type Mode = { kind: "list" } | { kind: "create" } | { kind: "view"; id: number } | { kind: "edit"; id: number };

interface FormValues {
  actionAt: string;
  description: string;
  result: string;
  assigneeId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;

// Text + icon for every status: never color alone (accessibility).
export const ACTION_STATUS_META: Record<ActionStatus, { label: string; icon: string; className: string }> = {
  PLANNED: { label: "Planned", icon: "◷", className: "border border-secondary text-secondary-emphasis bg-body" },
  IN_PROGRESS: { label: "In Progress", icon: "▶", className: "bg-primary-subtle text-primary-emphasis" },
  COMPLETED: { label: "Completed", icon: "✓", className: "bg-success-subtle text-success-emphasis" },
  CANCELLED: { label: "Cancelled", icon: "✕", className: "bg-secondary-subtle text-secondary-emphasis text-decoration-line-through" },
};

const LIMITS = { description: 2000, result: 2000, followUpNote: 1000, attachmentNotes: 500 };

function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const meta = ACTION_STATUS_META[status];
  return (
    <span className={`badge rounded-pill ${meta.className}`}>
      <span aria-hidden="true">{meta.icon} </span>
      {meta.label}
    </span>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyForm(currentUserId?: number): FormValues {
  return {
    actionAt: toLocalInput(new Date().toISOString()),
    description: "",
    result: "",
    assigneeId: currentUserId ? String(currentUserId) : "",
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
  };
}

function formFromAction(a: ActionTakenData): FormValues {
  return {
    actionAt: toLocalInput(a.actionAt),
    description: a.description,
    result: a.result ?? "",
    assigneeId: String(a.assignee.id),
    followUpRequired: a.followUpRequired,
    followUpNote: a.followUpNote ?? "",
    attachmentNotes: a.attachmentNotes ?? "",
  };
}

function validate(v: FormValues): FieldErrors {
  const e: FieldErrors = {};
  if (!v.description.trim()) e.description = "Description is required.";
  else if (v.description.trim().length > LIMITS.description) e.description = `At most ${LIMITS.description} characters.`;
  if (v.result.trim().length > LIMITS.result) e.result = `At most ${LIMITS.result} characters.`;
  if (v.followUpRequired && !v.followUpNote.trim()) e.followUpNote = "Follow-up Note is required when follow-up is needed.";
  if (v.attachmentNotes.trim().length > LIMITS.attachmentNotes) e.attachmentNotes = `At most ${LIMITS.attachmentNotes} characters.`;
  if (!v.actionAt) e.actionAt = "Action Date/Time is required.";
  return e;
}

function toInput(v: FormValues): ActionInput {
  return {
    actionAt: new Date(v.actionAt).toISOString(),
    description: v.description.trim(),
    result: v.result.trim() || null,
    assigneeId: v.assigneeId ? Number(v.assigneeId) : undefined,
    followUpRequired: v.followUpRequired,
    followUpNote: v.followUpRequired ? v.followUpNote.trim() : null,
    attachmentNotes: v.attachmentNotes.trim() || null,
  };
}

export default function ActionsTaken({ ticketId, canEdit, ticketStatus, currentUserId, assignees = [], onChanged }: Props) {
  const [actions, setActions] = useState<ActionTakenData[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [form, setForm] = useState<FormValues>(emptyForm(currentUserId));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ kind: "error" | "conflict"; text: string } | null>(null);
  const [conflictLatest, setConflictLatest] = useState<ActionTakenData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const idempotencyKey = useRef(newKey());
  const formRef = useRef<HTMLFormElement>(null);

  const locked = ticketStatus === "CLOSED" || ticketStatus === "CANCELLED";
  const editable = canEdit && !locked;
  const selected = mode.kind === "view" || mode.kind === "edit" ? actions.find((a) => a.id === mode.id) ?? null : null;

  useEffect(() => {
    load();
  }, [ticketId]);

  useEffect(() => {
    // Move focus to the first invalid field after a failed submit (accessibility).
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, [errors]);

  async function load() {
    setLoadState("loading");
    try {
      setActions(await getActions(ticketId));
      setLoadState("success");
    } catch {
      setLoadState("error");
    }
  }

  function resetFeedback() {
    setErrors({});
    setBanner(null);
    setConflictLatest(null);
    setToast("");
  }

  function openCreate() {
    resetFeedback();
    setForm(emptyForm(currentUserId));
    idempotencyKey.current = newKey(); // one key per opened form (BR-23)
    setMode({ kind: "create" });
  }

  function openView(id: number) {
    resetFeedback();
    setCompleting(false);
    setConfirmCancel(false);
    setMode({ kind: "view", id });
  }

  function openEdit(a: ActionTakenData) {
    resetFeedback();
    setForm(formFromAction(a));
    setMode({ kind: "edit", id: a.id });
  }

  function closeForm() {
    const dirty =
      mode.kind === "create"
        ? form.description.trim() !== "" || form.result.trim() !== "" || form.followUpNote.trim() !== ""
        : false;
    if (dirty && !window.confirm("Discard this action?")) return;
    resetFeedback();
    setMode({ kind: "list" });
  }

  function handleApiError(e: unknown) {
    const err = e as ApiError;
    const code = err?.error?.code;
    if (err?.status === 422 && code === "INVALID_ASSIGNEE") {
      setErrors({ assigneeId: "Choose an active IT Staff member or Administrator." });
    } else if (err?.status === 422 && err.error?.details?.fields) {
      setErrors(err.error.details.fields as FieldErrors);
    } else if (err?.status === 409 && code === "STALE_UPDATE") {
      setConflictLatest(err.error?.details?.current ?? null);
      setBanner({
        kind: "conflict",
        text: "This action was changed by someone else. Your edits are kept below — review the latest version and save again.",
      });
    } else if (err?.status === 409) {
      setBanner({ kind: "error", text: err.error?.message ?? "This action can't be changed anymore." });
      load();
    } else if (err?.status === 403) {
      setBanner({ kind: "error", text: "You don't have permission to change Actions Taken." });
    } else {
      setBanner({ kind: "error", text: "We couldn't save your changes. Check your connection and try again." });
    }
  }

  async function afterSuccess(message: string, nextMode: Mode) {
    setToast(message);
    await load();
    setMode(nextMode);
    onChanged?.();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // double-click guard (FR-19)
    setBanner(null);
    const clientErrors = validate(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (mode.kind === "create") {
        await createAction(ticketId, toInput(form), idempotencyKey.current);
        await afterSuccess("Action saved.", { kind: "list" });
      } else if (mode.kind === "edit" && selected) {
        const base = conflictLatest ?? selected;
        const saved = await updateAction(ticketId, selected.id, toInput(form), base.version);
        await afterSuccess("Action updated.", { kind: "view", id: saved.id });
      }
    } catch (err) {
      handleApiError(err); // form values are kept (FR-20)
    } finally {
      setSubmitting(false);
    }
  }

  function showLatest() {
    if (!conflictLatest) return;
    setActions((list) => list.map((a) => (a.id === conflictLatest.id ? conflictLatest : a)));
    setBanner(null);
  }

  async function runTransition(to: ActionStatus, result?: string) {
    if (!selected || submitting) return;
    setSubmitting(true);
    setBanner(null);
    setErrors({});
    try {
      await transitionAction(ticketId, selected.id, to, selected.version, result);
      setCompleting(false);
      setConfirmCancel(false);
      const label = to === "COMPLETED" ? "completed" : to === "CANCELLED" ? "cancelled" : "started";
      await afterSuccess(`Action ${label}.`, { kind: "view", id: selected.id });
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function field<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function errorProps(key: keyof FormValues) {
    return errors[key]
      ? { "aria-invalid": true as const, "aria-describedby": `action-${key}-error`, className: "form-control is-invalid" }
      : { className: "form-control" };
  }

  function FieldError({ name }: { name: keyof FormValues }) {
    return errors[name] ? (
      <div id={`action-${name}-error`} className="invalid-feedback d-block">
        {errors[name]}
      </div>
    ) : null;
  }

  // ---------- render ----------

  if (loadState === "loading") {
    return <p className="text-muted" aria-busy="true">Loading actions…</p>;
  }
  if (loadState === "error") {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>We couldn't load the Actions Taken.</span>
        <button className="btn btn-sm btn-outline-danger" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  const formView = (mode.kind === "create" || mode.kind === "edit") && (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="border rounded p-3 mb-3 bg-body-tertiary">
      <h3 className="h6">{mode.kind === "create" ? "Add action" : "Edit action"}</h3>
      {Object.keys(errors).length > 0 && (
        <div className="alert alert-danger py-2 small" role="alert">
          Please correct the highlighted fields.
        </div>
      )}
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label htmlFor="action-actionAt" className="form-label">Action Date/Time *</label>
          <input
            id="action-actionAt"
            type="datetime-local"
            value={form.actionAt}
            onChange={(e) => field("actionAt", e.target.value)}
            {...errorProps("actionAt")}
          />
          <FieldError name="actionAt" />
        </div>
        <div className="col-12 col-md-6">
          <label htmlFor="action-assigneeId" className="form-label">Assignee</label>
          <select
            id="action-assigneeId"
            value={form.assigneeId}
            onChange={(e) => field("assigneeId", e.target.value)}
            {...errorProps("assigneeId")}
            className={`form-select${errors.assigneeId ? " is-invalid" : ""}`}
          >
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <FieldError name="assigneeId" />
        </div>
        <div className="col-12">
          <label htmlFor="action-description" className="form-label">Action Description *</label>
          <textarea
            id="action-description"
            rows={2}
            maxLength={LIMITS.description}
            value={form.description}
            onChange={(e) => field("description", e.target.value)}
            {...errorProps("description")}
          />
          <div className="form-text">{form.description.length}/{LIMITS.description}</div>
          <FieldError name="description" />
        </div>
        <div className="col-12">
          <label htmlFor="action-result" className="form-label">Result</label>
          <textarea
            id="action-result"
            rows={2}
            maxLength={LIMITS.result}
            value={form.result}
            onChange={(e) => field("result", e.target.value)}
            {...errorProps("result")}
          />
          <div className="form-text">Required to complete the action.</div>
          <FieldError name="result" />
        </div>
        <div className="col-12">
          <div className="form-check form-switch">
            <input
              id="action-followUpRequired"
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={form.followUpRequired}
              onChange={(e) => field("followUpRequired", e.target.checked)}
            />
            <label htmlFor="action-followUpRequired" className="form-check-label">Follow-Up Required?</label>
          </div>
        </div>
        {form.followUpRequired && (
          <div className="col-12">
            <label htmlFor="action-followUpNote" className="form-label">Follow-up Note *</label>
            <textarea
              id="action-followUpNote"
              rows={2}
              maxLength={LIMITS.followUpNote}
              value={form.followUpNote}
              onChange={(e) => field("followUpNote", e.target.value)}
              {...errorProps("followUpNote")}
            />
            <FieldError name="followUpNote" />
          </div>
        )}
        <div className="col-12">
          <label htmlFor="action-attachmentNotes" className="form-label">Attachment Notes</label>
          <input
            id="action-attachmentNotes"
            type="text"
            maxLength={LIMITS.attachmentNotes}
            value={form.attachmentNotes}
            onChange={(e) => field("attachmentNotes", e.target.value)}
            {...errorProps("attachmentNotes")}
          />
          <div className="form-text">Which attachment or image to look at.</div>
          <FieldError name="attachmentNotes" />
        </div>
        <div className="col-12">
          <div className="small text-muted">Performed by: set automatically when the action is completed.</div>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="submit" className="btn btn-success btn-sm" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeForm} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );

  const detailView = mode.kind === "view" && selected && (
    <section className="border rounded p-3 mb-3" aria-labelledby="action-detail-title">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h3 id="action-detail-title" className="h6 mb-0">Action details</h3>
        <ActionStatusBadge status={selected.status} />
      </div>
      <dl className="row small mb-2">
        <dt className="col-sm-4">Action Date/Time</dt>
        <dd className="col-sm-8">{formatDate(selected.actionAt)}</dd>
        <dt className="col-sm-4">Description</dt>
        <dd className="col-sm-8 text-break">{selected.description}</dd>
        <dt className="col-sm-4">Result</dt>
        <dd className="col-sm-8 text-break">{selected.result ?? <span className="text-muted">—</span>}</dd>
        <dt className="col-sm-4">Assignee</dt>
        <dd className="col-sm-8">{selected.assignee.name}</dd>
        <dt className="col-sm-4">Performed by</dt>
        <dd className="col-sm-8">{selected.performedBy?.name ?? <span className="text-muted">Not completed yet</span>}</dd>
        <dt className="col-sm-4">Follow-Up Required?</dt>
        <dd className="col-sm-8">{selected.followUpRequired ? `Yes — ${selected.followUpNote}` : "No"}</dd>
        <dt className="col-sm-4">Attachment Notes</dt>
        <dd className="col-sm-8 text-break">{selected.attachmentNotes ?? <span className="text-muted">—</span>}</dd>
        <dt className="col-sm-4">Created by</dt>
        <dd className="col-sm-8">{selected.createdBy.name}</dd>
      </dl>

      {editable && (selected.status === "PLANNED" || selected.status === "IN_PROGRESS") ? (
        <>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => openEdit(selected)} disabled={submitting}>
              Edit
            </button>
            {selected.status === "PLANNED" && (
              <button className="btn btn-outline-primary btn-sm" onClick={() => runTransition("IN_PROGRESS")} disabled={submitting}>
                Start
              </button>
            )}
            <button
              className="btn btn-success btn-sm"
              onClick={() => {
                setCompleteResult(selected.result ?? "");
                setCompleting(true);
                setConfirmCancel(false);
              }}
              disabled={submitting}
            >
              Complete
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => {
                setConfirmCancel(true);
                setCompleting(false);
              }}
              disabled={submitting}
            >
              Cancel action
            </button>
          </div>

          {completing && (
            <div className="mt-3">
              <label htmlFor="complete-result" className="form-label">Result *</label>
              <textarea
                id="complete-result"
                rows={2}
                className={`form-control${errors.result ? " is-invalid" : ""}`}
                aria-invalid={errors.result ? true : undefined}
                aria-describedby={errors.result ? "complete-result-error" : undefined}
                value={completeResult}
                onChange={(e) => setCompleteResult(e.target.value)}
              />
              {errors.result && (
                <div id="complete-result-error" className="invalid-feedback d-block">
                  {errors.result}
                </div>
              )}
              <div className="d-flex gap-2 mt-2">
                <button
                  className="btn btn-success btn-sm"
                  disabled={submitting}
                  onClick={() => {
                    if (!completeResult.trim()) {
                      setErrors({ result: "Result is required to complete an action." });
                      return;
                    }
                    runTransition("COMPLETED", completeResult.trim());
                  }}
                >
                  Confirm completion
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setCompleting(false)}>
                  Back
                </button>
              </div>
            </div>
          )}

          {confirmCancel && (
            <div className="alert alert-warning mt-3 mb-0 d-flex flex-wrap align-items-center gap-2" role="alert">
              <span>Cancel this action? This can't be undone.</span>
              <button className="btn btn-danger btn-sm" onClick={() => runTransition("CANCELLED")} disabled={submitting}>
                Yes, cancel action
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmCancel(false)}>
                No
              </button>
            </div>
          )}
        </>
      ) : (
        canEdit && (
          <p className="small text-muted mb-0">
            {locked
              ? "This Ticket is closed or cancelled, so its actions can't be changed."
              : "Completed and cancelled actions can't be edited. Add a new action to correct."}
          </p>
        )
      )}
      <button className="btn btn-link btn-sm px-0 mt-2" onClick={() => setMode({ kind: "list" })}>
        ← Back to all actions
      </button>
    </section>
  );

  return (
    <div>
      {/* Persistent live region so screen readers announce success messages */}
      <div role="status" aria-live="polite">
        {toast && <div className="alert alert-success py-2 small">{toast}</div>}
      </div>

      {banner && (
        <div className={`alert ${banner.kind === "conflict" ? "alert-warning" : "alert-danger"} py-2`} role="alert">
          <span>{banner.text}</span>
          {banner.kind === "conflict" && conflictLatest && (
            <button className="btn btn-sm btn-outline-dark ms-2" onClick={showLatest}>
              Show latest
            </button>
          )}
        </div>
      )}

      {editable && mode.kind === "list" && (
        <button className="btn btn-success btn-sm mb-3" onClick={openCreate}>
          + Add action
        </button>
      )}
      {canEdit && locked && mode.kind === "list" && (
        <p className="small text-muted">This Ticket is closed or cancelled. Actions are read-only.</p>
      )}

      {formView}
      {detailView}

      {actions.length === 0 ? (
        <p className="text-muted">No actions recorded yet.</p>
      ) : (
        <>
          {/* Desktop / tablet: table that scrolls inside its own container */}
          <div className="table-responsive d-none d-md-block" style={{ overflowY: "hidden" }}>
            <table className="table table-sm table-hover align-middle mb-0">
              <caption className="visually-hidden">Actions Taken, oldest first</caption>
              <thead>
                <tr>
                  <th scope="col">Date/Time</th>
                  <th scope="col">Description</th>
                  <th scope="col">Result</th>
                  <th scope="col">Status</th>
                  <th scope="col">Assignee</th>
                  <th scope="col">Performed by</th>
                  <th scope="col">Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id} className={selected?.id === a.id ? "table-active" : undefined}>
                    <td className="text-nowrap">{formatDate(a.actionAt)}</td>
                    <td className="text-break">
                      <button
                        className="btn btn-link btn-sm p-0 text-start"
                        onClick={() => openView(a.id)}
                        aria-label={`View action: ${a.description}`}
                      >
                        {a.description}
                      </button>
                    </td>
                    <td className="text-break">{a.result ?? "—"}</td>
                    <td><ActionStatusBadge status={a.status} /></td>
                    <td>{a.assignee.name}</td>
                    <td>{a.performedBy?.name ?? "—"}</td>
                    <td>{a.followUpRequired ? <span className="badge bg-warning-subtle text-warning-emphasis">Yes</span> : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per action */}
          <ul className="list-unstyled d-md-none mb-0">
            {actions.map((a) => (
              <li key={a.id} className="border rounded p-2 mb-2">
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <span className="small text-muted">{formatDate(a.actionAt)}</span>
                  <ActionStatusBadge status={a.status} />
                </div>
                <button className="btn btn-link p-0 text-start text-break" onClick={() => openView(a.id)}>
                  {a.description}
                </button>
                <div className="small">
                  <span className="text-muted">Assignee:</span> {a.assignee.name}
                  {a.followUpRequired && <span className="badge bg-warning-subtle text-warning-emphasis ms-2">Follow-up</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
