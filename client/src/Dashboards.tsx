// Lab 4 — Requester and IT Staff dashboards (docs/lab-04/ui-spec.md §2–3).
// Every number comes from the backend; every card opens the matching filtered list.
import { useEffect, useState } from "react";
import {
  ApiError,
  DashboardMetric,
  DashboardTicket,
  RequesterDashboardData,
  StaffDashboardData,
  getRequesterDashboard,
  getStaffDashboard,
} from "./api.js";
import { TicketStatusBadge, statusLabel } from "./TicketWorkflow.js";

type LoadState = "loading" | "success" | "error" | "forbidden";

interface CommonProps {
  /** Opens a filtered list from a drill-down link such as "/queue?status=active". */
  onDrillDown: (link: string) => void;
  onOpenTicket: (ticketId: number) => void;
}

const PRIORITY_LABELS: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const ROLE_LABELS: Record<string, string> = { REQUESTER: "Requesters", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrators" };

function useDashboard<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setState("loading");
    try {
      setData(await loader());
      setState("success");
    } catch (e) {
      setState((e as ApiError)?.status === 403 ? "forbidden" : "error");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { data, state, refreshing, reload: () => load(false), refresh: () => load(true) };
}

function LoadingCards({ count }: { count: number }) {
  return (
    <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3 mb-4" aria-busy="true" aria-label="Loading dashboard">
      {Array.from({ length: count }).map((_, i) => (
        <div className="col" key={i}>
          <div className="card h-100 placeholder-glow">
            <div className="card-body">
              <span className="placeholder col-7 mb-2" />
              <span className="placeholder col-4 placeholder-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StateMessage({ state, onRetry }: { state: LoadState; onRetry: () => void }) {
  if (state === "forbidden") {
    return (
      <div className="alert alert-warning" role="alert">
        You don't have access to this dashboard.
      </div>
    );
  }
  return (
    <div className="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-2" role="alert">
      <span>We couldn't load your dashboard. Your data is safe — please try again.</span>
      <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function MetricCard({ metric, onOpen }: { metric: DashboardMetric; onOpen: (link: string) => void }) {
  return (
    <div className="col">
      <button
        type="button"
        className="card h-100 w-100 text-start border-success-subtle shadow-sm metric-card"
        onClick={() => onOpen(metric.drillDown)}
        aria-label={`${metric.label}: ${metric.value}. View list`}
      >
        <div className="card-body">
          <div className="small text-muted">{metric.label}</div>
          <div className="display-6 fw-semibold text-success-emphasis">{metric.value}</div>
          <div className="small text-success" aria-hidden="true">View all →</div>
        </div>
      </button>
    </div>
  );
}

function TicketList({
  title,
  tickets,
  emptyText,
  onOpenTicket,
  showOwner = false,
  dateField = "updatedAt",
}: {
  title: string;
  tickets: DashboardTicket[];
  emptyText: string;
  onOpenTicket: (id: number) => void;
  showOwner?: boolean;
  dateField?: "updatedAt" | "resolvedAt";
}) {
  const headingId = `list-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section className="card h-100" aria-labelledby={headingId}>
      <div className="card-body">
        <h3 id={headingId} className="h6 mb-3">{title}</h3>
        {tickets.length === 0 ? (
          <p className="text-muted small mb-0">{emptyText}</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {tickets.map((t) => (
              <li key={t.id} className="border-bottom py-2">
                <button
                  type="button"
                  className="btn btn-link p-0 text-start text-decoration-none w-100"
                  onClick={() => onOpenTicket(t.id)}
                >
                  <span className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <span className="small text-success fw-semibold">{t.ticketNumber}</span>
                    <TicketStatusBadge status={t.currentStatus} />
                  </span>
                  <span className="d-block text-body text-truncate" title={t.summary}>{t.summary}</span>
                  <span className="d-block small text-muted">
                    {showOwner && <>{t.owner ? t.owner.name : "Unassigned"} · </>}
                    {showOwner && <>{PRIORITY_LABELS[t.itPriority] ?? t.itPriority} priority · </>}
                    {new Date((dateField === "resolvedAt" ? t.resolvedAt : t.updatedAt) ?? t.updatedAt).toLocaleString()}
                    {t.requesterMarkedResolved && <> · <span className="text-success">Requester says it looks resolved</span></>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function RequesterDashboard({
  userName,
  onDrillDown,
  onOpenTicket,
  onCreateTicket,
}: CommonProps & { userName: string; onCreateTicket: () => void }) {
  const { data, state, reload } = useDashboard<RequesterDashboardData>(getRequesterDashboard);
  const firstName = userName.split(" ")[0];

  return (
    <div>
      <h2 className="h4 mb-1">Welcome, {firstName}!</h2>
      <p className="text-muted mb-4">Here's the latest on your requests.</p>

      {state === "loading" && <LoadingCards count={4} />}
      {(state === "error" || state === "forbidden") && <StateMessage state={state} onRetry={reload} />}

      {state === "success" && data && (
        <>
          <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3 mb-4">
            {data.metrics.map((m) => (
              <MetricCard key={m.id} metric={m} onOpen={onDrillDown} />
            ))}
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-8">
              <TicketList
                title="Recently Updated"
                tickets={data.recentlyUpdated}
                emptyText="You haven't submitted any tickets yet."
                onOpenTicket={onOpenTicket}
              />
            </div>
            <div className="col-12 col-lg-4">
              <section className="card h-100" aria-labelledby="quick-actions-title">
                <div className="card-body d-grid gap-2 align-content-start">
                  <h3 id="quick-actions-title" className="h6 mb-1">Quick Actions</h3>
                  <button className="btn btn-success" onClick={onCreateTicket}>
                    + Create Ticket
                  </button>
                  <button className="btn btn-outline-success" onClick={() => onDrillDown("/my-tickets")}>
                    See all my requests
                  </button>
                </div>
              </section>
            </div>
            <div className="col-12">
              <TicketList
                title="Recently Resolved (last 7 days)"
                tickets={data.recentlyResolved}
                emptyText="Nothing resolved in the last 7 days."
                onOpenTicket={onOpenTicket}
                dateField="resolvedAt"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function StaffDashboard({ userName, onDrillDown, onOpenTicket }: CommonProps & { userName: string }) {
  const { data, state, refreshing, reload, refresh } = useDashboard<StaffDashboardData>(getStaffDashboard);
  const firstName = userName.split(" ")[0];

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h2 className="h4 mb-1">Welcome back, {firstName}!</h2>
          <p className="text-muted mb-0">Here's what's happening in the service desk today.</p>
        </div>
        <div className="text-end">
          <button className="btn btn-outline-secondary btn-sm" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          {data && (
            <div className="small text-muted mt-1">
              Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {state === "loading" && <LoadingCards count={4} />}
      {(state === "error" || state === "forbidden") && <StateMessage state={state} onRetry={reload} />}

      {state === "success" && data && (
        <>
          <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3 mb-4">
            {data.metrics.map((m) => (
              <MetricCard key={m.id} metric={m} onOpen={onDrillDown} />
            ))}
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-md-7">
              <section className="card h-100" aria-labelledby="by-status-title">
                <div className="card-body">
                  <h3 id="by-status-title" className="h6 mb-2">Tickets by Status</h3>
                  <table className="table table-sm mb-0">
                    <caption className="visually-hidden">Number of Tickets in each status</caption>
                    <tbody>
                      {data.byStatus.map((row) => (
                        <tr key={row.status}>
                          <th scope="row" className="fw-normal">
                            <button className="btn btn-link btn-sm p-0" onClick={() => onDrillDown(row.drillDown)}>
                              {statusLabel(row.status)}
                            </button>
                          </th>
                          <td className="text-end fw-semibold">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            <div className="col-12 col-md-5">
              <section className="card h-100" aria-labelledby="by-priority-title">
                <div className="card-body">
                  <h3 id="by-priority-title" className="h6 mb-2">Active Tickets by IT Priority</h3>
                  <table className="table table-sm mb-0">
                    <caption className="visually-hidden">Number of active Tickets per IT Priority</caption>
                    <tbody>
                      {[...data.byPriority].reverse().map((row) => (
                        <tr key={row.itPriority}>
                          <th scope="row" className="fw-normal">
                            <button className="btn btn-link btn-sm p-0" onClick={() => onDrillDown(row.drillDown)}>
                              {PRIORITY_LABELS[row.itPriority] ?? row.itPriority}
                            </button>
                          </th>
                          <td className="text-end fw-semibold">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-6">
              <TicketList
                title="Urgent"
                tickets={data.urgent}
                emptyText="No active tickets. Nice work!"
                onOpenTicket={onOpenTicket}
                showOwner
              />
            </div>
            <div className="col-12 col-lg-6">
              <TicketList
                title="Recently Updated"
                tickets={data.recentlyUpdated}
                emptyText="No active tickets were updated recently."
                onOpenTicket={onOpenTicket}
                showOwner
              />
            </div>
          </div>

          {data.users && (
            <section className="card" aria-labelledby="users-title">
              <div className="card-body">
                <h3 id="users-title" className="h6 mb-2">User Accounts</h3>
                <div className="row row-cols-1 row-cols-sm-3 g-2">
                  {data.users.map((u) => (
                    <div className="col" key={u.role}>
                      <button
                        className="btn btn-outline-secondary w-100 text-start"
                        onClick={() => onDrillDown(u.drillDown)}
                        aria-label={`${ROLE_LABELS[u.role] ?? u.role}: ${u.active} active, ${u.inactive} inactive. Manage users`}
                      >
                        <span className="d-block small text-muted">{ROLE_LABELS[u.role] ?? u.role}</span>
                        <span className="fw-semibold">{u.active}</span> active
                        {u.inactive > 0 && <span className="text-muted"> · {u.inactive} inactive</span>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
