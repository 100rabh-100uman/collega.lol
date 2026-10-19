/**
 * COLLEGA.LOL — Optional Development Multi-Shop Seed Script
 *
 * Deterministically creates or removes a second fictional shop for local development
 * and multi-shop testing:
 * - Campus: Apex Institute of Technology — North Campus (apex-north)
 * - Second Shop: The Daily Grind & Bakery (concourse-bakery)
 * - Categories: Artisan Bakery, Specialty Coffee
 * - Sample Products: Almond Butter Croissant, Blueberry Crumble Muffin, Nitro Cold Brew
 *
 * SAFETY & IDEMPOTENCY:
 * - Strictly verifies non-production development target.
 * - Deterministic UUIDs and upsert operations.
 * - Does not create fake users, orders, or real transactions.
 * - Does not modify or impact production Supabase.
 * - Can be safely reversed anytime via: npm run seed:reset-baseline
 */

try {
  process.loadEnvFile?.(".env");
} catch {}

import { PrismaClient, Prisma } from "@prisma/client";
import { checkDatabaseReadiness } from "../src/core/config/env";
import { SEED_CAMPUS_ID } from "../prisma/seed";

const prisma = new PrismaClient();

// Deterministic RFC 4122 UUID v4 Identifiers for the 2nd Development Shop
export const DEMO_SECOND_SHOP_ID = "00000002-0000-4000-8000-000000000002";
export const DEMO_CATEGORY_BAKERY_ID = "00000003-0000-4000-8000-000000000004";
export const DEMO_CATEGORY_COFFEE_ID = "00000003-0000-4000-8000-000000000005";

export const DEMO_PRODUCT_CROISSANT_ID = "00000004-0000-4000-8000-000000000005";
export const DEMO_PRODUCT_MUFFIN_ID = "00000004-0000-4000-8000-000000000006";
export const DEMO_PRODUCT_COLD_BREW_ID = "00000004-0000-4000-8000-000000000007";

function assertDevelopmentTarget(): void {
  const dbReadiness = checkDatabaseReadiness();

  if (!dbReadiness.isConfigured || dbReadiness.isPlaceholder) {
    throw new Error(
      `[Safety Guard] Seed execution aborted: ${dbReadiness.message}`
    );
  }

  const dbUrl = process.env.DATABASE_URL || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  if (
    process.env.NODE_ENV === "production" ||
    dbUrl.toLowerCase().includes("collega.lol") ||
    appUrl.toLowerCase().includes("collega.lol")
  ) {
    throw new Error(
      "[Safety Guard] Seed execution aborted: Production environment detected. Multi-shop demo seeding is strictly forbidden in production."
    );
  }

  console.log("✔ [Safety Guard] Verified non-production development target (collega-dev).");
}

export async function seedDemoShop() {
  assertDevelopmentTarget();

  console.log("🌱 Seeding 2nd development shop (The Daily Grind & Bakery)...");

  // Verify campus exists
  const campus = await prisma.campus.findUnique({
    where: { id: SEED_CAMPUS_ID },
  });

  if (!campus) {
    throw new Error(
      `[Error] Target campus ${SEED_CAMPUS_ID} not found. Please run 'npm run db:seed' first.`
    );
  }

  // Upsert 2nd Shop
  const shop = await prisma.shop.upsert({
    where: {
      campusId_slug: {
        campusId: campus.id,
        slug: "concourse-bakery",
      },
    },
    update: {
      name: "The Daily Grind & Bakery",
      description: "Artisan pastries, bagels, espresso drinks, and fresh cold brews at the North Concourse.",
      location: "Student Union Building, 2nd Floor Mezzanine",
      isOpen: true,
      autoAcceptOrders: false,
    },
    create: {
      id: DEMO_SECOND_SHOP_ID,
      campusId: campus.id,
      slug: "concourse-bakery",
      name: "The Daily Grind & Bakery",
      description: "Artisan pastries, bagels, espresso drinks, and fresh cold brews at the North Concourse.",
      location: "Student Union Building, 2nd Floor Mezzanine",
      isOpen: true,
      autoAcceptOrders: false,
    },
  });
  console.log(`  ✔ Shop: ${shop.name} (${shop.slug}) [ID: ${shop.id}]`);

  // Upsert Categories
  const categoryBakery = await prisma.category.upsert({
    where: {
      shopId_slug: {
        shopId: shop.id,
        slug: "artisan-bakery",
      },
    },
    update: {
      name: "Artisan Bakery",
      sortOrder: 1,
      isAvailable: true,
    },
    create: {
      id: DEMO_CATEGORY_BAKERY_ID,
      shopId: shop.id,
      slug: "artisan-bakery",
      name: "Artisan Bakery",
      sortOrder: 1,
      isAvailable: true,
    },
  });

  const categoryCoffee = await prisma.category.upsert({
    where: {
      shopId_slug: {
        shopId: shop.id,
        slug: "specialty-coffee",
      },
    },
    update: {
      name: "Specialty Coffee",
      sortOrder: 2,
      isAvailable: true,
    },
    create: {
      id: DEMO_CATEGORY_COFFEE_ID,
      shopId: shop.id,
      slug: "specialty-coffee",
      name: "Specialty Coffee",
      sortOrder: 2,
      isAvailable: true,
    },
  });
  console.log(`  ✔ Categories: ${categoryBakery.name}, ${categoryCoffee.name}`);

  // Upsert Products
  const p1 = await prisma.product.upsert({
    where: { id: DEMO_PRODUCT_CROISSANT_ID },
    update: {
      name: "Almond Butter Croissant",
      description: "Flaky French butter croissant filled with frangipane almond cream and toasted sliced almonds.",
      price: new Prisma.Decimal("120.00"),
      preparationTimeMins: 5,
      isAvailable: true,
      categoryId: categoryBakery.id,
      shopId: shop.id,
    },
    create: {
      id: DEMO_PRODUCT_CROISSANT_ID,
      shopId: shop.id,
      categoryId: categoryBakery.id,
      name: "Almond Butter Croissant",
      description: "Flaky French butter croissant filled with frangipane almond cream and toasted sliced almonds.",
      price: new Prisma.Decimal("120.00"),
      preparationTimeMins: 5,
      isAvailable: true,
    },
  });

  const p2 = await prisma.product.upsert({
    where: { id: DEMO_PRODUCT_MUFFIN_ID },
    update: {
      name: "Blueberry Crumble Muffin",
      description: "Moist whole-berry muffin with sweet cinnamon oat crumble topping.",
      price: new Prisma.Decimal("85.00"),
      preparationTimeMins: 3,
      isAvailable: true,
      categoryId: categoryBakery.id,
      shopId: shop.id,
    },
    create: {
      id: DEMO_PRODUCT_MUFFIN_ID,
      shopId: shop.id,
      categoryId: categoryBakery.id,
      name: "Blueberry Crumble Muffin",
      description: "Moist whole-berry muffin with sweet cinnamon oat crumble topping.",
      price: new Prisma.Decimal("85.00"),
      preparationTimeMins: 3,
      isAvailable: true,
    },
  });

  const p3 = await prisma.product.upsert({
    where: { id: DEMO_PRODUCT_COLD_BREW_ID },
    update: {
      name: "Nitro Cold Brew",
      description: "Slow-steeped craft cold brew infused with nitrogen for a velvety smooth crema.",
      price: new Prisma.Decimal("95.00"),
      preparationTimeMins: 3,
      isAvailable: true,
      categoryId: categoryCoffee.id,
      shopId: shop.id,
    },
    create: {
      id: DEMO_PRODUCT_COLD_BREW_ID,
      shopId: shop.id,
      categoryId: categoryCoffee.id,
      name: "Nitro Cold Brew",
      description: "Slow-steeped craft cold brew infused with nitrogen for a velvety smooth crema.",
      price: new Prisma.Decimal("95.00"),
      preparationTimeMins: 3,
      isAvailable: true,
    },
  });

  console.log(`  ✔ Products: ${p1.name} (₹${p1.price}), ${p2.name} (₹${p2.price}), ${p3.name} (₹${p3.price})`);
  console.log("\n🎉 Second development shop is now active on campus!");
  console.log("   Visit /shop to see both campus shops, or /order?shopId=" + shop.id);
  console.log("   To restore the 1-shop canonical baseline: npm run seed:reset-baseline\n");
}

export async function removeDemoShop() {
  assertDevelopmentTarget();
  console.log("🧹 Removing 2nd development demo shop...");

  const demoProductIds = [
    DEMO_PRODUCT_CROISSANT_ID,
    DEMO_PRODUCT_MUFFIN_ID,
    DEMO_PRODUCT_COLD_BREW_ID,
  ];
  const demoCategoryIds = [DEMO_CATEGORY_BAKERY_ID, DEMO_CATEGORY_COFFEE_ID];

  await prisma.orderItem.deleteMany({
    where: { productId: { in: demoProductIds } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: demoProductIds } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: demoCategoryIds } },
  });
  await prisma.shop.deleteMany({
    where: { id: DEMO_SECOND_SHOP_ID },
  });

  console.log("✔ 2nd development shop removed. Pristine baseline restored.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--remove") || args.includes("--clean")) {
    await removeDemoShop();
  } else {
    await seedDemoShop();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-demo-shop")) {
  main()
    .catch((err) => {
      console.error("[Demo Seed Error]:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
