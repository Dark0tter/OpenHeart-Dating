-- AlterTable
ALTER TABLE "User" ADD COLUMN     "themeFlag" TEXT,
ADD COLUMN     "themeMode" TEXT NOT NULL DEFAULT 'system';

