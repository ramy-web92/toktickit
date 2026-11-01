import { useState, useEffect } from "react";
import { Category, AuthUser, getCurrentUser, logout, parseDrillDown } from "./api.js";
import Login from "./Login.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";
import StaffTicketQueue from "./StaffTicketQueue.js";
import StaffTicketDetail from "./StaffTicketDetail.js";
import UserManagement from "./UserManagement.js";
import { RequesterDashboard, StaffDashboard } from "./Dashboards.js";

type View =
  | "dashboard"
  | "create-ticket"
  | "my-tickets"
  | "ticket-detail"
  | "staff-queue"
  | "staff-ticket-detail"
  | "admin-users";
type AuthState = "loading" | "unauthenticated" | "must-change-password" | "authenticated";

interface NavItem {
  label: string;
  view: View;
  /** Views that keep this item marked as the current page. */
  activeFor: View[];
}

// Lab 4: role-appropriate navigation with Dashboard as the landing page (ui-spec §1).
const NAV: Record<string, NavItem[]> = {
  REQUESTER: [
    { label: "Dashboard", view: "dashboard", activeFor: ["dashboard"] },
    { label: "My Tickets", view: "my-tickets", activeFor: ["my-tickets", "ticket-detail"] },
    { label: "Create Ticket", view: "create-ticket", activeFor: ["create-ticket"] },
  ],
  IT_STAFF: [
    { label: "Dashboard", view: "dashboard", activeFor: ["dashboard"] },
    { label: "Ticket Queue", view: "staff-queue", activeFor: ["staff-queue", "staff-ticket-detail"] },
  ],
  ADMINISTRATOR: [
    { label: "Dashboard", view: "dashboard", activeFor: ["dashboard"] },
    { label: "Ticket Queue", view: "staff-queue", activeFor: ["staff-queue", "staff-ticket-detail"] },
    { label: "Users", view: "admin-users", activeFor: ["admin-users"] },
  ],
};

const ROLE_LABELS: Record<string, string> = { REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" };

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [returnView, setReturnView] = useState<View>("dashboard");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // Lab 4: filters passed from a dashboard card to a list (drill-down), and a key to remount the list.
  const [listFilters, setListFilters] = useState<Record<string, string>>({});
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        setAuthState(user.mustChangePassword ? "must-change-password" : "authenticated");
      })
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  useEffect(() => {
    if (authState === "authenticated") {
      fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/categories`)
        .then((res) => res.json())
        .then(setCategories)
        .catch(() => {});
    }
  }, [authState]);

  function handleLoginSuccess(user: AuthUser) {
    setCurrentUser(user);
    setAuthState(user.mustChangePassword ? "must-change-password" : "authenticated");
    setView("dashboard");
  }

  async function handleLogout() {
    await logout();
    setCurrentUser(null);
    setAuthState("unauthenticated");
    setView("dashboard");
  }

  function navigate(next: View, filters: Record<string, string> = {}) {
    setListFilters(filters);
    setListKey((k) => k + 1);
    setView(next);
  }

  function handleOpenTicket(ticketId: number) {
    setReturnView(view === "dashboard" ? "dashboard" : view);
    setSelectedTicketId(ticketId);
    setView(currentUser?.role === "IT_STAFF" || currentUser?.role === "ADMINISTRATOR" ? "staff-ticket-detail" : "ticket-detail");
  }

  function handleDrillDown(link: string) {
    const { target, params } = parseDrillDown(link);
    if (target === "queue") navigate("staff-queue", params);
    else if (target === "my-tickets") navigate("my-tickets", params);
    else if (target === "admin/users") navigate("admin-users", params);
  }

  if (authState === "loading") {
    return (
      <div className="container py-5 text-center">
        <p className="text-muted" aria-busy="true">Loading…</p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  if (authState === "must-change-password") {
    return <ChangePassword onSuccess={() => setAuthState("authenticated")} />;
  }

  // authState === "authenticated" — currentUser is guaranteed non-null here.
  const user = currentUser!;
  // Existing Lab 2 components expect a "requester"-shaped object.
  const requesterCompat = { id: user.id, name: user.name, email: user.email };
  const isStaff = user.role === "IT_STAFF" || user.role === "ADMINISTRATOR";
  const navItems = NAV[user.role] ?? [];

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: 1100 }}>
      <header className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">
          TokTickIT <span className="text-success">IT Service Desk</span>
        </h1>
        <div className="text-end">
          <div className="small text-muted">
            {user.name} · <span className="badge bg-secondary">{ROLE_LABELS[user.role] ?? user.role}</span>
          </div>
          <button className="btn btn-link btn-sm p-0" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav aria-label="Main" className="mb-4">
        <ul className="nav nav-pills flex-wrap gap-1">
          {navItems.map((item) => {
            const active = item.activeFor.includes(view);
            return (
              <li className="nav-item" key={item.view}>
                <button
                  className={`nav-link ${active ? "active bg-success" : "text-success"}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => navigate(item.view)}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main>
        {view === "dashboard" &&
          (isStaff ? (
            <StaffDashboard userName={user.name} onDrillDown={handleDrillDown} onOpenTicket={handleOpenTicket} />
          ) : (
            <RequesterDashboard
              userName={user.name}
              onDrillDown={handleDrillDown}
              onOpenTicket={handleOpenTicket}
              onCreateTicket={() => navigate("create-ticket")}
            />
          ))}

        {user.role === "REQUESTER" && (
          <>
            {view === "create-ticket" && (
              <CreateTicket requester={requesterCompat} categories={categories} onCreated={() => navigate("my-tickets")} />
            )}

            {view === "my-tickets" && (
              <MyTickets
                key={listKey}
                requester={requesterCompat}
                categories={categories}
                onOpenTicket={handleOpenTicket}
                initialStatus={listFilters.currentStatus}
              />
            )}

            {view === "ticket-detail" && selectedTicketId && (
              <TicketDetail ticketId={selectedTicketId} requester={requesterCompat} onBack={() => setView(returnView)} />
            )}
          </>
        )}

        {isStaff && (
          <>
            {view === "staff-queue" && (
              <StaffTicketQueue
                key={listKey}
                currentUserId={user.id}
                onOpenTicket={handleOpenTicket}
                initialFilters={listFilters}
              />
            )}
            {view === "staff-ticket-detail" && selectedTicketId && (
              <StaffTicketDetail ticketId={selectedTicketId} currentUserId={user.id} onBack={() => setView(returnView)} />
            )}
          </>
        )}

        {user.role === "ADMINISTRATOR" && view === "admin-users" && (
          <UserManagement key={listKey} currentUserId={user.id} initialRole={listFilters.role} />
        )}
      </main>
    </div>
  );
}
