-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "note" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "showBadge" BOOLEAN NOT NULL DEFAULT true;

