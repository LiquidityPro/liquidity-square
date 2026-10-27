-- AlterTable
ALTER TABLE "users" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "staff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "posts" ADD COLUMN "removedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN "status" "ReportStatus" NOT NULL DEFAULT 'open',
ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_verified_idx" ON "users"("verified");

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- Drop report targets that no longer point at an account, then enforce the link.
UPDATE "reports" SET "userId" = NULL
WHERE "userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "reports"."userId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('verify', 'unverify', 'remove_post', 'restore_post', 'suspend', 'restore_account', 'grant_staff', 'revoke_staff', 'dismiss_report');

-- CreateTable
CREATE TABLE "moderation_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "targetUserId" TEXT,
    "targetPostId" TEXT,
    "reportId" TEXT,
    "note" VARCHAR(280) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_events_createdAt_idx" ON "moderation_events"("createdAt");

-- AddForeignKey
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The desk log is only read through the API. Deny the Supabase Data API roles.
ALTER TABLE "moderation_events" ENABLE ROW LEVEL SECURITY;
