import { useEffect, useState } from "react";
import { getDevRequesters, DevRequester } from "./api.js";

type UiState = "loading" | "success" | "empty" | "error";

interface Props {
  onSelect: (requester: DevRequester) => void;
}

export default function RequesterSelector({ onSelect }: Props) {
  const [state, setState] = useState<UiState>("loading");
  const [requesters, setRequesters] = useState<DevRequester[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");

  useEffect(() => {
    loadRequesters();
  }, []);

  async function loadRequesters() {
    setState("loading");
    try {
      const result = await getDevRequesters();
      if (result.length === 0) {
        setState("empty");
      } else {
        setRequesters(result);
        setState("success");
      }
    } catch {
      setState("error");
    }
  }

  function handleContinue() {
    const requester = requesters.find((r) => r.id === selectedId);
    if (requester) {
      onSelect(requester);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <div className="card p-4 text-center">
        <h2 className="h4 mb-2">Select Development Requester</h2>
        <p className="text-muted small mb-4">
          Choose a development requester to simulate the current requester context
          for Lab 2. This is for testing only and is not a login screen.
        </p>

        {state === "loading" && <p>Loading requesters…</p>}

        {state === "empty" && (
          <p className="text-warning">No active Development Requesters found.</p>
        )}

        {state === "error" && (
          <div>
            <p className="text-danger">Unable to load requesters.</p>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadRequesters}>
              Retry
            </button>
          </div>
        )}

        {state === "success" && (
          <>
            <select
              className="form-select mb-3"
              value={selectedId}
              onChange={(e) => setSelectedId(Number(e.target.value))}
            >
              <option value="">-- Select a Requester --</option>
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-success w-100"
              disabled={selectedId === ""}
              onClick={handleContinue}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}