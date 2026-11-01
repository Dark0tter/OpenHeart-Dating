-- Rename the former kink taxonomy into a general interest taxonomy and remove
-- legacy explicit categories/profile choices from existing databases.

ALTER TYPE "KinkInterestLevel" RENAME TO "InterestLevel";

ALTER TABLE "ProfileKink" DROP CONSTRAINT "ProfileKink_kinkId_fkey";
ALTER TABLE "ProfileKink" DROP CONSTRAINT "ProfileKink_profileId_fkey";
ALTER TABLE "Kink" DROP CONSTRAINT "Kink_categoryId_fkey";
ALTER TABLE "ChatRoom" DROP CONSTRAINT "ChatRoom_kinkCategoryId_fkey";

ALTER TABLE "KinkCategory" RENAME TO "InterestCategory";
ALTER TABLE "Kink" RENAME TO "Interest";
ALTER TABLE "ProfileKink" RENAME TO "ProfileInterest";

ALTER TABLE "InterestCategory" RENAME CONSTRAINT "KinkCategory_pkey" TO "InterestCategory_pkey";
ALTER TABLE "Interest" RENAME CONSTRAINT "Kink_pkey" TO "Interest_pkey";

ALTER TABLE "ProfileInterest" RENAME COLUMN "kinkId" TO "interestId";
ALTER TABLE "ChatRoom" RENAME COLUMN "kinkCategoryId" TO "interestCategoryId";
ALTER TABLE "SponsorPlacement" RENAME COLUMN "targetKinkSlugs" TO "targetInterestSlugs";

ALTER TYPE "RoomKind" RENAME VALUE 'KINK_CATEGORY' TO 'INTEREST_CATEGORY';
ALTER TYPE "EventKind" RENAME VALUE 'MUNCH' TO 'MEETUP';

ALTER TABLE "Interest"
  ADD CONSTRAINT "Interest_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "InterestCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileInterest"
  ADD CONSTRAINT "ProfileInterest_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileInterest"
  ADD CONSTRAINT "ProfileInterest_interestId_fkey"
  FOREIGN KEY ("interestId") REFERENCES "Interest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatRoom"
  ADD CONSTRAINT "ChatRoom_interestCategoryId_fkey"
  FOREIGN KEY ("interestCategoryId") REFERENCES "InterestCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER INDEX "KinkCategory_slug_key" RENAME TO "InterestCategory_slug_key";
ALTER INDEX "Kink_slug_key" RENAME TO "Interest_slug_key";
ALTER INDEX "Kink_categoryId_idx" RENAME TO "Interest_categoryId_idx";
ALTER INDEX "ProfileKink_kinkId_level_idx" RENAME TO "ProfileInterest_interestId_level_idx";
ALTER INDEX "ProfileKink_pkey" RENAME TO "ProfileInterest_pkey";

DELETE FROM "ChatRoom" WHERE "interestCategoryId" IS NOT NULL;
DELETE FROM "ProfileInterest";
DELETE FROM "Interest";
DELETE FROM "InterestCategory";
UPDATE "SponsorPlacement" SET "targetInterestSlugs" = ARRAY[]::TEXT[];

UPDATE "Photo" SET "visibility" = 'PRIVATE' WHERE "visibility" = 'ADULT';
DELETE FROM "ConsentRequest" WHERE "scope" = 'ADULT_ALBUM';
DELETE FROM "ConsentGrant" WHERE "scope" = 'ADULT_ALBUM';

ALTER TABLE "User" DROP COLUMN "appAdultContent";
