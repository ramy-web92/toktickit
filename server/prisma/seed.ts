import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

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

  const devRequesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true },
    { name: "David Lee", email: "david.lee@example.com", isActive: true },
    { name: "Robert Smith", email: "robert.smith@example.com", isActive: false },
  ];
  for (const requester of devRequesters) {
    await prisma.devRequester.upsert({
      where: { email: requester.email },
      update: {},
      create: requester,
    });
  }
  console.log("Development Requesters seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });