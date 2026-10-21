-- AlterTable
ALTER TABLE "shops" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "shops_isActive_idx" ON "shops"("isActive");
