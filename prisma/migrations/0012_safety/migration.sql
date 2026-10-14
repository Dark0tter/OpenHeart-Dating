-- CreateTable
CREATE TABLE "SafetyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingWith" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "checkInBy" TIMESTAMP(3) NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "remindedAt" TIMESTAMP(3),
    "alertedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafetyCheckIn_status_checkInBy_idx" ON "SafetyCheckIn"("status", "checkInBy");

-- CreateIndex
CREATE INDEX "SafetyCheckIn_userId_idx" ON "SafetyCheckIn"("userId");

-- AddForeignKey
ALTER TABLE "SafetyCheckIn" ADD CONSTRAINT "SafetyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

