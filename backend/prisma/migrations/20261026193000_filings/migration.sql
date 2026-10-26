-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'filings';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "filingsSeenAt" TIMESTAMP(3),
ADD COLUMN "filingNudgeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "filings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "symbol" VARCHAR(12) NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "filings_key_key" ON "filings"("key");

-- CreateIndex
CREATE INDEX "filings_filedAt_idx" ON "filings"("filedAt");
