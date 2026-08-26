import { useState, useEffect } from "react";
import { checkSystem, Category, DevRequester } from "./api.js";
import RequesterSelector from "./RequesterSelector.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";

type UiState = "idle" | "loading" | "success" | "error";
type View = "home" | "create-ticket" | "my-tickets" | "ticket-detail";

export default function App() {
  const [selectedRequester, setSelectedRequester] = useState<DevRequester | null>(null);
  const [view, setView] = useState<View>("home");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (selectedRequester) {
      fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/categories`)
        .then((res) => res.json())
        .then(setCategories)
        .catch(() => {});
    }
  }, [selectedRequester]);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setErrorMessage("Unable to connect to TokTickIT API");
      setState("error");
    }
  }

  function handleOpenTicket(ticketId: number) {
    setSelectedTicketId(ticketId);
    setView("ticket-detail");
  }

  if (!selectedRequester) {
    return <RequesterSelector onSelect={setSelectedRequester} />;
  }

  return (
    <div className="container py-5" style={{ maxWidth: 900 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          TokTickIT <span className="text-success">IT Service Desk</span>
        </h1>
        <div className="text-end">
          <div className="small text-muted">Requester: {selectedRequester.name}</div>
          <button
            className="btn btn-link btn-sm p-0"
            onClick={() => setSelectedRequester(null)}
          >
            Change Requester
          </button>
        </div>
      </div>

      <div className="mb-4">
        <button
          className={`btn btn-sm me-2 ${view === "home" ? "btn-success" : "btn-outline-success"}`}
          onClick={() => setView("home")}
        >
          Home
        </button>
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

      {view === "home" && (
        <>
          <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
            {state === "loading" ? "Loading…" : "Check System"}
          </button>
          {state === "success" && (
            <div className="mt-3">
              <p>System Status: <strong>Online</strong></p>
              <p>Supported Request Categories:</p>
              <ul>
                {categories.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </div>
          )}
          {state === "error" && (
            <p className="mt-3 text-danger">
              System Status: <strong>Offline</strong><br />
              {errorMessage}
            </p>
          )}
        </>
      )}

      {view === "create-ticket" && (
        <CreateTicket
          requester={selectedRequester}
          categories={categories}
          onCreated={() => setView("my-tickets")}
        />
      )}

      {view === "my-tickets" && (
        <MyTickets
          requester={selectedRequester}
          categories={categories}
          onOpenTicket={handleOpenTicket}
        />
      )}

      {view === "ticket-detail" && selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          requester={selectedRequester}
          onBack={() => setView("my-tickets")}
        />
      )}
    </div>
  );
}
