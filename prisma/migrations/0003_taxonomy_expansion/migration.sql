-- AlterTable
ALTER TABLE "KinkCategory" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "RelationshipStyleTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "RelationshipStyleTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileRelationshipStyleTag" (
    "profileId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ProfileRelationshipStyleTag_pkey" PRIMARY KEY ("profileId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipStyleTag_slug_key" ON "RelationshipStyleTag"("slug");

-- AddForeignKey
ALTER TABLE "ProfileRelationshipStyleTag" ADD CONSTRAINT "ProfileRelationshipStyleTag_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRelationshipStyleTag" ADD CONSTRAINT "ProfileRelationshipStyleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "RelationshipStyleTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

