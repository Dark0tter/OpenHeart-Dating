-- CreateEnum
CREATE TYPE "ContentTier" AS ENUM ('STANDARD', 'ADULT_TEXT', 'WEB_ONLY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appAdultContent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "KinkCategory" ADD COLUMN     "tier" "ContentTier" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Kink" ADD COLUMN     "tier" "ContentTier" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "SponsorPlacement" ADD COLUMN     "contentTier" "ContentTier" NOT NULL DEFAULT 'WEB_ONLY';

