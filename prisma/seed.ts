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

  // Always refresh pinHash on re-seed so a partial test-DB pollution
  // (e.g. a prior test wrote a junk hash at this phone) gets corrected.
  const owner = await prisma.user.upsert({
    where: { phone: ownerPhone },
    update: { name: ownerName, pinHash },
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

  // ----- Product categories -----
  // Seeds a starter set of beverage-shop categories with sensible
  // emoji icons. Owners can edit or add more in /categories.
  const productCategories = [
    { name: "Water",   slug: "water",   iconEmoji: "💧", sortOrder: 1 },
    { name: "Beer",    slug: "beer",    iconEmoji: "🍺", sortOrder: 2 },
    { name: "Soda",    slug: "soda",    iconEmoji: "🥤", sortOrder: 3 },
    { name: "Juice",   slug: "juice",   iconEmoji: "🧃", sortOrder: 4 },
    { name: "Spirits", slug: "spirits", iconEmoji: "🥃", sortOrder: 5 },
    { name: "Wine",    slug: "wine",    iconEmoji: "🍷", sortOrder: 6 },
    { name: "Snacks",  slug: "snacks",  iconEmoji: "🍿", sortOrder: 7 },
    { name: "Other",   slug: "other",   iconEmoji: "📦", sortOrder: 99 },
  ];
  for (const cat of productCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { iconEmoji: cat.iconEmoji, sortOrder: cat.sortOrder },
      create: cat,
    });
  }
  console.log(`  Product categories: ${productCategories.length} seeded`);

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
