/**
 * COLLEGA.LOL — Fictional Development Seed Script (Stage 3)
 *
 * Seeds baseline development catalog data for the Smart Ordering MVP:
 * - Campus: Apex Institute of Technology — North Campus (apex-north)
 * - Shop: The Campus Quad Bistro (quad-bistro)
 * - Categories: Hot Meals, Quick Bites, Beverages
 * - Sample Products: Veggie Wrap, Classic Burger, Masala Fries, Iced Tea
 *
 * SAFETY & IDEMPOTENCY:
 * - Strictly verifies non-production environment before any DB write.
 * - Uses deterministic UUIDs and upsert operations.
 * - Zero deletions: repeated runs never delete or duplicate rows.
 * - Never creates fake users, orders, or payment records.
 * - Never logs credentials, connection strings, or secret keys.
 */

try {
  process.loadEnvFile?.(".env");
} catch {
  // If .env is already loaded or absent, proceed gracefully
}

import { PrismaClient, Prisma } from "@prisma/client";
import { checkDatabaseReadiness } from "../src/core/config/env";

const prisma = new PrismaClient();

// Deterministic RFC 4122 UUID v4 Identifiers for Seed Entities
export const SEED_CAMPUS_ID = "00000001-0000-4000-8000-000000000001";
export const SEED_SHOP_ID = "00000002-0000-4000-8000-000000000001";

export const SEED_CATEGORY_HOT_MEALS_ID = "00000003-0000-4000-8000-000000000001";
export const SEED_CATEGORY_QUICK_BITES_ID = "00000003-0000-4000-8000-000000000002";
export const SEED_CATEGORY_BEVERAGES_ID = "00000003-0000-4000-8000-000000000003";

export const SEED_PRODUCT_VEGGIE_WRAP_ID = "00000004-0000-4000-8000-000000000001";
export const SEED_PRODUCT_CLASSIC_BURGER_ID = "00000004-0000-4000-8000-000000000002";
export const SEED_PRODUCT_MASALA_FRIES_ID = "00000004-0000-4000-8000-000000000003";
export const SEED_PRODUCT_ICED_TEA_ID = "00000004-0000-4000-8000-000000000004";

/**
 * Pre-flight safety check: verifies that the target is strictly development
 * and fails closed if anything indicates a production or placeholder environment.
 */
function assertDevelopmentTarget(): void {
  const dbReadiness = checkDatabaseReadiness();

  if (!dbReadiness.isConfigured || dbReadiness.isPlaceholder) {
    throw new Error(
      `[Safety Guard] Seed execution aborted: ${dbReadiness.message}`
    );
  }

  const dbUrl = process.env.DATABASE_URL || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  // Fail closed on any production indicator
  if (
    process.env.NODE_ENV === "production" ||
    dbUrl.toLowerCase().includes("collega.lol") ||
    appUrl.toLowerCase().includes("collega.lol")
  ) {
    throw new Error(
      "[Safety Guard] Seed execution aborted: Production environment detected. Seeding is strictly forbidden in production."
    );
  }

  console.log("✔ [Safety Guard] Verified non-production development target (collega-dev).");
}

