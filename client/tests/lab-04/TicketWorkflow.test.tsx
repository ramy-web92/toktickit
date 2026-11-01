// Lab 4 — UI-11..UI-14 (docs/lab-04/tests.md). The API module is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketWorkflowControl, { RequesterResolvedButton } from "../../src/TicketWorkflow.js";
import type { WorkflowTicket } from "../../src/api.js";

vi.mock("../../src/api.js", () => ({
  changeTicketStatus: vi.fn(),
  getStatusHistory: vi.fn(),
  markProblemResolved: vi.fn(),
}));
import * as api from "../../src/api.js";

function ticket(over: Partial<WorkflowTicket> = {}): WorkflowTicket {
  return {
    id: 5,
    currentStatus: "IN_PROGRESS",
    version: 3,
    allowedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    requesterMarkedResolved: false,
    requesterMarkedResolvedAt: null,
    ...over,
  };
}

// Renders the control and waits for the status history to load, so React state
// updates finish inside the test (no act() warnings).
async function renderControl(ui: React.ReactElement) {
  const utils = render(ui);
  await screen.findByText(/status history \(/i);
  return utils;
}

beforeEach(() => {
  vi.mocked(api.changeTicketStatus).mockReset();
  vi.mocked(api.markProblemResolved).mockReset();
  vi.mocked(api.getStatusHistory).mockReset().mockResolvedValue([]);
});

describe("TicketWorkflowControl", () => {
  it("UI-11 offers only the transitions allowed by the server", async () => {
    await renderControl(<TicketWorkflowControl ticket={ticket()} onUpdated={vi.fn()} onReload={vi.fn()} />);
    const group = screen.getByRole("group", { name: /change status/i });
    const labels = Array.from(group.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Wait for requester", "Resolve", "Cancel ticket"]);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument(); // badge with text
  });

  it("shows no control when nothing is allowed", async () => {
    await renderControl(<TicketWorkflowControl ticket={ticket({ currentStatus: "CANCELLED", allowedTransitions: [] })} onUpdated={vi.fn()} onReload={vi.fn()} />,
    );
    expect(screen.queryByRole("group", { name: /change status/i })).not.toBeInTheDocument();
    expect(screen.getByText(/this ticket is cancelled/i)).toBeInTheDocument();
  });

  it("UI-12 cancel dialog requires a reason, traps focus and closes with Escape", async () => {
    const user = userEvent.setup();
    await renderControl(<TicketWorkflowControl ticket={ticket()} onUpdated={vi.fn()} onReload={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Cancel ticket" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /cancel this ticket/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText(/reason/i)).toHaveFocus();

    // Confirm without a reason → error, no request
    const buttons = dialog.querySelectorAll("button");
    await user.click(buttons[buttons.length - 1]);
    expect(screen.getByText(/a reason is required/i)).toBeInTheDocument();
    expect(api.changeTicketStatus).not.toHaveBeenCalled();

    // Tab cycles inside the dialog
    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("UI-12 sends the reason when cancelling", async () => {
    const user = userEvent.setup();
    vi.mocked(api.changeTicketStatus).mockResolvedValueOnce(ticket({ currentStatus: "CANCELLED", allowedTransitions: [], version: 4 }));
    await renderControl(<TicketWorkflowControl ticket={ticket()} onUpdated={vi.fn()} onReload={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Cancel ticket" }));
    await user.type(screen.getByLabelText(/reason/i), "Duplicate request");
    const buttons = screen.getByRole("dialog").querySelectorAll("button");
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api.changeTicketStatus).toHaveBeenCalledWith(5, "CANCELLED", 3, "Duplicate request"));
  });

  it("UI-13 a successful change refreshes the summary and the history", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const updated = ticket({ currentStatus: "WAITING_FOR_REQUESTER", version: 4, allowedTransitions: ["IN_PROGRESS", "RESOLVED", "CANCELLED"] });
    vi.mocked(api.changeTicketStatus).mockResolvedValueOnce(updated);
    await renderControl(<TicketWorkflowControl ticket={ticket()} onUpdated={onUpdated} onReload={vi.fn()} />);
    await waitFor(() => expect(api.getStatusHistory).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Wait for requester" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(api.changeTicketStatus).toHaveBeenCalledWith(5, "WAITING_FOR_REQUESTER", 3, undefined);
    expect(await screen.findByText(/status changed to waiting for requester/i)).toBeInTheDocument();
    await waitFor(() => expect(api.getStatusHistory).toHaveBeenCalledTimes(2));
  });

  it("shows the resolution gate message from the server", async () => {
    const user = userEvent.setup();
    vi.mocked(api.changeTicketStatus).mockRejectedValueOnce({
      status: 409,
      error: { code: "RESOLUTION_GATE", message: "Complete or cancel all open actions before resolving this Ticket." },
    });
    await renderControl(<TicketWorkflowControl ticket={ticket()} onUpdated={vi.fn()} onReload={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Resolve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/complete or cancel all open actions/i);
  });

  it("reloads the Ticket on a stale update", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    vi.mocked(api.changeTicketStatus).mockRejectedValueOnce({ status: 409, error: { code: "STALE_UPDATE" } });
    await renderControl(<TicketWorkflowControl ticket={ticket()} onUpdated={vi.fn()} onReload={onReload} />);
    await user.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent(/changed by someone else/i);
  });
});

describe("RequesterResolvedButton", () => {
  it("UI-14 marks the problem as appearing resolved without changing the status", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const marked = ticket({ requesterMarkedResolved: true, requesterMarkedResolvedAt: "2026-10-20T03:00:00.000Z" });
    vi.mocked(api.markProblemResolved).mockResolvedValueOnce(marked);
    render(<RequesterResolvedButton ticket={ticket()} onUpdated={onUpdated} />);
    expect(screen.getByText(/only IT Staff can formally resolve/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /problem appears resolved/i }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(marked));
    expect(marked.currentStatus).toBe("IN_PROGRESS");
  });

  it("UI-14 shows a confirmation once marked", () => {
    render(
      <RequesterResolvedButton
        ticket={ticket({ requesterMarkedResolved: true, requesterMarkedResolvedAt: "2026-10-20T03:00:00.000Z" })}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByText(/you told IT this looks resolved/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is hidden when IT is not working on the Ticket", () => {
    const { container } = render(<RequesterResolvedButton ticket={ticket({ currentStatus: "NEW" })} onUpdated={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
