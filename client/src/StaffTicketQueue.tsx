import { useEffect, useState } from "react";
import { getStaffTickets, StaffTicketRow } from "./api.js";

type UiState = "loading" | "success" | "error";

interface Props {
  currentUserId: number;
  onOpenTicket: (ticketId: number) => void;
}

type SortField = "ticketNumber" | "summary" | "requestedPriority" | "itPriority" | "currentStatus" | "updatedAt";

export default function StaffTicketQueue({ currentUserId, onOpenTicket }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [tickets, setTickets] = useState<StaffTicketRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [sort, setSort] = useState<SortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    load();
  }, [page, search, status, owner, sort, order]);

  async function load() {
    setState("loading");
    try {
      const result = await getStaffTickets({ page, search, status, owner, sort, order });
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

  function toggleSort(field: SortField) {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
    setPage(1);
  }

  function sortIndicator(field: SortField) {
    if (sort !== field) return " ⇅";
    return order === "asc" ? " ▲" : " ▼";
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
    {hasActiveFilters
      ? "No tickets match your filters. "
      : "No tickets in the queue yet."}
    {hasActiveFilters && (
      <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
        Clear Filters
      </button>
    )}
  </div>
)}
      {state === "success" && tickets.length > 0 && (
        <div>
          {/* Desktop / tablette : table avec tri */}
          <div className="table-responsive d-none d-md-block">
            <table className="table">
              <thead>
                <tr>
                  <th role="button" onClick={() => toggleSort("ticketNumber")}>
                    Ticket No.{sortIndicator("ticketNumber")}
                  </th>
                  <th role="button" onClick={() => toggleSort("summary")}>
                    Summary{sortIndicator("summary")}
                  </th>
                  <th>Category</th>
                  <th role="button" onClick={() => toggleSort("requestedPriority")}>
                    Req. Priority{sortIndicator("requestedPriority")}
                  </th>
                  <th role="button" onClick={() => toggleSort("itPriority")}>
                    IT Priority{sortIndicator("itPriority")}
                  </th>
                  <th role="button" onClick={() => toggleSort("currentStatus")}>
                    Status{sortIndicator("currentStatus")}
                  </th>
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

          {/* Mobile : cartes empilées */}
          <div className="d-md-none">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="card mb-2"
                onClick={() => onOpenTicket(t.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="card-body py-2 px-3">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <small className="text-muted">{t.ticketNumber}</small>
                    <span className="badge bg-secondary-subtle text-secondary-emphasis">
                      {t.currentStatus}
                    </span>
                  </div>
                  <div className="fw-semibold mb-2">{t.summary}</div>
                  <div className="d-flex flex-wrap gap-2 small">
                    <span className="text-muted">{t.category.name}</span>
                    <span className="badge bg-success-subtle text-success-emphasis">
                      Req: {t.requestedPriority}
                    </span>
                    <span className="badge bg-success-subtle text-success-emphasis">
                      IT: {t.itPriority}
                    </span>
                  </div>
                  <div className="small text-muted mt-2">
                    Owner: {t.owner ? t.owner.name : "Unassigned"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
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
        </div>
      )}
    </div>
  );
}