export async function seed(): Promise<{
  campus: { id: string; name: string };
  shop: { id: string; name: string };
  categoriesCount: number;
  productsCount: number;
}> {
  assertDevelopmentTarget();

  console.log("🌱 Executing idempotent seed for Smart Ordering MVP...");

  // 1. Campus: Apex Institute of Technology — North Campus
  const campus = await prisma.campus.upsert({
    where: { slug: "apex-north" },
    update: {
      name: "Apex Institute of Technology — North Campus",
      address: "North Campus Central Plaza, Academic City",
      isActive: true,
    },
    create: {
      id: SEED_CAMPUS_ID,
      slug: "apex-north",
      name: "Apex Institute of Technology — North Campus",
      address: "North Campus Central Plaza, Academic City",
      isActive: true,
    },
  });
  console.log(`  ✔ Campus: ${campus.name} (${campus.slug})`);

  // 2. Shop: The Campus Quad Bistro
  const shop = await prisma.shop.upsert({
    where: {
      campusId_slug: {
        campusId: campus.id,
        slug: "quad-bistro",
      },
    },
    update: {
      name: "The Campus Quad Bistro",
      description: "Fresh sandwiches, wraps, comfort snacks and artisan beverages at the North Quad.",
      location: "North Quad Courtyard, Ground Floor, Academic Block B",
      isOpen: true,
      autoAcceptOrders: false, // Smart Ordering MVP: manual acceptance default
    },
    create: {
      id: SEED_SHOP_ID,
      campusId: campus.id,
      slug: "quad-bistro",
      name: "The Campus Quad Bistro",
      description: "Fresh sandwiches, wraps, comfort snacks and artisan beverages at the North Quad.",
      location: "North Quad Courtyard, Ground Floor, Academic Block B",
      isOpen: true,
      autoAcceptOrders: false,
    },
  });
  console.log(`  ✔ Shop: ${shop.name} (${shop.slug}) [isOpen: ${shop.isOpen}]`);

  // 3. Categories: Hot Meals, Quick Bites, Beverages
  const categoryHotMeals = await prisma.category.upsert({
    where: {
      shopId_slug: {
        shopId: shop.id,
        slug: "hot-meals",
      },
    },
    update: {
      name: "Hot Meals",
      sortOrder: 1,
      isAvailable: true,
    },
    create: {
      id: SEED_CATEGORY_HOT_MEALS_ID,
      shopId: shop.id,
      slug: "hot-meals",
      name: "Hot Meals",
      sortOrder: 1,
      isAvailable: true,
    },
  });

  const categoryQuickBites = await prisma.category.upsert({
    where: {
      shopId_slug: {
        shopId: shop.id,
        slug: "quick-bites",
      },
    },
    update: {
      name: "Quick Bites",
      sortOrder: 2,
      isAvailable: true,
    },
    create: {
      id: SEED_CATEGORY_QUICK_BITES_ID,
      shopId: shop.id,
      slug: "quick-bites",
      name: "Quick Bites",
      sortOrder: 2,
      isAvailable: true,
    },
  });

  const categoryBeverages = await prisma.category.upsert({
    where: {
      shopId_slug: {
        shopId: shop.id,
        slug: "beverages",
      },
    },
    update: {
      name: "Beverages",
      sortOrder: 3,
      isAvailable: true,
    },
    create: {
      id: SEED_CATEGORY_BEVERAGES_ID,
      shopId: shop.id,
      slug: "beverages",
      name: "Beverages",
      sortOrder: 3,
      isAvailable: true,
    },
  });
  console.log("  ✔ Categories: Hot Meals, Quick Bites, Beverages");

  // 4. Products: Veggie Wrap, Classic Burger, Masala Fries, Iced Tea
  const productVeggieWrap = await prisma.product.upsert({
    where: { id: SEED_PRODUCT_VEGGIE_WRAP_ID },
    update: {
      shopId: shop.id,
      categoryId: categoryQuickBites.id,
      name: "Veggie Wrap",
      description: "Fresh garden veggies, crisp lettuce, and mint yogurt dressing wrapped in a whole-wheat tortilla.",
      price: new Prisma.Decimal("120.00"),
      preparationTimeMins: 8,
      sortOrder: 1,
      isAvailable: true,
    },
    create: {
      id: SEED_PRODUCT_VEGGIE_WRAP_ID,
      shopId: shop.id,
      categoryId: categoryQuickBites.id,
      name: "Veggie Wrap",
      description: "Fresh garden veggies, crisp lettuce, and mint yogurt dressing wrapped in a whole-wheat tortilla.",
      price: new Prisma.Decimal("120.00"),
      preparationTimeMins: 8,
      sortOrder: 1,
      isAvailable: true,
    },
  });

  const productClassicBurger = await prisma.product.upsert({
    where: { id: SEED_PRODUCT_CLASSIC_BURGER_ID },
    update: {
      shopId: shop.id,
      categoryId: categoryHotMeals.id,
      name: "Classic Burger",
      description: "Crispy seasoned vegetable patty with fresh tomatoes, lettuce, and signature quad sauce in a toasted sesame bun.",
      price: new Prisma.Decimal("150.00"),
      preparationTimeMins: 12,
      sortOrder: 1,
      isAvailable: true,
    },
    create: {
      id: SEED_PRODUCT_CLASSIC_BURGER_ID,
      shopId: shop.id,
      categoryId: categoryHotMeals.id,
      name: "Classic Burger",
      description: "Crispy seasoned vegetable patty with fresh tomatoes, lettuce, and signature quad sauce in a toasted sesame bun.",
      price: new Prisma.Decimal("150.00"),
      preparationTimeMins: 12,
      sortOrder: 1,
      isAvailable: true,
    },
  });

  const productMasalaFries = await prisma.product.upsert({
    where: { id: SEED_PRODUCT_MASALA_FRIES_ID },
    update: {
      shopId: shop.id,
      categoryId: categoryQuickBites.id,
      name: "Masala Fries",
      description: "Golden crisp potato fries tossed in special campus spice blend, served with tangy dip.",
      price: new Prisma.Decimal("90.00"),
      preparationTimeMins: 6,
      sortOrder: 2,
      isAvailable: true,
    },
    create: {
      id: SEED_PRODUCT_MASALA_FRIES_ID,
      shopId: shop.id,
      categoryId: categoryQuickBites.id,
      name: "Masala Fries",
      description: "Golden crisp potato fries tossed in special campus spice blend, served with tangy dip.",
      price: new Prisma.Decimal("90.00"),
      preparationTimeMins: 6,
      sortOrder: 2,
      isAvailable: true,
    },
  });

  const productIcedTea = await prisma.product.upsert({
    where: { id: SEED_PRODUCT_ICED_TEA_ID },
    update: {
      shopId: shop.id,
      categoryId: categoryBeverages.id,
      name: "Iced Tea",
      description: "Refreshing brewed lemon iced tea served chilled with fresh mint leaves.",
      price: new Prisma.Decimal("60.00"),
      preparationTimeMins: 3,
      sortOrder: 1,
      isAvailable: true,
    },
    create: {
      id: SEED_PRODUCT_ICED_TEA_ID,
      shopId: shop.id,
      categoryId: categoryBeverages.id,
      name: "Iced Tea",
      description: "Refreshing brewed lemon iced tea served chilled with fresh mint leaves.",
      price: new Prisma.Decimal("60.00"),
      preparationTimeMins: 3,
      sortOrder: 1,
      isAvailable: true,
    },
  });

  console.log(
    `  ✔ Products (4): ${productVeggieWrap.name} (₹${productVeggieWrap.price}), ${productClassicBurger.name} (₹${productClassicBurger.price}), ${productMasalaFries.name} (₹${productMasalaFries.price}), ${productIcedTea.name} (₹${productIcedTea.price})`
  );

  return {
    campus: { id: campus.id, name: campus.name },
    shop: { id: shop.id, name: shop.name },
    categoriesCount: 3,
    productsCount: 4,
  };
}

async function main() {
  try {
    const result = await seed();
    console.log("✅ Seed completed successfully!");
    console.log(`   Summary: 1 Campus, 1 Shop, ${result.categoriesCount} Categories, ${result.productsCount} Products.`);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].includes("seed")) {
  main();
}
