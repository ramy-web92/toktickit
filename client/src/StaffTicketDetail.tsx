import { useEffect, useState } from "react";
import {
  getStaffTicketDetail,
  claimOrReassignTicket,
  setItPriority,
  getInternalNotes,
  postInternalNote,
  getComments,
  postComment,
  getStaffUsers,
  getAdminUsersList,
  getAssignees,
  StaffTicketDetailData,
  InternalNoteData,
  PublicCommentData,
  AdminUserRow,
} from "./api.js";
import ActionsTaken from "./ActionsTaken.js";
import TicketWorkflowControl, { TicketStatusBadge } from "./TicketWorkflow.js";

type UiState = "loading" | "success" | "error";
type Tab = "actions" | "comments" | "notes" | "attachments";

// Lab 4: permitted transitions now come from the server (ticket.allowedTransitions).

interface Props {
  ticketId: number;
  currentUserId: number;
  onBack: () => void;
}

export default function StaffTicketDetail({ ticketId, currentUserId, onBack }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [ticket, setTicket] = useState<StaffTicketDetailData | null>(null);
  const [tab, setTab] = useState<Tab>("actions");
  const [comments, setComments] = useState<PublicCommentData[]>([]);
  const [notes, setNotes] = useState<InternalNoteData[]>([]);
  const [newEntry, setNewEntry] = useState("");
  const [entryState, setEntryState] = useState<"idle" | "submitting" | "error">("idle");
  const [actionError, setActionError] = useState("");
  const [staffUsers, setStaffUsers] = useState<AdminUserRow[]>([]);
  const [reassignTarget, setReassignTarget] = useState<string>("");
  const [assignees, setAssignees] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    loadAll();
  }, [ticketId]);

  async function loadAll() {
    setState("loading");
    try {
      const [t, c, n, staff, admins, assignable] = await Promise.all([
        getStaffTicketDetail(ticketId),
        getComments(ticketId),
        getInternalNotes(ticketId),
        getStaffUsers().catch(() => []),
        getAdminUsersList().catch(() => []),
        getAssignees().catch(() => []),
      ]);
      setTicket(t);
      setComments(c);
      setNotes(n);
      setStaffUsers([...staff, ...admins]);
      setAssignees(assignable);
      setState("success");
    } catch {
      setState("error");
    }
  }

  // Lab 4: refresh the Ticket summary without reloading the whole page (FR-12).
  async function refreshTicket() {
    try {
      setTicket(await getStaffTicketDetail(ticketId));
    } catch {
      // keep the current view; the next full load will retry
    }
  }

  async function handleClaim() {
    setActionError("");
    try {
      await claimOrReassignTicket(ticketId, currentUserId);
      await loadAll();
    } catch {
      setActionError("Unable to claim this ticket.");
    }
  }

  async function handleReassign() {
    if (!reassignTarget) return;
    setActionError("");
    try {
      await claimOrReassignTicket(ticketId, Number(reassignTarget));
      setReassignTarget("");
      await loadAll();
    } catch {
      setActionError("Unable to reassign this ticket.");
    }
  }

  async function handlePriorityChange(value: string) {
    setActionError("");
    try {
      await setItPriority(ticketId, value);
      await loadAll();
    } catch {
      setActionError("Unable to update priority.");
    }
  }



  async function handlePostEntry(e: React.FormEvent) {
  e.preventDefault();
  if (newEntry.trim().length === 0) {
    setEntryState("error");
    return;
  }
  setEntryState("submitting");
  try {
    if (tab === "comments") {
      await postComment(ticketId, newEntry.trim());
      setComments(await getComments(ticketId));
    } else if (tab === "notes") {
      await postInternalNote(ticketId, newEntry.trim());
      setNotes(await getInternalNotes(ticketId));
    }
    setNewEntry("");
    setEntryState("idle");
  } catch {
    setEntryState("error");
  }
}

  if (state === "loading") return <p>Loading ticket…</p>;
  if (state === "error" || !ticket) {
    return (
      <div className="alert alert-danger">
        Unable to load this ticket.{" "}
        <button className="btn btn-sm btn-outline-danger" onClick={onBack}>
          Back to Queue
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-link p-0 mb-3" onClick={onBack}>
        ← Back to Queue
      </button>

      <div className="card p-4 mb-4">
        <div className="row mb-3">
          <div className="col-md-3">
            <div className="small text-muted">Ticket No.</div>
            <div>{ticket.ticketNumber}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Category</div>
            <div>{ticket.category.name}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Related System</div>
            <div>{ticket.relatedSystem.name}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Requester</div>
            <div>{ticket.requester.name}</div>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-3">
            <div className="small text-muted">Requested Priority</div>
            <span className="badge bg-success-subtle text-success-emphasis">
              {ticket.requestedPriority}
            </span>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">IT Priority</div>
            <select
              className="form-select form-select-sm"
              value={ticket.itPriority}
              onChange={(e) => handlePriorityChange(e.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Current Status</div>
            <TicketStatusBadge status={ticket.currentStatus} />
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Ticket Owner</div>
            {ticket.owner ? (
              <div>
                <div className="mb-1">{ticket.owner.name}</div>
                <div className="d-flex gap-1">
                  <select
                    className="form-select form-select-sm"
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                  >
                    <option value="">Reassign to…</option>
                    {/* Lab 4: /api/staff/assignees works for IT Staff too (the admin users list did not) */}
                    {assignees
                      .filter((u) => u.id !== ticket.owner?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={handleReassign}
                    disabled={!reassignTarget}
                  >
                    Reassign
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-sm btn-success" onClick={handleClaim}>
                Claim Ticket
              </button>
            )}
          </div>
        </div>

        {actionError && <div className="alert alert-danger py-2">{actionError}</div>}

        <div className="border rounded p-3 mb-3">
          <div className="small text-muted mb-2">Ticket workflow</div>
          <TicketWorkflowControl
            ticket={ticket}
            onUpdated={(updated) => setTicket((t) => (t ? { ...t, ...updated } : t))}
            onReload={refreshTicket}
          />
        </div>

        <div className="mb-2">
          <div className="small text-muted">Summary</div>
          <div>{ticket.summary}</div>
        </div>
        <div>
          <div className="small text-muted">Description</div>
          <div>{ticket.description}</div>
        </div>

        {ticket.requesterMarkedResolved && (
          <div className="mt-3">
            <span className="badge bg-success-subtle text-success-emphasis">
              Requester marked this problem as appearing resolved
            </span>
          </div>
        )}
      </div>

      <div className="card p-4">
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "actions" ? "active" : ""}`}
              onClick={() => setTab("actions")}
            >
              Actions Taken
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "comments" ? "active" : ""}`}
              onClick={() => setTab("comments")}
            >
              Public Comments ({comments.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "notes" ? "active" : ""}`}
              onClick={() => setTab("notes")}
            >
              Internal Notes ({notes.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "attachments" ? "active" : ""}`}
              onClick={() => setTab("attachments")}
            >
              Attachments ({ticket.attachments.length})
            </button>
          </li>
        </ul>

        {tab === "actions" && (
          <ActionsTaken
            ticketId={ticketId}
            canEdit={true}
            ticketStatus={ticket.currentStatus}
            currentUserId={currentUserId}
            assignees={assignees}
            onChanged={refreshTicket}
          />
        )}

        {tab === "comments" && (
  <>
    <form onSubmit={handlePostEntry} className="mb-3">
      <textarea
        className="form-control mb-2"
        rows={2}
        placeholder="Type your comment here..."
        value={newEntry}
        onChange={(e) => setNewEntry(e.target.value)}
      />
      {entryState === "error" && (
        <div className="text-danger small mb-2">Comment cannot be empty.</div>
      )}
      <button className="btn btn-success btn-sm" type="submit" disabled={entryState === "submitting"}>
        {entryState === "submitting" ? "Posting…" : "Post Comment"}
      </button>
    </form>
            {comments.length === 0 && <p className="text-muted">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="border-bottom py-2">
                <div className="d-flex justify-content-between">
                  <div>
                    <strong>{c.author.name}</strong>{" "}
                    <span className="badge bg-secondary-subtle text-secondary-emphasis">{c.author.role}</span>
                  </div>
                  <span className="small text-muted">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div>{c.content}</div>
              </div>
            ))}
          </>
        )}

        {tab === "notes" && (
  <>
    <div className="alert alert-warning py-2 small">Internal — IT Staff and Administrator only</div>
    <form onSubmit={handlePostEntry} className="mb-3">
      <textarea
        className="form-control mb-2"
        rows={2}
        placeholder="Type your internal note here..."
        value={newEntry}
        onChange={(e) => setNewEntry(e.target.value)}
      />
      {entryState === "error" && (
        <div className="text-danger small mb-2">Note cannot be empty.</div>
      )}
      <button className="btn btn-warning btn-sm" type="submit" disabled={entryState === "submitting"}>
        {entryState === "submitting" ? "Posting…" : "Post Note"}
      </button>
    </form>
            {notes.length === 0 && <p className="text-muted">No internal notes yet.</p>}
            {notes.map((n) => (
              <div key={n.id} className="border-bottom py-2 bg-warning-subtle px-2 rounded">
                <div className="d-flex justify-content-between">
                  <div>
                    <strong>{n.author.name}</strong>{" "}
                    <span className="badge bg-secondary-subtle text-secondary-emphasis">{n.author.role}</span>
                  </div>
                  <span className="small text-muted">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <div>{n.content}</div>
              </div>
            ))}
          </>
        )}

        {tab === "attachments" && (
          <>
            {ticket.attachments.length === 0 && <p className="text-muted">No attachments.</p>}
            {ticket.attachments.map((a) => (
              <div key={a.id} className="border-bottom py-2">
                {a.originalFileName} ({Math.round(a.sizeBytes / 1024)} KB)
                {a.isRemoved && <span className="badge bg-secondary ms-2">Removed</span>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}