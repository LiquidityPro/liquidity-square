-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'disclosure';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "href" VARCHAR(500);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "disclosureCursor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "disclosure_receipts" (
    "userId" TEXT NOT NULL,
    "filingKey" VARCHAR(64) NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disclosure_receipts_pkey" PRIMARY KEY ("userId","filingKey")
);

-- CreateIndex
CREATE INDEX "disclosure_receipts_userId_filedAt_idx" ON "disclosure_receipts"("userId", "filedAt");

-- AddForeignKey
ALTER TABLE "disclosure_receipts" ADD CONSTRAINT "disclosure_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
