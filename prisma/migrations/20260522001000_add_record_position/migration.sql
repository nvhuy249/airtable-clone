ALTER TABLE "Record" ADD COLUMN IF NOT EXISTS "position" INTEGER;

WITH numbered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY "tableId" ORDER BY "createdAt", id) - 1 AS position
  FROM "Record"
)
UPDATE "Record" r
SET "position" = numbered.position
FROM numbered
WHERE numbered.id = r.id;

ALTER TABLE "Record" ALTER COLUMN "position" SET DEFAULT 0;
ALTER TABLE "Record" ALTER COLUMN "position" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Record_tableId_position_id_idx" ON "Record"("tableId", "position", "id");
