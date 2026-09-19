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

  console.log("\n--- Seeded credentials (local development only) ---");
  console.log(`Password for all seeded users: ${SEED_PASSWORD}`);
  console.log("Requester: jennifer.anderson@example.com");
  console.log("IT Staff: kevin.patel@example.com");
  console.log("Administrator: john.smith@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });