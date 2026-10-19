-- DropIndex
DROP INDEX "orders_orderNumber_idx";

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
