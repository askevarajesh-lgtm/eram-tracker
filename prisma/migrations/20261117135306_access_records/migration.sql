-- "Users & access" entries are records for tracking licence/access allocation, not app users.
-- Rename BusinessUser -> AccessRecord (and its columns) so nobody mistakes them for sign-in accounts.
-- Pure renames: no data is dropped.

ALTER TABLE "BusinessUser" RENAME TO "AccessRecord";
ALTER TABLE "AccessRecord" RENAME CONSTRAINT "BusinessUser_pkey" TO "AccessRecord_pkey";
ALTER TABLE "AccessRecord" RENAME CONSTRAINT "BusinessUser_companyId_fkey" TO "AccessRecord_companyId_fkey";
ALTER INDEX "BusinessUser_companyId_idx" RENAME TO "AccessRecord_companyId_idx";

ALTER TABLE "LicenceAssignment" RENAME COLUMN "userId" TO "recordId";
ALTER TABLE "LicenceAssignment" RENAME CONSTRAINT "LicenceAssignment_userId_fkey" TO "LicenceAssignment_recordId_fkey";
ALTER INDEX "LicenceAssignment_userId_idx" RENAME TO "LicenceAssignment_recordId_idx";

ALTER TABLE "Meeting" RENAME COLUMN "userIds" TO "inviteeRecordIds";
