-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'quote';
ALTER TYPE "NotificationType" ADD VALUE 'alert';

-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('up', 'down', 'either');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'harassment', 'misinformation', 'other');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN "quoteId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "symbol" TEXT,
ADD COLUMN "summary" VARCHAR(180),
ALTER COLUMN "actorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "watches" (
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watches_pkey" PRIMARY KEY ("userId","symbol")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "thresholdPct" DOUBLE PRECISION NOT NULL,
    "direction" "AlertDirection" NOT NULL DEFAULT 'either',
    "lastFiredSession" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("userId","symbol")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "stance" "Stance",
    "position" INTEGER NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "userId" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("userId","pollId")
);

-- CreateTable
CREATE TABLE "mutes" (
    "userId" TEXT NOT NULL,
    "mutedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutes_pkey" PRIMARY KEY ("userId","mutedId")
);

-- CreateTable
CREATE TABLE "blocks" (
    "userId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("userId","blockedId")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "postId" TEXT,
    "userId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "note" VARCHAR(280),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "posts_quoteId_idx" ON "posts"("quoteId");

-- CreateIndex
CREATE INDEX "tickers_sector_idx" ON "tickers"("sector");

-- CreateIndex
CREATE INDEX "watches_userId_createdAt_idx" ON "watches"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "price_alerts_symbol_idx" ON "price_alerts"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "polls_postId_key" ON "polls"("postId");

-- CreateIndex
CREATE INDEX "poll_options_pollId_position_idx" ON "poll_options"("pollId", "position");

-- CreateIndex
CREATE INDEX "poll_votes_optionId_idx" ON "poll_votes"("optionId");

-- CreateIndex
CREATE INDEX "poll_votes_createdAt_idx" ON "poll_votes"("createdAt");

-- CreateIndex
CREATE INDEX "blocks_blockedId_idx" ON "blocks"("blockedId");

-- CreateIndex
CREATE INDEX "reports_reporterId_createdAt_idx" ON "reports"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_postId_idx" ON "reports"("postId");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watches" ADD CONSTRAINT "watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watches" ADD CONSTRAINT "watches_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutes" ADD CONSTRAINT "mutes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutes" ADD CONSTRAINT "mutes_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
