/**
 * Safe Reset to Seed Baseline
 * Deletes non-seed test records and returns database to pristine seed baseline.
 */

try {
  process.loadEnvFile?.(".env");
} catch {}

import { prisma } from "../src/core/db/prisma";
import {
  SEED_SHOP_ID,
  SEED_CATEGORY_HOT_MEALS_ID,
  SEED_CATEGORY_QUICK_BITES_ID,
  SEED_CATEGORY_BEVERAGES_ID,
  SEED_PRODUCT_VEGGIE_WRAP_ID,
  SEED_PRODUCT_CLASSIC_BURGER_ID,
  SEED_PRODUCT_MASALA_FRIES_ID,
  SEED_PRODUCT_ICED_TEA_ID,
} from "../prisma/seed";

async function main() {
  const seedProductIds = [
    SEED_PRODUCT_VEGGIE_WRAP_ID,
    SEED_PRODUCT_CLASSIC_BURGER_ID,
    SEED_PRODUCT_MASALA_FRIES_ID,
    SEED_PRODUCT_ICED_TEA_ID,
  ];
  const seedCategoryIds = [
    SEED_CATEGORY_HOT_MEALS_ID,
    SEED_CATEGORY_QUICK_BITES_ID,
    SEED_CATEGORY_BEVERAGES_ID,
  ];

  await prisma.orderItem.deleteMany({});
  await prisma.paymentRecord.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.staffSession.deleteMany({});
  await prisma.staffInvitation.deleteMany({});
  await prisma.shopMember.deleteMany({});
  await prisma.product.deleteMany({ where: { id: { notIn: seedProductIds } } });
  await prisma.category.deleteMany({ where: { id: { notIn: seedCategoryIds } } });
  await prisma.shop.deleteMany({ where: { id: { not: SEED_SHOP_ID } } });
  await prisma.profile.deleteMany({});
  await prisma.user.deleteMany({});

  // Reset seed products to isAvailable: true
  await prisma.product.updateMany({
    where: { id: { in: seedProductIds } },
    data: { isAvailable: true },
  });

  // Reset seed shop to isOpen: true
  await prisma.shop.update({
    where: { id: SEED_SHOP_ID },
    data: { isOpen: true },
  });

  console.log("✔ Non-seed test records safely removed. Baseline restored.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
