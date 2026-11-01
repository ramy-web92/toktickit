// Lab 1 App tests, updated in Lab 4 (final regression).
// The original tests targeted the Lab 1 "Check System" page, which was replaced by
// login and role-based screens in Labs 3–4. These tests cover the current shell.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

vi.mock("../../src/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api.js")>();
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    getRequesterDashboard: vi.fn(),
    getStaffDashboard: vi.fn(),
    getStaffTickets: vi.fn(),
  };
});
import * as api from "../../src/api.js";

const user = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", name = "Test User") =>
  ({ id: 1, name, email: "test@example.com", role, mustChangePassword: false }) as any;

const staffDashboard = {
  generatedAt: "2026-10-20T03:00:00.000Z",
  timeZone: "Asia/Bangkok",
  metrics: [{ id: "ST-M1", label: "Unassigned", value: 2, drillDown: "/queue?owner=unassigned&status=active" }],
  byStatus: [],
  byPriority: [],
  recentlyUpdated: [],
  urgent: [],
};

beforeEach(() => {
  vi.mocked(api.getCurrentUser).mockReset();
  vi.mocked(api.getRequesterDashboard).mockReset().mockResolvedValue({
    generatedAt: "2026-10-20T03:00:00.000Z", timeZone: "Asia/Bangkok", metrics: [], recentlyUpdated: [], recentlyResolved: [],
  });
  vi.mocked(api.getStaffDashboard).mockReset().mockResolvedValue(staffDashboard);
  vi.mocked(api.getStaffTickets).mockReset().mockResolvedValue({
    data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  });
  // Categories are loaded with fetch directly by App.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
});

describe("App", () => {
  it("renders the TokTickIT login screen when not signed in", async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValueOnce({ status: 401 });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByText("TokTickIT")).toBeInTheDocument();
  });

  it("lands a Requester on the Dashboard with Requester navigation", async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(user("REQUESTER", "Jennifer Anderson"));
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Main" });
    const items = within(nav).getAllByRole("button").map((b) => b.textContent);
    expect(items).toEqual(["Dashboard", "My Tickets", "Create Ticket"]);
    expect(within(nav).getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("Welcome, Jennifer!")).toBeInTheDocument();
  });

  it("gives IT Staff a Dashboard and a Ticket Queue, but no Users page", async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(user("IT_STAFF", "Kevin Patel"));
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Dashboard", "Ticket Queue"]);
    expect(await screen.findByText("Welcome back, Kevin!")).toBeInTheDocument();
  });

  it("gives Administrators the Users page too", async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(user("ADMINISTRATOR", "John Smith"));
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Dashboard", "Ticket Queue", "Users"]);
  });

  it("drills down from a dashboard card to the filtered Ticket Queue", async () => {
    const u = userEvent.setup();
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(user("IT_STAFF", "Kevin Patel"));
    render(<App />);
    await u.click(await screen.findByRole("button", { name: "Unassigned: 2. View list" }));

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(api.getStaffTickets).toHaveBeenCalledWith(expect.objectContaining({ owner: "unassigned", status: "active" }));
  });
});
