-- Lab 4 rollback: removes everything added by migration *_lab4_actions_taken.
-- Lab 1–3 data (Users, Tickets, Attachments, Comments, Notes) is NOT touched.
-- WARNING: all Actions Taken and status history rows are lost.
-- Usage (from server/):
--   npx prisma db execute --file prisma/rollback/lab4_down.sql --schema prisma/schema.prisma
-- Then restore the Lab 3 schema.prisma (git checkout main -- prisma/schema.prisma).
BEGIN;

DROP TABLE IF EXISTS "ActionTaken";
DROP TABLE IF EXISTS "TicketStatusChange";
DROP TYPE IF EXISTS "ActionStatus";

DROP INDEX IF EXISTS "Ticket_currentStatus_ownerId_idx";
DROP INDEX IF EXISTS "Ticket_requesterId_currentStatus_idx";
DROP INDEX IF EXISTS "Ticket_updatedAt_idx";

ALTER TABLE "Ticket"
  DROP COLUMN IF EXISTS "closedAt",
  DROP COLUMN IF EXISTS "requesterMarkedResolvedAt",
  DROP COLUMN IF EXISTS "resolvedAt",
  DROP COLUMN IF EXISTS "version";

DELETE FROM "_prisma_migrations" WHERE "migration_name" LIKE '%_lab4_actions_taken';

COMMIT;
