import { useState, useEffect } from "react";
import { Category, AuthUser, getCurrentUser, logout } from "./api.js";
import Login from "./Login.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";
import StaffTicketQueue from "./StaffTicketQueue.js";
import StaffTicketDetail from "./StaffTicketDetail.js";

type View = "home" | "create-ticket" | "my-tickets" | "ticket-detail" | "staff-queue" | "staff-ticket-detail";
type AuthState = "loading" | "unauthenticated" | "must-change-password" | "authenticated";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<View>("home");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

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
  }

  async function handleLogout() {
    await logout();
    setCurrentUser(null);
    setAuthState("unauthenticated");
    setView("home");
  }

    function handleOpenTicket(ticketId: number) {
    setSelectedTicketId(ticketId);
    setView(currentUser?.role === "IT_STAFF" || currentUser?.role === "ADMINISTRATOR" ? "staff-ticket-detail" : "ticket-detail");
  }

  if (authState === "loading") {
    return (
      <div className="container py-5 text-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  if (authState === "must-change-password") {
    return (
      <ChangePassword
        onSuccess={() => setAuthState("authenticated")}
      />
    );
  }

  // authState === "authenticated" — currentUser is guaranteed non-null here.
  const user = currentUser!;
  // Existing Lab 2 components expect a "requester"-shaped object.
  const requesterCompat = { id: user.id, name: user.name, email: user.email };

  return (
    <div className="container py-5" style={{ maxWidth: 900 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          TokTickIT <span className="text-success">IT Service Desk</span>
        </h1>
        <div className="text-end">
          <div className="small text-muted">
            {user.name} · <span className="badge bg-secondary">{user.role}</span>
          </div>
          <button className="btn btn-link btn-sm p-0" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {user.role === "REQUESTER" && (
        <>
          <div className="mb-4">
            <button
              className={`btn btn-sm me-2 ${
                view === "my-tickets" || view === "ticket-detail" ? "btn-success" : "btn-outline-success"
              }`}
              onClick={() => setView("my-tickets")}
            >
              My Tickets
            </button>
            <button
              className={`btn btn-sm ${view === "create-ticket" ? "btn-success" : "btn-outline-success"}`}
              onClick={() => setView("create-ticket")}
            >
              Create Ticket
            </button>
          </div>

          {view === "create-ticket" && (
            <CreateTicket
              requester={requesterCompat}
              categories={categories}
              onCreated={() => setView("my-tickets")}
            />
          )}

          {(view === "my-tickets" || view === "home") && (
            <MyTickets
              requester={requesterCompat}
              categories={categories}
              onOpenTicket={handleOpenTicket}
            />
          )}

          {view === "ticket-detail" && selectedTicketId && (
            <TicketDetail
              ticketId={selectedTicketId}
              requester={requesterCompat}
              onBack={() => setView("my-tickets")}
            />
          )}
        </>
      )}

            {user.role === "IT_STAFF" && (
        <>
          {(view === "staff-queue" || view === "home") && (
            <StaffTicketQueue currentUserId={user.id} onOpenTicket={handleOpenTicket} />
          )}
          {view === "staff-ticket-detail" && selectedTicketId && (
            <StaffTicketDetail
              ticketId={selectedTicketId}
              currentUserId={user.id}
              onBack={() => setView("staff-queue")}
            />
          )}
        </>
      )}

      {user.role === "ADMINISTRATOR" && (
        <div className="alert alert-info">
          Administrator User Management UI coming soon.
        </div>
      )}
    </div>
  );
}