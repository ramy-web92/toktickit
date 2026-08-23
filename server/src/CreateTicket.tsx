import { useEffect, useState } from "react";
import {
  getRelatedSystems,
  createTicket,
  Category,
  RelatedSystem,
  DevRequester,
} from "./api.js";

type FormState = "idle" | "submitting" | "success" | "error";

interface Props {
  requester: DevRequester;
  categories: Category[];
  onCreated: (ticketNumber: string) => void;
}

export default function CreateTicket({ requester, categories, onCreated }: Props) {
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("MEDIUM");
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>("idle");
  const [ticketNumber, setTicketNumber] = useState("");
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    getRelatedSystems().then(setRelatedSystems).catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (summary.trim().length < 5 || summary.trim().length > 120) {
      errors.summary = "Summary must be between 5 and 120 characters";
    }
    if (description.trim().length < 10 || description.trim().length > 2000) {
      errors.description = "Description must be between 10 and 2000 characters";
    }
    if (!categoryId) {
      errors.categoryId = "Category is required";
    }
    if (!relatedSystemId) {
      errors.relatedSystemId = "Related System is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState("submitting");
    setApiError("");
    try {
      const result = await createTicket({
        requesterId: requester.id,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
        attachments: files,
      });
      setTicketNumber(result.ticket.ticketNumber);
      setState("success");
      onCreated(result.ticket.ticketNumber);
    } catch (err: any) {
      if (err.error?.code === "VALIDATION_ERROR") {
        setFieldErrors(err.error.fields || {});
      } else {
        setApiError("Unable to create ticket. Please try again.");
      }
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="alert alert-success mt-4">
        <h5>Ticket Created</h5>
        <p>
          Your ticket number is <strong>{ticketNumber}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4" noValidate>
      <div className="mb-3">
        <label className="form-label">
          Category <span className="text-danger">*</span>
        </label>
        <select
          className={`form-select ${fieldErrors.categoryId ? "is-invalid" : ""}`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">-- Select --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {fieldErrors.categoryId && (
          <div className="invalid-feedback">{fieldErrors.categoryId}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">
          Related System <span className="text-danger">*</span>
        </label>
        <select
          className={`form-select ${fieldErrors.relatedSystemId ? "is-invalid" : ""}`}
          value={relatedSystemId}
          onChange={(e) => setRelatedSystemId(e.target.value)}
        >
          <option value="">-- Select --</option>
          {relatedSystems.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {fieldErrors.relatedSystemId && (
          <div className="invalid-feedback">{fieldErrors.relatedSystemId}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">Requested Priority</label>
        <select
          className="form-select"
          value={requestedPriority}
          onChange={(e) => setRequestedPriority(e.target.value)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label">
          Summary <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          className={`form-control ${fieldErrors.summary ? "is-invalid" : ""}`}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        {fieldErrors.summary && <div className="invalid-feedback">{fieldErrors.summary}</div>}
      </div>

      <div className="mb-3">
        <label className="form-label">
          Description <span className="text-danger">*</span>
        </label>
        <textarea
          className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {fieldErrors.description && (
          <div className="invalid-feedback">{fieldErrors.description}</div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">Attachments (JPG, PNG, WEBP, PDF — max 5MB each)</label>
        <input type="file" className="form-control" multiple onChange={handleFileChange} />
      </div>

      {apiError && <div className="alert alert-danger">{apiError}</div>}

      <button className="btn btn-success" type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Submitting…" : "Submit Ticket"}
      </button>
    </form>
  );
}
