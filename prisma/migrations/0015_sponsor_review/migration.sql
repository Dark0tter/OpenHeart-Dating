-- AlterTable
ALTER TABLE "SponsorPlacement" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "dailyCap" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "staffNotes" TEXT;

-- CreateTable
CREATE TABLE "SponsorDailyStat" (
    "placementId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "appViews" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SponsorDailyStat_pkey" PRIMARY KEY ("placementId","day")
);

-- AddForeignKey
ALTER TABLE "SponsorDailyStat" ADD CONSTRAINT "SponsorDailyStat_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "SponsorPlacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

