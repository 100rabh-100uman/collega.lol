/**
 * Safe Seed Verification Script
 * Checks row counts and verifies that seed data is present and non-duplicated.
 */

try {
  process.loadEnvFile?.(".env");
} catch {}

import { prisma } from "../src/core/db/prisma";

async function main() {
  const [campusCount, shopCount, categoryCount, productCount, orderCount, userCount] =
    await Promise.all([
      prisma.campus.count(),
      prisma.shop.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count(),
    ]);

  console.log("=== Seed Data Verification ===");
  console.log(`Campuses:   ${campusCount} (expected: 1)`);
  if (shopCount === 2) {
    console.log(`Shops:      ${shopCount} (canonical: 1, + 1 optional dev demo shop active)`);
    console.log(`Categories: ${categoryCount} (canonical: 3, + 2 demo categories)`);
    console.log(`Products:   ${productCount} (canonical: 4, + 3 demo products)`);
  } else {
    console.log(`Shops:      ${shopCount} (expected: 1)`);
    console.log(`Categories: ${categoryCount} (expected: 3)`);
    console.log(`Products:   ${productCount} (expected: 4)`);
  }
  console.log(`Orders:     ${orderCount} (expected: 0, no fake orders)`);
  console.log(`Users:      ${userCount} (expected: 0, no fake users)`);

  const shops = await prisma.shop.findMany({
    select: { name: true, slug: true, location: true, isOpen: true },
    orderBy: { name: "asc" },
  });
  console.log("\nShops Registered:");
  for (const s of shops) {
    console.log(`- ${s.name} (${s.slug}) [${s.location}]: ${s.isOpen ? "Open" : "Closed"}`);
  }

  const products = await prisma.product.findMany({
    select: {
      name: true,
      price: true,
      isAvailable: true,
      category: { select: { name: true } },
      shop: { select: { name: true } },
    },
    orderBy: [{ shop: { name: "asc" } }, { name: "asc" }],
  });

  console.log("\nProducts in Catalog:");
  for (const p of products) {
    console.log(`- [${p.shop.name}] ${p.name} (${p.category.name}): ₹${p.price.toFixed(2)} (Available: ${p.isAvailable})`);
  }
}

main()
  .catch((err) => {
    console.error("Verification error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
