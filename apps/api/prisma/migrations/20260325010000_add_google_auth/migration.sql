-- AlterTable: replace name with firstName/lastName, make password/username nullable, add Google fields
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
ALTER TABLE "User" ADD COLUMN "isOnboarded" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing name data to firstName (put full name in firstName)
UPDATE "User" SET "firstName" = "name", "lastName" = '' WHERE "firstName" IS NULL;

-- Set NOT NULL after backfill
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;

-- Drop old name column
ALTER TABLE "User" DROP COLUMN "name";

-- Make password nullable
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Make username nullable
ALTER TABLE "User" ALTER COLUMN "username" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
