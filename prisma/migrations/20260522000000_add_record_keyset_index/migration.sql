-- Supports keyset pagination for the default table row order.
CREATE INDEX "Record_tableId_createdAt_id_idx" ON "Record"("tableId", "createdAt", "id");
