-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ConsentScope" ADD VALUE 'PRIVATE_ALBUM';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "thumbKey" TEXT,
ADD COLUMN     "width" INTEGER;

-- CreateTable
CREATE TABLE "BlockedImageHash" (
    "hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedImageHash_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "SelfieVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT,
    "gesture" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "SelfieVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "scope" "ConsentScope" NOT NULL,
    "status" "MessageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SelfieVerification_status_createdAt_idx" ON "SelfieVerification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SelfieVerification_userId_idx" ON "SelfieVerification"("userId");

-- CreateIndex
CREATE INDEX "ConsentRequest_ownerId_status_idx" ON "ConsentRequest"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRequest_requesterId_ownerId_scope_key" ON "ConsentRequest"("requesterId", "ownerId", "scope");

-- CreateIndex
CREATE INDEX "Photo_status_createdAt_idx" ON "Photo"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SelfieVerification" ADD CONSTRAINT "SelfieVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

