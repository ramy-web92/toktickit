import { useEffect, useState } from "react";
import { getStaffTickets, StaffTicketRow } from "./api.js";

type UiState = "loading" | "success" | "error";

interface Props {
  currentUserId: number;
  onOpenTicket: (ticketId: number) => void;
}

export default function StaffTicketQueue({ currentUserId, onOpenTicket }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [tickets, setTickets] = useState<StaffTicketRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");

  useEffect(() => {
    load();
  }, [page, search, status, owner]);

  async function load() {
    setState("loading");
    try {
      const result = await getStaffTickets({ page, search, status, owner });
      setTickets(result.data);
      setTotalItems(result.pagination.totalItems);
      setState("success");
    } catch {
      setState("error");
    }
  }

  function clearFilters() {
    setSearch("");
    setStatus("");
    setOwner("");
    setPage(1);
  }

  const hasActiveFilters = search !== "" || status !== "" || owner !== "";
  const totalPages = Math.ceil(totalItems / 10) || 1;

  const statusOptions = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

  return (
    <div>
      <h4 className="mb-3">My Queue</h4>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 240 }}
          placeholder="Search by ticket number or summary..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Owners</option>
          <option value="unassigned">Unassigned</option>
          <option value="me">Assigned to me</option>
        </select>
        {hasActiveFilters && (
          <button className="btn btn-outline-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {state === "loading" && <p>Loading tickets…</p>}

      {state === "error" && (
        <div className="alert alert-danger">
          Unable to load tickets.{" "}
          <button className="btn btn-sm btn-outline-danger" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {state === "success" && tickets.length === 0 && (
        <div className="alert alert-secondary">
          No tickets match your filters.{" "}
          {hasActiveFilters && (
            <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      )}

      {state === "success" && tickets.length > 0 && (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket No.</th>
                  <th>Summary</th>
                  <th>Category</th>
                  <th>Req. Priority</th>
                  <th>IT Priority</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} onClick={() => onOpenTicket(t.id)} style={{ cursor: "pointer" }}>
                    <td>{t.ticketNumber}</td>
                    <td>{t.summary}</td>
                    <td>{t.category.name}</td>
                    <td>
                      <span className="badge bg-success-subtle text-success-emphasis">
                        {t.requestedPriority}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-success-subtle text-success-emphasis">
                        {t.itPriority}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-secondary-subtle text-secondary-emphasis">
                        {t.currentStatus}
                      </span>
                    </td>
                    <td>{t.owner ? t.owner.name : <span className="text-muted">Unassigned</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Showing page {page} of {totalPages} ({totalItems} tickets)
            </span>
            <div>
              <button
                className="btn btn-sm btn-outline-secondary me-2"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}