import { useState } from "react";
import { checkSystem, Category, DevRequester } from "./api.js";
import RequesterSelector from "./RequesterSelector.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [selectedRequester, setSelectedRequester] = useState<DevRequester | null>(null);
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

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

  if (!selectedRequester) {
    return <RequesterSelector onSelect={setSelectedRequester} />;
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
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
    </div>
  );
}