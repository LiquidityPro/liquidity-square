-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" VARCHAR(280) NOT NULL,
    "stance" "Stance",
    "poll" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drafts_authorId_updatedAt_idx" ON "drafts"("authorId", "updatedAt");

-- CreateIndex
CREATE INDEX "drafts_scheduledFor_idx" ON "drafts"("scheduledFor");

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
