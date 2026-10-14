-- AlterTable
ALTER TABLE "Verification" ADD COLUMN     "identityHash" TEXT;

-- AlterTable
ALTER TABLE "SafetyCheckIn" ADD COLUMN     "alertFailedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BannedIdentity" (
    "hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedIdentity_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "BannedIdentity_userId_idx" ON "BannedIdentity"("userId");

-- Rows left behind by accounts deleted before this relation existed.
DELETE FROM "Subscription" WHERE "userId" NOT IN (SELECT "id" FROM "User");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

