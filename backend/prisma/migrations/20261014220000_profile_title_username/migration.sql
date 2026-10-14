-- AlterTable
ALTER TABLE "users" ADD COLUMN "username" VARCHAR(20),
ADD COLUMN "title" VARCHAR(80),
ADD COLUMN "titleChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
