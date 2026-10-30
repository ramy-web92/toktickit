// Lab 4 — Ticket workflow controls (docs/lab-04/ui-spec.md §5).
// The UI only offers the transitions returned by the server (allowedTransitions);
// the backend stays the authority (resolution gate, versions, permissions).
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  StatusChangeData,
  WorkflowTicket,
  changeTicketStatus,
  getStatusHistory,
  markProblemResolved,
} from "./api.js";

// Text + icon for every status, never color alone.
export const TICKET_STATUS_META: Record<string, { label: string; icon: string; className: string }> = {
  NEW: { label: "New", icon: "✦", className: "bg-info-subtle text-info-emphasis" },
  OPEN: { label: "Open", icon: "○", className: "bg-primary-subtle text-primary-emphasis" },
  IN_PROGRESS: { label: "In Progress", icon: "▶", className: "bg-warning-subtle text-warning-emphasis" },
  WAITING_FOR_REQUESTER: { label: "Waiting for Requester", icon: "⏸", className: "bg-secondary-subtle text-secondary-emphasis" },
  RESOLVED: { label: "Resolved", icon: "✓", className: "bg-success-subtle text-success-emphasis" },
  CLOSED: { label: "Closed", icon: "■", className: "bg-dark-subtle text-dark-emphasis" },
  REOPENED: { label: "Reopened", icon: "↺", className: "bg-danger-subtle text-danger-emphasis" },
  CANCELLED: { label: "Cancelled", icon: "✕", className: "bg-secondary-subtle text-secondary-emphasis text-decoration-line-through" },
};

/** Verb-style labels for the "Change status" menu. */
export const TRANSITION_LABELS: Record<string, string> = {
  OPEN: "Open ticket",
  IN_PROGRESS: "Start work",
  WAITING_FOR_REQUESTER: "Wait for requester",
  RESOLVED: "Resolve",
  CLOSED: "Close",
  REOPENED: "Reopen",
  CANCELLED: "Cancel ticket",
};

const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

/** Human-readable priority (the API returns LOW / MEDIUM / HIGH). */
export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? priority;
}

export function statusLabel(status: string): string {
  return TICKET_STATUS_META[status]?.label ?? status;
}

