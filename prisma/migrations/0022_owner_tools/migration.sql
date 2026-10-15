-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recoveryCodes" TEXT[],
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "SponsorInquiry" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "city" TEXT,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT,
    "token" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'info',
    "websiteOnly" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SponsorInquiry_status_createdAt_idx" ON "SponsorInquiry"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_token_key" ON "WaitlistEntry"("token");

-- CreateIndex
CREATE INDEX "WaitlistEntry_confirmedAt_idx" ON "WaitlistEntry"("confirmedAt");

-- CreateIndex
CREATE INDEX "Announcement_startsAt_idx" ON "Announcement"("startsAt");

