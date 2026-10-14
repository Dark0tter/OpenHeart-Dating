-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "staffAlertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JobState" (
    "key" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobState_pkey" PRIMARY KEY ("key")
);

