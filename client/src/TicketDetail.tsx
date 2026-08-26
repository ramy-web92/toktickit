import { useEffect, useState } from "react";
import { DevRequester } from "./api.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface Attachment {
  id: number;
  originalFileName: string;
  sizeBytes: number;
  uploadedAt: string;
  isRemoved: boolean;
  removedAt: string | null;
  removalReason: string | null;
}

interface TicketDetailData {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string;
  currentStatus: string;
  createdAt: string;
  category: { name: string };
  relatedSystem: { name: string };
  attachments: Attachment[];
}

type UiState = "loading" | "success" | "error";

interface Props {
  ticketId: number;
  requester: DevRequester;
  onBack: () => void;
}

export default function TicketDetail({ ticketId, requester, onBack }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    setState("loading");
    try {
      const res = await fetch(`${API_URL}/api/tickets/${ticketId}?requesterId=${requester.id}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTicket(data.ticket);
      setState("success");
    } catch {
      setState("error");
    }
  }

  async function handleRemove(attachmentId: number) {
    if (removalReason.trim().length < 3) return;
    try {
      const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: requester.id, reason: removalReason.trim() }),
      });
      if (res.ok) {
        setRemovingId(null);
        setRemovalReason("");
        loadTicket();
      }
    } catch {
      // safe no-op, UI stays as-is
    }
  }

  if (state === "loading") return <p>Loading ticket…</p>;
  if (state === "error" || !ticket) {
    return (
      <div className="alert alert-danger">
        Unable to load this ticket.{" "}
        <button className="btn btn-sm btn-outline-danger" onClick={onBack}>
          Back to My Tickets
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-link p-0 mb-3" onClick={onBack}>
        ← Back to My Tickets
      </button>

      <div className="card p-4 mb-4">
        <div className="row mb-2">
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
            <div className="small text-muted">Status</div>
            <span className="badge bg-secondary-subtle text-secondary-emphasis">
              {ticket.currentStatus}
            </span>
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
            <span className="badge bg-success-subtle text-success-emphasis">
              {ticket.itPriority}
            </span>
          </div>
        </div>
        <div className="mb-3">
          <div className="small text-muted">Summary</div>
          <div>{ticket.summary}</div>
        </div>
        <div>
          <div className="small text-muted">Description</div>
          <div>{ticket.description}</div>
        </div>
      </div>

      <div className="card p-4">
        <h5 className="mb-3">Attachments</h5>
        {ticket.attachments.length === 0 && <p className="text-muted">No attachments.</p>}
        {ticket.attachments.map((a) => (
          <div key={a.id} className={`border-bottom py-2 ${a.isRemoved ? "text-muted" : ""}`}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{a.originalFileName}</strong> ({Math.round(a.sizeBytes / 1024)} KB)
                {a.isRemoved && (
                  <span className="badge bg-secondary ms-2">Removed: {a.removalReason}</span>
                )}
              </div>
              {!a.isRemoved && (
                <div>
                  {removingId === a.id ? (
                    <div className="d-flex gap-2 align-items-center">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Reason (min 3 chars)"
                        value={removalReason}
                        onChange={(e) => setRemovalReason(e.target.value)}
                        style={{ width: 180 }}
                      />
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={removalReason.trim().length < 3}
                        onClick={() => handleRemove(a.id)}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setRemovingId(null);
                          setRemovalReason("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setRemovingId(a.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
