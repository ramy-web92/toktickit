// Lab 4 — UI-01, UI-02 (docs/lab-04/tests.md). The API module is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffDashboard } from "../../src/Dashboards.js";
import type { StaffDashboardData } from "../../src/api.js";

vi.mock("../../src/api.js", () => ({
  getStaffDashboard: vi.fn(),
  getRequesterDashboard: vi.fn(),
}));
import * as api from "../../src/api.js";

const STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

function data(over: Partial<StaffDashboardData> = {}): StaffDashboardData {
  return {
    generatedAt: "2026-10-20T03:00:00.000Z",
    timeZone: "Asia/Bangkok",
    metrics: [
      { id: "ST-M1", label: "Unassigned", value: 4, drillDown: "/queue?owner=unassigned&status=active" },
      { id: "ST-M2", label: "My Assigned", value: 16, drillDown: "/queue?owner=me&status=active" },
      { id: "ST-M5", label: "Tickets with My Open Actions", value: 2, drillDown: "/queue?actionAssignee=me" },
      { id: "ST-M6", label: "Follow-ups Pending", value: 0, drillDown: "/queue?followUp=pending" },
    ],
    byStatus: STATUSES.map((status, i) => ({ status, value: i, drillDown: `/queue?status=${status}` })),
    byPriority: ["LOW", "MEDIUM", "HIGH"].map((p, i) => ({ itPriority: p, value: i + 1, drillDown: `/queue?itPriority=${p}&status=active` })),
    recentlyUpdated: [
      { id: 1, ticketNumber: "TKT-2026-000001", summary: "Laptop battery", currentStatus: "IN_PROGRESS", itPriority: "MEDIUM", updatedAt: "2026-10-20T03:00:00.000Z", resolvedAt: null, requesterMarkedResolved: true, owner: { id: 6, name: "Kevin Patel" } },
    ],
    urgent: [],
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(api.getStaffDashboard).mockReset();
});

describe("StaffDashboard", () => {
  it("UI-01 renders metric cards, status and priority tables and lists", async () => {
    vi.mocked(api.getStaffDashboard).mockResolvedValueOnce(data());
    render(<StaffDashboard userName="Kevin Patel" onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Unassigned: 4. View list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Assigned: 16. View list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow-ups Pending: 0. View list" })).toBeInTheDocument();
    expect(screen.getByText("Welcome back, Kevin!")).toBeInTheDocument();

    const byStatus = screen.getByRole("table", { name: /each status/i });
    expect(within(byStatus).getAllByRole("row")).toHaveLength(8);
    expect(within(byStatus).getByRole("button", { name: "Waiting for Requester" })).toBeInTheDocument();

    expect(screen.getByText("TKT-2026-000001")).toBeInTheDocument();
    expect(screen.getByText(/requester says it looks resolved/i)).toBeInTheDocument();
    expect(screen.getByText("No active tickets. Nice work!")).toBeInTheDocument(); // empty urgent list
    expect(screen.queryByText("User Accounts")).not.toBeInTheDocument();
  });

  it("UI-01 cards and table rows drill down to the filtered queue (AC-17)", async () => {
    const user = userEvent.setup();
    const onDrillDown = vi.fn();
    vi.mocked(api.getStaffDashboard).mockResolvedValueOnce(data());
    render(<StaffDashboard userName="Kevin Patel" onDrillDown={onDrillDown} onOpenTicket={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Unassigned: 4. View list" }));
    expect(onDrillDown).toHaveBeenLastCalledWith("/queue?owner=unassigned&status=active");

    await user.click(screen.getByRole("button", { name: "High" }));
    expect(onDrillDown).toHaveBeenLastCalledWith("/queue?itPriority=HIGH&status=active");
  });

  it("opens a Ticket from a list", async () => {
    const user = userEvent.setup();
    const onOpenTicket = vi.fn();
    vi.mocked(api.getStaffDashboard).mockResolvedValueOnce(data());
    render(<StaffDashboard userName="Kevin Patel" onDrillDown={vi.fn()} onOpenTicket={onOpenTicket} />);
    await user.click(await screen.findByText("Laptop battery"));
    expect(onOpenTicket).toHaveBeenCalledWith(1);
  });

  it("shows user counts for Administrators", async () => {
    vi.mocked(api.getStaffDashboard).mockResolvedValueOnce(
      data({ users: [{ role: "IT_STAFF", active: 3, inactive: 1, drillDown: "/admin/users?role=IT_STAFF" }] }),
    );
    render(<StaffDashboard userName="John Smith" onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /IT Staff: 3 active, 1 inactive/i })).toBeInTheDocument();
  });

  it("UI-02 shows a loading state, then a safe error with Retry", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStaffDashboard).mockRejectedValueOnce({ status: 500 }).mockResolvedValueOnce(data());
    render(<StaffDashboard userName="Kevin Patel" onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);
    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your dashboard/i);
    expect(alert).not.toHaveTextContent(/500|error code|stack/i);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Unassigned: 4. View list" })).toBeInTheDocument();
  });

  it("UI-02 shows a forbidden message on 403", async () => {
    vi.mocked(api.getStaffDashboard).mockRejectedValueOnce({ status: 403 });
    render(<StaffDashboard userName="Kevin Patel" onDrillDown={vi.fn()} onOpenTicket={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have access/i);
  });
});
