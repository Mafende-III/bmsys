import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ----- Owner user -----
  // Default PIN: 1234 (CHANGE ON FIRST LOGIN)
  const ownerPhone = process.env.OWNER_PHONE ?? "+250788000000";
  const ownerName  = process.env.OWNER_NAME  ?? "Owner";
  const ownerPin   = process.env.OWNER_PIN   ?? "1234";
  const pinHash = await argon2.hash(ownerPin);

  const owner = await prisma.user.upsert({
    where: { phone: ownerPhone },
    update: {},
    create: {
      name: ownerName,
      phone: ownerPhone,
      pinHash,
      role: "OWNER",
    },
  });
  console.log(`  Owner user: ${owner.phone}`);

  // ----- Channels -----
  const channels = [
    { name: "Retail",    slug: "retail" },
    { name: "Wholesale", slug: "wholesale" },
    { name: "Delivery",  slug: "delivery" },
    { name: "Online",    slug: "online" },
  ];
  for (const c of channels) {
    await prisma.channel.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }
  console.log(`  Channels: ${channels.map((c) => c.slug).join(", ")}`);

  // ----- Expense categories -----
  const categories = [
    { name: "Rent",       slug: "rent" },
    { name: "Salaries",   slug: "salaries" },
    { name: "Utilities",  slug: "utilities" },
    { name: "Transport",  slug: "transport" },
    { name: "Supplies",   slug: "supplies" },
    { name: "Marketing",  slug: "marketing" },
    { name: "Other",      slug: "other" },
  ];
  for (const cat of categories) {
    await prisma.expenseCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`  Expense categories: ${categories.length} seeded`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
