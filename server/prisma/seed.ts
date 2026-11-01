import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";

// Local development only — never use these passwords in production.
const SEED_PASSWORD = "Password123!";

async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

async function main() {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(SEED_PASSWORD);

  // --- Categories & Related Systems (unchanged from Lab 2) ---
  const categories = ["Account and Access", "Hardware", "Software", "Network"];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Categories seeded successfully.");

  const relatedSystems = [
    "Email", "Campus Wi-Fi", "VPN", "LEB2 App",
    "Grade Submission App", "Printer", "Corporate Laptop",
  ];
  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Related Systems seeded successfully.");

  // --- Development Requesters (Lab 2 regression: GET /api/dev-requesters) ---
  const devRequesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true },
    { name: "David Lee", email: "david.lee@example.com", isActive: true },
    { name: "Robert Smith", email: "robert.smith@example.com", isActive: false },
  ];
  for (const d of devRequesters) {
    await prisma.devRequester.upsert({ where: { email: d.email }, update: {}, create: d });
  }
  console.log("Development Requesters seeded successfully.");

  // --- Users: Requesters, IT Staff, Administrator (Lab 3) ---
  const users = [
    // Requesters: 4 active + 1 inactive
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "David Lee", email: "david.lee@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Robert Smith", email: "robert.smith@example.com", role: "REQUESTER" as const, isActive: false },

    // IT Staff: 3 active + 1 inactive
    { name: "Kevin Patel", email: "kevin.patel@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Emily Davis", email: "emily.davis@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Lisa Martinez", email: "lisa.martinez@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Amanda Clark", email: "amanda.clark@example.com", role: "IT_STAFF" as const, isActive: false },

    // Administrator: 1 active
    { name: "John Smith", email: "john.smith@example.com", role: "ADMINISTRATOR" as const, isActive: true },

    // Lab 4 — active Requester with zero Tickets (empty dashboard, AC-16).
    // Appended at the end so the ids of earlier users never change.
    { name: "Nina Wong", email: "nina.wong@example.com", role: "REQUESTER" as const, isActive: true },
  ];

  const createdUsers: Record<string, { id: number }> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        passwordHash,
        mustChangePassword: false, // seeded users can log in directly for testing
      },
    });
    createdUsers[u.email] = { id: user.id };
  }
  console.log("Users seeded successfully.");

  // --- Tickets: realistic distribution across statuses/priorities/ownership ---
  const category = await prisma.category.findUniqueOrThrow({ where: { name: "Hardware" } });
  const categorySoftware = await prisma.category.findUniqueOrThrow({ where: { name: "Software" } });
  const categoryNetwork = await prisma.category.findUniqueOrThrow({ where: { name: "Network" } });
  const laptop = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Corporate Laptop" } });
  const vpn = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "VPN" } });
  const email = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } });

  const tickets = [
    {
      ticketNumber: "TKT-2026-000001",
      requesterEmail: "jennifer.anderson@example.com",
      ownerEmail: "kevin.patel@example.com",
      categoryId: category.id,
      relatedSystemId: laptop.id,
      summary: "Laptop battery drains quickly",
      description: "Battery drains much faster than usual, even when idle.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "IN_PROGRESS" as const,
    },
    {
      ticketNumber: "TKT-2026-000002",
      requesterEmail: "michael.brown@example.com",
      ownerEmail: "emily.davis@example.com",
      categoryId: categoryNetwork.id,
      relatedSystemId: vpn.id,
      summary: "Cannot connect to VPN",
      description: "VPN client fails to connect from home network.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      currentStatus: "OPEN" as const,
    },
    {
      ticketNumber: "TKT-2026-000003",
      requesterEmail: "sarah.johnson@example.com",
      ownerEmail: null,
      categoryId: categorySoftware.id,
      relatedSystemId: email.id,
      summary: "Email not syncing on mobile",
      description: "Emails received on desktop do not appear on the phone app.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      currentStatus: "NEW" as const,
    },
    {
      ticketNumber: "TKT-2026-000004",
      requesterEmail: "david.lee@example.com",
      ownerEmail: "lisa.martinez@example.com",
      categoryId: category.id,
      relatedSystemId: laptop.id,
      summary: "Docking station not detected",
      description: "External monitors do not turn on when docking the laptop.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "RESOLVED" as const,
    },

    // --- Lab 4: cover every status, every IT Priority, assigned and unassigned ---
    // Numbers 9000xx are reserved for seed data so they never collide with
    // tickets created through the API (which uses TKT-2026-<count + 1>).
    {
      ticketNumber: "TKT-2026-900005",
      requesterEmail: "jennifer.anderson@example.com",
      ownerEmail: "kevin.patel@example.com",
      categoryId: categorySoftware.id,
      relatedSystemId: email.id,
      summary: "Outlook freezing intermittently",
      description: "Outlook stops responding several times a day when opening attachments.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      currentStatus: "WAITING_FOR_REQUESTER" as const,
    },
    {
      ticketNumber: "TKT-2026-900006",
      requesterEmail: "michael.brown@example.com",
      ownerEmail: "emily.davis@example.com",
      categoryId: category.id,
      relatedSystemId: laptop.id,
      summary: "Keyboard keys sticking",
      description: "Several keys on the laptop keyboard stick after pressing.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      currentStatus: "CLOSED" as const,
    },
    {
      ticketNumber: "TKT-2026-900007",
      requesterEmail: "sarah.johnson@example.com",
      ownerEmail: "kevin.patel@example.com",
      categoryId: categoryNetwork.id,
      relatedSystemId: vpn.id,
      summary: "VPN disconnects randomly",
      description: "The VPN connection drops every 20-30 minutes. It was fixed once but came back.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      currentStatus: "REOPENED" as const,
    },
    {
      ticketNumber: "TKT-2026-900008",
      requesterEmail: "david.lee@example.com",
      ownerEmail: null,
      categoryId: categorySoftware.id,
      relatedSystemId: email.id,
      summary: "Request shared mailbox access",
      description: "Need access to the department shared mailbox. No longer needed.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      currentStatus: "CANCELLED" as const,
    },
    {
      ticketNumber: "TKT-2026-900009",
      requesterEmail: "jennifer.anderson@example.com",
      ownerEmail: null,
      categoryId: categoryNetwork.id,
      relatedSystemId: vpn.id,
      summary: "Cannot access grade submission from campus",
      description: "Grade submission page times out from the campus network before the deadline.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      currentStatus: "NEW" as const,
    },
    {
      ticketNumber: "TKT-2026-900010",
      requesterEmail: "michael.brown@example.com",
      ownerEmail: "lisa.martinez@example.com",
      categoryId: category.id,
      relatedSystemId: laptop.id,
      summary: "Printer queue stuck",
      description: "Print jobs stay in the queue and never reach the printer.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "IN_PROGRESS" as const,
    },
  ];

  const createdTickets: Record<string, { id: number }> = {};
  for (const t of tickets) {
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: {},
      create: {
        ticketNumber: t.ticketNumber,
        requesterId: createdUsers[t.requesterEmail].id,
        ownerId: t.ownerEmail ? createdUsers[t.ownerEmail].id : null,
        categoryId: t.categoryId,
        relatedSystemId: t.relatedSystemId,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        currentStatus: t.currentStatus,
        // Lab 4 — keep timestamps consistent with the status (BR-18).
        resolvedAt: t.currentStatus === "RESOLVED" || t.currentStatus === "CLOSED" ? new Date() : null,
        closedAt: t.currentStatus === "CLOSED" ? new Date() : null,
      },
    });
    createdTickets[t.ticketNumber] = { id: ticket.id };
  }
  console.log("Tickets seeded successfully.");

  // --- Example Public Comments & Internal Notes ---
  const firstTicketId = createdTickets["TKT-2026-000001"].id;

  const existingComment = await prisma.publicComment.findFirst({
    where: { ticketId: firstTicketId },
  });
  if (!existingComment) {
    await prisma.publicComment.create({
      data: {
        ticketId: firstTicketId,
        authorId: createdUsers["kevin.patel@example.com"].id,
        content: "We are investigating the issue on your device. We'll update you shortly.",
      },
    });
    await prisma.publicComment.create({
      data: {
        ticketId: firstTicketId,
        authorId: createdUsers["jennifer.anderson@example.com"].id,
        content: "Thank you for the update. Please let me know if you need any additional information.",
      },
    });
  }

  const existingNote = await prisma.internalNote.findFirst({
    where: { ticketId: firstTicketId },
  });
  if (!existingNote) {
    await prisma.internalNote.create({
      data: {
        ticketId: firstTicketId,
        authorId: createdUsers["kevin.patel@example.com"].id,
        content: "Checked battery health report — recommend replacement if still draining after BIOS update.",
      },
    });
  }
  console.log("Public Comments and Internal Notes seeded successfully.");

  // --- Lab 4: Actions Taken (zero, one and many per Ticket) ---
  // Idempotent: each seeded action has a fixed idempotencyKey and is created
  // only if no action with that key exists on the Ticket yet.
  type SeedAction = {
    key: string;
    description: string;
    result?: string;
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    createdBy: string;
    assignee: string;
    followUpRequired?: boolean;
    followUpNote?: string;
    attachmentNotes?: string;
  };

  const seedActions: Record<string, SeedAction[]> = {
    // Many actions, all statuses mixed, performed by different IT Staff (BR-02)
    "TKT-2026-000001": [
      {
        key: "seed-1-a1", status: "COMPLETED",
        description: "Ran battery health report and updated BIOS.",
        result: "Battery wear at 38%. BIOS updated to 1.14.",
        createdBy: "kevin.patel@example.com", assignee: "kevin.patel@example.com",
        followUpRequired: true, followUpNote: "Check drain again one week after the BIOS update.",
        attachmentNotes: "See battery-report.html in the ticket attachments.",
      },
      {
        key: "seed-1-a2", status: "IN_PROGRESS",
        description: "Order replacement battery from vendor.",
        createdBy: "kevin.patel@example.com", assignee: "emily.davis@example.com",
      },
      {
        key: "seed-1-a3", status: "PLANNED",
        description: "Install replacement battery and recalibrate.",
        createdBy: "kevin.patel@example.com", assignee: "kevin.patel@example.com",
      },
    ],
    // One action
    "TKT-2026-000004": [
      {
        key: "seed-4-a1", status: "COMPLETED",
        description: "Updated dock firmware and display drivers.",
        result: "Both external monitors detected after reboot.",
        createdBy: "lisa.martinez@example.com", assignee: "lisa.martinez@example.com",
      },
    ],
    "TKT-2026-900005": [
      {
        key: "seed-900005-a1", status: "IN_PROGRESS",
        description: "Repair Office installation and clear Outlook cache.",
        createdBy: "kevin.patel@example.com", assignee: "kevin.patel@example.com",
      },
    ],
    "TKT-2026-900006": [
      {
        key: "seed-900006-a1", status: "CANCELLED",
        description: "Replace full keyboard assembly.",
        createdBy: "emily.davis@example.com", assignee: "emily.davis@example.com",
      },
      {
        key: "seed-900006-a2", status: "COMPLETED",
        description: "Cleaned keyboard with compressed air.",
        result: "All keys respond normally.",
        createdBy: "emily.davis@example.com", assignee: "emily.davis@example.com",
      },
    ],
    "TKT-2026-900007": [
      {
        key: "seed-900007-a1", status: "COMPLETED",
        description: "Reinstalled VPN client and reset network adapter.",
        result: "Connection stable for 2 hours during test.",
        createdBy: "kevin.patel@example.com", assignee: "lisa.martinez@example.com",
        followUpRequired: true, followUpNote: "Requester reported drops again; check router MTU settings.",
      },
      {
        key: "seed-900007-a2", status: "PLANNED",
        description: "Test VPN with reduced MTU on the requester's home router.",
        createdBy: "kevin.patel@example.com", assignee: "kevin.patel@example.com",
      },
    ],
  };

  // Remove seed actions from earlier seed versions (keys no longer in use),
  // so re-running the seed always converges to the same data.
  const validKeys = Object.values(seedActions).flat().map((a) => a.key);
  await prisma.actionTaken.deleteMany({
    where: { idempotencyKey: { startsWith: "seed-", notIn: validKeys } },
  });

  for (const [ticketNumber, actions] of Object.entries(seedActions)) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber } });
    for (const [index, a] of actions.entries()) {
      const exists = await prisma.actionTaken.findFirst({
        where: { ticketId: ticket.id, idempotencyKey: a.key },
      });
      if (exists) continue;

      await prisma.actionTaken.create({
        data: {
          ticketId: ticket.id,
          // Stable order, never before the Ticket was created (BR-09).
          actionAt: new Date(ticket.createdAt.getTime() + (index + 1) * 10_000),
          description: a.description,
          result: a.result ?? null,
          status: a.status,
          followUpRequired: a.followUpRequired ?? false,
          followUpNote: a.followUpRequired ? a.followUpNote ?? null : null,
          attachmentNotes: a.attachmentNotes ?? null,
          createdById: createdUsers[a.createdBy].id,
          assigneeId: createdUsers[a.assignee].id,
          performedById: a.status === "COMPLETED" ? createdUsers[a.assignee].id : null,
          idempotencyKey: a.key,
        },
      });
    }
  }
  console.log("Actions Taken seeded successfully.");

  console.log("\n--- Seeded credentials (local development only) ---");
  console.log(`Password for all seeded users: ${SEED_PASSWORD}`);
  console.log("Requester: jennifer.anderson@example.com");
  console.log("IT Staff: kevin.patel@example.com");
  console.log("Administrator: john.smith@example.com");
  console.log("Requester with no tickets (empty dashboard): nina.wong@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });