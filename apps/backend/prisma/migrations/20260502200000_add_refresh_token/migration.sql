-- AlterTable: add refresh token fields to users
ALTER TABLE "users" ADD COLUMN "refreshTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "refreshTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_refreshTokenHash_key" ON "users"("refreshTokenHash");
