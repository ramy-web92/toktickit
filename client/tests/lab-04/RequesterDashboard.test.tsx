// Lab 4 — UI-03, UI-04 (docs/lab-04/tests.md). The API module is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterDashboard } from "../../src/Dashboards.js";
import type { RequesterDashboardData } from "../../src/api.js";

vi.mock("../../src/api.js", () => ({
  getStaffDashboard: vi.fn(),
  getRequesterDashboard: vi.fn(),
}));
import * as api from "../../src/api.js";

function metrics(values: [number, number, number, number]) {
  return [
    { id: "RQ-M1", label: "My Open Tickets", value: values[0], drillDown: "/my-tickets?currentStatus=active" },
    { id: "RQ-M2", label: "Waiting for Me", value: values[1], drillDown: "/my-tickets?currentStatus=WAITING_FOR_REQUESTER" },
    { id: "RQ-M3", label: "Resolved", value: values[2], drillDown: "/my-tickets?currentStatus=RESOLVED" },
    { id: "RQ-M4", label: "Closed", value: values[3], drillDown: "/my-tickets?currentStatus=CLOSED" },
  ];
}

function data(over: Partial<RequesterDashboardData> = {}): RequesterDashboardData {
  return {
    generatedAt: "2026-10-20T03:00:00.000Z",
    timeZone: "Asia/Bangkok",
    metrics: metrics([3, 1, 5, 12]),
    recentlyUpdated: [
      { id: 1, ticketNumber: "TKT-2026-000001", summary: "Laptop battery drains quickly", currentStatus: "IN_PROGRESS", itPriority: "MEDIUM", updatedAt: "2026-10-20T03:00:00.000Z", resolvedAt: null, requesterMarkedResolved: false },
    ],
    recentlyResolved: [
      { id: 4, ticketNumber: "TKT-2026-000004", summary: "Monitor not detected", currentStatus: "RESOLVED", itPriority: "LOW", updatedAt: "2026-10-19T03:00:00.000Z", resolvedAt: "2026-10-19T03:00:00.000Z", requesterMarkedResolved: false },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(api.getRequesterDashboard).mockReset();
});

describe("RequesterDashboard", () => {
  it("UI-03 renders the four metrics, recent and resolved lists", async () => {
    vi.mocked(api.getRequesterDashboard).mockResolvedValueOnce(data());
    render(<RequesterDashboard userName="Jennifer Anderson" onDrillDown={vi.fn()} onOpenTicket={vi.fn()} onCreateTicket={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "My Open Tickets: 3. View list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting for Me: 1. View list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolved: 5. View list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Closed: 12. View list" })).toBeInTheDocument();
    expect(screen.getByText("Welcome, Jennifer!")).toBeInTheDocument();
    expect(screen.getByText("Laptop battery drains quickly")).toBeInTheDocument();
    expect(screen.getByText("Monitor not detected")).toBeInTheDocument();
  });

  it("UI-03 drill-down and quick actions", async () => {
    const user = userEvent.setup();
    const onDrillDown = vi.fn();
    const onCreateTicket = vi.fn();
    const onOpenTicket = vi.fn();
    vi.mocked(api.getRequesterDashboard).mockResolvedValueOnce(data());
    render(<RequesterDashboard userName="Jennifer Anderson" onDrillDown={onDrillDown} onOpenTicket={onOpenTicket} onCreateTicket={onCreateTicket} />);

    await user.click(await screen.findByRole("button", { name: "Waiting for Me: 1. View list" }));
    expect(onDrillDown).toHaveBeenLastCalledWith("/my-tickets?currentStatus=WAITING_FOR_REQUESTER");

    await user.click(screen.getByRole("button", { name: "+ Create Ticket" }));
    expect(onCreateTicket).toHaveBeenCalled();

    await user.click(screen.getByText("Laptop battery drains quickly"));
    expect(onOpenTicket).toHaveBeenCalledWith(1);
  });

  it("UI-04 a Requester with no tickets sees zeros, empty states and Create Ticket (AC-16)", async () => {
    vi.mocked(api.getRequesterDashboard).mockResolvedValueOnce(
      data({ metrics: metrics([0, 0, 0, 0]), recentlyUpdated: [], recentlyResolved: [] }),
    );
    render(<RequesterDashboard userName="Nina Wong" onDrillDown={vi.fn()} onOpenTicket={vi.fn()} onCreateTicket={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "My Open Tickets: 0. View list" })).toBeInTheDocument();
    expect(screen.getByText("You haven't submitted any tickets yet.")).toBeInTheDocument();
    expect(screen.getByText("Nothing resolved in the last 7 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Create Ticket" })).toBeInTheDocument();
  });

  it("keyboard users can reach and activate a metric card", async () => {
    const user = userEvent.setup();
    const onDrillDown = vi.fn();
    vi.mocked(api.getRequesterDashboard).mockResolvedValueOnce(data());
    render(<RequesterDashboard userName="Jennifer Anderson" onDrillDown={onDrillDown} onOpenTicket={vi.fn()} onCreateTicket={vi.fn()} />);
    await screen.findByRole("button", { name: "My Open Tickets: 3. View list" });
    await user.tab();
    expect(screen.getByRole("button", { name: "My Open Tickets: 3. View list" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onDrillDown).toHaveBeenCalledWith("/my-tickets?currentStatus=active");
  });
});
