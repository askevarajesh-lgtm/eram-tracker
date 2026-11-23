-- App access per person and system becomes a table (with role and date) instead of an id array.

CREATE TABLE "AppAccess" (
    "recordId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "grantedOn" DATE,

    CONSTRAINT "AppAccess_pkey" PRIMARY KEY ("recordId","projectId")
);
CREATE INDEX "AppAccess_projectId_idx" ON "AppAccess"("projectId");
ALTER TABLE "AppAccess" ADD CONSTRAINT "AppAccess_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AccessRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppAccess" ADD CONSTRAINT "AppAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- keep any access already stored in the old array column
INSERT INTO "AppAccess" ("recordId", "projectId")
SELECT a."id", p."id"
FROM "AccessRecord" a
CROSS JOIN LATERAL unnest(a."apps") AS x(pid)
JOIN "Project" p ON p."id" = x.pid
ON CONFLICT DO NOTHING;

ALTER TABLE "AccessRecord" DROP COLUMN "apps";

ALTER TABLE "Licence" ALTER COLUMN "audience" SET DEFAULT 'endusers';
ALTER TABLE "Issue" ALTER COLUMN "priority" SET DEFAULT 'Normal';
