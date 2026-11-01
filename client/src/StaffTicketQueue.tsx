import { useEffect, useState } from "react";
import { getStaffTickets, StaffTicketRow } from "./api.js";
import { TicketStatusBadge, priorityLabel, statusLabel } from "./TicketWorkflow.js";

type UiState = "loading" | "success" | "error";

interface Props {
  currentUserId: number;
  onOpenTicket: (ticketId: number) => void;
  /** Lab 4: filters coming from a dashboard drill-down (status, owner, itPriority, actionAssignee, followUp). */
  initialFilters?: Record<string, string>;
}

// Lab 4: drill-down filters that have no dropdown are shown as removable chips.
const CHIP_LABELS: Record<string, Record<string, string>> = {
  actionAssignee: { me: "Has open actions assigned to me" },
  followUp: { pending: "Follow-up pending" },
};

type SortField = "ticketNumber" | "summary" | "requestedPriority" | "itPriority" | "currentStatus" | "updatedAt";

export default function StaffTicketQueue({ currentUserId, onOpenTicket, initialFilters = {} }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [tickets, setTickets] = useState<StaffTicketRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialFilters.status ?? "");
  const [owner, setOwner] = useState(initialFilters.owner ?? "");
  const [itPriority, setItPriority] = useState(initialFilters.itPriority ?? "");
  const [actionAssignee, setActionAssignee] = useState(initialFilters.actionAssignee ?? "");
  const [followUp, setFollowUp] = useState(initialFilters.followUp ?? "");
  const [sort, setSort] = useState<SortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    load();
  }, [page, search, status, owner, itPriority, actionAssignee, followUp, sort, order]);

  async function load() {
    setState("loading");
    try {
      // Lab 4 fix: the API expects sortBy / sortDir (Lab 3 sent sort / order, so sorting was ignored).
      const result = await getStaffTickets({
        page, search, status, owner, itPriority, actionAssignee, followUp, sortBy: sort, sortDir: order,
      });
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
    setItPriority("");
    setActionAssignee("");
    setFollowUp("");
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

  const hasActiveFilters =
    search !== "" || status !== "" || owner !== "" || itPriority !== "" || actionAssignee !== "" || followUp !== "";
  const chips = [
    { key: "actionAssignee", value: actionAssignee, clear: () => setActionAssignee("") },
    { key: "followUp", value: followUp, clear: () => setFollowUp("") },
  ].filter((c) => c.value);
  const totalPages = Math.ceil(totalItems / 10) || 1;

  const statusOptions = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

  return (
    <div>
      <h2 className="h4 mb-3">Ticket Queue</h2>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          aria-label="Search tickets"
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
          aria-label="Status"
          className="form-select"
          style={{ maxWidth: 200 }}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 170 }}
          aria-label="IT Priority"
          value={itPriority}
          onChange={(e) => {
            setItPriority(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All IT Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          aria-label="Owner"
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

      {chips.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-3" aria-label="Active dashboard filters">
          {chips.map((c) => (
            <span key={c.key} className="badge rounded-pill bg-success-subtle text-success-emphasis d-inline-flex align-items-center gap-1">
              {CHIP_LABELS[c.key]?.[c.value] ?? `${c.key}: ${c.value}`}
              <button
                type="button"
                className="btn-close btn-close-sm"
                style={{ fontSize: "0.6rem" }}
                aria-label={`Remove filter ${CHIP_LABELS[c.key]?.[c.value] ?? c.key}`}
                onClick={() => {
                  c.clear();
                  setPage(1);
                }}
              />
            </span>
          ))}
        </div>
      )}

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
                    <td>
                      {/* Lab 4: real button so keyboard users can open the Ticket */}
                      <button
                        type="button"
                        className="btn btn-link p-0 text-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTicket(t.id);
                        }}
                      >
                        {t.ticketNumber}
                      </button>
                    </td>
                    <td>{t.summary}</td>
                    <td>{t.category.name}</td>
                    <td>
                      <span className="badge bg-success-subtle text-success-emphasis">
                        {priorityLabel(t.requestedPriority)}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-success-subtle text-success-emphasis">
                        {priorityLabel(t.itPriority)}
                      </span>
                    </td>
                    <td>
                      <TicketStatusBadge status={t.currentStatus} />
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
                role="button"
                tabIndex={0}
                aria-label={`Open ${t.ticketNumber}: ${t.summary}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenTicket(t.id);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="card-body py-2 px-3">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <small className="text-muted">{t.ticketNumber}</small>
                    <TicketStatusBadge status={t.currentStatus} />
                  </div>
                  <div className="fw-semibold mb-2">{t.summary}</div>
                  <div className="d-flex flex-wrap gap-2 small">
                    <span className="text-muted">{t.category.name}</span>
                    <span className="badge bg-success-subtle text-success-emphasis">
                      Req: {priorityLabel(t.requestedPriority)}
                    </span>
                    <span className="badge bg-success-subtle text-success-emphasis">
                      IT: {priorityLabel(t.itPriority)}
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