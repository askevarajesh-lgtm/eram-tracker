-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "files" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "files" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "developerId" TEXT,
    "date" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move data the old app kept in "extra" into the new columns/table.
UPDATE "Task" SET "files" = "extra"->'files', "extra" = "extra" - 'files' WHERE jsonb_typeof("extra"->'files') = 'array';
UPDATE "Issue" SET "files" = "extra"->'files', "extra" = "extra" - 'files' WHERE jsonb_typeof("extra"->'files') = 'array';

INSERT INTO "TimeEntry" ("id", "taskId", "developerId", "date", "hours", "note")
SELECT gen_random_uuid()::text, t."id",
       (SELECT d."id" FROM "Developer" d WHERE d."id" = e->>'dev'),
       (e->>'d')::date, (e->>'h')::numeric, COALESCE(e->>'n', '')
FROM "Task" t
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t."extra"->'time') = 'array' THEN t."extra"->'time' ELSE '[]'::jsonb END) AS e
WHERE (e->>'d') ~ '^\d{4}-\d{2}-\d{2}$' AND (e->>'h') ~ '^\d+(\.\d+)?$';
UPDATE "Task" SET "extra" = "extra" - 'time' WHERE "extra" ? 'time';
