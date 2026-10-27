-- CreateEnum
CREATE TYPE "Badge" AS ENUM ('none', 'member', 'professional', 'distinguished');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "badge" "Badge" NOT NULL DEFAULT 'none';

-- Existing verified accounts become professionals. Gold stays a desk decision.
UPDATE "users" SET "badge" = 'professional' WHERE "verified" = true;

-- DropIndex
DROP INDEX "users_verified_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "verified";

-- CreateIndex
CREATE INDEX "users_badge_idx" ON "users"("badge");

-- CreateEnum
CREATE TYPE "BadgeApplicationStatus" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "badge_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(80),
    "firm" VARCHAR(80) NOT NULL,
    "proofUrl" VARCHAR(300) NOT NULL,
    "note" VARCHAR(280) NOT NULL,
    "status" "BadgeApplicationStatus" NOT NULL DEFAULT 'pending',
    "granted" "Badge",
    "decisionNote" VARCHAR(280),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "badge_applications_status_createdAt_idx" ON "badge_applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "badge_applications_userId_createdAt_idx" ON "badge_applications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "badge_applications" ADD CONSTRAINT "badge_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "ModerationAction" ADD VALUE 'grant_member';
ALTER TYPE "ModerationAction" ADD VALUE 'grant_professional';
ALTER TYPE "ModerationAction" ADD VALUE 'grant_distinguished';
ALTER TYPE "ModerationAction" ADD VALUE 'clear_badge';
ALTER TYPE "ModerationAction" ADD VALUE 'decline_application';

-- The application queue is only read through the API.
ALTER TABLE "badge_applications" ENABLE ROW LEVEL SECURITY;