export function TicketStatusBadge({ status }: { status: string }) {
  const meta = TICKET_STATUS_META[status] ?? { label: status, icon: "", className: "bg-secondary-subtle" };
  return (
    <span className={`badge rounded-pill ${meta.className}`}>
      <span aria-hidden="true">{meta.icon} </span>
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Cancel dialog: labelled, focus trapped, Esc closes, focus returns to the trigger.

function CancelDialog({
  onConfirm,
  onClose,
  submitting,
  serverError,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
  submitting: boolean;
  serverError: string;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), textarea"),
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function submit() {
    if (!reason.trim()) {
      setError("A reason is required to cancel a Ticket.");
      inputRef.current?.focus();
      return;
    }
    onConfirm(reason.trim());
  }

  const message = error || serverError;
  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,0.4)" }} onKeyDown={onKeyDown}>
      <div
        ref={dialogRef}
        className="modal-dialog modal-dialog-centered"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
      >
        <div className="modal-content">
          <div className="modal-header">
            <h2 id="cancel-dialog-title" className="modal-title h5">Cancel this Ticket?</h2>
          </div>
          <div className="modal-body">
            <label htmlFor="cancel-reason" className="form-label">Reason *</label>
            <textarea
              id="cancel-reason"
              ref={inputRef}
              rows={3}
              maxLength={500}
              className={`form-control${message ? " is-invalid" : ""}`}
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? "cancel-reason-error" : undefined}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {message && (
              <div id="cancel-reason-error" className="invalid-feedback d-block">
                {message}
              </div>
            )}
            <div className="form-text">The Requester will see the Ticket as Cancelled. This can't be undone.</div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>
              Keep ticket
            </button>
            <button className="btn btn-danger" onClick={submit} disabled={submitting}>
              {submitting ? "Cancelling…" : "Cancel ticket"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status history (append-only, oldest first)

export function StatusHistory({ ticketId, refreshKey }: { ticketId: number; refreshKey: number }) {
  const [items, setItems] = useState<StatusChangeData[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getStatusHistory(ticketId)
      .then((data) => {
        setItems(data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [ticketId, refreshKey]);

  return (
    <details className="mt-3">
      <summary className="small">Status history{items ? ` (${items.length})` : ""}</summary>
      {failed && <p className="small text-danger mt-2 mb-0">We couldn't load the status history.</p>}
      {items && items.length === 0 && <p className="small text-muted mt-2 mb-0">No status changes yet.</p>}
      {items && items.length > 0 && (
        <ol className="small mt-2 mb-0 ps-3">
          {items.map((h) => (
            <li key={h.id} className="mb-1">
              {statusLabel(h.fromStatus)} → <strong>{statusLabel(h.toStatus)}</strong> by {h.actor.name},{" "}
              {new Date(h.createdAt).toLocaleString()}
              {h.reason && <span className="text-muted"> — “{h.reason}”</span>}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// IT Staff / Administrator status control

interface ControlProps {
  ticket: WorkflowTicket;
  /** Called with the updated Ticket after a successful change (refreshes the summary, FR-12). */
  onUpdated: (ticket: WorkflowTicket) => void;
  /** Called when the Ticket must be reloaded (stale data). */
  onReload: () => void;
  /** Hide the status badge when the page already shows it (avoids a duplicate). */
  showBadge?: boolean;
}

export default function TicketWorkflowControl({ ticket, onUpdated, onReload, showBadge = true }: ControlProps) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);

  const allowed = ticket.allowedTransitions ?? [];

  async function change(to: string, reason?: string) {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    setDialogError("");
    try {
      const updated = await changeTicketStatus(ticket.id, to, ticket.version, reason);
      setDialogOpen(false);
      setMessage({ kind: "success", text: `Status changed to ${statusLabel(updated.currentStatus)}.` });
      setHistoryKey((k) => k + 1);
      onUpdated(updated);
    } catch (e) {
      const err = e as ApiError;
      const code = err?.error?.code;
      if (code === "RESOLUTION_GATE") {
        setMessage({ kind: "warning", text: err.error?.message ?? "Complete all actions before resolving." });
      } else if (code === "STALE_UPDATE") {
        setMessage({ kind: "warning", text: "This Ticket was changed by someone else. We reloaded the latest version." });
        onReload();
      } else if (err?.status === 422 && to === "CANCELLED") {
        setDialogError(err.error?.details?.fields?.reason ?? "A reason is required to cancel a Ticket.");
      } else if (code === "INVALID_TRANSITION") {
        setMessage({ kind: "error", text: "That status change is not allowed anymore. We reloaded the Ticket." });
        onReload();
      } else {
        setMessage({ kind: "error", text: "We couldn't change the status. Check your connection and try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setDialogError("");
    cancelTriggerRef.current?.focus(); // focus returns to the trigger
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        {showBadge && <TicketStatusBadge status={ticket.currentStatus} />}
        {allowed.length === 0 ? (
          <span className="small text-muted">
            {ticket.currentStatus === "CANCELLED" ? "This Ticket is cancelled." : "No status change available."}
          </span>
        ) : (
          <div className="d-flex flex-wrap gap-1" role="group" aria-label="Change status">
            {allowed.map((to) =>
              to === "CANCELLED" ? (
                <button
                  key={to}
                  ref={cancelTriggerRef}
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => setDialogOpen(true)}
                  disabled={submitting}
                >
                  {TRANSITION_LABELS[to]}
                </button>
              ) : (
                <button
                  key={to}
                  className={`btn btn-sm ${to === "RESOLVED" ? "btn-success" : "btn-outline-success"}`}
                  onClick={() => change(to)}
                  disabled={submitting}
                >
                  {TRANSITION_LABELS[to] ?? statusLabel(to)}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      <div role="status" aria-live="polite">
        {message?.kind === "success" && <div className="alert alert-success py-2 small mt-2 mb-0">{message.text}</div>}
      </div>
      {message && message.kind !== "success" && (
        <div className={`alert ${message.kind === "warning" ? "alert-warning" : "alert-danger"} py-2 small mt-2 mb-0`} role="alert">
          {message.text}
        </div>
      )}

      <StatusHistory ticketId={ticket.id} refreshKey={historyKey} />

      {dialogOpen && (
        <CancelDialog
          onConfirm={(reason) => change("CANCELLED", reason)}
          onClose={closeDialog}
          submitting={submitting}
          serverError={dialogError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requester "Problem appears resolved" (advisory only, BR-19)

const MARKABLE = ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

export function RequesterResolvedButton({
  ticket,
  onUpdated,
}: {
  ticket: WorkflowTicket;
  onUpdated: (ticket: WorkflowTicket) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function mark() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      onUpdated(await markProblemResolved(ticket.id));
    } catch {
      setError("We couldn't save this. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ticket.requesterMarkedResolved) {
    const when = ticket.requesterMarkedResolvedAt ? new Date(ticket.requesterMarkedResolvedAt).toLocaleString() : null;
    return (
      <p className="small mb-0" role="status">
        <span aria-hidden="true">✓ </span>
        You told IT this looks resolved{when ? ` on ${when}` : ""}. IT Staff will confirm and update the status.
      </p>
    );
  }
  if (!MARKABLE.includes(ticket.currentStatus)) return null;

  return (
    <div>
      <button className="btn btn-outline-success btn-sm" onClick={mark} disabled={submitting}>
        {submitting ? "Saving…" : "Problem appears resolved"}
      </button>
      <div className="form-text">This tells IT the problem seems fixed. Only IT Staff can formally resolve the Ticket.</div>
      {error && (
        <div className="text-danger small mt-1" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
