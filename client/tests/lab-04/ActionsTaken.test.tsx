// Lab 4 — UI-05..UI-10 (docs/lab-04/tests.md). The API module is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken.js";
import type { ActionTakenData } from "../../src/api.js";

vi.mock("../../src/api.js", () => ({
  getActions: vi.fn(),
  createAction: vi.fn(),
  updateAction: vi.fn(),
  transitionAction: vi.fn(),
}));
import * as api from "../../src/api.js";

const kevin = { id: 6, name: "Kevin Patel" };
const emily = { id: 7, name: "Emily Davis" };

function action(over: Partial<ActionTakenData>): ActionTakenData {
  return {
    id: 1,
    ticketId: 10,
    actionAt: "2026-10-20T03:00:00.000Z",
    description: "Checked cable",
    result: null,
    status: "PLANNED",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    createdBy: kevin,
    assignee: kevin,
    performedBy: null,
    version: 1,
    createdAt: "2026-10-20T03:00:00.000Z",
    updatedAt: "2026-10-20T03:00:00.000Z",
    ...over,
  };
}

const list = [
  action({ id: 1, description: "Ran diagnostics", status: "COMPLETED", result: "OK", performedBy: kevin }),
  action({ id: 2, actionAt: "2026-10-20T04:00:00.000Z", description: "Order battery", status: "IN_PROGRESS", assignee: emily }),
  action({ id: 3, actionAt: "2026-10-20T05:00:00.000Z", description: "Install battery", status: "PLANNED" }),
];

function renderStaff(props: Partial<React.ComponentProps<typeof ActionsTaken>> = {}) {
  return render(
    <ActionsTaken ticketId={10} canEdit ticketStatus="IN_PROGRESS" currentUserId={6} assignees={[kevin, emily]} {...props} />,
  );
}

beforeEach(() => {
  vi.mocked(api.getActions).mockReset().mockResolvedValue(list);
  vi.mocked(api.createAction).mockReset();
  vi.mocked(api.updateAction).mockReset();
  vi.mocked(api.transitionAction).mockReset();
});

describe("ActionsTaken panel", () => {
  it("UI-05 lists actions in server order with text status badges", async () => {
    renderStaff();
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[1].textContent)).toEqual([
      "Ran diagnostics", "Order battery", "Install battery",
    ]);
    // status conveyed by text, not color only
    expect(within(rows[0]).getByText("Completed")).toBeInTheDocument();
    expect(within(rows[1]).getByText("In Progress")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Planned")).toBeInTheDocument();
  });

  it("shows a safe error with Retry when loading fails", async () => {
    vi.mocked(api.getActions).mockRejectedValueOnce({ status: 500 });
    renderStaff();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    vi.mocked(api.getActions).mockResolvedValueOnce([]);
    renderStaff();
    expect(await screen.findByText("No actions recorded yet.")).toBeInTheDocument();
  });

  it("UI-06 Requester view is read-only", async () => {
    renderStaff({ canEdit: false });
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /add action/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /view action: install battery/i })[0]);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
  });

  it("UI-07 follow-up toggle reveals a required note and focuses the error", async () => {
    const user = userEvent.setup();
    renderStaff();
    await user.click(await screen.findByRole("button", { name: /add action/i }));
    await user.type(screen.getByLabelText(/action description/i), "Reset VPN profile");
    expect(screen.queryByLabelText(/follow-up note/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: /follow-up required/i }));
    const note = screen.getByLabelText(/follow-up note/i);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/follow-up note is required/i)).toBeInTheDocument();
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(note).toHaveFocus();
    expect(api.createAction).not.toHaveBeenCalled();
  });

  it("UI-08 double-clicking Save sends one request with an idempotency key", async () => {
    const user = userEvent.setup();
    let resolve!: (v: ActionTakenData) => void;
    vi.mocked(api.createAction).mockImplementation(() => new Promise((r) => (resolve = r)));
    renderStaff();
    await user.click(await screen.findByRole("button", { name: /add action/i }));
    await user.type(screen.getByLabelText(/action description/i), "Replace cable");

    const save = screen.getByRole("button", { name: "Save" });
    await user.dblClick(save);
    expect(api.createAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    const [ticketId, input, key] = vi.mocked(api.createAction).mock.calls[0];
    expect(ticketId).toBe(10);
    expect(input).toMatchObject({ description: "Replace cable", assigneeId: 6, followUpRequired: false });
    expect(typeof key).toBe("string");

    resolve(action({ id: 4, description: "Replace cable" }));
    expect(await screen.findByText("Action saved.")).toBeInTheDocument();
  });

  it("UI-09 keeps the user's input and shows a banner on a 409 conflict", async () => {
    const user = userEvent.setup();
    const latest = action({ id: 3, description: "Install battery", result: "Changed by Emily", version: 2 });
    vi.mocked(api.updateAction).mockRejectedValueOnce({
      status: 409,
      error: { code: "STALE_UPDATE", details: { current: latest } },
    });
    renderStaff();
    await user.click((await screen.findAllByRole("button", { name: /view action: install battery/i }))[0]);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const result = screen.getByLabelText(/^result/i);
    await user.type(result, "My result");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^result/i)).toHaveValue("My result");

    // Saving again after "Show latest" uses the new version
    vi.mocked(api.updateAction).mockResolvedValueOnce({ ...latest, result: "My result", version: 3 });
    await user.click(screen.getByRole("button", { name: "Show latest" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.updateAction).mock.calls[1][3]).toBe(2);
  });

  it("shows server field errors (422) under the right field", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createAction).mockRejectedValueOnce({
      status: 422,
      error: { code: "INVALID_ASSIGNEE" },
    });
    renderStaff();
    await user.click(await screen.findByRole("button", { name: /add action/i }));
    await user.type(screen.getByLabelText(/action description/i), "Something");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/active IT Staff member/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/action description/i)).toHaveValue("Something");
  });

  it("requires a result before completing, then completes", async () => {
    const user = userEvent.setup();
    vi.mocked(api.transitionAction).mockResolvedValueOnce(action({ id: 3, status: "COMPLETED", result: "Done" }));
    renderStaff();
    await user.click((await screen.findAllByRole("button", { name: /view action: install battery/i }))[0]);
    await user.click(screen.getByRole("button", { name: "Complete" }));
    await user.click(screen.getByRole("button", { name: "Confirm completion" }));
    expect(screen.getByText(/result is required/i)).toBeInTheDocument();
    expect(api.transitionAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/result \*/i), "Done");
    await user.click(screen.getByRole("button", { name: "Confirm completion" }));
    await waitFor(() => expect(api.transitionAction).toHaveBeenCalledWith(10, 3, "COMPLETED", 1, "Done"));
  });

  it("UI-10 completed actions are read-only", async () => {
    const user = userEvent.setup();
    renderStaff();
    await user.click((await screen.findAllByRole("button", { name: /view action: ran diagnostics/i }))[0]);
    expect(screen.getByText(/can't be edited/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
  });

  it("hides editing on a Closed Ticket", async () => {
    renderStaff({ ticketStatus: "CLOSED" });
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /add action/i })).not.toBeInTheDocument();
    expect(screen.getByText(/actions are read-only/i)).toBeInTheDocument();
  });
});
