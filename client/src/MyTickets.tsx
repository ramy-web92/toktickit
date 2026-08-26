import { useEffect, useState } from "react";
import { DevRequester, Category } from "./api.js";

interface TicketRow {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  itPriority: string;
  currentStatus: string;
  updatedAt: string;
  category: { name: string };
}

type UiState = "loading" | "success" | "error";

interface Props {
  requester: DevRequester;
  categories: Category[];
  onOpenTicket: (ticketId: number) => void;
}
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function MyTickets({ requester, categories, onOpenTicket }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("");
  const [hasEverHadTickets, setHasEverHadTickets] = useState(true);

  useEffect(() => {
    loadTickets();
  }, [requester, page, search, categoryId, requestedPriority]);

  async function loadTickets() {
    setState("loading");
    try {
      const params = new URLSearchParams({
        requesterId: String(requester.id),
        page: String(page),
      });
      if (search) params.set("search", search);
      if (categoryId) params.set("categoryId", categoryId);
      if (requestedPriority) params.set("requestedPriority", requestedPriority);

      const res = await fetch(`${API_URL}/api/tickets?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTickets(data.tickets);
      setTotalItems(data.pagination.totalItems);
      if (!search && !categoryId && !requestedPriority) {
        setHasEverHadTickets(data.pagination.totalItems > 0);
      }
      setState("success");
    } catch {
      setState("error");
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setRequestedPriority("");
    setPage(1);
  }

  const hasActiveFilters = search !== "" || categoryId !== "" || requestedPriority !== "";
  const totalPages = Math.ceil(totalItems / 10) || 1;

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 240 }}
          placeholder="Search ticket # or summary…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 160 }}
          value={requestedPriority}
          onChange={(e) => {
            setRequestedPriority(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
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
          <button className="btn btn-sm btn-outline-danger" onClick={loadTickets}>
            Retry
          </button>
        </div>
      )}

      {state === "success" && tickets.length === 0 && !hasActiveFilters && !hasEverHadTickets && (
        <div className="alert alert-secondary">You haven't created any tickets yet.</div>
      )}

      {state === "success" && tickets.length === 0 && hasActiveFilters && (
        <div className="alert alert-secondary">
          No tickets match your filters.{" "}
          <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      )}

      {state === "success" && tickets.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Ticket No.</th>
                <th>Summary</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Last Updated</th>
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
                    <span className="badge bg-secondary-subtle text-secondary-emphasis">
                      {t.currentStatus}
                    </span>
                  </td>
                  <td>{new Date(t.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

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
